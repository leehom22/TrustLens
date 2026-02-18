import cv2
import numpy as np
import random

# ================= 核心工具: 绘制带背景的文字 =================
def draw_hud_text(img, text, pos, color=(0, 255, 0), size=0.6, thickness=2, bg_intensity=0.3):
    font = cv2.FONT_HERSHEY_SIMPLEX
    (w, h), _ = cv2.getTextSize(text, font, size, thickness)
    x, y = pos
    
    h_bg = h + 12 # 增加一点高度
    if y - h_bg < 0: y_adjusted = h_bg + 2
    else: y_adjusted = y
    
    if x + w > img.shape[1]: x = img.shape[1] - w - 5
    
    roi = img[y_adjusted-h_bg:y_adjusted+5, x:x+w+10]
    if roi.size > 0:
        black_rect = np.zeros_like(roi, dtype=np.uint8)
        res = cv2.addWeighted(roi, 1.0 - bg_intensity, black_rect, bg_intensity, 0)
        img[y_adjusted-h_bg:y_adjusted+5, x:x+w+10] = res

    cv2.putText(img, text, (x+5, y_adjusted), font, size, color, thickness, cv2.LINE_AA)
    return y_adjusted + h + 25 # 增加行距

# ================= 核心工具: 战术危险区绘制 =================
def draw_hazard_zone(img, mask, color, label):
    if mask is None: return
    
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 8))
    merged_mask = cv2.dilate(mask, kernel, iterations=2)
    contours, _ = cv2.findContours(merged_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    overlay = img.copy()
    
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w < 10 or h < 10: continue
        
        # 半透明填充
        cv2.rectangle(overlay, (x, y), (x+w, y+h), color, -1)
        
        # 四角战术框
        l = min(w, h) // 3
        if l > 25: l = 25
        t = 3 # 加粗线条
        
        cv2.line(img, (x, y), (x + l, y), color, t)
        cv2.line(img, (x, y), (x, y + l), color, t)
        cv2.line(img, (x+w, y), (x+w-l, y), color, t)
        cv2.line(img, (x+w, y), (x+w, y+l), color, t)
        cv2.line(img, (x, y+h), (x+l, y+h), color, t)
        cv2.line(img, (x, y+h), (x, y+h-l), color, t)
        cv2.line(img, (x+w, y+h), (x+w-l, y+h), color, t)
        cv2.line(img, (x+w, y+h), (x+w, y+h-l), color, t)
        
        # 标签 (加大字号)
        cv2.putText(img, label, (x, y-8), cv2.FONT_HERSHEY_PLAIN, 1.2, color, 1)

    cv2.addWeighted(overlay, 0.25, img, 0.75, 0, img)

# ================= 核心工具: 网格统计 =================
def calculate_grid_stats(diff_map, grid_size=32):
    if len(diff_map.shape) == 3:
        gray = cv2.cvtColor(diff_map, cv2.COLOR_BGR2GRAY)
    else:
        gray = diff_map

    h, w = gray.shape
    if grid_size < 1: grid_size = 32
    rows = h // grid_size
    cols = w // grid_size
    if rows == 0 or cols == 0: return np.zeros((1,1)), 0.0, 0.0

    z_matrix = np.zeros((rows, cols))
    global_mean = np.mean(gray)
    global_std = np.std(gray) + 1e-5
    
    for r in range(rows):
        for c in range(cols):
            y, x = r * grid_size, c * grid_size
            roi = gray[y:y+grid_size, x:x+grid_size]
            local_mean = np.mean(roi)
            z_score = abs(local_mean - global_mean) / global_std
            z_matrix[r, c] = z_score
            
    return z_matrix, global_mean, global_std

# ================= 通用 HUD 生成器 =================
def generate_hud(original_cv, diff_map, masks_dict, global_score, confidence_val=1.0, variant="NOISE"):
    """
    Project GLASS HUD v3
    Args:
        variant (str): "NOISE" (for PDFs) | "ELA" (for Images)
    """

    h, w = original_cv.shape[:2]
    
    # 1. 战术底图
    gray_bg = cv2.cvtColor(original_cv, cv2.COLOR_BGR2GRAY)
    gray_bg = cv2.cvtColor(gray_bg, cv2.COLOR_GRAY2BGR)
    blue_tint = np.zeros_like(gray_bg)
    blue_tint[:, :, 0] = 60
    base_layer = cv2.addWeighted(gray_bg, 0.6, blue_tint, 1.0, 0)

    # 2. 全屏数据流网格
    grid_size = 40 
    z_matrix, g_mean, g_std = calculate_grid_stats(diff_map, grid_size)
    
    for r in range(z_matrix.shape[0]):
        for c in range(z_matrix.shape[1]):
            y, x = r * grid_size, c * grid_size
            
            # 随机闪烁
            if random.random() > 0.8:
                alpha = random.uniform(0.1, 0.3)
                color = (255, 255, 0) # Cyan
                overlay_color = tuple([int(cc * alpha) for cc in color])
                l = 4
                cv2.line(base_layer, (x, y-l), (x, y+l), overlay_color, 1)
                cv2.line(base_layer, (x-l, y), (x+l, y), overlay_color, 1)
            
            # 数值流
            if (r + c) % 4 == 0 or z_matrix[r, c] > 2.0: 
                val = z_matrix[r, c]
                font_color = (100, 100, 255) if val > 2.5 else (80, 80, 80)
                if val > 0:
                    cv2.putText(base_layer, f"{val:.1f}", (x+5, y+20), 
                               cv2.FONT_HERSHEY_PLAIN, 0.6, font_color, 1)

    # 3. 风险渲染
    # 等高线
    z_map_resized = cv2.resize(z_matrix, (w, h), interpolation=cv2.INTER_CUBIC)
    mask_l2 = (z_map_resized > 3.0).astype(np.uint8) * 255
    contours_l2, _ = cv2.findContours(mask_l2, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(base_layer, contours_l2, -1, (0, 165, 255), 1)

    # 检测框
    colors = {
        "Noise_Anomaly": (0, 0, 255),
        "ATS_HACK": (0, 0, 255),
        "BlackLevel": (0, 0, 255),
        "Alignment": (0, 165, 255),
        "Structure": (255, 0, 255),
        "text_image": (0, 255, 255),
        "ELA_Anomaly": (255, 0, 255)   # 洋红色
    }

    for key, mask in masks_dict.items():
        if mask is not None:
            c = (0, 255, 255)
            for k, v in colors.items():
                if k in key: c = v
            draw_hazard_zone(base_layer, mask, c, key.upper())

    # 4. 右侧 HUD 面板 (加大尺寸)
    card_w = 320  # [修改] 加宽面板
    card_h = 480  # [修改] 加高面板
    margin_top = 30
    margin_right = 30
    
    c_x1 = w - card_w - margin_right
    c_y1 = margin_top
    c_x2 = w - margin_right
    c_y2 = margin_top + card_h
    
    if c_x1 < 0: c_x1 = 0
    if c_y2 > h: c_y2 = h
    
    card_roi = base_layer[c_y1:c_y2, c_x1:c_x2]
    if card_roi.size > 0:
        black_layer = np.zeros_like(card_roi)
        glass_card = cv2.addWeighted(card_roi, 0.5, black_layer, 0.5, 0)
        base_layer[c_y1:c_y2, c_x1:c_x2] = glass_card
        cv2.rectangle(base_layer, (c_x1, c_y1), (c_x2, c_y2), (100, 255, 255), 1)
        
        # 装饰
        corner_len = 15
        corner_color = (100, 255, 255)
        thick = 2
        cv2.line(base_layer, (c_x1, c_y1), (c_x1 + corner_len, c_y1), corner_color, thick)
        cv2.line(base_layer, (c_x1, c_y1), (c_x1, c_y1 + corner_len), corner_color, thick)
        cv2.line(base_layer, (c_x2, c_y1), (c_x2 - corner_len, c_y1), corner_color, thick)
        cv2.line(base_layer, (c_x2, c_y1), (c_x2, c_y1 + corner_len), corner_color, thick)
        cv2.line(base_layer, (c_x1, c_y2), (c_x1 + corner_len, c_y2), corner_color, thick)
        cv2.line(base_layer, (c_x1, c_y2), (c_x1, c_y2 - corner_len), corner_color, thick)
        cv2.line(base_layer, (c_x2, c_y2), (c_x2 - corner_len, c_y2), corner_color, thick)
        cv2.line(base_layer, (c_x2, c_y2), (c_x2, c_y2 - corner_len), corner_color, thick)

    # 5. 写入 HUD 数据
    if global_score > 70:
        theme_color = (0, 0, 255)
        status_str = "CRITICAL"
    elif global_score > 35:
        theme_color = (0, 165, 255)
        status_str = "SUSPICIOUS"
    else:
        theme_color = (0, 255, 0)
        status_str = "VERIFIED"

    text_x = c_x1 + 25
    text_y = c_y1 + 50
    
    draw_hud_text(base_layer, "FORENSIC HUD", (text_x, text_y), (200, 200, 200), 0.7, 2, 0.0)
    text_y += 35
    cv2.line(base_layer, (text_x, text_y), (c_x2 - 25, text_y), theme_color, 3)
    text_y += 45
    draw_hud_text(base_layer, status_str, (text_x, text_y), theme_color, 1.4, 3, 0.0)
    text_y += 50
    
    # [修改] 动态指标名称
    max_z = np.max(z_matrix)
    anomaly_grids = np.sum(z_matrix > 3.0)
    
    # 区分 Noise 和 ELA 的显示逻辑
    if variant == "NOISE":
        metric_label_1 = "NOISE Z-SCR"
        metric_label_2 = "NOISE DEV"
    else:
        metric_label_1 = "ELA Z-SCORE"
        metric_label_2 = "CMPRS ARTIFACT"

    metrics_data = [
        ("RISK SCORE", f"{global_score}"),
        ("CONFIDENCE", f"{int(confidence_val * 100)}%"),
        (metric_label_1, f"{max_z:.2f}"),
        (metric_label_2, f"{g_std:.2f}"),
        ("ANOMALY BLKS", f"{anomaly_grids}")
    ]
    
    for label, val in metrics_data:
        cv2.putText(base_layer, label, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1, cv2.LINE_AA)
        retval = cv2.getTextSize(val, cv2.FONT_HERSHEY_SIMPLEX, 0.75, 2)
        (tw, th), _ = retval
        val_x = c_x2 - 25 - tw
        cv2.putText(base_layer, val, (val_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2, cv2.LINE_AA)
        text_y += 45 # 增加行距

    # 6. 底部直方图
    hist_h = 60
    hist_w = (c_x2 - 25) - (c_x1 + 25)
    hist_x = c_x1 + 25
    hist_y = c_y2 - 25
    
    if len(diff_map.shape) == 3:
        diff_gray = cv2.cvtColor(diff_map, cv2.COLOR_BGR2GRAY)
    else:
        diff_gray = diff_map

    hist = cv2.calcHist([diff_gray], [0], None, [256], [0, 256])
    cv2.normalize(hist, hist, 0, hist_h, cv2.NORM_MINMAX)
    
    cv2.rectangle(base_layer, (hist_x, hist_y - hist_h), (hist_x + hist_w, hist_y), (30, 30, 30), 1)
    pts = []
    for i in range(256):
        bin_val = hist[i][0]
        px = int(hist_x + (i / 256) * hist_w)
        py = int(hist_y - bin_val)
        pts.append((px, py))
    cv2.polylines(base_layer, [np.array(pts)], False, (0, 200, 200), 1, cv2.LINE_AA)
    
    label_text = f"{variant} DISTRIBUTION"
    cv2.putText(base_layer, label_text, (hist_x, hist_y - hist_h - 5), cv2.FONT_HERSHEY_PLAIN, 0.8, (150, 150, 150), 1)
    
    return base_layer

# Native PDF 专用 HUD (现在直接封装调用)
def generate_pdf_hud(original_cv, pdf_results_dict, global_score, diff_map_override=None):
    """
    Native PDF 也使用 Noise 数据流。
    如果提供了 diff_map_override (Noise Map)，就用它；否则生成随机噪声流。
    """
    h, w = original_cv.shape[:2]
    
    if diff_map_override is not None:
        noise_map = diff_map_override
    else:
        # Fallback: 生成随机噪声流
        noise_map = np.random.normal(0, 5, (h, w)).astype(np.uint8)
    
    # 强制 variant="NOISE"
    return generate_hud(original_cv, noise_map, pdf_results_dict, global_score, confidence_val=1.0, variant="NOISE")





"""import cv2
import numpy as np
import random

def draw_hud_text(img, text, pos, color=(0, 255, 0), size=0.5, thickness=1, bg_intensity=0.3):
    
    font = cv2.FONT_HERSHEY_SIMPLEX
    (w, h), _ = cv2.getTextSize(text, font, size, thickness)
    x, y = pos
    
    # 获取文字区域的背景
    h_bg = h + 8
    if y - h_bg < 0: return y + h + 10 # 越界保护
    
    roi = img[y-h_bg:y+4, x:x+w+4]
    
    # 绘制半透明黑色背景条 (Glass Effect)
    black_rect = np.zeros_like(roi, dtype=np.uint8)
    res = cv2.addWeighted(roi, 1.0 - bg_intensity, black_rect, bg_intensity, 0)
    img[y-h_bg:y+4, x:x+w+4] = res

    cv2.putText(img, text, (x, y), font, size, color, thickness, cv2.LINE_AA)
    return y + h + 15 # 返回下一行的Y坐标

def calculate_grid_stats(ela_img, grid_size=32):
    
    h, w = ela_img.shape
    
    # 确保 grid_size 合理
    if grid_size < 1: grid_size = 32
    
    rows = h // grid_size
    cols = w // grid_size
    
    # 避免空图错误
    if rows == 0 or cols == 0:
        return np.zeros((1,1)), 0.0, 0.0

    z_matrix = np.zeros((rows, cols))
    
    # 1. 计算全局统计
    global_mean = np.mean(ela_img)
    global_std = np.std(ela_img) + 1e-5
    
    # 2. 填充矩阵
    for r in range(rows):
        for c in range(cols):
            y, x = r * grid_size, c * grid_size
            roi = ela_img[y:y+grid_size, x:x+grid_size]
            local_mean = np.mean(roi)
            z_score = abs(local_mean - global_mean) / global_std
            z_matrix[r, c] = z_score
            
    return z_matrix, global_mean, global_std

def generate_hud(original_cv, ela_cv, masks_dict, global_score):
    
    h, w = original_cv.shape[:2]
    
    # ---------------------------------------------------------
    # 1. 战术底图处理 (Cool Blue Tint) - 提升可见度
    # ---------------------------------------------------------
    gray_bg = cv2.cvtColor(original_cv, cv2.COLOR_BGR2GRAY)
    gray_bg = cv2.cvtColor(gray_bg, cv2.COLOR_GRAY2BGR)
    
    # 制造一种 "夜视仪/蓝光屏幕" 的底色，而不是死黑
    # B通道增强，R/G通道压暗
    # 目标亮度: 40% (比之前的 15% 亮很多)
    blue_tint = np.zeros_like(gray_bg)
    blue_tint[:, :, 0] = 50 # Add some blue
    
    # 混合：原图灰度 * 0.4 + 蓝光层
    base_layer = cv2.addWeighted(gray_bg, 0.5, blue_tint, 1.0, 0)

    # ---------------------------------------------------------
    # 2. 全屏网格与微数据 (The "Computing" Vibe)
    # ---------------------------------------------------------
    grid_size = 40 #稍微大一点的格子
    grid_layer = np.zeros_like(base_layer)
    
    z_matrix, g_mean, g_std = calculate_grid_stats(ela_cv if len(ela_cv.shape)==2 else cv2.cvtColor(ela_cv, cv2.COLOR_BGR2GRAY), grid_size)
    
    # 遍历每个格子画线和数据
    for r in range(z_matrix.shape[0]):
        for c in range(z_matrix.shape[1]):
            y, x = r * grid_size, c * grid_size
            
            # 画淡淡的青色网格线 (Cyan)
            # 随机透明度，制造闪烁感
            alpha = random.uniform(0.1, 0.3)
            color = (255, 255, 0) # Cyan in BGR
            overlay_color = tuple([int(cc * alpha) for cc in color])
            
            # 只画十字交叉点，比画全框更高级
            l = 4
            # 十字中心
            cv2.line(base_layer, (x, y-l), (x, y+l), overlay_color, 1)
            cv2.line(base_layer, (x-l, y), (x+l, y), overlay_color, 1)
            
            # [关键] 在部分格子里填入 Z-Score 数值
            # 不用填满，填 20% 的格子，制造“数据流”感觉
            if (r + c) % 3 == 0: 
                val = z_matrix[r, c]
                # 如果 Z-Score 较高，显示红色；否则显示极淡的青色
                font_color = (100, 100, 255) if val > 2.0 else (80, 80, 80)
                cv2.putText(base_layer, f"{val:.1f}", (x+5, y+20), 
                           cv2.FONT_HERSHEY_PLAIN, 0.7, font_color, 1)

    # ---------------------------------------------------------
    # 3. 风险渲染 (Risk Overlay) - 只有检测到才显示
    # ---------------------------------------------------------
    # 等高线层
    z_map_resized = cv2.resize(z_matrix, (w, h), interpolation=cv2.INTER_CUBIC)
    
    # Level 2 Warning (Orange)
    mask_l2 = (z_map_resized > 3.0).astype(np.uint8) * 255
    contours_l2, _ = cv2.findContours(mask_l2, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(base_layer, contours_l2, -1, (0, 165, 255), 1)

    # Level 3 Critical (Red Glow)
    mask_l3 = (z_map_resized > 4.5).astype(np.uint8) * 255
    if np.sum(mask_l3) > 0:
        red_layer = np.zeros_like(base_layer)
        red_layer[mask_l3 > 0] = (0, 0, 255)
        red_layer = cv2.GaussianBlur(red_layer, (45, 45), 0)
        base_layer = cv2.addWeighted(base_layer, 1.0, red_layer, 0.8, 0)
        
        # 红色实线轮廓
        contours_l3, _ = cv2.findContours(mask_l3, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(base_layer, contours_l3, -1, (0, 0, 255), 2)

    # 具体的检测框 (Masks)
    for key, mask in masks_dict.items():
        if mask is not None:
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                x, y, cw, ch = cv2.boundingRect(cnt)
                color = (0, 0, 255) # Red
                # 战术框
                l = min(cw, ch) // 3
                t = 2
                cv2.line(base_layer, (x, y), (x + l, y), color, t)
                cv2.line(base_layer, (x, y), (x, y + l), color, t)
                cv2.line(base_layer, (x+cw, y+ch), (x+cw-l, y+ch), color, t)
                cv2.line(base_layer, (x+cw, y+ch), (x+cw, y+ch-l), color, t)
                # 标签
                #cv2.putText(base_layer, f"{key.upper()}", (x, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

    # ---------------------------------------------------------
    # 4. 右侧半透明侧边栏 (Glass HUD)
    # ---------------------------------------------------------
    panel_w = 240
    panel_x = w - panel_w
    
    # 核心技术点：不画实心黑块，而是画半透明层
    # 提取原图的右侧区域
    sidebar_roi = base_layer[0:h, panel_x:w]
    # 创建一个纯黑层
    black_layer = np.zeros_like(sidebar_roi)
    # 混合：原图 30% + 黑色 70% -> 得到半透明深色玻璃效果
    glass_panel = cv2.addWeighted(sidebar_roi, 0.5, black_layer, 0.5, 0)
    # 贴回去
    base_layer[0:h, panel_x:w] = glass_panel
    
    # 画一条发光的分割线
    cv2.line(base_layer, (panel_x, 0), (panel_x, h), (100, 255, 255), 1)

    # ---------------------------------------------------------
    # 5. 写入数据 (Data Injection)
    # ---------------------------------------------------------
    if global_score > 70:
        theme_color = (0, 0, 255) # Red
        status_str = "CRITICAL"
    elif global_score > 30:
        theme_color = (0, 165, 255) # Orange
        status_str = "SUSPICIOUS"
    else:
        theme_color = (0, 255, 0) # Green
        status_str = "VERIFIED"

    x_pad = panel_x + 15
    y_cursor = 50
    
    # 标题
    draw_hud_text(base_layer, "ANALYSIS HUB", (x_pad, y_cursor), (255, 255, 255), 0.6, 2, 0.0)
    y_cursor += 30
    
    # 分割线
    cv2.line(base_layer, (x_pad, y_cursor), (w-15, y_cursor), theme_color, 2)
    y_cursor += 30
    
    # 状态大字
    draw_hud_text(base_layer, status_str, (x_pad, y_cursor), theme_color, 1.0, 2, 0.0)
    y_cursor += 40
    
    # 详细指标
    max_z = np.max(z_matrix)
    metrics = [
        ("RISK SCORE", f"{global_score}"),
        ("MAX Z-SCORE", f"{max_z:.2f}"),
        ("ELA MEAN", f"{g_mean:.2f}"),
        ("ELA STD", f"{g_std:.2f}"),
        ("INTEGRITY", f"{100-global_score}%"),
    ]
    
    for label, val in metrics:
        # 标签
        cv2.putText(base_layer, label, (x_pad, y_cursor), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1, cv2.LINE_AA)
        # 数值 (右对齐)
        (tw, th), _ = cv2.getTextSize(val, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.putText(base_layer, val, (w - 15 - tw, y_cursor), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
        
        # 下划虚线
        y_cursor += 8
        for i in range(x_pad, w-15, 8):
            cv2.line(base_layer, (i, y_cursor), (i+4, y_cursor), (50, 50, 50), 1)
        y_cursor += 25

    # ---------------------------------------------------------
    # 6. 底部微型直方图 (Mini Histogram)
    # ---------------------------------------------------------
    hist_h = 60
    hist_w = panel_w - 30
    hist_x = x_pad
    hist_y = h - 30
    
    # 计算 ELA 直方图
    ela_gray = ela_cv if len(ela_cv.shape)==2 else cv2.cvtColor(ela_cv, cv2.COLOR_BGR2GRAY)
    hist = cv2.calcHist([ela_gray], [0], None, [256], [0, 256])
    cv2.normalize(hist, hist, 0, hist_h, cv2.NORM_MINMAX)
    
    # 画直方图背景框
    cv2.rectangle(base_layer, (hist_x, hist_y - hist_h), (hist_x + hist_w, hist_y), (30, 30, 30), 1)
    
    # 画波形
    pts = []
    for i in range(256):
        bin_val = hist[i][0]
        px = int(hist_x + (i / 256) * hist_w)
        py = int(hist_y - bin_val)
        pts.append((px, py))
    
    cv2.polylines(base_layer, [np.array(pts)], False, (0, 200, 200), 1, cv2.LINE_AA)
    cv2.putText(base_layer, "NOISE DISTRIBUTION", (hist_x, hist_y + 15), cv2.FONT_HERSHEY_PLAIN, 0.8, (150, 150, 150), 1)

    return base_layer
"""