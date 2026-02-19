import cv2
import numpy as np
import pdfplumber
import pikepdf
from PIL import Image
from typing import Dict, Any, List
from ..core.config import logger
import io

# ================= 基础工具 =================

def pil_to_cv2(pil_image):
    return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

# ================= 统计孤岛检测核心（通用版） =================

def analyze_statistical_island(cv_img: np.ndarray, block_size: int = 32) -> Dict[str, Any]:
    """
    统计孤岛检测：适用于扫描件和图片（JPEG/PNG）
    返回：
        score: 基于最大连通异常块数的风险分数 (0-100)
        mask: 异常区域的二值掩膜（用于HUD高亮）
        noise_map: 残差图（用于HUD数据流）
        max_cluster_blocks: 最大连通块数（用于调试）
    """
    if len(cv_img.shape) == 3:
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    else:
        gray = cv_img

    # 1. 中值滤波提取残差
    denoised = cv2.medianBlur(gray, 5)
    noise_map = cv2.absdiff(gray, denoised)

    h, w = noise_map.shape
    rows = h // block_size
    cols = w // block_size
    if rows == 0 or cols == 0:
        return {"score": 0, "mask": None, "noise_map": noise_map, "max_cluster_blocks": 0}

    # 2. 分块计算标准差
    std_map = np.zeros((rows, cols))
    for r in range(rows):
        for c in range(cols):
            y = r * block_size
            x = c * block_size
            block = noise_map[y:y+block_size, x:x+block_size]
            std_map[r, c] = np.std(block)

    # 3. 局部邻域对比（当前块与周围8邻域均值比较）
    anomaly_map = np.zeros_like(std_map, dtype=np.uint8)
    for r in range(rows):
        for c in range(cols):
            r_min = max(0, r-1)
            r_max = min(rows, r+2)
            c_min = max(0, c-1)
            c_max = min(cols, c+2)
            neighbor_vals = std_map[r_min:r_max, c_min:c_max]
            local_mean = np.mean(neighbor_vals)
            if std_map[r, c] > local_mean * 1.2:   # 阈值1.2可调
                anomaly_map[r, c] = 1

    # 4. 连通聚类（在块级进行）
    num_labels, labels = cv2.connectedComponents(anomaly_map, connectivity=8)
    if num_labels <= 1:
        max_cluster_blocks = 0
        mask = None
    else:
        cluster_sizes = []
        mask = np.zeros((h, w), dtype=np.uint8)
        for i in range(1, num_labels):
            cluster_blocks = np.sum(labels == i)
            cluster_sizes.append(cluster_blocks)
            # 将聚类映射到像素级掩膜
            ys, xs = np.where(labels == i)
            for yb, xb in zip(ys, xs):
                y1 = yb * block_size
                x1 = xb * block_size
                y2 = min((yb+1) * block_size, h)
                x2 = min((xb+1) * block_size, w)
                mask[y1:y2, x1:x2] = 255
        max_cluster_blocks = max(cluster_sizes)

    # 5. 评分：基于最大连通块数
    score = min(100, int(max_cluster_blocks * 15))   # 系数15可调

    return {
        "score": score,
        "mask": mask,
        "noise_map": noise_map,
        "max_cluster_blocks": max_cluster_blocks
    }

# ================= PDF 结构检测（Native PDF专用） =================

def analyze_pdf_structure_page(pdf_path: str, page_idx: int) -> Dict[str, Any]:
    """
    分析特定页面的 PDF 结构 (对象插入、字体子集)
    """
    score = 0
    details = {}
    try:
        with pikepdf.open(pdf_path) as pdf:
            if page_idx >= len(pdf.pages):
                return {"score": 0}
            page = pdf.pages[page_idx]
            if '/Resources' in page.keys():
                res = page['/Resources']
                if '/XObject' in res.keys():
                    xobjs = res['/XObject']
                    if len(xobjs) > 10:
                        score += 20
                        details["excessive_objects"] = True
                if '/Font' in res.keys():
                    fonts = res['/Font']
                    subsets = 0
                    for f in fonts.keys():
                        basefont = str(fonts[f].get('/BaseFont', ''))
                        if '+' in basefont:
                            subsets += 1
                    if subsets > 3:
                        score += 15
                        details["mixed_font_subsets"] = True
    except Exception:
        pass
    return {"score": min(100, score), "details": details}

