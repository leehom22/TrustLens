import cv2
import numpy as np
from PIL import Image

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
    y_start = int(h * 0.20)
    y_end = int(h * 0.80)
    
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


# ================= ** Other Methodology =================
# Unified return format: (score, mask, signals)
# def analyze_black_level_consistency(img, bs=32): return 0, None, []
# def analyze_sharpness_contrast(img, bs=32): return 0, None, []
# def detect_copy_move_sift(img): return 0, None, []