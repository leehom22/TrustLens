import cv2
import numpy as np
from PIL import Image
from ..core.config import logger

try:
    import pdfplumber
    PDF_PLUMBER_AVAILABLE = True
except ImportError:
    PDF_PLUMBER_AVAILABLE = False


# Turn the image into OpenCV format (BGR), for analysis and sketching/ labelling
def pil_to_cv2(pil_image):
    return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)


# ================= 1. ELA Core Calculation (Grid-based Z-Score Statistical Method) =================
# [Optimization] Use Numpy vectorization instead of nested for loops, significantly improving performance
def calculate_ela_metrics(diff_img: Image.Image, grid_size: int):
    """
    Calculate ELA statistical metrics.
    Uses Z-Score (standard score) to identify local anomalies relative to the global background.
    
    Args:
        diff_img: ELA difference image (PIL Image)
        grid_size: Grid size (e.g., 32)
    
    Returns:
        dict: Contains global mean, max Z-Score, number of suspicious grids
    """
    # Convert binary image into gray scale values array
    gray_ela = diff_img.convert("L")
    ela_array = np.array(gray_ela)
    h, w = ela_array.shape
    
    # 1. Calculate global statistics (Baseline)
    # Population mean and standard deviation (average deviation from mean) as standard
    global_mean = np.mean(ela_array)
    global_std = np.std(ela_array)
    
    # Integer grayscale value is discrete instead of continuous, pure colour image value is assumed as 0.5,
    # to prevent zero value as denominator will lead the z-score to be approaching to infinity value (division by zero)
    if global_std < 0.5: global_std = 0.5

    # [Optimization] Vectorized calculation of local means
    # Crop the edges exceeded dimension (smaller than grid_size) to fit reshape
    n_h, n_w = h // grid_size, w // grid_size
    shaved_h, shaved_w = n_h * grid_size, n_w * grid_size
    
    if shaved_h == 0 or shaved_w == 0:
         return {"global_mean": float(global_mean), "max_z_score": 0.0, "suspicious_grids": 0}
    
    shaved_ela = ela_array[:shaved_h, :shaved_w]
    
    # Define blocks with the grid size, compute for the mean value of local sampling block
    # Reshape array to (block_rows, grid_h, block_cols, grid_w) and compute mean for each block
    blocks = shaved_ela.reshape(n_h, grid_size, n_w, grid_size)
    local_means = blocks.mean(axis=(1, 3))   # shape of matrix: (n_h, n_w)
    
    # 2. Compute for z-score matrix consisting every local samples (X - μ / σ)
    z_scores = (local_means - global_mean) / global_std
    
    # 3. Decision threshold (Vectorized comparison)
    # z_score > 4.0: The z-score 4.0 grids only exists with probability of 0.003%, which can be considered as suspicious anomalies (outliers)
    # local_mean > 15: High absolute brightness to avoid false positives in dark areas
    suspicious_mask = (z_scores > 4.0) & (local_means > 15)
    suspicious_grids = np.sum(suspicious_mask)
    
    # Find the grids with greatest abnormality
    # Calculate the maximum anomaly degree of the whole image
    max_local_mean = np.max(local_means) if local_means.size > 0 else 0
    overall_max_z = (max_local_mean - global_mean) / global_std
    
    return {
        "global_mean": float(global_mean),
        "max_z_score": float(overall_max_z),
        "suspicious_grids": int(suspicious_grids)
    }


