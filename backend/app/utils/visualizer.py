import cv2
import numpy as np
import random

# =============== Draw HUD Text with Semi-Transparent Background =============
def draw_hud_text(img, text, pos, color=(0, 255, 0), size=0.5, thickness=1, bg_intensity=0.3):
    
    font = cv2.FONT_HERSHEY_SIMPLEX
    (w, h), _ = cv2.getTextSize(text, font, size, thickness)
    x, y = pos
    
    h_bg = h + 8
    # Add boundary checks to prevent out-of-bounds errors
    if y - h_bg < 0: y_adjusted = h_bg + 2
    else: y_adjusted = y
    if x + w > img.shape[1]: x = img.shape[1] - w - 2
    
    roi = img[y_adjusted-h_bg:y_adjusted+4, x:x+w+4]
    if roi.size > 0:
        black_rect = np.zeros_like(roi, dtype=np.uint8)
        res = cv2.addWeighted(roi, 1.0 - bg_intensity, black_rect, bg_intensity, 0)
        img[y_adjusted-h_bg:y_adjusted+4, x:x+w+4] = res

    cv2.putText(img, text, (x, y_adjusted), font, size, color, thickness, cv2.LINE_AA)
    return y_adjusted + h + 15


# ============= Calculate Z-Score Matrix for ELA Image to Identify Anomalous Regions ==============
def calculate_grid_stats(ela_img, grid_size=32):

    h, w = ela_img.shape
    if grid_size < 1: grid_size = 32
    rows = h // grid_size
    cols = w // grid_size
    if rows == 0 or cols == 0: return np.zeros((1,1)), 0.0, 0.0

    z_matrix = np.zeros((rows, cols))
    global_mean = np.mean(ela_img)
    global_std = np.std(ela_img) + 1e-5
    
    for r in range(rows):
        for c in range(cols):
            y, x = r * grid_size, c * grid_size
            roi = ela_img[y:y+grid_size, x:x+grid_size]
            local_mean = np.mean(roi)
            z_score = abs(local_mean - global_mean) / global_std
            z_matrix[r, c] = z_score
            
    return z_matrix, global_mean, global_std


