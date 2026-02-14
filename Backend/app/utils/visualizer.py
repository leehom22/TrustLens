import cv2
import numpy as np
import random

def draw_hud_text(img, text, pos, color=(0, 255, 0), size=0.5, thickness=1, bg_intensity=0.3):
    """绘制带半透明背景条的文字"""
    font = cv2.FONT_HERSHEY_SIMPLEX
    (w, h), _ = cv2.getTextSize(text, font, size, thickness)
    x, y = pos
    
    h_bg = h + 8
    if y - h_bg < 0: y_adjusted = h_bg + 2
    else: y_adjusted = y
    
    # 越界检查
    if x + w > img.shape[1]: x = img.shape[1] - w - 2
    
    roi = img[y_adjusted-h_bg:y_adjusted+4, x:x+w+4]
    
    # 绘制半透明黑色背景条 (Glass Effect)
    if roi.size > 0:
        black_rect = np.zeros_like(roi, dtype=np.uint8)
        res = cv2.addWeighted(roi, 1.0 - bg_intensity, black_rect, bg_intensity, 0)
        img[y_adjusted-h_bg:y_adjusted+4, x:x+w+4] = res

    cv2.putText(img, text, (x, y_adjusted), font, size, color, thickness, cv2.LINE_AA)
    return y_adjusted + h + 15

def calculate_grid_stats(ela_img, grid_size=32):
    """实时计算网格 Z-Score 矩阵"""
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