# ================= 2. Intelligent Texture Detection (For Photos/Scanned Documents) =================
# Accept is_photo pre-judgment parameter to avoid recalculating Laplacian variance
def analyze_texture_consistency(image_input, block_size=32, is_photo=None):
    """
    Detection Principle:
    Photos/Scans usually have background noise (ISO Noise).
    Manipulated areas (smudging or new text) are usually "abnormally smooth" (Low Variance).
    
    Intelligent Switch:
    If the whole image is already very smooth (digital screenshot), skip automatically to avoid false positives.
    """
    if isinstance(image_input, str):
        img = cv2.imread(image_input, cv2.IMREAD_GRAYSCALE)
    else:
        if len(image_input.shape) == 3:
            img = cv2.cvtColor(image_input, cv2.COLOR_BGR2GRAY)
        else:
            img = image_input  
    if img is None: return 0, None, []

    # 1. Pre-check: Determine either photo or screenshot
    if is_photo is None:
        # Laplacian analysis if info not found (Calculate internally)
        lap = cv2.Laplacian(img, cv2.CV_64F)
        global_variance = np.var(lap)
        # Empirical threshold: Screenshot < 80，Image (Photo/Scan) > 100
        if global_variance < 80:
             return 0, None, []
    elif is_photo is False:
        # Skipped this step if exists as clean UI screenshot
        return 0, None, []

    # 2. If it's a photo, start looking for "smooth islands" (anomalies)
    h, w = img.shape
    anomaly_mask = np.zeros((h, w), dtype=np.uint8)
    
    # Compute for noise residual (only for high frequency texture)
    denoised = cv2.medianBlur(img, 3)
    residual = cv2.absdiff(img, denoised)
    
    block_vars = []
    block_coords = []
    
    for y in range(0, h, block_size):
        for x in range(0, w, block_size):
            block = residual[y:min(y+block_size, h), x:min(x+block_size, w)]
            if block.size == 0: continue
            
            # Ignore pure black/white areas (lack of texture is normal here)
            if np.mean(block) < 5 or np.mean(block) > 250: continue
                
            var = np.var(block)
            block_vars.append(var)
            block_coords.append((y, x, var))
            
    if not block_vars: return 0, None, []

    # 3. Find abnormally smooth blocks
    vals = np.array(block_vars)
    median = np.median(vals)
    
    # Variance in manipulated areas is usually much lower than background
    # Threshold: 5 times smoother than the median
    threshold = median / 5.0
    
    found = False
    for y, x, val in block_coords:
        if val < threshold:
            # Mark anomaly area
            cv2.rectangle(anomaly_mask, (x, y), (x+block_size, y+block_size), 255, -1)
            found = True
            
    if found:
        # Return 65 score (Medium-High Risk)
        return 65, anomaly_mask, ["Texture anomaly detected (Potential Smoothing/Cloning)"]
    else:
        return 0, None, []


# ================= 3. Black Level Detection (For Screenshots - Conservative ROI Version) =================
# Accept pre-computed contours, add Dark Mode detection
def analyze_fused_forensics(image_input, pre_contours=None):
    """
    For Screenshots: Focus only on pure black brush edits/insertions.
    Uses ROI (Region of Interest) to avoid status bars and buttons, analyzing only body text.
    """
    if isinstance(image_input, str):
        img = cv2.imread(image_input)
    else:
        if len(image_input.shape) == 3:
            img = cv2.cvtColor(image_input, cv2.COLOR_RGB2BGR)
        else:
            img = image_input

    if img is None: return 0, None, []
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    anomaly_mask = np.zeros((h, w), dtype=np.uint8)
    
    # ROI: Strictly limit to the middle area (Avoid Header/Footer)
    y_start = int(h * 0.075)
    y_end = int(h * 0.925)
    
    contours = pre_contours
    if contours is None:
        # Dark Mode Detection
        # If background is dark (<100), use THRESH_BINARY (Find bright text)
        # If background is bright (>100), use THRESH_BINARY_INV (Find black text)
        mean_brightness = np.mean(gray)
        thresh_type = cv2.THRESH_BINARY if mean_brightness < 100 else cv2.THRESH_BINARY_INV
        
        _, thresh = cv2.threshold(gray, 200, 255, thresh_type)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    features = []
    valid_rois = []
    
    for cnt in contours:
        x, y, w_box, h_box = cv2.boundingRect(cnt)
        
        # 1. Physical location filtering
        if y < y_start or (y + h_box) > y_end: continue
        # 2. Size filtering (Only look at body text lines, ignore big headers or small noise)
        if h_box < 8 or h_box > 60: continue 
        
        roi = gray[y:y+h_box, x:x+w_box]
        
        # 3. Extract black level features (Mean of darkest 30% pixels)
        # Note: If in Dark Mode, logic reversal might be needed, currently keeping logic for "anomaly insertion"
        pixels = np.sort(roi.ravel())
        k = max(1, int(len(pixels) * 0.3))
        mean_dark = np.mean(pixels[:k])
        
        # Ignore background (too bright) and extremely black headers (too black)
        if mean_dark > 160: continue
        if mean_dark < 20: continue # Assume body text is dark gray, ignore <20 pure black headers

        features.append(mean_dark)
        valid_rois.append((x, y, w_box, h_box))
        
    if not features: return 0, None, []
    
    features = np.array(features)
    median = np.median(features)
    
    # Threshold: Must be 30 grayscale levels darker than median (Hard to trigger, unless very obvious)
    threshold = median - 30
    
    found = False
    for i in range(len(features)):
        if features[i] < threshold: 
            rx, ry, rw, rh = valid_rois[i]
            cv2.rectangle(anomaly_mask, (rx, ry), (rx+rw, ry+rh), 255, -1)
            found = True
            
    if found:
        return 50, anomaly_mask, ["Text Intensity Anomaly (Digital Insertion)"]
    else:
        return 0, None, []
    

