import os
import uuid
import io
import numpy as np
from PIL import Image, ImageChops, ImageEnhance, ImageStat
from ..utils.config import logger, EVIDENCE_DIR, PDF_ELA_MAX_PAGES
from ..utils.schemas import LayerResult, LayerStatus
from ..utils.utils import downsample_image


# ================ Poppler Check ====================
try:
    from pdf2image import convert_from_path
    POPPLER_AVAILABLE = True
except ImportError:
    POPPLER_AVAILABLE = False
    logger.warning("⚠️ Poppler/pdf2image missing. PDF Visual ELA will be disabled.")


# ================= Split document into pages function (not exceeds max pages) =========================
def pdf_to_ela_pages(pdf_path: str, max_pages: int = PDF_ELA_MAX_PAGES):
    if not POPPLER_AVAILABLE: return []
    try:
        # Render into 150 dpi
        # - PDF document usually with 72dpi to 150dpi resolution, over-resolved may occupy a great amount of RAM but doesn't give higher quality analysis
        # - dpi value too small may be overlay by noise pixels, but too large will affect the accuracy of the global standard deviation of noise pixels
        pages = convert_from_path(pdf_path, dpi=150, first_page=1, last_page=max_pages) 
        return [downsample_image(p) for p in pages]
    except Exception as e:
        logger.error(f"PDF convert error: {e}")
        return []


# ========================= Statistical Analysis Function ==================================
def calculate_ela_metrics(diff_img: Image.Image, grid_size: int):
    
    # 1. Retrieve grayscale data
    gray_ela = diff_img.convert("L")
    w, h = gray_ela.size
    ela_array = np.array(gray_ela)
    
    # 2. Global Data as standard (population mean and population standard deviation)
    global_mean = np.mean(ela_array)
    global_std = np.std(ela_array)
    
    # The noise values are discrete integers (0 - 255), if the overall deviation of each grids in global image < 0.5 (half of discrete integer),
    # it has a high possibility as a pure colour image,
    # while set as a constant of 0.5 is to prevent zero denominator in z-score calculation
    if global_std < 0.5: global_std = 0.5

    suspicious_grids = 0
    max_local_mean = 0
    
    # 3. Iterates through Local Grids Data
    for x in range(0, w, grid_size):
        for y in range(0, h, grid_size):
            box = ela_array[y:min(y+grid_size, h), x:min(x+grid_size, w)]
            if box.size == 0: continue
            
            local_mean = np.mean(box)
            max_local_mean = max(max_local_mean, local_mean)
            
            # z-score of the local sample (deviation of the local grid noise from the global noise)
            z_score = (local_mean - global_mean) / global_std
            
            # In normal distribution, only 0.1% of data have z-score > 3.0, which can consider as anomalies or outliers
            if z_score > 3.0 and local_mean > 10:
                suspicious_grids += 1

    # 4. Indicate the greatest anomalies
    overall_max_z = (max_local_mean - global_mean) / global_std
    
    return {
        "global_mean": float(global_mean),
        "max_z_score": float(overall_max_z),
        "suspicious_grids": suspicious_grids
    }


# ================================= Execution ====================================
def run_layer_2_ela(file_path: str, file_type: str) -> LayerResult:
    try:
        images = []
        if file_type.startswith("image/"):
            with Image.open(file_path) as raw_img:
                raw_img.load()
                images = [downsample_image(raw_img.convert("RGB"))]   # load and convert images into RGB
        elif file_type == "application/pdf":
            images = pdf_to_ela_pages(file_path)
            if not images and not POPPLER_AVAILABLE:
                return LayerResult(layer_name="L2_Visual", status=LayerStatus.SKIPPED, score=0, details={"reason": "Poppler missing"})
            if not images:
                return LayerResult(layer_name="L2_Visual", status=LayerStatus.ERROR, score=0, details={"error": "PDF conversion failed"})
        else:
            return LayerResult(layer_name="L2_Visual", status=LayerStatus.SKIPPED, score=0, details={"reason": "Unsupported Type"})

        page_results = []
        
        for idx, original in enumerate(images):
            # 1. Generate ELA in RAM (buffer)
            with io.BytesIO() as buffer:
                original.save(buffer, "JPEG", quality=90)
                buffer.seek(0)
                resaved = Image.open(buffer)
                ela_img = ImageChops.difference(original, resaved)
            
            # 2. Scale the min to max noise values into 0-255 scale
            extrema = ela_img.getextrema()
            max_diff = max([ex[1] for ex in extrema]) or 1
            scale = 255.0 / max_diff
            visual_ela = ImageEnhance.Brightness(ela_img).enhance(scale)

            # 3. Generate heatmap
            heatmap_name = f"heatmap_{uuid.uuid4().hex[:8]}_p{idx+1}.jpg"
            heatmap_path = os.path.join(EVIDENCE_DIR, heatmap_name)
            visual_ela.save(heatmap_path)

            # 4. Split into grids and execute statistic function
            w, h = ela_img.size
            grid_size = max(32, min(w, h) // 25)
            metrics = calculate_ela_metrics(ela_img, grid_size)
            
            # 5. Confidence Level Threshold
            # If the global mean of noise > 15, which indicates the document probably scanned, low-quality or with complex background / contents, 
            # confidence level of the ELA statistics is low
            is_noisy_source = metrics["global_mean"] > 15
            confidence = "LOW" if is_noisy_source else "HIGH"
            


            # ================== Evaluation =================
            page_score = 0
            if confidence == "HIGH":
                if metrics["max_z_score"] > 4.0: page_score += 40   # great anomalies
                if metrics["suspicious_grids"] > 2: page_score += 40   # great number of abnormal grids
                if metrics["suspicious_grids"] > 0: page_score += 10
            else:
                # Loosen the judging standard for low-confidence analysis (z-score > 5.0)
                if metrics["max_z_score"] > 5.0: page_score += 10
            
            page_results.append({
                "page": idx + 1,
                "score": min(page_score, 100),
                "url": f"/evidence/{heatmap_name}",
                "metrics": metrics,
                "confidence": confidence,
                "note": "Scan/Low Quality" if is_noisy_source else "Native Digital"
            })

        if not page_results: 
            return LayerResult(layer_name="L2_Visual", status=LayerStatus.CLEAN, score=0, details={})
        

        # ======================== Fianl Evaluation =======================

        # The final judging depends on the page with worst result (highest score)
        worst = max(page_results, key=lambda x: x["score"])
        
        status = LayerStatus.CLEAN
        l2_signals = []
        
        if worst["score"] > 70:
            status = LayerStatus.HIGH_RISK
            l2_signals.append(f"Visual manipulation detected (Z-Score: {worst['metrics']['max_z_score']:.1f})")
        elif worst["score"] > 30:
            status = LayerStatus.SUSPICIOUS
            l2_signals.append("Suspicious visual inconsistency found")
            
        if worst["confidence"] == "LOW":
            l2_signals.append("Note: Source image quality is low/scanned, ELA reliability is reduced.")


        # ====================== Final Output ====================
        return LayerResult(
            layer_name = "L2_Visual",
            status = status,
            score = worst["score"],
            risk_signals = l2_signals,
            details = {
                "analyzed_pages": len(images), 
                "worst_page_details": worst,
                "all_pages_details": page_results,
                "forensic_note": "Z-Score analysis used."
            },
            visual_evidence_url = worst["url"]
        )

    except Exception as e:
        logger.error(f"ELA Logic Error: {e}", extra={"request_id": "internal"})
        return LayerResult(layer_name="L2_Visual", status=LayerStatus.ERROR, score=0, details={"error": str(e)})