def analyze_ats_hacking(pdf_path: str, page_idx: int, cv_img: np.ndarray) -> Dict[str, Any]:
    """
    [Native PDF专用] ATS关键词注入检测 & 显影
    返回：
        score: 风险分数
        mask: 可疑区域掩膜
        signals: 信号列表
    """
    result = {
        "score": 0,
        "mask": None,
        "signals": [],
        "details": {"hidden_count": 0, "tiny_count": 0}
    }
    h, w = cv_img.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    try:
        with pdfplumber.open(pdf_path) as pdf:
            if page_idx >= len(pdf.pages):
                return result
            page = pdf.pages[page_idx]
            scale_x = w / page.width
            scale_y = h / page.height

            hidden_chars = []
            for char in page.chars:
                is_suspicious = False
                reason = ""
                c = char.get('non_stroking_color')
                if c is not None:
                    if c == (1,) or c == [1] or c == (1,1,1) or c == [1,1,1]:
                        is_suspicious = True
                        reason = "White"
                    elif len(c) == 4 and sum(c) == 0:
                        is_suspicious = True
                        reason = "White"
                size = char.get('size', 10)
                if size < 2.0:
                    is_suspicious = True
                    reason = "Tiny"
                    result["details"]["tiny_count"] += 1

                if is_suspicious:
                    text_char = char.get('text', '')
                    if not text_char or text_char.isspace():
                        continue
                    hidden_chars.append(char)
                    if reason == "White":
                        result["details"]["hidden_count"] += 1

                    x0 = int(char['x0'] * scale_x)
                    top = int(char['top'] * scale_y)
                    x1 = int(char['x1'] * scale_x)
                    bottom = int(char['bottom'] * scale_y)
                    cv2.rectangle(mask, (x0-2, top-2), (x1+2, bottom+2), 255, -1)

                    if x1 > x0 and bottom > top:
                        sub_img = cv_img[top:bottom, x0:x1]
                        if sub_img.size > 0:
                            white_rect = np.full_like(sub_img, (200,200,255))
                            cv2.addWeighted(sub_img, 0.5, white_rect, 0.5, 0, sub_img)
                            cv_img[top:bottom, x0:x1] = sub_img
                        font_scale = max(0.4, (bottom - top) / 30.0)
                        cv2.putText(cv_img, text_char, (x0, bottom-2),
                                    cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0,0,255), 1)

            total_suspicious = len(hidden_chars)
            if total_suspicious > 5:
                result["score"] = min(100, 50 + total_suspicious * 2)
                result["mask"] = mask
                if result["details"]["hidden_count"] > 0:
                    result["signals"].append("Invisible White Text (ATS Hacking)")
                if result["details"]["tiny_count"] > 0:
                    result["signals"].append("Micro-Font Injection (<2pt)")
    except Exception as e:
        logger.warning(f"ATS Check Error: {e}")

    return result

# ================= PDF 分流工具（保留） =================

def calculate_image_coverage(pdf_path: str) -> float:
    """
    计算 PDF 全文的平均图片覆盖率，用于区分扫描件和原生PDF
    """
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                return 0.0
            total_ratio = 0.0
            pages_checked = 0
            for page in pdf.pages[:5]:
                page_area = page.width * page.height
                if page_area == 0:
                    continue
                img_area = sum([img['width'] * img['height'] for img in page.images])
                total_ratio += (img_area / page_area)
                pages_checked += 1
            if pages_checked == 0:
                return 0.0
            return min(total_ratio / pages_checked, 1.0)
    except Exception as e:
        logger.warning(f"Image coverage calc failed: {e}")
        return 0.0