# ================= 4. Row Alignment Detection (For Screenshot Manipulation) =================
# Accept pre-computed contours, use center-line alignment, use relative threshold
def analyze_alignment_consistency(image_input, pre_contours=None, is_photo=None):
    """
    Minimalist alignment detection: Check if text in the same row jitters vertically.
    """
    if isinstance(image_input, str):
        img = cv2.imread(image_input)
    else:
        if len(image_input.shape) == 3:
            img = cv2.cvtColor(image_input, cv2.COLOR_RGB2BGR)
        else:
            img = image_input

    if img is None: return 0, None, []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # --- Safety Valve: Skip this check if it's a scan/photo ---
    if is_photo:
        return 0, None, []
    elif is_photo is None:
        lap = cv2.Laplacian(gray, cv2.CV_64F)
        if np.var(lap) > 100: return 0, None, []

    # 1. Extract contours (If not pre-computed)
    contours = pre_contours
    if contours is None:
        mean_brightness = np.mean(gray)
        thresh_type = cv2.THRESH_BINARY if mean_brightness < 100 else cv2.THRESH_BINARY_INV
        _, thresh = cv2.threshold(gray, 200, 255, thresh_type)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    word_boxes = []
    for cnt in contours:
        x, y, w_box, h_box = cv2.boundingRect(cnt)
        # Filter: Only look at body-sized text, ignore punctuation and icons
        if h_box < 12 or h_box > 50: continue 
        if w_box < 5: continue
        word_boxes.append((x, y, w_box, h_box))
        
    if not word_boxes: return 0, None, []
    
    # 2. Simple row clustering
    rows = []
    # Sort by y coordinate (Still sort by Top for clustering)
    word_boxes.sort(key=lambda b: b[1]) 
    
    current_row = [word_boxes[0]]
    for i in range(1, len(word_boxes)):
        box = word_boxes[i]
        ref_box = current_row[-1]
        
        # If y difference is less than half the row height, consider it the same row
        if abs(box[1] - ref_box[1]) < (ref_box[3] / 2):
            current_row.append(box)
        else:
            rows.append(current_row)
            current_row = [box]
    rows.append(current_row)
    
    # 3. Check for intra-row jitter
    anomaly_mask = np.zeros((h, w), dtype=np.uint8)
    found_issue = False
    
    for row in rows:
        if len(row) < 3: continue # Too few words in this row to compare
        
        # [Optimization] Calculate vertical center point (Center Y), instead of Top Y
        # Center Y = y + h / 2
        centers_y = [b[1] + b[3]/2.0 for b in row]
        median_cy = np.median(centers_y)
        
        # [Optimization] Dynamic relative threshold: 15% of row height, minimum 3px
        avg_height = np.mean([b[3] for b in row])
        tolerance = max(3.0, avg_height * 0.15)
        
        for i in range(len(row)):
            box = row[i]
            bx, by, bw, bh = box
            cy = by + bh / 2.0
            
            # Judgment: Deviation from center line exceeds dynamic threshold
            if abs(cy - median_cy) > tolerance:
                # Draw orange box on Mask
                cv2.rectangle(anomaly_mask, (bx, by), (bx+bw, by+bh), 255, -1)
                found_issue = True
                
    if found_issue:
        return 50, anomaly_mask, ["Text Alignment Anomaly (Potential Insertion)"]
    else:
        return 0, None, []


