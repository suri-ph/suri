# ============================================================================ #
# Local Enhanced Recognition Module
# Embedded in the main script to avoid import issues

import cv2
import numpy as np
from sklearn.preprocessing import normalize

def extract_pyramid_features(face_img, session, face_size=112):
    """Extract features at multiple scales for robust recognition"""
    pyramid_scales = [0.8, 1.0, 1.2]
    features = []
    
    # Validate input
    if face_img.size == 0:
        print("[WARNING] Empty face image provided")
        return np.zeros(512)  # Return zero embedding
    
    # Ensure minimum size
    h, w = face_img.shape[:2]
    if h < 20 or w < 20:
        print(f"[WARNING] Face too small ({h}x{w}), resizing to minimum")
        face_img = cv2.resize(face_img, (40, 40))
        h, w = face_img.shape[:2]
    
    for scale in pyramid_scales:
        try:
            # Scale the face
            new_h, new_w = int(h * scale), int(w * scale)
            
            # Ensure minimum dimensions
            new_h = max(new_h, 20)
            new_w = max(new_w, 20)
            
            scaled_face = cv2.resize(face_img, (new_w, new_h))
            
            # Center crop or pad to target size
            if scale >= 1.0 and new_h >= face_size and new_w >= face_size:
                # Crop center
                start_y = (new_h - face_size) // 2
                start_x = (new_w - face_size) // 2
                cropped = scaled_face[start_y:start_y + face_size, 
                                    start_x:start_x + face_size]
            else:
                # Pad to center or resize if too small
                cropped = np.zeros((face_size, face_size, 3), dtype=np.uint8)
                
                # Ensure scaled face doesn't exceed target dimensions
                if new_h > face_size or new_w > face_size:
                    # Resize down to fit
                    aspect_ratio = min(face_size / new_h, face_size / new_w)
                    new_h = int(new_h * aspect_ratio)
                    new_w = int(new_w * aspect_ratio)
                    scaled_face = cv2.resize(scaled_face, (new_w, new_h))
                
                # Center the face in the padded image
                start_y = (face_size - new_h) // 2
                start_x = (face_size - new_w) // 2
                end_y = start_y + new_h
                end_x = start_x + new_w
                
                # Ensure we don't exceed boundaries
                start_y = max(0, start_y)
                start_x = max(0, start_x)
                end_y = min(face_size, end_y)
                end_x = min(face_size, end_x)
                
                # Adjust scaled_face dimensions if needed
                actual_h = end_y - start_y
                actual_w = end_x - start_x
                
                if scaled_face.shape[0] != actual_h or scaled_face.shape[1] != actual_w:
                    scaled_face = cv2.resize(scaled_face, (actual_w, actual_h))
                
                cropped[start_y:end_y, start_x:end_x] = scaled_face
            
            # Preprocess and extract features
            blob = preprocess_face_enhanced(cropped, face_size)
            feature = session.run(None, {'input': blob})[0][0]
            features.append(feature)
            
        except Exception as e:
            print(f"[WARNING] Error processing scale {scale}: {e}")
            # Use original size as fallback
            try:
                cropped = cv2.resize(face_img, (face_size, face_size))
                blob = preprocess_face_enhanced(cropped, face_size)
                feature = session.run(None, {'input': blob})[0][0]
                features.append(feature)
            except Exception as e2:
                print(f"[ERROR] Fallback failed: {e2}")
                # Return zero vector as last resort
                features.append(np.zeros(512))
    
    if not features:
        print("[ERROR] No features extracted, returning zero vector")
        return np.zeros(512)
    
    # Weighted fusion (larger scales get more weight for detail)
    weights = [0.3, 0.5, 0.2][:len(features)]  # Adjust for actual number of features
    if len(weights) != len(features):
        weights = [1.0/len(features)] * len(features)  # Equal weights if mismatch
    
    try:
        fused_feature = np.average(features, axis=0, weights=weights)
        return normalize([fused_feature])[0]
    except Exception as e:
        print(f"[ERROR] Feature fusion failed: {e}")
        return normalize([features[0]])[0] if features else np.zeros(512)

def preprocess_face_enhanced(face_img, face_size=112):
    """Enhanced preprocessing with lighting and blur handling"""
    # Apply CLAHE for extreme lighting conditions
    lab = cv2.cvtColor(face_img, cv2.COLOR_BGR2LAB)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    lab[:,:,0] = clahe.apply(lab[:,:,0])
    enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    
    # Gaussian blur for noise reduction
    enhanced = cv2.GaussianBlur(enhanced, (3, 3), 0.5)
    
    # Resize to target size
    face = cv2.resize(enhanced, (face_size, face_size))
    
    # Normalize
    face = face[:, :, ::-1].astype(np.float32) / 255.0
    face = (face - 0.5) / 0.5
    face = np.transpose(face, (2, 0, 1))
    return np.expand_dims(face, axis=0)

