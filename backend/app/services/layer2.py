import os
import uuid
import io
import cv2
import numpy as np
from PIL import Image, ImageChops, ImageEnhance
from ..core.config import logger, EVIDENCE_DIR, PDF_ELA_MAX_PAGES
from ..utils.schemas import LayerResult, LayerStatus
from ..utils.utils import downsample_image
from ..utils.visualizer import generate_hud
from ..utils.layer2_utils import (
    calculate_ela_metrics, 
    analyze_fused_forensics,     # Black level detection
    analyze_texture_consistency, # Texture detection (Native/Mixed)
    # analyze_alignment_consistency, # Alignment detection
    analyze_ats_hacking,         # ATS Hacking (New)
    analyze_statistical_islands, # Statistical Island (New)
    calculate_image_coverage,
    pil_to_cv2
)
import platform
import logging
import shutil


logging.getLogger("pdfminer").setLevel(logging.ERROR)

if platform.system() == "Windows":
    POPPLER_PATH = r"C:\poppler-25.12.0\Library\bin"
else:
    POPPLER_PATH = None  # Linux uses system PATH
def check_poppler():
    if platform.system() == "Windows" and POPPLER_PATH:
        target_exe = os.path.join(POPPLER_PATH, "pdftoppm.exe")
        if os.path.exists(target_exe):
            return True
    return shutil.which("pdftoppm") is not None

# ================ Poppler Check ====================
try:
    from pdf2image import convert_from_path
    POPPLER_AVAILABLE = True
except ImportError:
    POPPLER_AVAILABLE = False
    logger.warning("⚠️ Poppler/pdf2image missing. PDF Visual ELA will be disabled.")

POPPLER_INSTALLED = check_poppler()

# ================= Split document into pages function =========================
def pdf_to_ela_pages(pdf_path: str, max_pages: int = PDF_ELA_MAX_PAGES):
    if not POPPLER_AVAILABLE: return []
    if not POPPLER_INSTALLED:
        logger.error("Poppler binary NOT found in system PATH. PDF analysis will fail.")
        return []
    try:
        # [Optimization] Memory protection: Read in chunks (generators) to prevent OOM
        # Although it returns a List at the end for interface compatibility, the intermediate process is safer.
        pages_list = []
        for i in range(1, max_pages + 1):
            try:
                # Request only one page at a time
                if POPPLER_PATH:
                    page_batch = convert_from_path(
                        pdf_path,
                        dpi=150,
                        first_page=i,
                        last_page=i,
                        poppler_path=POPPLER_PATH
                    )
                else:
                    page_batch = convert_from_path(
                        pdf_path,
                        dpi=150,
                        first_page=i,
                        last_page=i
                    )
                if not page_batch: break
                pages_list.append(downsample_image(page_batch[0]))
            except Exception:
                break # Stop on page number overflow or other errors
        return pages_list
    except Exception as e:
        logger.error(f"PDF convert error: {e}")
        return []


