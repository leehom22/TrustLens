import os
import uuid
import cv2
import numpy as np
from PIL import Image
from typing import List, Any
from ..core.config import logger, EVIDENCE_DIR
from ..utils.schemas import LayerResult, LayerStatus
from ..utils.visualizer import generate_hud, generate_pdf_hud
from ..utils.layer2_utils import (
    calculate_image_coverage,
    classify_image_mode,
    analyze_noise_residual,
    analyze_blackness_consistency,
    calculate_ela_metrics,
    analyze_pdf_structure_page,
    analyze_ats_hacking,
    pil_to_cv2
)

import logging
logging.getLogger("pdfminer").setLevel(logging.ERROR)

# Poppler Check
try:
    from pdf2image import convert_from_path
    POPPLER_AVAILABLE = True
except ImportError:
    POPPLER_AVAILABLE = False

def pdf_to_images(pdf_path: str, max_pages: int = 5) -> List[Any]:
    if not POPPLER_AVAILABLE: return []
    try:
        return convert_from_path(pdf_path, dpi=150, first_page=1, last_page=max_pages)
    except Exception:
        return []

def save_evidence(img_cv, prefix="ev"):
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}.jpg"
    path = os.path.join(EVIDENCE_DIR, filename)
    cv2.imwrite(path, img_cv)
    return f"/evidence/{filename}"

def run_layer_2_ela(file_path: str, file_type: str, l3_data: dict = None) -> LayerResult:
    try:
        l3_data = l3_data or {}
        is_pdf = (file_type == "application/pdf")
        
        # 1. 模式判定 (Type Classification)
        mode = "unknown"
        if is_pdf:
            coverage = calculate_image_coverage(file_path)
            mode = "scanned_pdf" if coverage > 0.80 else "native_pdf"

        # 2. 准备图像
        images = []
        if is_pdf:
            if POPPLER_AVAILABLE:
                images = pdf_to_images(file_path, max_pages=8)
            else:
                return LayerResult(layer_name="L2_Visual", status=LayerStatus.SKIPPED, score=0, details={"error": "Poppler missing"})
        else:
            try:
                images = [Image.open(file_path).convert("RGB")]
            except:
                pass

        if not images:
            return LayerResult(layer_name="L2_Visual", status=LayerStatus.ERROR, score=0, details={"error": "No images loaded"})

        # 3. 逐页分析
        page_evidence_list = []
        max_score = 0
        all_signals = set()
        
        for idx, pil_img in enumerate(images):
            cv_img = pil_to_cv2(pil_img)
            page_score = 0
            heatmap = None
            masks = {} # 收集当前页所有的检测框
            
            # =========================================================
            # PATH A: PDF Pipeline (All PDFs run Noise Residual)
            # =========================================================
            if is_pdf:
                # 1. Base Layer: Noise Residual (通用基础层)
                # 无论是 Native 还是 Scanned，都计算噪声残差
                noise_res = analyze_noise_residual(cv_img)
                noise_score = noise_res["score"]
                if noise_res.get("mask") is not None:
                    masks["Noise_Anomaly"] = noise_res["mask"]

                # 如果是 Native PDF，噪声分通常为 0 (除非有插入图)，所以不作为主要评分依据，除非很高
                # 如果是 Scanned PDF，这是主要评分依据
                if mode == "scanned_pdf":
                    page_score = max(page_score, noise_score)
                    if noise_score > 30: 
                        all_signals.add(f"Inconsistent Noise (Page {idx+1})")
                        masks["Noise_Anomaly"] = noise_res["mask"]
                else:
                    # Native PDF 下，只有极高的噪声异常才算数 (插入图)
                    if noise_score > 50:
                        page_score = max(page_score, noise_score)
                        all_signals.add("High Noise Island in Native PDF")
                        masks["Noise_Anomaly"] = noise_res["mask"]

                # 2. Specific Add-on: Native PDF Structure Checks
                if mode == "native_pdf":
                    struct_res = analyze_pdf_structure_page(file_path, idx)
                    ats_res = analyze_ats_hacking(file_path, idx, cv_img) # 会在 cv_img 上画红字
                    
                    # 累加分数
                    page_score = max(page_score, struct_res["score"], ats_res["score"])
                    
                    # 收集 Masks
                    if ats_res["mask"] is not None: masks["ATS_HACK"] = ats_res["mask"]
                    
                    # 收集信号
                    if struct_res["score"] > 0: all_signals.add(f"Structure Anomaly (Page {idx+1})")
                    for sig in ats_res["signals"]: all_signals.add(sig)

                # 3. Visualization: PDF 统一使用 Noise Map 做数据流
                # 这样 Native 和 Scanned 的视觉风格就统一了
                heatmap = generate_hud(
                    cv_img, 
                    noise_res["noise_map"], # Base Data Stream
                    masks, 
                    page_score, 
                    variant="NOISE" # 面板显示 Noise Z-Score
                )

            # =========================================================
            # PATH B: Image Pipeline (All JPEGs run ELA)
            # =========================================================
            else:
                mode = classify_image_mode(pil_img)

                # 1. Base Layer: ELA (通用基础层)
                ela_metrics = calculate_ela_metrics(pil_img)
                z = ela_metrics["max_z_score"]
                ela_score = 0
                if z > 3.0: ela_score = min(100, int((z - 3.0) * 20))
                
                # Photo 模式下，ELA 是主宰
                if mode == "photo":
                    page_score = max(page_score, ela_score)
                    if ela_score > 40:
                        all_signals.add("Compression Artifacts")
                    if ela_metrics.get("mask") is not None:
                        masks["ELA_Anomaly"] = ela_metrics["mask"]
                
                # 2. Specific Add-on: Screenshot Checks
                else:  # native_digital
                    blackness_res = analyze_blackness_consistency(cv_img)
                    page_score = max(page_score, blackness_res["score"])
                    if blackness_res.get("mask") is not None:
                        masks["BlackLevel"] = blackness_res["mask"]   # 沿用原有键名，HUD颜色不变
                    if blackness_res["score"] > 0:
                        all_signals.add("Inconsistent Blackness Detected")
                    
                    # 这里暂时没有 BlackLevel 的 mask，如果有可以加进 masks 字典

                # 3. Visualization: Image 统一使用 ELA Image 做数据流
                heatmap = generate_hud(
                    cv_img, 
                    ela_metrics["ela_image"], # Base Data Stream
                    masks, 
                    page_score, 
                    variant="ELA" # 面板显示 ELA Z-Score
                )

            # 保存证据
            ev_url = save_evidence(heatmap, prefix=f"p{idx+1}")
            page_evidence_list.append({
                "page": idx + 1,
                "score": page_score,
                "evidence_url": ev_url
            })
            max_score = max(max_score, page_score)

        # 4. 汇总结果
        worst_page = max(page_evidence_list, key=lambda x: x["score"])
        
        status = LayerStatus.CLEAN
        if max_score > 75: status = LayerStatus.HIGH_RISK
        elif max_score > 35: status = LayerStatus.SUSPICIOUS

        return LayerResult(
            layer_name="L2_Visual",
            status=status,
            score=max_score,
            risk_signals=list(all_signals),
            details={
                "mode": mode,
                "total_pages": len(images),
                "page_evidence": page_evidence_list,
                "worst_page": worst_page["page"]
            },
            visual_evidence_url=worst_page["evidence_url"]
        )

    except Exception as e:
        logger.error(f"L2 Error: {e}")
        return LayerResult(layer_name="L2_Visual", status=LayerStatus.ERROR, score=0, details={"error": str(e)})