def calculate_quality_score(face_img, bbox_conf):
    """Calculate comprehensive quality score"""
    scores = []
    
    # 1. Sharpness (Laplacian variance)
    gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    sharpness_score = min(laplacian_var / 1000.0, 1.0)  # Normalize
    scores.append(sharpness_score)
    
    # 2. Brightness consistency
    brightness = np.mean(gray)
    brightness_score = 1.0 - abs(brightness - 127.5) / 127.5  # Closer to mid-gray is better
    scores.append(brightness_score)
    
    # 3. Contrast
    contrast_score = gray.std() / 128.0  # Normalize std dev
    scores.append(min(contrast_score, 1.0))
    
    # 4. Face size (larger faces generally better)
    h, w = face_img.shape[:2]
    size_score = min((h * w) / (112 * 112), 1.0)  # Relative to baseline
    scores.append(size_score)
    
    # 5. Detection confidence
    scores.append(bbox_conf)
    
    # Weighted average
    weights = [0.3, 0.2, 0.2, 0.15, 0.15]
    quality_score = np.average(scores, weights=weights)
    
    return quality_score

def detect_blur(image):
    """Detect blur using FFT analysis"""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply FFT
    f_transform = np.fft.fft2(gray)
    f_shift = np.fft.fftshift(f_transform)
    magnitude_spectrum = np.log(np.abs(f_shift) + 1)
    
    # Calculate blur metric
    blur_metric = np.mean(magnitude_spectrum)
    return blur_metric < 10.0  # Threshold for blur detection

def deblur_face(face_img):
    """Simple deblurring using sharpening kernel"""
    if detect_blur(face_img):
        # Unsharp masking
        gaussian = cv2.GaussianBlur(face_img, (9, 9), 2.0)
        unsharp = cv2.addWeighted(face_img, 2.0, gaussian, -1.0, 0)
        return np.clip(unsharp, 0, 255).astype(np.uint8)
    return face_img

def enhance_face_preprocessing(face_img, bbox_conf):
    """Enhanced preprocessing pipeline"""
    
    # 1. Quality assessment
    quality_score = calculate_quality_score(face_img, bbox_conf)
    
    # 2. Deblur if needed
    if quality_score < 0.6:  # Low quality faces
        face_img = deblur_face(face_img)
    
    # 3. Lighting enhancement for extreme conditions
    if np.mean(face_img) < 80 or np.mean(face_img) > 180:  # Very dark or bright
        # CLAHE enhancement
        lab = cv2.cvtColor(face_img, cv2.COLOR_BGR2LAB)
        clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8,8))
        lab[:,:,0] = clahe.apply(lab[:,:,0])
        face_img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    
    return face_img, quality_score

def get_adaptive_threshold(conditions, base_threshold=0.20):
    """Get threshold adjusted for current conditions"""
    condition_modifiers = {
        'low_light': -0.05,      # More lenient in low light
        'motion_blur': -0.03,    # More lenient with blur
        'partial_occlusion': -0.08,  # Much more lenient with occlusion
        'high_quality': +0.05,   # Stricter with high quality
        'crowded_scene': -0.02   # Slightly more lenient in crowds
    }
    
    threshold = base_threshold
    
    for condition in conditions:
        if condition in condition_modifiers:
            threshold += condition_modifiers[condition]
    
    # Clamp to reasonable range
    return max(0.1, min(0.4, threshold))

def detect_conditions(face_img, face_quality, detection_conf, scene_crowding=1.0):
    """Automatically detect conditions affecting recognition"""
    conditions = []
    
    # Lighting conditions
    brightness = np.mean(cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY))
    if brightness < 80 or brightness > 200:
        conditions.append('low_light')
    
    # Quality-based conditions
    if face_quality < 0.5:
        conditions.append('motion_blur')
    
    if face_quality > 0.8:
        conditions.append('high_quality')
    
    # Detection confidence as proxy for occlusion
    if detection_conf < 0.6:
        conditions.append('partial_occlusion')
    
    # Scene crowding
    if scene_crowding > 3:  # More than 3 faces detected
        conditions.append('crowded_scene')
    
    return conditions