# ================================= Execution ====================================
def run_layer_2_ela(file_path: str, file_type: str) -> LayerResult:
    try:
        images = []
        is_pdf = False
        pdf_is_scanned = False

        if file_type.startswith("image/"):
            with Image.open(file_path) as raw_img:
                raw_img.load()
                images = [downsample_image(raw_img.convert("RGB"))]
        elif file_type == "application/pdf":
            is_pdf = True

            coverage = calculate_image_coverage(file_path)
            # Threshold: If > 80% of the page is image, it's a scan.
            if coverage > 0.8:
                pdf_is_scanned = True
                logger.info(f"PDF Analysis: Detected SCANNED document (Image Coverage: {coverage:.2f})")
            else:
                pdf_is_scanned = False
                logger.info(f"PDF Analysis: Detected NATIVE digital document (Image Coverage: {coverage:.2f})")

            images = pdf_to_ela_pages(file_path)
            if not images and not POPPLER_AVAILABLE:
                return LayerResult(layer_name="L2_Visual", status=LayerStatus.SKIPPED, score=0, details={"reason": "Poppler missing"})
            if not images:
                return LayerResult(layer_name="L2_Visual", status=LayerStatus.ERROR, score=0, details={"error": "PDF conversion failed"})
        else:
            return LayerResult(layer_name="L2_Visual", status=LayerStatus.SKIPPED, score=0, details={"reason": "Unsupported Type"})


        page_results = []
        l2_signals = [] 
        max_visual_score = 0

        global_max_breakdown = {
            "ATS_Hacking": 0.0,
            "Black_Level": 0.0,
            "Texture": 0.0
        }

        ats_total_hidden = 0
        ats_total_tiny = 0
        ats_score = 0

        for idx, original in enumerate(images):
            cv_img = pil_to_cv2(original)
            h, w = cv_img.shape[:2]
            gray_img = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
            
            # ================= MODE DETERMINATION =================
            if is_pdf:
                # For PDF, stick to the global classification we calculated earlier
                is_native_digital = not pdf_is_scanned
            else:
                # Calculate Laplacian Variance to classify Native vs Noisy
                lap_var = cv2.Laplacian(gray_img, cv2.CV_64F).var()
                
                # Threshold: > 80-100 implies noise/scan. < 80 implies clean digital.
                is_native_digital = lap_var < 100 
            
            mode_str = "NATIVE" if is_native_digital else "NOISY"
            
            # ================= ALGORITHM WEIGHTS =================
            # Define confidence weights based on mode
            if is_native_digital:
                w_black = 1.0
                w_texture = max(0, (0.4 - coverage))  # Weak Signal: Texture less reliable as image coverage increases
                w_island = 0.0   # Disable statistical island for clean images
            else:
                w_black = 0.2    # Black level unreliable in scans
                w_texture = 0.0  # Texture less effective in noisy scans
                w_island = 1.0   # Statistical island designed for scans
            
            # Initialize Masks Collection for HUD
            meta_collection = {
                "ATS":        {"mask": None, "color": (255, 0, 255),   "conf": 1.0 if (is_pdf and is_native_digital) else 0.0}, # Magenta
                "BlackLevel": {"mask": None, "color": (255, 255, 0),   "conf": w_black},   # Cyan
                "Texture":    {"mask": None, "color": (0, 255, 255),   "conf": w_texture}, # Yellow
                "Island":     {"mask": None, "color": (0, 165, 255),   "conf": w_island},  # Orange
                # "Alignment":  {"mask": None, "color": (0, 255, 0),     "conf": w_align}    # Green
            }
            
            # ================= DETECTORS =================
            
            # 1. ATS Hacking (Native PDF Only)
            ats_score = 0
            if is_pdf and is_native_digital:
                ats_res = analyze_ats_hacking(file_path, idx, cv_img) # Note: cv_img modified in-place for visualization
                if ats_res["score"] > 0:
                    ats_score = ats_res["score"]
                    meta_collection["ATS"]["mask"] = ats_res["mask"] 
                    l2_signals.extend([f"{s}" for s in ats_res["signals"]])

                    ats_total_hidden += ats_res["details"].get("hidden_count", 0)
                    ats_total_tiny += ats_res["details"].get("tiny_count", 0)

            # 2. Black Level Detection (Fused Forensics)
            # Use pre-computed contours if native for speed
            shared_contours = None
            if is_native_digital:
                mean_brightness = np.mean(gray_img)
                thresh_type = cv2.THRESH_BINARY if mean_brightness < 100 else cv2.THRESH_BINARY_INV
                _, thresh = cv2.threshold(gray_img, 200, 255, thresh_type)
                shared_contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            raw_black_score, black_mask, black_sigs = analyze_fused_forensics(cv_img, pre_contours=shared_contours)
            # Apply Confidence
            final_black_score = raw_black_score * w_black
            if raw_black_score > 0 and w_black > 0.3: # Only report if confidence is decent
                 l2_signals.extend([f"Page {idx+1}: {s}" for s in black_sigs])
            meta_collection["BlackLevel"]["mask"] = black_mask

            # 3. Texture / Statistical Island
            final_texture_score = 0
            
            if is_native_digital:
                if w_texture > 0:
                    # Use Standard Texture Check with low weight
                    raw_tex_score, tex_mask, tex_sigs = analyze_texture_consistency(cv_img, is_photo=False)
                    final_texture_score = int(raw_tex_score * w_texture)
                    if raw_tex_score > 0 and final_texture_score > 20:
                        l2_signals.extend([f"Page {idx+1}: {s} (Low Conf)" for s in tex_sigs])
                    meta_collection["Texture"]["mask"] = tex_mask
            else:
                # Use Statistical Island for Noisy/Scans
                raw_island_score, island_mask, island_sigs = analyze_statistical_islands(cv_img)
                final_texture_score = raw_island_score * w_island # Island replaces texture score
                if raw_island_score > 0:
                    l2_signals.extend([f"Page {idx+1}: {s}" for s in island_sigs])
                meta_collection["Island"]["mask"] = island_mask

            # 4. Alignment
            """
            raw_align_score, align_mask, align_sigs = analyze_alignment_consistency(
                cv_img, pre_contours=shared_contours, is_photo=(not is_native_digital)
            )
            final_align_score = raw_align_score * w_align
            if raw_align_score > 0 and w_align >= 0.5:
                l2_signals.extend([f"Page {idx+1}: {s}" for s in align_sigs])
            meta_collection["Alignment"]["mask"] = align_mask
            """

            # ================= SCORING AGGREGATION =================
            # Max of all weighted scores
            advanced_score = max(ats_score, final_black_score, final_texture_score)   # final_align_score
            max_visual_score = max(max_visual_score, advanced_score)

            global_max_breakdown["ATS_Hacking"] = max(global_max_breakdown["ATS_Hacking"], ats_score)
            global_max_breakdown["Black_Level"] = max(global_max_breakdown["Black_Level"], final_black_score)
            global_max_breakdown["Texture"] = max(global_max_breakdown["Texture"], final_texture_score)

            # ================= ELA (For Reference & HUD) =================
            with io.BytesIO() as buffer:
                original.save(buffer, "JPEG", quality=90)
                buffer.seek(0)
                resaved = Image.open(buffer)
                ela_img = ImageChops.difference(original, resaved)
            
            grid_size = max(32, min(w, h) // 25)
            metrics = calculate_ela_metrics(ela_img, grid_size)
            
            # ELA Score (Conservative)
            ela_page_score = 0
            # Only trust ELA high score if it's Native Digital and metrics are extreme
            if is_native_digital and metrics["max_z_score"] > 3.0 and metrics["suspicious_grids"] > 2:
                ela_page_score = 40
                l2_signals.append(f"Page {idx+1}: ELA compression anomalies detected.")
            
            # Combine Advanced + ELA
            current_page_score = max(advanced_score, ela_page_score)
            current_page_score = min(current_page_score, 100)

            # ================= HUD GENERATION =================
            ela_cv = pil_to_cv2(ela_img)
            try:
                # Filter None masks
                active_masks = {k: v for k, v in meta_collection.items() if v is not None}
                
                heatmap_cv = generate_hud(
                    cv_img,          # Original (with ATS red text drawn if any)
                    ela_cv,          # ELA
                    active_masks,    # All masks
                    int(current_page_score)
                )
            except Exception as e:
                logger.error(f"Visualizer Error: {e}")
                heatmap_cv = cv_img

            # Save
            heatmap_name = f"heatmap_{uuid.uuid4().hex[:8]}_p{idx+1}.jpg"
            heatmap_path = os.path.join(EVIDENCE_DIR, heatmap_name)
            cv2.imwrite(heatmap_path, heatmap_cv)

            page_results.append({
                "page": idx + 1,
                "score": current_page_score,
                "breakdown": {
                    "ATS_Hacking": ats_score,
                    "Black_Level": final_black_score,
                    "Texture": final_texture_score
                },
                "url": f"/evidence/{heatmap_name}",
                "local_path": os.path.abspath(heatmap_path),
                "metrics": metrics
            })

        if not page_results: 
            return LayerResult(layer_name="L2_Visual", status=LayerStatus.CLEAN, score=0, details={})

        # ================= FINAL RESULT =================
        worst = max(page_results, key=lambda x: x["score"])
        final_score = int(worst["score"])
        
        status = LayerStatus.CLEAN
        if final_score > 70: status = LayerStatus.HIGH_RISK
        elif final_score > 30: status = LayerStatus.SUSPICIOUS
        
        l2_signals = list(set(l2_signals))
        
        if final_score > 60:
            l2_signals.append("VISUAL_TAMPERING_DETECTED")
        if any("ATS_Hacking" in s for s in l2_signals):
            l2_signals = [s.replace("ATS_Hacking", "ATS_HACKING_DETECTED") if "ATS_Hacking" in s else s for s in l2_signals]
            if "ATS_HACKING_DETECTED" not in l2_signals:
                l2_signals.append("ATS_HACKING_DETECTED")

        return LayerResult(
            layer_name = "L2_Visual",
            status = status,
            score = final_score,
            risk_signals = l2_signals,
            details = {
                "analyzed_pages": len(images), 
                "all_pages": page_results,
                "worst_page_details": worst,
                "advanced_score_breakdown": global_max_breakdown,
                "ats_hacking_details": {
                    "hidden_white_chars": ats_total_hidden,
                    "micro_font_chars": ats_total_tiny
                } if (ats_total_hidden > 0 or ats_total_tiny > 0) else None,
                "mode": mode_str,
                "forensic_note": "Hybrid Architecture: Native(ATS/BlackLevel/ELA) vs Noisy(Islands/Texture/ELA).",
            },
            ATS_Hacking = "Detected" if any("ATS_HACKING_DETECTED" in s for s in l2_signals) else "None",
            visual_evidence_url = worst["url"]
        )
        
    except Exception as e:
        logger.error(f"Layer 2 Error: {e}")
        return LayerResult(layer_name="L2_Visual", status=LayerStatus.ERROR, score=0, details={"error": str(e)})