def draw_hazard_zone(img, mask, color, label):
    """
    [核心升级] 区域融合绘制函数
    1. 膨胀融合碎块
    2. 绘制战术框
    3. 填充斜线警示纹理
    """
    if mask is None: return
    
    # 1. 膨胀融合：使用横向长方形核，把同一行的字连起来
    # (15, 5) 表示横向膨胀 15px，纵向 5px -> 适合文本行融合
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 8))
    merged_mask = cv2.dilate(mask, kernel, iterations=2)
    
    contours, _ = cv2.findContours(merged_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    overlay = img.copy()
    
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        
        # 忽略太小的噪点框
        if w < 10 or h < 10: continue
        
        # A. 绘制斜线填充 (Hazard Stripes) - 极具警示感
        # 只在框内画斜线
        roi = overlay[y:y+h, x:x+w]
        line_step = 10
        for i in range(0, w + h, line_step):
            # 在 ROI 内画斜线
            pt1 = (i, 0)
            pt2 = (0, i)
            # 需要截断坐标以防画出界，但 cv2.line 会自动处理 ROI 裁剪吗？不会，需手动计算，
            # 简单方法：画在全图再 mask，或者直接画
            # 这里为了性能，只画简单的半透明填充
            pass
        
        # 用半透明色块填充代替复杂的斜线计算 (性能更好，效果也棒)
        cv2.rectangle(overlay, (x, y), (x+w, y+h), color, -1)
        
        # B. 绘制战术四角框 (实心高亮)
        l = min(w, h) // 3
        if l > 20: l = 20
        t = 2
        
        # 画在原图 img 上 (不透明)
        cv2.line(img, (x, y), (x + l, y), color, t)
        cv2.line(img, (x, y), (x, y + l), color, t)
        
        cv2.line(img, (x+w, y), (x+w-l, y), color, t)
        cv2.line(img, (x+w, y), (x+w, y+l), color, t)
        
        cv2.line(img, (x, y+h), (x+l, y+h), color, t)
        cv2.line(img, (x, y+h), (x, y+h-l), color, t)
        
        cv2.line(img, (x+w, y+h), (x+w-l, y+h), color, t)
        cv2.line(img, (x+w, y+h), (x+w, y+h-l), color, t)
        
        # C. 标签
        cv2.putText(img, label, (x, y-5), cv2.FONT_HERSHEY_PLAIN, 0.8, color, 1)

    # 混合半透明填充层 (透明度 0.2 -> 隐约可见的封锁区)
    cv2.addWeighted(overlay, 0.25, img, 0.75, 0, img)


def generate_hud(original_cv, ela_cv, masks_dict, global_score):
    """
    Project GLASS HUD v2: 区域融合版
    """
    h, w = original_cv.shape[:2]
    
    # 1. 战术底图 (Blue Tint)
    gray_bg = cv2.cvtColor(original_cv, cv2.COLOR_BGR2GRAY)
    gray_bg = cv2.cvtColor(gray_bg, cv2.COLOR_GRAY2BGR)
    blue_tint = np.zeros_like(gray_bg)
    blue_tint[:, :, 0] = 60 
    base_layer = cv2.addWeighted(gray_bg, 0.6, blue_tint, 1.0, 0)

    # 2. 全屏网格 (The Grid)
    grid_size = 40 
    z_matrix, g_mean, g_std = calculate_grid_stats(ela_cv if len(ela_cv.shape)==2 else cv2.cvtColor(ela_cv, cv2.COLOR_BGR2GRAY), grid_size)
    
    for r in range(z_matrix.shape[0]):
        for c in range(z_matrix.shape[1]):
            y, x = r * grid_size, c * grid_size
            # 随机闪烁青色网格
            if random.random() > 0.7:
                alpha = random.uniform(0.05, 0.2)
                color = (255, 255, 0) 
                overlay_color = tuple([int(cc * alpha) for cc in color])
                
                l = 3
                cv2.line(base_layer, (x, y-l), (x, y+l), overlay_color, 1)
                cv2.line(base_layer, (x-l, y), (x+l, y), overlay_color, 1)
                
            if (r + c) % 4 == 0: 
                val = z_matrix[r, c]
                font_color = (100, 100, 255) if val > 2.5 else (70, 70, 70)
                cv2.putText(base_layer, f"{val:.1f}", (x+5, y+20), 
                           cv2.FONT_HERSHEY_PLAIN, 0.6, font_color, 1)

    # 3. 风险渲染 (Risk Overlay)
    # [A] 等高线 (保持原样)
    z_map_resized = cv2.resize(z_matrix, (w, h), interpolation=cv2.INTER_CUBIC)
    mask_l2 = (z_map_resized > 3.0).astype(np.uint8) * 255
    contours_l2, _ = cv2.findContours(mask_l2, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(base_layer, contours_l2, -1, (0, 165, 255), 1)

    # [B] 具体的检测框 (Masks) - 核心修改处
    # 定义颜色
    colors = {
        "Texture": (0, 255, 255),    # yellow
        "BlackLevel": (0, 0, 255),   # red
        "Alignment": (0, 165, 255)   # orange
    }

    # 1. Draw glow area by using mask
    glow_layer = np.zeros_like(base_layer)
    for key, mask in masks_dict.items():
        if mask is not None:
            c = colors.get(key, (0, 0, 255))
            glow_layer[mask > 0] = c # 原始像素发光
    
    # 高斯模糊做辉光
    if np.max(glow_layer) > 0:
        glow_blur = cv2.GaussianBlur(glow_layer, (31, 31), 0)
        base_layer = cv2.addWeighted(base_layer, 1.0, glow_blur, 0.8, 0)

    # 2. 再画战术框 (Zones) - 用融合后的 mask，画大框
    for key, mask in masks_dict.items():
        if mask is not None:
            c = colors.get(key, (0, 0, 255))
            # 调用新的融合绘制函数
            draw_hazard_zone(base_layer, mask, c, key.upper())

    # 4. 右侧半透明 HUD
    panel_w = 240
    panel_x = w - panel_w
    
    sidebar_roi = base_layer[0:h, panel_x:w]
    black_layer = np.zeros_like(sidebar_roi)
    glass_panel = cv2.addWeighted(sidebar_roi, 0.6, black_layer, 0.4, 0) # 调亮一点透明度
    base_layer[0:h, panel_x:w] = glass_panel
    cv2.line(base_layer, (panel_x, 0), (panel_x, h), (100, 255, 255), 1)

    # 5. 写入数据
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
    y_cursor = 50
    
    draw_hud_text(base_layer, "ANALYSIS HUB", (x_pad, y_cursor), (255, 255, 255), 0.6, 2, 0.0)
    y_cursor += 30
    cv2.line(base_layer, (x_pad, y_cursor), (w-15, y_cursor), theme_color, 2)
    y_cursor += 30
    draw_hud_text(base_layer, status_str, (x_pad, y_cursor), theme_color, 1.0, 2, 0.0)
    y_cursor += 40
    
    max_z = np.max(z_matrix)
    metrics = [
        ("RISK SCORE", f"{global_score}"),
        ("MAX Z-SCORE", f"{max_z:.2f}"),
        ("ELA MEAN", f"{g_mean:.2f}"),
        ("INTEGRITY", f"{100-global_score}%"),
    ]
    
    for label, val in metrics:
        cv2.putText(base_layer, label, (x_pad, y_cursor), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1, cv2.LINE_AA)
        (tw, th), _ = cv2.getTextSize(val, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.putText(base_layer, val, (w - 15 - tw, y_cursor), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
        y_cursor += 30

    # 6. 底部直方图
    hist_h = 60
    hist_w = panel_w - 30
    hist_x = x_pad
    hist_y = h - 30
    
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
    cv2.polylines(base_layer, [np.array(pts)], False, (0, 200, 200), 1, cv2.LINE_AA)
    
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