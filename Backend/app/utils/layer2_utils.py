import cv2
import numpy as np
import pdfplumber
import pikepdf
from PIL import Image, ImageChops
from typing import Dict, Any, List
import re
from ..core.config import logger
import io

# ================= 基础工具 =================

def pil_to_cv2(pil_image):
    return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

# ================= 0. 分流检测工具 =================

def calculate_image_coverage(pdf_path: str) -> float:
    """
    计算 PDF 全文的平均图片覆盖率
    """
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages: return 0.0
            
            total_ratio = 0.0
            pages_checked = 0
            
            # 只检查前 5 页以节省时间
            for page in pdf.pages[:5]:
                page_area = page.width * page.height
                if page_area == 0: continue
                
                img_area = sum([img['width'] * img['height'] for img in page.images])
                total_ratio += (img_area / page_area)
                pages_checked += 1
            
            if pages_checked == 0: return 0.0
            return min(total_ratio / pages_checked, 1.0)
    except Exception as e:
        logger.warning(f"Image coverage calc failed: {e}")
        return 0.0


def classify_image_mode(pil_img: Image.Image) -> str:
    """
    简单分类图像：自然照片(photo) 或 数字生成图像(native_digital)
    """
    img = np.array(pil_img.convert('RGB'))
    h, w = img.shape[:2]

    # 1. 颜色数量（降采样加速）
    small = cv2.resize(img, (100, 100), interpolation=cv2.INTER_AREA)
    colors = set(tuple(p) for row in small for p in row)
    num_colors = len(colors)

    # 2. 边缘方差（拉普拉斯）
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    edge_var = np.var(laplacian)

    # 启发式阈值（可根据实际数据调整）
    if num_colors < 3000 and edge_var > 150:
        return "native_digital"   # 原 screenshot
    else:
        return "photo"



# ================= 1. Noise Residual Core (针对 Scanned PDF) =================