# ================= 5. NEW: ATS Hacking (Native PDF Only) =================
def analyze_ats_hacking(pdf_path: str, page_idx: int, cv_img: np.ndarray):
    """
    [Native PDF only] ATS Keyword Injection Detection.
    """
    if not PDF_PLUMBER_AVAILABLE:
        return {"score": 0, "mask": None, "signals": [], "details": {}}

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
            
            # Coordinate scaling
            scale_x = w / page.width
            scale_y = h / page.height
            
            hidden_chars = []
            
            for char in page.chars:
                is_suspicious = False
                reason = ""
                
                # Check 1: White on White (Color Analysis)
                c = char.get('non_stroking_color')
                if c is not None:
                    # CMYK or RGB white
                    if c == (1,) or c == [1] or c == (1,1,1) or c == [1,1,1] or c == (0,0,0,0):
                        is_suspicious = True
                        reason = "White"
                    # Sometimes white is represented as 1 in Grayscale
                    elif isinstance(c, (float, int)) and c == 1:
                        is_suspicious = True
                        reason = "White"

                # Check 2: Micro Fonts
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
                    
                    # Draw on Mask
                    x0 = int(char.get('x0', 0) * scale_x)
                    top = int(char.get('top', 0) * scale_y)
                    x1 = int(char.get('x1', 0) * scale_x)
                    bottom = int(char.get('bottom', 0) * scale_y)
                    
                    cv2.rectangle(mask, (x0-2, top-2), (x1+2, bottom+2), 255, -1)
                    
                    # Reveal on Original Image (Visualizer Helper)
                    # Create a reddish/white highlight box
                    if x1 > x0 and bottom > top:
                        sub_img = cv_img[top:bottom, x0:x1]
                        if sub_img.size > 0:
                            white_rect = np.full_like(sub_img, (200,200,255))
                            cv2.addWeighted(sub_img, 0.5, white_rect, 0.5, 0, sub_img)
                            cv_img[top:bottom, x0:x1] = sub_img
                        
                        # Draw text in red
                        font_scale = max(0.4, (bottom - top) / 30.0)
                        cv2.putText(cv_img, text_char, (x0, bottom-2),
                                    cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0,0,255), 1)

            total_suspicious = len(hidden_chars)
            if total_suspicious > 5:
                # High certainty
                result["score"] = min(100, 50 + total_suspicious * 2)
                result["mask"] = mask
                
                if result["details"]["hidden_count"] > 0:
                    result["signals"].append(f"ATS Hacking: {result['details']['hidden_count']} invisible white chars")
                if result["details"]["tiny_count"] > 0:
                    result["signals"].append(f"ATS Hacking: {result['details']['tiny_count']} micro-font chars (<2pt)")
                    
    except Exception as e:
        # pdfplumber sometimes fails on malformed PDFs
        print(f"ATS Analysis Warning: {e}")
        
    return result


