import os
import uuid
import tempfile
from PIL import Image, ImageChops, ImageEnhance, ImageStat
from ..utils.config import logger, EVIDENCE_DIR, PDF_ELA_MAX_PAGES
from ..utils.schemas import LayerResult, LayerStatus
from ..utils.utils import downsample_image

# Poppler Check
try:
    from pdf2image import convert_from_path
    POPPLER_AVAILABLE = True
except ImportError:
    POPPLER_AVAILABLE = False
    logger.warning("⚠️ Poppler/pdf2image missing. PDF Visual ELA will be disabled.")

def pdf_to_ela_pages(pdf_path: str, max_pages: int = PDF_ELA_MAX_PAGES):
    if not POPPLER_AVAILABLE: return []
    try:
        pages = convert_from_path(pdf_path, dpi=150, first_page=1, last_page=max_pages)
        return [downsample_image(p) for p in pages]
    except Exception as e:
        logger.error(f"PDF convert error: {e}")
        return []

def run_layer_2_ela(file_path: str, file_type: str) -> LayerResult:
    try:
        images = []
        if file_type.startswith("image/"):
            images = [downsample_image(Image.open(file_path).convert("RGB"))]
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
            # 1. Generate ELA
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=True) as tmp:
                original.save(tmp.name, "JPEG", quality=90)
                resaved = Image.open(tmp.name)
                ela_img = ImageChops.difference(original, resaved)
            
            # 2. Enhance
            extrema = ela_img.getextrema()
            max_diff = max([ex[1] for ex in extrema]) or 1
            scale = 255.0 / max_diff
            ela_img = ImageEnhance.Brightness(ela_img).enhance(scale)

            heatmap_name = f"heatmap_{uuid.uuid4().hex[:8]}_p{idx+1}.jpg"
            heatmap_path = os.path.join(EVIDENCE_DIR, heatmap_name)
            ela_img.save(heatmap_path)

            # 3. Dynamic Grid Scan
            gray_ela = ela_img.convert("L")
            w, h = gray_ela.size
            grid_size = max(32, min(w, h) // 25) 
            
            suspicious_grids = 0
            stat_global = ImageStat.Stat(gray_ela)
            global_avg = stat_global.mean[0]

            for x in range(0, w, grid_size):
                for y in range(0, h, grid_size):
                    box = (x, y, min(x + grid_size, w), min(y + grid_size, h))
                    region = gray_ela.crop(box)
                    local_avg = ImageStat.Stat(region).mean[0]
                    
                    if local_avg > (global_avg * 3.5) and local_avg > 18:
                        suspicious_grids += 1

            page_score = 0
            if global_avg > 20: page_score += 30
            if suspicious_grids > 0: page_score += 50
            
            page_results.append({
                "page": idx + 1,
                "score": min(page_score, 100),
                "url": f"/evidence/{heatmap_name}",
                "grid_size_used": grid_size,
                "suspicious_grids": suspicious_grids
            })

        if not page_results: return LayerResult(layer_name="L2_Visual", status=LayerStatus.CLEAN, score=0, details={})
        
        worst = max(page_results, key=lambda x: x["score"])
        status = LayerStatus.CLEAN
        if worst["score"] > 80: status = LayerStatus.HIGH_RISK
        elif worst["score"] > 30: status = LayerStatus.SUSPICIOUS

        return LayerResult(
            layer_name="L2_Visual",
            status=status,
            score=worst["score"],
            details={"analyzed_pages": len(images), "worst_page": worst},
            visual_evidence_url=worst["url"]
        )

    except Exception as e:
        logger.error(f"ELA Logic Error: {e}", extra={"request_id": "internal"})
        return LayerResult(layer_name="L2_Visual", status=LayerStatus.ERROR, score=0, details={"error": str(e)})