def analyze_noise_residual(cv_img: np.ndarray, block_size: int = 32) -> Dict[str, Any]:
    """
    TrustLens 核心算法 V2: 带文字剔除的噪声残差分析
    """
    if len(cv_img.shape) == 3:
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    else:
        gray = cv_img
        
    # ---------------------------------------------------------
    # Step 0: 智能文字掩膜 (Text Masking)
    # ---------------------------------------------------------
    # 使用 Otsu 自动阈值找到文字 (前提是文字比纸黑)
    # THRESH_BINARY_INV: 文字变白(255)，背景变黑(0)
    _, text_mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    # 膨胀掩膜：文字边缘通常伴随高频伪影，我们需要把边缘也“吃掉”
    # 这样能保证我们只分析纯净的背景纸张
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    text_mask_dilated = cv2.dilate(text_mask, kernel, iterations=1)
    
    # ---------------------------------------------------------
    # Step 1: 提取噪声层
    # ---------------------------------------------------------
    denoised = cv2.medianBlur(gray, 3)
    noise_map = cv2.absdiff(gray, denoised)
    
    # ---------------------------------------------------------
    # Step 2: 滑动窗口统计 (只看背景！)
    # ---------------------------------------------------------
    h, w = noise_map.shape
    std_map = np.zeros((h // block_size, w // block_size))
    
    rows, cols = std_map.shape
    valid_blocks_count = 0
    background_stds = []
    
    for r in range(rows):
        for c in range(cols):
            y, x = r * block_size, c * block_size
            
            # 提取当前块的 噪声图 和 掩膜
            block_noise = noise_map[y:y+block_size, x:x+block_size]
            block_mask = text_mask_dilated[y:y+block_size, x:x+block_size]
            
            # 关键逻辑：只提取背景像素 (Mask == 0 的部分)
            bg_pixels = block_noise[block_mask == 0]
            
            # 如果这个块全是文字 (背景像素太少)，由于无法计算背景噪点，我们跳过它
            # 或者给它赋予一个相邻块的值（这里简化为0，后续忽略）
            if len(bg_pixels) < (block_size * block_size * 0.2): 
                std_map[r, c] = -1.0 # 标记为无效块
                continue
            
            # 计算背景像素的标准差
            std = np.std(bg_pixels)
            std_map[r, c] = std
            background_stds.append(std)

    # ---------------------------------------------------------
    # Step 3: 异常检测 (Statistical Island)
    # ---------------------------------------------------------
    if not background_stds:
        return {"score": 0, "mask": None, "noise_map": noise_map, "signals": []}
    
    # 将 -1 的无效块填充为全局中位数 (防止热力图出现黑洞)
    global_median = np.median(background_stds)
    global_std = np.std(background_stds)
    
    std_map[std_map == -1.0] = global_median
    
    # 阈值设定 (Hackathon 模式)
    # 重点抓“过平滑”区域 (P图涂改通常导致噪点消失)
    lower_thresh = max(0.1, global_median - 2.5 * global_std)
    # 也可以抓“过噪”区域 (来自不同噪点源的拼接)，但通常文字剔除后这个很难触发
    upper_thresh = global_median + 3.0 * global_std
    
    mask = np.zeros((h, w), dtype=np.uint8)
    anomaly_blocks = 0
    
    for r in range(rows):
        for c in range(cols):
            val = std_map[r, c]
            
            # 判定异常
            is_anomaly = False
            
            # Case 1: 异常平滑 (P图/涂改) -> 最常见的造假
            if val < lower_thresh:
                 # 防止把纯白边缘误判 (纯白边缘虽然平滑，但不是造假)
                 # 只有当全局噪声水平确实存在 (扫描件) 时，局部平滑才是问题
                 if global_median > 2.0: 
                     is_anomaly = True
            
            # Case 2: 异常嘈杂 (拼接)
            elif val > upper_thresh:
                is_anomaly = True
            
            if is_anomaly:
                anomaly_blocks += 1
                y, x = r * block_size, c * block_size
                cv2.rectangle(mask, (x, y), (x+block_size, y+block_size), 255, -1)
                
    # 4. 评分
    ratio = anomaly_blocks / std_map.size
    score = min(100, int(ratio * 1000))
    
    signals = []
    if score > 30:
        signals.append("Background Noise Inconsistency (Potential Erasure/Modification)")
        
    return {
        "score": score,
        "mask": mask,
        "noise_map": noise_map, 
        "text_mask": text_mask_dilated, # 调试用，可以看到遮罩效果
        "details": {"global_noise_level": float(global_median)}
    }

# ================= 2. Black Level Consistency (针对 Screenshot) =================

import numpy as np
import cv2
from scipy import stats  # 用于更稳健的异常检测

def analyze_blackness_consistency(cv_img: np.ndarray, iqr_multiplier: float = 1.5) -> Dict[str, Any]:
    """
    基于文字分群和组内黑度一致性检测篡改
    参数：
        cv_img: BGR 图像
        iqr_multiplier: 四分位距倍数，用于判定异常，越大越保守（默认1.5）
    返回：
        score: 0-100 风险分数
        mask: 二值掩膜，可疑区域为白色
    """
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    h_img, w_img = gray.shape

    # 1. 二值化（得到黑色前景为白色）
    binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, 11, 2)
    # 开运算去噪
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

    # 2. 连通组件分析
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if num_labels < 2:
        return {"score": 0, "mask": None}

    # 3. 过滤非文字组件
    components = []
    min_height = max(4, int(h_img * 0.005))
    max_height = int(h_img * 0.2)
    min_area = min_height * min_height // 2

    for i in range(1, num_labels):
        x, y, w, h, area = stats[i]
        if area < min_area:
            continue
        if h < min_height or h > max_height:
            continue
        aspect = w / h if h != 0 else 0
        if aspect > 8 or aspect < 0.2:
            continue
        # 提取该组件内的灰度值（只取前景像素）
        component_mask = (labels == i).astype(np.uint8) * 255
        component_pixels = gray[component_mask == 255]
        if len(component_pixels) == 0:
            continue
        median_blackness = np.median(component_pixels)  # 中位数灰度值
        components.append({
            "x": x, "y": y, "w": w, "h": h,
            "centroid": centroids[i],
            "median_blackness": median_blackness,
            "area": area,
            "index": i
        })

    if len(components) < 5:
        return {"score": 0, "mask": None}   # 组件太少，无法统计

    # 4. 按垂直中心排序，行聚类
    components.sort(key=lambda c: c["centroid"][1])  # y 坐标
    rows = []
    current_row = [components[0]]
    current_y = components[0]["centroid"][1]
    heights = [c["h"] for c in components]
    median_h = np.median(heights)
    y_threshold = median_h * 0.6

    for comp in components[1:]:
        y_center = comp["centroid"][1]
        if abs(y_center - current_y) <= y_threshold:
            current_row.append(comp)
            # 更新当前行平均 y
            current_y = (current_y + y_center) / 2
        else:
            rows.append(current_row)
            current_row = [comp]
            current_y = y_center
    rows.append(current_row)

    # 5. 行内黑度一致性分析
    mask = np.zeros(gray.shape, dtype=np.uint8)
    suspicious_count = 0
    total_components = 0

    for row in rows:
        if len(row) < 5:
            continue   # 行内元素太少无法做统计
        blackness_values = [c["median_blackness"] for c in row]
        # 使用中位数和四分位距检测异常
        q1, q3 = np.percentile(blackness_values, [20, 80])
        iqr = q3 - q1
        lower_bound = q1 - iqr_multiplier * iqr
        upper_bound = q3 + iqr_multiplier * iqr

        for comp in row:
            if comp["median_blackness"] < lower_bound or comp["median_blackness"] > upper_bound:
                suspicious_count += 1
                # 标记该组件区域（膨胀一点）
                x, y, w, h = comp["x"], comp["y"], comp["w"], comp["h"]
                cv2.rectangle(mask, (x-2, y-2), (x+w+2, y+h+2), 255, -1)
        total_components += len(row)

    # 6. 评分（基于可疑组件比例）
    if total_components == 0:
        score = 0
    else:
        ratio = suspicious_count / total_components
        # 将比例映射到 0-100，系数可根据需要调整（例如 ratio * 100 直接作为分数）
        score = min(100, int(ratio * 100))

    return {
        "score": score,
        "mask": mask if np.any(mask) else None
    }

# ================= 3. ELA (针对 Photo) =================

def calculate_ela_metrics(pil_img: Image.Image, block_size=32):
    """
    简化的 ELA 计算，返回 Z-Score、ELA 灰度图以及异常块掩膜
    """
    with io.BytesIO() as buf:
        pil_img.save(buf, "JPEG", quality=90)
        buf.seek(0)
        resaved = Image.open(buf)
        ela_img = ImageChops.difference(pil_img, resaved)
    
    ela_cv = pil_to_cv2(ela_img)
    gray_ela = cv2.cvtColor(ela_cv, cv2.COLOR_BGR2GRAY)
    
    mean = np.mean(gray_ela)
    std = np.std(gray_ela) + 1e-5
    max_val = np.max(gray_ela)
    
    z_score = (max_val - mean) / std

    # --- 新增：块级异常掩膜 ---
    h, w = gray_ela.shape
    rows, cols = h // block_size, w // block_size
    if rows == 0 or cols == 0:
        mask = None
    else:
        z_matrix = np.zeros((rows, cols))
        for r in range(rows):
            for c in range(cols):
                y, x = r * block_size, c * block_size
                block = gray_ela[y:y+block_size, x:x+block_size]
                block_mean = np.mean(block)
                z_block = abs((block_mean - mean) / std)
                z_matrix[r, c] = z_block

        anomaly_thresh = 2.5  # 可根据需要调整
        mask = np.zeros((h, w), dtype=np.uint8)
        for r in range(rows):
            for c in range(cols):
                if z_matrix[r, c] > anomaly_thresh:
                    y, x = r * block_size, c * block_size
                    cv2.rectangle(mask, (x, y), (x+block_size, y+block_size), 255, -1)

    return {
        "max_z_score": float(z_score),
        "ela_image": gray_ela,
        "mask": mask   # 关键：现在包含掩膜
    }

# ================= 4. Native PDF Checks (Structure) =================

def analyze_pdf_structure_page(pdf_path: str, page_idx: int) -> Dict[str, Any]:
    """
    分析特定页面的 PDF 结构 (对象插入、字体子集)
    """
    score = 0
    details = {}
    
    try:
        with pikepdf.open(pdf_path) as pdf:
            if page_idx >= len(pdf.pages): return {"score": 0}
            
            page = pdf.pages[page_idx]
            
            # 1. 资源字典检查 (Resources)
            if '/Resources' in page.keys():
                res = page['/Resources']
                
                # 检查 XObject (插入的图片/表单)
                if '/XObject' in res.keys():
                    xobjs = res['/XObject']
                    if len(xobjs) > 10: # 页面对象过多
                        score += 20
                        details["excessive_objects"] = True
                        
                # 检查 Font (字体子集变异)
                if '/Font' in res.keys():
                    fonts = res['/Font']
                    subsets = 0
                    for f in fonts.keys():
                        basefont = str(fonts[f].get('/BaseFont', ''))
                        if '+' in basefont: subsets += 1
                    
                    if subsets > 3: # 太多不同的字体子集
                        score += 15
                        details["mixed_font_subsets"] = True

            # 2. 内容流检查 (简单的叠加检测)
            # 这里不做深度 stream 解析，太慢且容易错，只给个基础分
            
    except Exception as e:
        pass
        
    return {"score": min(100, score), "details": details}


# ... (保留原有的 import)
# 确保 import pdfplumber

def analyze_ats_hacking(pdf_path: str, page_idx: int, cv_img: np.ndarray) -> Dict[str, Any]:
    """
    [Native PDF 专用] ATS 关键词注入检测 & 显影
    功能：
    1. 检测 White-on-White (纯白) 和 Tiny Text (微缩)
    2. 【新增】在 cv_img 上将这些隐藏文字用红色“显影”出来
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
            if page_idx >= len(pdf.pages): return result
            page = pdf.pages[page_idx]
            
            # 缩放比例 (PDF Point -> Image Pixel)
            scale_x = w / page.width
            scale_y = h / page.height
            
            hidden_chars = []
            
            # 遍历每一个字符
            for char in page.chars:
                is_suspicious = False
                reason = ""
                
                # --- 检测 1: 纯白文字 (White Text) ---
                c = char.get('non_stroking_color')
                if c is not None:
                    # RGB White (1, 1, 1) or Gray White (1,) or CMYK (0,0,0,0)
                    if c == (1,) or c == [1] or c == (1, 1, 1) or c == [1, 1, 1]:
                        is_suspicious = True
                        reason = "White"
                    elif len(c) == 4 and sum(c) == 0:
                        is_suspicious = True
                        reason = "White"
                        
                # --- 检测 2: 微缩文字 (Tiny Text) ---
                size = char.get('size', 10)
                if size < 2.0:
                    is_suspicious = True
                    reason = "Tiny"
                    result["details"]["tiny_count"] += 1
                
                # --- 显影逻辑 (Re-Inking) ---
                if is_suspicious:
                    text_char = char.get('text', '')
                    # 忽略空格和无意义字符
                    if not text_char or text_char.isspace():
                        continue
                        
                    hidden_chars.append(char)
                    if reason == "White": result["details"]["hidden_count"] += 1
                    
                    # 坐标转换
                    x0 = int(char['x0'] * scale_x)
                    top = int(char['top'] * scale_y)
                    x1 = int(char['x1'] * scale_x)
                    bottom = int(char['bottom'] * scale_y)
                    
                    # 1. 在 Mask 上绘制高亮区 (给 HUD 用)
                    # 稍微膨胀一点，让框连成片
                    cv2.rectangle(mask, (x0-2, top-2), (x1+2, bottom+2), 255, -1)
                    
                    # 2. 在原图上“显影” (Re-ink in Red)
                    # 只有当字符有实际宽度时才绘制
                    if x1 > x0 and bottom > top:
                        # 绘制一个淡红色的背景底衬，增加对比度
                        sub_img = cv_img[top:bottom, x0:x1]
                        if sub_img.size > 0:
                            white_rect = np.full_like(sub_img, (200, 200, 255)) # 淡红背景
                            cv2.addWeighted(sub_img, 0.5, white_rect, 0.5, 0, sub_img)
                            cv_img[top:bottom, x0:x1] = sub_img
                        
                        # 把字写出来 (用深红色)
                        # 注意：cv2.putText 不支持中文，如果是英文关键词注入效果最好
                        # 如果需要支持中文，需要换 PIL Draw，但 cv2 速度快，Demo 够用了
                        font_scale = max(0.4, (bottom - top) / 30.0) # 根据字号自动调整
                        cv2.putText(cv_img, text_char, (x0, bottom-2), 
                                   cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 255), 1)

            # 评分逻辑
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