# ================= 6. NEW: Statistical Island (Noisy/Scan Only) =================
def analyze_statistical_islands(image_input, block_size=16):
    """
    [Noisy/Scan Only] Detects "Statistical Islands" - areas of abnormally low variance 
    in a noisy image (indicating potential digital patching/erasing).
    """
    if isinstance(image_input, str):
        img = cv2.imread(image_input, cv2.IMREAD_GRAYSCALE)
    else:
        if len(image_input.shape) == 3:
            img = cv2.cvtColor(image_input, cv2.COLOR_BGR2GRAY)
        else:
            img = image_input
            
    if img is None: return 0, None, []

    h, w = img.shape
    
    # 1. Median Blur to estimate base content
    # Use larger kernel for noisy images
    median_blur = cv2.medianBlur(img, 5)
    
    # 2. Residual (Noise Map)
    residual = cv2.absdiff(img, median_blur)
    
    # 3. Block Statistics
    # We want to find blocks where the residual variance is significantly LOWER than global median
    std_map = np.zeros((h // block_size, w // block_size))
    
    for r in range(0, h // block_size):
        for c in range(0, w // block_size):
            y, x = r * block_size, c * block_size
            block = residual[y:y+block_size, x:x+block_size]
            if block.size == 0: continue
            std_map[r, c] = np.std(block)
            
    # 4. Global Baseline (Robust)
    global_median_std = np.median(std_map)
    if global_median_std < 1.0: return 0, None, [] # Image is too clean/flat
    
    # 5. Thresholding (Islands)
    # Anomaly if local noise is < 30% of global median noise (unusually smooth)
    anomaly_indices = np.where(std_map < (global_median_std * 0.3))
    
    if len(anomaly_indices[0]) == 0: return 0, None, []
    
    # 6. Build Mask & Cluster
    mask = np.zeros((h, w), dtype=np.uint8)
    for r, c in zip(anomaly_indices[0], anomaly_indices[1]):
        y, x = r * block_size, c * block_size
        # Additional check: Local contrast with neighbors (Spatial Isolation)
        # If neighbors are also smooth, it might just be a blank page area.
        # We want smooth areas SURROUNDED by noise, or just very distinct.
        # Simple implementation: just mark it first.
        
        # Avoid pure white/black blocks (margins)
        roi_orig = img[y:y+block_size, x:x+block_size]
        if np.mean(roi_orig) > 250 or np.mean(roi_orig) < 5: continue
        
        cv2.rectangle(mask, (x, y), (x+block_size, y+block_size), 255, -1)
        
    # 7. Cluster-based Score (Connected Components)
    # Filter out tiny isolated blocks (noise), keep larger islands
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
    
    suspicious_blobs = 0
    final_mask = np.zeros_like(mask)
    
    for i in range(1, num_labels): # Skip background 0
        area = stats[i, cv2.CC_STAT_AREA]
        # Filter: Area must be significant (e.g., > 2 blocks)
        if area > (block_size * block_size * 2):
            suspicious_blobs += 1
            # Copy this component to final mask
            final_mask[labels == i] = 255
            
    if suspicious_blobs > 0:
        # Score based on number of islands, maxing at 80
        score = min(80, 40 + suspicious_blobs * 10)
        return score, final_mask, ["Statistical Island (Smooth Patch in Noisy Background)"]
    
    return 0, None, []


def calculate_image_coverage(pdf_path: str) -> float:
    """
    计算 PDF 全文的平均图片覆盖率，用于区分扫描件和原生PDF
    Return: 0.0 - 1.0 (1.0 means 100% covered by images)
    """
    if not PDF_PLUMBER_AVAILABLE:
        return 0.0

    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                return 0.0
            
            total_ratio = 0.0
            pages_checked = 0
            
            # Check up to first 5 pages to determine document type
            for page in pdf.pages[:5]:
                page_area = float(page.width * page.height)
                if page_area == 0:
                    continue
                
                # Sum area of all images on the page
                img_area = sum([float(img['width'] * img['height']) for img in page.images])
                
                # Calculation ratio
                total_ratio += (img_area / page_area)
                pages_checked += 1
            
            if pages_checked == 0:
                return 0.0
            
            # Average ratio
            return min(total_ratio / pages_checked, 1.0)
            
    except Exception as e:
        logger.warning(f"Image coverage calc failed: {e}")
        return 0.0




# ================= ** Other Methodology =================
# Unified return format: (score, mask, signals)
# def analyze_black_level_consistency(img, bs=32): return 0, None, []
# def analyze_sharpness_contrast(img, bs=32): return 0, None, []
# def detect_copy_move_sift(img): return 0, None, []