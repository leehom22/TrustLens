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
    analyze_texture_consistency, # Texture detection
    analyze_alignment_consistency, # Alignment detection
    pil_to_cv2
)

# ================ Poppler Check ====================
try:
    from pdf2image import convert_from_path
    POPPLER_AVAILABLE = True
except ImportError:
    POPPLER_AVAILABLE = False
    logger.warning("⚠️ Poppler/pdf2image missing. PDF Visual ELA will be disabled.")


# ================= Split document into pages function =========================
def pdf_to_ela_pages(pdf_path: str, max_pages: int = PDF_ELA_MAX_PAGES):
    if not POPPLER_AVAILABLE: return []
    try:
        # [Optimization] Memory protection: Read in chunks (generators) to prevent OOM
        # Although it returns a List at the end for interface compatibility, the intermediate process is safer.
        pages_list = []
        for i in range(1, max_pages + 1):
            try:
                # Request only one page at a time
                page_batch = convert_from_path(pdf_path, dpi=150, first_page=i, last_page=i)
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
        if file_type.startswith("image/"):
            with Image.open(file_path) as raw_img:
                raw_img.load()
                images = [downsample_image(raw_img.convert("RGB"))]
        elif file_type == "application/pdf":
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
        
        for idx, original in enumerate(images):
            cv_img = pil_to_cv2(original)
            
            # 1. Convert to grayscale
            gray_img = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
            
            # 2. Noise detection (Determine if it is a photo/scan or digital screenshot)
            lap_var = cv2.Laplacian(gray_img, cv2.CV_64F).var()
            is_noisy_source = lap_var > 80 # >80 is usually a photo or scan (high frequency noise)
            
            # 3. Unified text contour extraction (Only for clean screenshots, reducing repetitive overhead)
            shared_contours = None
            if not is_noisy_source:
                # Simple brightness check to adapt to Dark Mode screenshots
                mean_brightness = np.mean(gray_img)
                thresh_type = cv2.THRESH_BINARY if mean_brightness < 100 else cv2.THRESH_BINARY_INV
                _, thresh = cv2.threshold(gray_img, 200, 255, thresh_type)
                shared_contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # --- Call detection functions (Pass pre-computed parameters) ---
            
            # 1. Black level detection (For digital screenshots)
            black_score, black_mask, black_sigs = analyze_fused_forensics(
                cv_img, pre_contours=shared_contours
            )
            
            # 2. Texture detection (For photos/scans)
            tex_score, tex_mask, tex_sigs = analyze_texture_consistency(
                cv_img, is_photo=is_noisy_source
            )
            
            # 3. Alignment detection (For digital screenshots)
            align_score, align_mask, align_sigs = analyze_alignment_consistency(
                cv_img, pre_contours=shared_contours, is_photo=is_noisy_source
            )
            
            current_detection_score = max(black_score, tex_score, align_score)
            if current_detection_score > 0:
                max_visual_score = max(max_visual_score, current_detection_score)

            # --- Score Fusion Logic ---
            # Take the highest score among the three detectors (Max Voting)
            current_max = max(black_score, tex_score, align_score)
            
            if current_max > 0:
                max_visual_score = max(max_visual_score, current_max)
                
            # Collect signals
            if black_score > 0: l2_signals.extend([f"Page {idx+1}: {s}" for s in black_sigs])
            if tex_score > 0: l2_signals.extend([f"Page {idx+1}: {s}" for s in tex_sigs])
            if align_score > 0: l2_signals.extend([f"Page {idx+1}: {s}" for s in align_sigs])

            # --- 3. ELA Generation (Visual Base) ---
            with io.BytesIO() as buffer:
                original.save(buffer, "JPEG", quality=90)
                buffer.seek(0)
                resaved = Image.open(buffer)
                ela_img = ImageChops.difference(original, resaved)
            
            # --- 4. ELA Stats (Rigorous Z-Score) ---
            w, h = ela_img.size
            # Dynamically calculate grid size, usually 32 or smaller
            grid_size = max(32, min(w, h) // 25)
            # Calling the optimized vectorized version here
            metrics = calculate_ela_metrics(ela_img, grid_size)
            
            # Corrected judgment logic using data returned by metrics
            is_noisy_source_ela = metrics["global_mean"] > 15
            confidence = "LOW" if is_noisy_source_ela else "HIGH"

            # ELA Scoring Logic (Conservative)
            page_score = 0
            if confidence == "HIGH":
                # Deduct points only if Z-Score is extremely high and there are multiple suspicious grids
                if metrics["max_z_score"] > 4.5 and metrics["suspicious_grids"] > 2:
                    page_score = 40

            current_page_score = max(current_detection_score, page_score)
            current_page_score = min(current_page_score, 100)


            masks_collection = {
                "Texture": tex_mask,
                "BlackLevel": black_mask,
                "Alignment": align_mask
            }
            
            # Convert PIL ELA image to OpenCV format for HUD generation
            ela_cv = pil_to_cv2(ela_img)
            
            # Generate HUD with fused signals (This is the key innovation of Layer 2, providing visual explainability for the AI's decision)
            try:
                heatmap_cv = generate_hud(
                    cv_img,          # Original Image (OpenCV)
                    ela_cv,          # ELA Image (OpenCV)
                    masks_collection,   # All forensic masks for explainability
                    int(current_page_score)   # Final fused score for this page
                )
            except Exception as e:
                logger.error(f"Visualizer Error: {e}")
                # Fallback to basic ELA if HUD generation fails
                heatmap_cv = cv_img
            

            # --- 5. Save Heatmap ---
            heatmap_name = f"heatmap_{uuid.uuid4().hex[:8]}_p{idx+1}.jpg"
            heatmap_path = os.path.join(EVIDENCE_DIR, heatmap_name)
            cv2.imwrite(heatmap_path, heatmap_cv)

            page_results.append({
                "page": idx + 1,
                "score": min(page_score, 100),
                "url": f"/evidence/{heatmap_name}",
                "local_path": os.path.abspath(heatmap_path),
                "metrics": metrics,
                "confidence": confidence,
                "note": "Native Digital" if confidence == "HIGH" else "Scan/Noisy"
            })

        if not page_results: 
            return LayerResult(layer_name="L2_Visual", status=LayerStatus.CLEAN, score=0, details={})

        # ======================== Final Evaluation =======================
        worst = max(page_results, key=lambda x: x["score"])
        
        # Final score takes the maximum of (ELA Score) and (Advanced Detection Score)
        final_score = max(worst["score"], max_visual_score)
        final_score = min(final_score, 100)

        status = LayerStatus.CLEAN
        l2_signals = list(set(l2_signals))
        
        if final_score > 70:
            status = LayerStatus.HIGH_RISK
        elif final_score > 30:
            status = LayerStatus.SUSPICIOUS
            
        if worst["confidence"] == "LOW":
            l2_signals.append("Note: Source image quality is low/noisy, visual analysis reliability is reduced.")

        return LayerResult(
            layer_name = "L2_Visual",
            status = status,
            score = final_score,
            risk_signals = l2_signals,
            details = {
                "analyzed_pages": len(images), 
                "all_pages": page_results,
                "worst_page_details": worst,
                "advanced_analysis": {
                     "fused_check": "Triggered" if max_visual_score > 0 else "Pass"
                },
                "forensic_note": "Fused Analysis: ELA + Texture (for Photos) + Intensity (for Screenshots).",
                "visual_tampering": (final_score > 60 and worst["confidence"] == "HIGH")
            },
            visual_evidence_url = worst["url"]
        )
        
    except Exception as e:
        logger.error(f"Layer 2 Error: {e}")
        return LayerResult(layer_name="L2_Visual", status=LayerStatus.ERROR, score=0, details={"error": str(e)})