# ================= Draw Hazard Zones with Custom Colors and Confidence Labels =================
def draw_hazard_zone(img, mask, color, label, confidence):
    
    if mask is None: return
    
    # Dilate the mask to merge nearby regions and create a more cohesive hazard zone
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 8))
    merged_mask = cv2.dilate(mask, kernel, iterations=2)
    contours, _ = cv2.findContours(merged_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    overlay = img.copy()
    
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w < 10 or h < 10: continue 
        
        # Fill the bounding box with a semi-transparent color
        cv2.rectangle(overlay, (x, y), (x+w, y+h), color, -1)
        
        # Draw a border
        l = min(w, h) // 3
        if l > 20: l = 20
        t = 2
        # Corner lines
        cv2.line(img, (x, y), (x + l, y), color, t)
        cv2.line(img, (x, y), (x, y + l), color, t)
        cv2.line(img, (x+w, y), (x+w-l, y), color, t)
        cv2.line(img, (x+w, y), (x+w, y+l), color, t)
        cv2.line(img, (x, y+h), (x+l, y+h), color, t)
        cv2.line(img, (x, y+h), (x, y+h-l), color, t)
        cv2.line(img, (x+w, y+h), (x+w-l, y+h), color, t)
        cv2.line(img, (x+w, y+h), (x+w, y+h-l), color, t)
        
        # Label with confidence
        conf_str = f"{int(confidence*100)}%"
        label_text = f"{label} [{conf_str}]"
        # Label background
        (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_PLAIN, 0.9, 1)
        cv2.rectangle(img, (x, y-th-5), (x+tw, y-2), (0,0,0), -1)
        cv2.putText(img, label_text, (x, y-5), cv2.FONT_HERSHEY_PLAIN, 0.9, color, 1)

    # Blend the overlay with the original image to create a glow effect
    cv2.addWeighted(overlay, 0.25, img, 0.75, 0, img)


# ================= Main HUD Generation Function Integrating All Elements =================
def generate_hud(original_cv, ela_cv, detection_meta, global_score):

    h, w = original_cv.shape[:2]
    
    # ------------- Blue Tint -------------
    gray_bg = cv2.cvtColor(original_cv, cv2.COLOR_BGR2GRAY)
    gray_bg = cv2.cvtColor(gray_bg, cv2.COLOR_GRAY2BGR)
    
    blue_tint = np.zeros_like(gray_bg)
    blue_tint[:, :, 0] = 50 # Add some blue
    
    # Blend the gray background with the blue tint to create a cool base layer
    base_layer = cv2.addWeighted(gray_bg, 0.5, blue_tint, 1.0, 0)

    # ------------ Grid Overlay with Z-Scores ------------
    grid_size = 40 
    z_matrix, g_mean, g_std = calculate_grid_stats(ela_cv if len(ela_cv.shape)==2 else cv2.cvtColor(ela_cv, cv2.COLOR_BGR2GRAY), grid_size)
    
    for r in range(z_matrix.shape[0]):
        for c in range(z_matrix.shape[1]):
            y, x = r * grid_size, c * grid_size
            
            val = z_matrix[r, c]
            
            # Generate a random alpha for the grid lines
            if random.random() > 0.7:
                alpha = random.uniform(0.1, 0.3)
                color = (255, 255, 0) 
                overlay_color = tuple([int(cc * alpha) for cc in color])
                
                l = 4
                cv2.line(base_layer, (x, y-l), (x, y+l), overlay_color, 1)
                cv2.line(base_layer, (x-l, y), (x+l, y), overlay_color, 1)
            
            # According to the Z-Score, decide whether to show the value and in what color
            show_text = False
            font_color = (80, 80, 80) # 默认：极淡的灰色
            
            if val > 3.0:
                show_text = True
                font_color = (0, 255, 255) # Yellow
            elif val > 1.5:
                if random.random() > 0.2: show_text = True
                font_color = (50, 200, 255) # Orange
            else:
                # values below 1.5 are mostly normal, but randomly show some to create a "data stream" effect
                if (r + c) % 3 == 0 or random.random() > 0.8:
                    show_text = True
                    font_color = (80, 120, 120) # Faint Cyan (青灰)

            if show_text:
                # one decimal place
                text_val = f"{val:.1f}"
                # avoid placing text too close to the edges
                cv2.putText(base_layer, text_val, (x+8, y+22), 
                           cv2.FONT_HERSHEY_PLAIN, 0.7, font_color, 1)

    # ---------- Risk Overlay -----------
    
    # ELA Z-Map Contours - Level 2 Warning (Orange) and Level 3 Critical (Red)
    # Resize Z-Map to Full Image Size to ensure coverage
    z_map_resized = cv2.resize(z_matrix, (w, h), interpolation=cv2.INTER_CUBIC)
    
    if global_score > 40:
        mask_l2 = (z_map_resized > 3.0).astype(np.uint8) * 255
        contours_l2, _ = cv2.findContours(mask_l2, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(base_layer, contours_l2, -1, (0, 0, 255), 1)

    glow_layer = np.zeros_like(base_layer)
    
    for key, data in detection_meta.items():
        # Ensure data is a dict (Fix for logic bug protection)
        if isinstance(data, dict):
            mask = data.get("mask")
            if mask is not None and np.sum(mask) > 0:
                color = data.get("color", (0, 0, 255))
                conf = data.get("conf", 1.0)
                
                # glow layer
                glow_layer[mask > 0] = color
                
                draw_hazard_zone(base_layer, mask, color, key.upper(), conf)
    
    # Apply a strong blur to the glow layer to create a halo effect around detected regions, but only if there are detections
    if np.max(glow_layer) > 0:
        glow_blur = cv2.GaussianBlur(glow_layer, (45, 45), 0)
        base_layer = cv2.addWeighted(base_layer, 1.0, glow_blur, 0.6, 0)

    # ------------- Sidebar HUD -------------
    panel_w = 260
    panel_x = w - panel_w

    num_modules = len([k for k, v in detection_meta.items() if isinstance(v, dict)])
    panel_h = min(h, 320 + num_modules * 20)

    sidebar_roi = base_layer[0:panel_h, panel_x:w]
    black_layer = np.zeros_like(sidebar_roi)
    # Glass effect: blend the sidebar with a semi-transparent black layer to create a frosted glass panel
    glass_panel = cv2.addWeighted(sidebar_roi, 0.4, black_layer, 0.6, 0) 
    base_layer[0:panel_h, panel_x:w] = glass_panel
    
    cv2.line(base_layer, (panel_x, 0), (panel_x, panel_h), (100, 255, 255), 1)
    if panel_h < h:
        cv2.line(base_layer, (panel_x, panel_h), (w, panel_h), (100, 255, 255), 1)

    # Determine overall status based on global score
    if global_score > 70:
        theme_color = (0, 0, 255) 
        status_str = "CRITICAL"
    elif global_score > 30:
        theme_color = (0, 165, 255) 
        status_str = "SUSPICIOUS"
    else:
        theme_color = (0, 255, 0) 
        status_str = "VERIFIED"

    x_pad = panel_x + 15
    y_cursor = 40
    
    draw_hud_text(base_layer, "ANALYSIS HUB", (x_pad, y_cursor), (255, 255, 255), 0.6, 2, 0.0)
    y_cursor += 30
    cv2.line(base_layer, (x_pad, y_cursor), (w-15, y_cursor), theme_color, 2)
    y_cursor += 30
    draw_hud_text(base_layer, status_str, (x_pad, y_cursor), theme_color, 1.0, 2, 0.0)
    y_cursor += 40
    
    # [New] Module Confidence Panel
    draw_hud_text(base_layer, "MODULES", (x_pad, y_cursor), (200, 200, 200), 0.5, 1, 0.0)
    y_cursor += 25
    
    for key, data in detection_meta.items():
        if isinstance(data, dict):
            conf = data.get("conf", 0.0)
            color = data.get("color", (100, 100, 100))
            
            display_color = color if conf > 0.1 else (80, 80, 80)
            label = f"{key[:10]}"
            
            # Bar Background
            bar_w = 80
            bar_x = w - 15 - bar_w
            cv2.rectangle(base_layer, (bar_x, y_cursor-8), (bar_x + bar_w, y_cursor-2), (50,50,50), -1)
            # Bar Fill
            fill_w = int(bar_w * conf)
            if fill_w > 0:
                cv2.rectangle(base_layer, (bar_x, y_cursor-8), (bar_x + fill_w, y_cursor-2), display_color, -1)
                
            cv2.putText(base_layer, label, (x_pad, y_cursor), cv2.FONT_HERSHEY_SIMPLEX, 0.4, display_color, 1, cv2.LINE_AA)
            y_cursor += 20
            
    y_cursor += 15
    cv2.line(base_layer, (x_pad, y_cursor), (w-15, y_cursor), (100, 100, 100), 1)
    y_cursor += 25

    # Key Metrics
    max_z = np.max(z_matrix)
    metrics = [
        ("RISK SCORE", f"{global_score}"),
        ("MAX Z-SCORE", f"{max_z:.2f}"),
        ("ELA MEAN", f"{g_mean:.2f}"),
    ]
    
    for label, val in metrics:
        cv2.putText(base_layer, label, (x_pad, y_cursor), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1, cv2.LINE_AA)
        (tw, th), _ = cv2.getTextSize(val, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.putText(base_layer, val, (w - 15 - tw, y_cursor), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
        y_cursor += 30

    """ 6. 底部微型直方图 - [Restored]
    hist_h = 50
    hist_w = panel_w - 30
    hist_x = x_pad
    hist_y = h - 20
    
    ela_gray = ela_cv if len(ela_cv.shape)==2 else cv2.cvtColor(ela_cv, cv2.COLOR_BGR2GRAY)
    hist = cv2.calcHist([ela_gray], [0], None, [256], [0, 256])
    cv2.normalize(hist, hist, 0, hist_h, cv2.NORM_MINMAX)
    
    cv2.rectangle(base_layer, (hist_x, hist_y - hist_h), (hist_x + hist_w, hist_y), (30, 30, 30), 1)
    pts = []
    for i in range(256):
        bin_val = hist[i][0]
        px = int(hist_x + (i / 256) * hist_w)
        py = int(hist_y - bin_val)
        pts.append((px, py))
    cv2.polylines(base_layer, [np.array(pts)], False, (0, 200, 200), 1, cv2.LINE_AA)"""
    
    return base_layer





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