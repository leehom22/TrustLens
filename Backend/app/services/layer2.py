import os
import uuid
import cv2
import numpy as np
from PIL import Image
from typing import List, Any
from ..core.config import logger, EVIDENCE_DIR
from ..utils.schemas import LayerResult, LayerStatus
from ..utils.visualizer import generate_hud
from ..utils.layer2_utils import (
    calculate_image_coverage,
    analyze_statistical_island,
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
    if not POPPLER_AVAILABLE:
        return []
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
        is_pdf = (file_type == "application/pdf")

        # 1. 模式判定 (Type Classification)
        mode = "unknown"
        if is_pdf:
            coverage = calculate_image_coverage(file_path)
            mode = "scanned_pdf" if coverage > 0.80 else "native_pdf"
        else:
            mode = "image"   # 所有非PDF统一归为image

        logger.info(f"Layer 2 Mode: {mode}")

        # 2. 准备图像
        images = []
        if is_pdf:
            if POPPLER_AVAILABLE:
                images = pdf_to_images(file_path, max_pages=8)
            else:
                return LayerResult(layer_name="L2_Visual", status=LayerStatus.SKIPPED, score=0,
                                   details={"error": "Poppler missing"})
        else:
            try:
                images = [Image.open(file_path).convert("RGB")]
            except Exception as e:
                return LayerResult(layer_name="L2_Visual", status=LayerStatus.ERROR, score=0,
                                   details={"error": f"Cannot open image: {e}"})

        if not images:
            return LayerResult(layer_name="L2_Visual", status=LayerStatus.ERROR, score=0,
                               details={"error": "No images loaded"})

        # 3. 逐页分析
        page_evidence_list = []
        max_score = 0
        all_signals = set()

        for idx, pil_img in enumerate(images):
            cv_img = pil_to_cv2(pil_img)
            page_score = 0
            masks = {}
            diff_map = None   # 用于HUD的数据流

            # ========== PDF处理 ==========
            if is_pdf:
                if mode == "scanned_pdf":
                    # 扫描PDF：统计孤岛检测
                    analysis = analyze_statistical_island(cv_img)
                    page_score = analysis["score"]
                    if analysis.get("mask") is not None:
                        masks["Statistical_Island"] = analysis["mask"]
                    diff_map = analysis["noise_map"]
                    if page_score > 30:
                        all_signals.add(f"Statistical Discontinuity (Page {idx+1})")
                else:  # native_pdf
                    # 原生PDF：结构 + ATS
                    struct_res = analyze_pdf_structure_page(file_path, idx)
                    ats_res = analyze_ats_hacking(file_path, idx, cv_img)
                    page_score = max(struct_res["score"], ats_res["score"])
                    if ats_res.get("mask") is not None:
                        masks["ATS_HACK"] = ats_res["mask"]
                    if struct_res["score"] > 0:
                        all_signals.add(f"Structure Anomaly (Page {idx+1})")
                    for sig in ats_res["signals"]:
                        all_signals.add(sig)
                    # Native PDF没有噪声图，用原图灰度作为diff_map（HUD仍可显示）
                    diff_map = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

            # ========== 图片处理（JPEG/PNG等）==========
            else:
                analysis = analyze_statistical_island(cv_img)
                page_score = analysis["score"]
                if analysis.get("mask") is not None:
                    masks["Statistical_Island"] = analysis["mask"]
                diff_map = analysis["noise_map"]
                if page_score > 30:
                    all_signals.add("Statistical Discontinuity Detected")

            # 生成HUD（统一使用variant="NOISE"即可，HUD内显示文字可后续调整）
            heatmap = generate_hud(
                cv_img,
                diff_map,
                masks,
                page_score,
                variant="NOISE"   # HUD上显示什么由内部逻辑决定，这里不再区分
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
        if max_score > 75:
            status = LayerStatus.HIGH_RISK
        elif max_score > 35:
            status = LayerStatus.SUSPICIOUS

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
        return LayerResult(layer_name="L2_Visual", status=LayerStatus.ERROR, score=0,
                           details={"error": str(e)})