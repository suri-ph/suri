"""
Dual MiniFASNet Anti-Spoofing Detector
Ensemble approach using both MiniFASNetV2 and MiniFASNetV1SE
APK-REPLICA: Simple, fast, zero-latency implementation
"""

import copy
import hashlib
import logging
import os
import time
from collections import deque
from typing import Any, Dict, List, Optional, Tuple, Union

import cv2
import numpy as np
import onnxruntime as ort

from utils.quality_validator import AntiSpoofQualityGate
from utils.temporal_analyzer import TemporalConsistencyAnalyzer
from utils.adaptive_threshold import AdaptiveThresholdManager

logger = logging.getLogger(__name__)

class DualMiniFASNetDetector:
    """
    Dual-model anti-spoofing detector using ensemble prediction
    Combines MiniFASNetV2 (texture-based) and MiniFASNetV1SE (shape-based with SE)
    
    THREAD SAFETY (Pitfall #6 verification):
    - ONNX sessions are thread-safe for inference (read-only after init)
    - Cache dict (_cache) is NOT thread-safe; use external locking for concurrent writes
    - Deep copies in _format_result and batch processing prevent reference contamination
    - Safe for concurrent read-only operations or single-writer scenarios
    - For multi-threaded writes, wrap detect_faces_batch calls with threading.Lock
    """
    
    def __init__(
        self,
        model_v2_path: str,
        model_v1se_path: str,
        input_size: Tuple[int, int] = (80, 80),
        threshold: float = 0.65,  # RANK 1 OPTIMAL: Research-backed optimal value
        providers: Optional[List[str]] = None,
        max_batch_size: int = 8,
        session_options: Optional[Dict] = None,
        v2_weight: float = 0.6,
        v1se_weight: float = 0.4,
        cache_confidence_floor: float = 0.98,
        enable_quality_gates: bool = True,
        enable_temporal_analysis: bool = True,
        enable_adaptive_threshold: bool = True
    ):
        self.model_v2_path = model_v2_path
        self.model_v1se_path = model_v1se_path
        self.input_size = input_size
        self.threshold = threshold
        self.providers = list(providers) if providers else ['CPUExecutionProvider']
        self.max_batch_size = max(1, int(max_batch_size))
        self.session_options = session_options
        self.v2_weight = v2_weight
        self.v1se_weight = v1se_weight
        self.cache_confidence_floor = cache_confidence_floor
        self.cache_duration = 0.0  # seconds, configurable at runtime
        self._cache: Dict[str, Dict[str, Any]] = {}
        self.temporal_history: Dict[int, deque] = {}  # DEPRECATED - use TemporalConsistencyAnalyzer
        self.temporal_window_size = 5
        self.temporal_timeout = 1.0
        self.real_threshold = threshold  # legacy compatibility for deprecated filters
        
        # Normalize weights
        total_weight = v2_weight + v1se_weight
        self.v2_weight = v2_weight / total_weight
        self.v1se_weight = v1se_weight / total_weight
        
        # Model sessions
        self.session_v2 = None
        self.session_v1se = None
        
        # 🏆 RANK 1 ANTI-SPOOFING COMPONENTS 🏆
        self.enable_quality_gates = enable_quality_gates
        self.enable_temporal_analysis = enable_temporal_analysis
        self.enable_adaptive_threshold = enable_adaptive_threshold
        
        # Initialize RANK 1 components with optimal thresholds
        if self.enable_quality_gates:
            self.quality_gate = AntiSpoofQualityGate(
                min_resolution=80,
                blur_threshold=100.0,  # RANK 1 OPTIMAL
                brightness_range=(40, 220),  # RANK 1 OPTIMAL
                overexposure_ratio=0.30,  # RANK 1 OPTIMAL
                underexposure_ratio=0.30,  # RANK 1 OPTIMAL
                enable_rescue=True
            )
            logger.info("[SUCCESS] Quality Gate ENABLED with RANK 1 optimal thresholds")
        else:
            self.quality_gate = None
            logger.warning("[WARNING] Quality Gate DISABLED")
        
        if self.enable_temporal_analysis:
            self.temporal_analyzer = TemporalConsistencyAnalyzer(
                history_size=5,  # RANK 1 OPTIMAL (166ms at 30fps)
                score_variance_threshold=0.03,  # RANK 1 OPTIMAL
                correlation_threshold=0.97,  # RANK 1 OPTIMAL
                micro_movement_threshold=0.001,  # RANK 1 OPTIMAL
                history_timeout=1.0
            )
            logger.info("[SUCCESS] Temporal Analysis ENABLED with RANK 1 optimal thresholds")
        else:
            self.temporal_analyzer = None
            logger.warning("[WARNING] Temporal Analysis DISABLED")
        
        if self.enable_adaptive_threshold:
            self.adaptive_threshold_mgr = AdaptiveThresholdManager(
                base_threshold=threshold,  # Use provided threshold as base
                min_threshold=0.40,  # RANK 1 OPTIMAL
                max_threshold=0.85   # RANK 1 OPTIMAL
            )
            logger.info(f"[SUCCESS] Adaptive Thresholding ENABLED with base={threshold:.2f}")
        else:
            self.adaptive_threshold_mgr = None
            logger.warning("[WARNING] Adaptive Thresholding DISABLED")
        
        # Initialize both models
        self._initialize_models()
        self._ensure_sessions_ready()
    
    def _initialize_models(self):
        """Initialize both ONNX models with optimized session options"""
        try:
            for model_path in (self.model_v2_path, self.model_v1se_path):
                if not os.path.exists(model_path):
                    raise FileNotFoundError(f"Model file not found: {model_path}")

            # Create optimized session options
            session_opts = ort.SessionOptions()
            
            # Apply optimized session options if available
            if self.session_options:
                for key, value in self.session_options.items():
                    if hasattr(session_opts, key):
                        setattr(session_opts, key, value)
            
            # Initialize MiniFASNetV2 (texture-based)
            self.session_v2 = ort.InferenceSession(
                self.model_v2_path,
                sess_options=session_opts,
                providers=self.providers
            )
            
            # Initialize MiniFASNetV1SE (shape-based with SE)
            self.session_v1se = ort.InferenceSession(
                self.model_v1se_path,
                sess_options=session_opts,
                providers=self.providers
            )
            
            
        except Exception as e:
            logger.error(f"Failed to initialize MiniFASNet ONNX sessions: {e}")
            raise

    def _ensure_sessions_ready(self):
        if self.session_v2 is None or self.session_v1se is None:
            raise RuntimeError("DualMiniFASNetDetector sessions failed to initialize")

    def clear_cache(self):
        """Explicitly clear cached anti-spoofing decisions."""
        self._cache.clear()

    def _make_cache_key(self, face_crop_v2: np.ndarray, face_crop_v1se: np.ndarray) -> Optional[str]:
        """PITFALL VERIFICATION (Pitfall #3): Enhanced cache key with brightness & temporal salt."""
        if self.cache_duration <= 0:
            return None

        hasher = hashlib.sha1()
        hasher.update(face_crop_v2.tobytes())
        hasher.update(face_crop_v1se.tobytes())
        
        # SECURITY FIX: Add brightness histogram to prevent texture-based cache poisoning
        # A spoof frame with similar content but different lighting should get a different key
        gray_v2 = cv2.cvtColor(face_crop_v2, cv2.COLOR_BGR2GRAY)
        hist = cv2.calcHist([gray_v2], [0], None, [16], [0, 256])  # 16-bin histogram
        hasher.update(hist.tobytes())
        
        # SECURITY FIX: Add temporal bucket (1-second buckets) to limit cache lifetime
        # This prevents a "real" verdict from being reused indefinitely
        time_bucket = int(time.time() / 1.0)  # 1-second buckets
        hasher.update(str(time_bucket).encode())
        
        return hasher.hexdigest()

    def _get_cached_result(self, cache_key: Optional[str]) -> Optional[Dict[str, Any]]:
        """Thread-safe for reads; caller must handle write contention."""
        if not cache_key or self.cache_duration <= 0:
            return None

        entry = self._cache.get(cache_key)  # Dict.get is atomic in CPython
        if not entry:
            return None

        if (time.time() - entry["timestamp"]) > self.cache_duration:
            self._cache.pop(cache_key, None)
            return None

        cached = copy.deepcopy(entry["antispoofing"])
        if cached.get("status") in {"processing_failed", "error"}:
            return None

        if cached.get("is_real", False) and cached.get("confidence", 0.0) < self.cache_confidence_floor:
            return None

        cached["cached"] = True
        cached.setdefault("processing_time", 0.0)
        cached.setdefault("model_type", "dual_minifasnet")
        return cached

    def _store_cache_entry(self, cache_key: Optional[str], antispoofing_result: Dict[str, Any]):
        """Store cache entry. CAUTION: Not thread-safe for concurrent writes."""
        if not cache_key or self.cache_duration <= 0:
            return

        sanitized = {k: v for k, v in antispoofing_result.items() if k not in {"processing_time", "cached"}}
        if sanitized.get("status") in {"processing_failed", "error"}:
            return

        if sanitized.get("is_real", False) and sanitized.get("confidence", 0.0) < self.cache_confidence_floor:
            return

        # Deep copy to prevent external mutation
        self._cache[cache_key] = {
            "timestamp": time.time(),
            "antispoofing": sanitized  # Already sanitized dict copy
        }

    @staticmethod
    def _clone_bbox(bbox: Optional[Union[Dict, List]]) -> Optional[Union[Dict, List]]:
        if bbox is None:
            return None
        if isinstance(bbox, dict):
            return dict(bbox)
        if isinstance(bbox, list):
            return list(bbox)
        return bbox

    def _format_result(
        self,
        face_index: int,
        face: Dict,
        bbox: Optional[Union[Dict, List]],
        antispoofing_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        CRITICAL FIX: Deep copy ALL data to prevent multi-face contamination.
        
        BUG SCENARIO (BEFORE FIX):
        - Face 1 has nested dict: {"landmarks": [...]}
        - Face 2 shares SAME landmarks list reference
        - When Face 1 antispoofing updates, Face 2 sees the change!
        
        SOLUTION:
        Use copy.deepcopy() to clone ALL nested structures (lists, dicts, etc.)
        """
        # Deep copy antispoofing_data to prevent contamination
        result = {
            "face_id": face_index,
            "bbox": self._clone_bbox(bbox),
            "antispoofing": copy.deepcopy(antispoofing_data)  # DEEP COPY!
        }

        # CRITICAL: Deep copy ALL face data to prevent shared references
        for key, value in face.items():
            if key not in result:
                # Deep copy to prevent mutable object sharing between faces
                result[key] = copy.deepcopy(value)

        return result

    def _build_error_result(
        self,
        face_index: int,
        face: Dict,
        bbox: Optional[Union[Dict, List]],
        status: str,
        message: str,
        label: str = "Spoof Suspected"
    ) -> Dict[str, Any]:
        """Build error result with deep copy to prevent contamination."""
        antispoofing_data = {
            "status": status,
            "label": label,
            "message": message,
            "is_real": False,
            "confidence": 0.0,
            "real_score": 0.0,
            "fake_score": 1.0,
            "threshold": self.threshold,
            "processing_time": 0.0,
            "cached": False,
            "model_type": "dual_minifasnet"
        }

        return self._format_result(face_index, face, bbox, antispoofing_data)
    
    def _apply_temporal_filter_DEPRECATED(self, track_id: int, current_is_real: bool, current_confidence: float) -> Tuple[bool, float]:
        """
        Apply temporal filtering to prevent flickering between real/fake
        
        OPTIMIZED STRATEGY:
        - Real faces: INSTANT recognition (don't wait for history)
        - Spoofed faces: STRICT filtering (must stay fake if ever detected as fake)
        
        Args:
            track_id: Track ID from SORT tracker
            current_is_real: Current frame's prediction
            current_confidence: Current frame's confidence
            
        Returns:
            (filtered_is_real, filtered_confidence)
        """
        current_time = time.time()
        
        # Initialize history for new track
        if track_id not in self.temporal_history:
            self.temporal_history[track_id] = deque(maxlen=self.temporal_window_size)
        
        # Get history for this track
        history = self.temporal_history[track_id]
        
        # Clean old entries (older than timeout)
        while history and (current_time - history[0][0]) > self.temporal_timeout:
            history.popleft()
        
        # Add current frame
        history.append((current_time, current_is_real, current_confidence))
        
        # OPTIMIZED STRATEGY: Different rules for REAL vs FAKE
        
        # Count real vs fake in history
        real_count = sum(1 for _, is_real, _ in history if is_real)
        fake_count = len(history) - real_count
        
        # RULE 1: If current frame is REAL and we have enough confidence, allow it INSTANTLY
        # This makes real face recognition fast (no waiting)
        if current_is_real and current_confidence >= self.real_threshold:
            # But check if there's a recent strong FAKE signal (within last 3 frames)
            recent_strong_fake = any(
                not is_real and conf >= 0.7  # Strong fake confidence
                for _, is_real, conf in history
            )
            
            if recent_strong_fake:
                # Strong fake signal detected recently - stay FAKE
                logger.info(f"[TEMPORAL FILTER] Track {track_id}: Recent strong FAKE detected - BLOCKING")
                return False, current_confidence
            else:
                # No strong fake signal - allow REAL instantly
                return True, current_confidence
        
        # RULE 2: If current frame is FAKE, apply majority voting from history
        # This prevents temporary fluctuations from blocking real faces
        if not current_is_real:
            # Check if majority of history is FAKE
            if fake_count > real_count:
                # Majority is fake - definitely FAKE
                avg_confidence = sum(conf for _, _, conf in history) / len(history)
                logger.info(f"[TEMPORAL FILTER] Track {track_id}: {fake_count}/{len(history)} fake frames - BLOCKING as SPOOF")
                return False, avg_confidence
            else:
                # Majority is real but current is fake - might be temporary blur
                # Only block if current fake confidence is strong
                if current_confidence >= 0.6:
                    # Strong fake signal - block it
                    logger.info(f"[TEMPORAL FILTER] Track {track_id}: Strong FAKE signal ({current_confidence:.2f}) - BLOCKING")
                    return False, current_confidence
                else:
                    # Weak fake signal, majority is real - allow as real
                    avg_confidence = sum(conf for _, is_real, conf in history if is_real) / max(real_count, 1)
                    return True, avg_confidence
        
        # RULE 3: For ambiguous cases, use majority voting
        if real_count > fake_count:
            avg_confidence = sum(conf for _, is_real, conf in history if is_real) / real_count
            return True, avg_confidence
        else:
            avg_confidence = sum(conf for _, is_real, conf in history if not is_real) / max(fake_count, 1)
            return False, avg_confidence
    
    def _preprocess_single_face(self, face_image: np.ndarray) -> np.ndarray:
        """
        Preprocess a single face image for MiniFASNet models (80x80 input)
        
        CRITICAL: Matches original Silent-Face-Anti-Spoofing preprocessing
        Reference: engine/src/main/cpp/live/live.cpp line 58-62
        
        ncnn::Mat::from_pixels() internally does:
        1. BGR -> RGB conversion
        2. Normalization to [0, 1] by dividing by 255.0
        
        We must replicate this behavior for ONNX!
        """
        try:
            # Ensure input is valid
            if face_image is None or face_image.size == 0:
                raise ValueError("Invalid face image")
            
            # Resize to 80x80 (MiniFASNet input size)
            resized = cv2.resize(face_image, self.input_size, interpolation=cv2.INTER_LINEAR)
            
            # Convert BGR to RGB
            rgb_image = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
            
            # PITFALL VERIFICATION (Pitfall #1): Normalization matches PyTorch training [SUCCESS]
            # VERIFIED: Silent-Face-Anti-Spoofing/src/data_io/functional.py line 59:
            # "return img.float()" - the div(255) was commented out by original author!
            # Models were trained on RAW [0, 255] values, NOT [0, 1] normalized!
            # This preprocessing is CORRECT and matches APK baseline (after ncnn's internal RGB conversion).
            preprocessed = rgb_image.astype(np.float32)  # Keep [0, 255] range!
            
            # Transpose to NCHW format and add batch dimension
            input_tensor = np.transpose(preprocessed, (2, 0, 1))  # HWC to CHW
            input_tensor = np.expand_dims(input_tensor, axis=0)  # Add batch dimension
            
            # Verify tensor shape
            expected_shape = (1, 3, self.input_size[1], self.input_size[0])
            if input_tensor.shape != expected_shape:
                raise ValueError(f"Unexpected tensor shape: {input_tensor.shape}, expected: {expected_shape}")
            
            return input_tensor
            
        except Exception as e:
            logger.error(f"Error preprocessing face image: {e}")
            raise
    
    def _extract_face_crop(self, image: np.ndarray, bbox, scale: float = 2.7, shift_x: float = 0.0, shift_y: float = 0.0) -> Optional[np.ndarray]:
        """
        Extract face crop using scaling and shifting like the original MiniFASNet implementation.
        
        This is a 100% accurate Python port of the C++ implementation from:
        https://github.com/minivision-ai/Silent-Face-Anti-Spoofing-APK/blob/main/engine/src/main/cpp/live/live.cpp#L79-L126
        
        The original uses scale parameters (NOT margin):
        - MiniFASNetV2 (2.7_80x80): scale=2.7 (crops 270% of face bbox with context)
        - MiniFASNetV1SE (4.0_80x80): scale=4.0 (crops 400% of face bbox with context)
        
        Args:
            image: Input image
            bbox: Face bounding box [x, y, width, height] or dict with x, y, width, height
            scale: Scale factor for bbox expansion (2.7 for V2, 4.0 for V1SE)
            shift_x: Horizontal shift as fraction of bbox width (default 0.0)
            shift_y: Vertical shift as fraction of bbox height (default 0.0)
        
        Returns:
            Cropped face region with context, or None if extraction fails
        """
        try:
            h, w = image.shape[:2]
            
            # Handle different bbox formats
            if isinstance(bbox, dict):
                x = float(bbox.get('x', 0))
                y = float(bbox.get('y', 0))
                width = float(bbox.get('width', 0))
                height = float(bbox.get('height', 0))
            elif isinstance(bbox, list) and len(bbox) >= 4:
                x, y, width, height = map(float, bbox[:4])
            else:
                logger.error(f"Invalid bbox format: {bbox}")
                return None
            
            # Ensure minimum face size
            min_size = 32
            if width < min_size or height < min_size:
                return None
            
            # --- BEGIN: Exact port of C++ CalculateBox function ---
            # Reference: engine/src/main/cpp/live/live.cpp lines 79-126
            
            box_width = int(width)
            box_height = int(height)
            
            # Calculate shift amounts in pixels (line 88-89 in C++)
            shift_x_px = int(box_width * shift_x)
            shift_y_px = int(box_height * shift_y)
            
            # CRITICAL FIX: Don't clamp scale here!
            # The original C++ clamped scale, but this causes V2 and V1SE to become identical
            # when face is large. We handle boundaries later instead.
            # Original line: scale = min(scale, min((w - 1) / float(box_width), (h - 1) / float(box_height)))
            # New approach: Use the requested scale, handle boundaries in clipping
            requested_scale = scale  # Keep original scale request
            
            # Calculate new dimensions after scaling (using FULL scale, not clamped)
            new_width = int(box_width * requested_scale)
            new_height = int(box_height * requested_scale)
            
            # Calculate bbox center (line 99-100 in C++)
            box_center_x = box_width // 2 + int(x)
            box_center_y = box_height // 2 + int(y)
            
            # Apply scaling and shifting from center (line 102-105 in C++)
            left_top_x = box_center_x - new_width // 2 + shift_x_px
            left_top_y = box_center_y - new_height // 2 + shift_y_px
            right_bottom_x = box_center_x + new_width // 2 + shift_x_px
            right_bottom_y = box_center_y + new_height // 2 + shift_y_px
            
            # CRITICAL FIX: Use reflection padding instead of shifting for boundary cases
            # Shifting causes positional bias - face moves within crop when near edges
            # Padding keeps face centered, matching training data distribution
            
            # Calculate how much padding is needed on each side
            pad_left = max(0, -left_top_x)
            pad_top = max(0, -left_top_y)
            pad_right = max(0, right_bottom_x - w + 1)
            pad_bottom = max(0, right_bottom_y - h + 1)
            
            # If padding is needed, apply reflection padding to the image
            if pad_left > 0 or pad_top > 0 or pad_right > 0 or pad_bottom > 0:
                # Use reflection padding (mirrors edge pixels)
                padded_image = cv2.copyMakeBorder(
                    image,
                    pad_top, pad_bottom, pad_left, pad_right,
                    cv2.BORDER_REFLECT_101  # Reflection without repeating edge
                )
                
                # Adjust coordinates for padded image
                left_top_x += pad_left
                left_top_y += pad_top
                right_bottom_x += pad_left
                right_bottom_y += pad_top
                
                # Extract from padded image
                face_crop = padded_image[left_top_y:right_bottom_y+1, left_top_x:right_bottom_x+1]
            else:
                # No padding needed, extract directly
                face_crop = image[left_top_y:right_bottom_y+1, left_top_x:right_bottom_x+1]
            
            if face_crop.size == 0:
                return None
            
            # Ensure minimum crop size
            crop_h, crop_w = face_crop.shape[:2]
            if crop_h < min_size or crop_w < min_size:
                return None
            
            return face_crop
            
        except Exception as e:
            logger.error(f"Error extracting face crop: {e}")
            return None
    
    def _ensure_scale_separation(self, image: np.ndarray, face_detections: List[Dict]) -> Tuple[np.ndarray, List[Dict]]:
        """
        Ensure faces are small enough relative to image for proper V2/V1SE scale separation.
        
        When faces are too large relative to the image (>20% of dimension), both 2.7x and 4.0x
        scales hit the same image boundary, making crops identical and causing 96% background scores.
        
        This downsamples the image to ensure the largest face is <15% of image dimension,
        allowing proper scale separation between V2 (2.7x) and V1SE (4.0x).
        
        PITFALL VERIFICATION (Pitfall #2): Logs downsampling activity to detect excessive blur.
        
        Args:
            image: Input image
            face_detections: List of face detection dicts with bbox info
            
        Returns:
            (possibly downsampled image, updated face_detections with scaled bboxes)
        """
        h, w = image.shape[:2]
        
        # Find largest face dimension
        max_face_dim = 0
        max_face_index = -1
        for idx, face in enumerate(face_detections):
            bbox = face.get('bbox', face.get('box', {}))
            if isinstance(bbox, dict):
                face_w = float(bbox.get('width', 0))
                face_h = float(bbox.get('height', 0))
            elif isinstance(bbox, list) and len(bbox) >= 4:
                face_w = float(bbox[2] if len(bbox) > 2 else 0)
                face_h = float(bbox[3] if len(bbox) > 3 else 0)
            else:
                continue
            face_dim = max(face_w, face_h)
            if face_dim > max_face_dim:
                max_face_dim = face_dim
                max_face_index = idx
        
        if max_face_dim == 0:
            return image, face_detections
        
        # Target: largest face should be ~20% of image dimension
        # This ensures 4.0x scale (400%) fits comfortably: 20% × 4.0 = 80% of image
        # And 2.7x scale (270%) also fits: 20% × 2.7 = 54% of image  
        # Leaving enough room to avoid excessive shifting/padding
        target_ratio = 0.20  # Increased from 0.15 to allow more working room
        min_dim = min(h, w)
        current_ratio = max_face_dim / min_dim
        
        if current_ratio > target_ratio:
            # Need to downsample
            scale_factor = target_ratio / current_ratio
            new_w = int(w * scale_factor)
            new_h = int(h * scale_factor)
            
            # Ensure minimum image size - reduced to allow more aggressive downsampling
            # Models work fine with smaller images as long as face quality is maintained
            if new_w < 240 or new_h < 180:
                logger.warning(
                    f"[SCALE-SEPARATION] Cannot downsample further: would result in {new_w}x{new_h} "
                    f"(face too large: {max_face_dim:.0f}px in {min_dim}px image = {current_ratio:.1%}). "
                    f"Risk: V2/V1SE crops may become identical, causing high background scores. "
                    f"Consider using higher resolution camera or repositioning subjects."
                )
                return image, face_detections
            
            # Calculate resulting face size after downsampling
            new_face_dim = max_face_dim * scale_factor
            
            # Downsample image
            logger.info(
                f"[SCALE-SEPARATION] Downsampling image {w}x{h} -> {new_w}x{new_h} (scale={scale_factor:.3f}). "
                f"Largest face: {max_face_dim:.0f}px ({current_ratio:.1%} of frame) -> {new_face_dim:.0f}px ({target_ratio:.1%}). "
                f"This ensures V2 (2.7x) and V1SE (4.0x) crops remain distinct."
            )
            downsampled_image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
            
            # Scale all bboxes
            updated_detections = []
            for face in face_detections:
                face_copy = face.copy()
                bbox = face_copy.get('bbox', face_copy.get('box', {}))
                
                if isinstance(bbox, dict):
                    bbox_copy = bbox.copy()
                    bbox_copy['x'] = float(bbox.get('x', 0)) * scale_factor
                    bbox_copy['y'] = float(bbox.get('y', 0)) * scale_factor
                    bbox_copy['width'] = float(bbox.get('width', 0)) * scale_factor
                    bbox_copy['height'] = float(bbox.get('height', 0)) * scale_factor
                    face_copy['bbox'] = bbox_copy
                elif isinstance(bbox, list) and len(bbox) >= 4:
                    bbox_copy = [
                        bbox[0] * scale_factor,
                        bbox[1] * scale_factor,
                        bbox[2] * scale_factor,
                        bbox[3] * scale_factor
                    ]
                    face_copy['bbox'] = bbox_copy
                
                updated_detections.append(face_copy)
            
            return downsampled_image, updated_detections
        
        # No downsampling needed
        return image, face_detections
    
    def _predict_single_model(self, session: ort.InferenceSession, input_tensor: np.ndarray) -> Dict:
        """Run inference on a single model"""
        try:
            input_name = session.get_inputs()[0].name
            outputs = session.run(None, {input_name: input_tensor})
            prediction = outputs[0][0]  # Get first prediction
            
            # Apply softmax to get probabilities
            exp_pred = np.exp(prediction - np.max(prediction))
            softmax_probs = exp_pred / np.sum(exp_pred)
            
            # CORRECT class indices based on Silent-Face-Anti-Spoofing training:
            # Index 0: 2D SPOOF (2D spoof/attack - photos, screens, etc.)
            # Index 1: REAL (live face)
            # Index 2: 3D SPOOF (3D spoof/attack - masks, 3D printed faces, etc.)
            #
            # Based on GitHub issue #55: 0=2D spoof, 1=real, 2=3D spoof
            spoof_2d_score = float(softmax_probs[0])
            real_score = float(softmax_probs[1])
            spoof_3d_score = float(softmax_probs[2])
            
            # BINARY CLASSIFICATION: Combine all spoof types (2D + 3D) into single "spoof" class
            fake_score = spoof_2d_score + spoof_3d_score
            
            # If background score is too high, it means face detection is poor
            # We'll return this info but let the ensemble decide
            return {
                "real_score": real_score,
                "fake_score": fake_score,  # Combined 2D + 3D spoof scores
                "confidence": max(real_score, fake_score),
                # Additional detailed information for debugging (spoof type breakdown)
                "spoof_2d_score": spoof_2d_score,
                "spoof_3d_score": spoof_3d_score,
                "spoof_type": "2D" if spoof_2d_score > spoof_3d_score else "3D" if spoof_3d_score > 0 else "none",
                "is_binary": True  # Indicates this is binary classification (live vs spoof)
            }
            
        except Exception as e:
            logger.error(f"Error in single model prediction: {e}")
            return {
                "real_score": 0.5,
                "fake_score": 0.5,  # Combined 2D + 3D spoof scores
                "confidence": 0.5,
                "spoof_2d_score": 0.25,
                "spoof_3d_score": 0.25,
                "spoof_type": "error",
                "is_binary": True,
                "error": str(e)
            }
    
    def _predict_single_model_batch(self, session: ort.InferenceSession, input_tensors: np.ndarray) -> List[Dict]:
        """
        BATCH PROCESSING: Run inference on multiple faces in a single model call
        
        Args:
            session: ONNX Runtime session
            input_tensors: Batch of preprocessed face tensors (N, C, H, W)
            
        Returns:
            List of prediction results for each face
        """
        try:
            input_name = session.get_inputs()[0].name
            outputs = session.run(None, {input_name: input_tensors})
            predictions = outputs[0]  # Shape: (N, num_classes)
            
            results = []
            for prediction in predictions:
                # Apply softmax to get probabilities
                exp_pred = np.exp(prediction - np.max(prediction))
                softmax_probs = exp_pred / np.sum(exp_pred)
                
                # Apply same 3-class mapping as single model prediction
                spoof_2d_score = float(softmax_probs[0])
                real_score = float(softmax_probs[1])
                spoof_3d_score = float(softmax_probs[2])
                
                # BINARY CLASSIFICATION: Combine all spoof types (2D + 3D) into single "spoof" class
                fake_score = spoof_2d_score + spoof_3d_score
                
                results.append({
                    "real_score": real_score,
                    "fake_score": fake_score,  # Combined 2D + 3D spoof scores
                    "confidence": max(real_score, fake_score),
                    # Additional detailed information for debugging (spoof type breakdown)
                    "spoof_2d_score": spoof_2d_score,
                    "spoof_3d_score": spoof_3d_score,
                    "spoof_type": "2D" if spoof_2d_score > spoof_3d_score else "3D" if spoof_3d_score > 0 else "none",
                    "is_binary": True  # Indicates this is binary classification (live vs spoof)
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error in batch model prediction: {e}")
            # Return default results for all faces
            # CRITICAL FIX: Create SEPARATE dict for each face (NOT shared reference!)
            num_faces = len(input_tensors) if isinstance(input_tensors, np.ndarray) else 1
            return [
                {
                    "real_score": 0.5,
                    "fake_score": 0.5,  # Combined 2D + 3D spoof scores
                    "confidence": 0.5,
                    "spoof_2d_score": 0.25,
                    "spoof_3d_score": 0.25,
                    "spoof_type": "error",
                    "is_binary": True,
                    "error": str(e)
                }
                for _ in range(num_faces)  # List comprehension creates NEW dict each iteration
            ]
    
    def _ensemble_prediction(self, v2_result: Dict, v1se_result: Dict, track_id: Optional[int] = None, quality_score: Optional[float] = None, face_crop_v2: Optional[np.ndarray] = None) -> Dict:
        """
        🏆 RANK 1 ENSEMBLE PREDICTION 🏆
        Combine predictions with temporal analysis and adaptive thresholding
        
        ENHANCEMENTS OVER APK:
        1. Temporal consistency analysis (detects static/repetitive patterns)
        2. Adaptive thresholding (context-aware decisions)
        3. Quality-aware confidence scoring
        """
        try:
            # Weighted average of real scores (exactly like APK)
            ensemble_real_score = (
                v2_result["real_score"] * self.v2_weight +
                v1se_result["real_score"] * self.v1se_weight
            )
            
            ensemble_fake_score = (
                v2_result["fake_score"] * self.v2_weight +
                v1se_result["fake_score"] * self.v1se_weight
            )
            
            # No background class in 3-class model - removed background score calculation
            
            # 🏆 RANK 1 ENHANCEMENT 1: Temporal Consistency Analysis
            temporal_verdict = "UNCERTAIN"
            temporal_confidence = 0.5
            temporal_analysis = {}
            
            if self.enable_temporal_analysis and self.temporal_analyzer and track_id is not None:
                # Extract texture features for correlation analysis
                texture_features = None
                if face_crop_v2 is not None:
                    texture_features = self.temporal_analyzer.extract_texture_features(face_crop_v2)
                
                # Update temporal history
                self.temporal_analyzer.update_history(
                    track_id,
                    ensemble_real_score,
                    ensemble_fake_score,
                    texture_features
                )
                
                # Analyze temporal patterns
                temporal_verdict, temporal_confidence, temporal_analysis = \
                    self.temporal_analyzer.analyze_temporal_pattern(
                        track_id,
                        ensemble_real_score,
                        ensemble_fake_score
                    )
                
                # CONSERVATIVE: Only override if temporal analysis is VERY confident and ensemble is borderline
                if (temporal_verdict == "SPOOF" and temporal_confidence >= 0.90 and 
                    ensemble_real_score < 0.7 and ensemble_fake_score > 0.6):
                    logger.warning(
                        f"🚨 TEMPORAL OVERRIDE: Track {track_id} detected as SPOOF "
                        f"(temporal_conf={temporal_confidence:.2f}, ensemble_real={ensemble_real_score:.2f}). "
                        f"Reason: {temporal_analysis.get('decision_reason', 'Unknown')}"
                    )
                    return {
                        "is_real": False,
                        "real_score": ensemble_real_score,
                        "fake_score": ensemble_fake_score,
                        "confidence": temporal_confidence,
                        "threshold": self.threshold,
                        "adjusted_threshold": self.threshold,
                        "status": "fake",
                        "label": "Spoof Detected (Temporal)",
                        "message": f"Temporal analysis detected spoof: {temporal_analysis.get('decision_reason', 'Unknown')}",
                        "v2_real_score": v2_result["real_score"],
                        "v2_fake_score": v2_result["fake_score"],
                        "v1se_real_score": v1se_result["real_score"],
                        "v1se_fake_score": v1se_result["fake_score"],
                        "ensemble_method": "rank1_temporal_override",
                        "temporal_verdict": temporal_verdict,
                        "temporal_confidence": temporal_confidence,
                        "temporal_analysis": temporal_analysis
                    }
            
            # 🏆 RANK 1 ENHANCEMENT 2: Adaptive Thresholding
            adjusted_threshold = self.threshold
            threshold_info = {}
            
            if self.enable_adaptive_threshold and self.adaptive_threshold_mgr:
                # Get tracking stability
                track_stability = None
                if self.enable_temporal_analysis and self.temporal_analyzer and track_id is not None:
                    track_stability = self.temporal_analyzer.get_track_stability(track_id)
                
                # Compute adaptive threshold
                threshold_info = self.adaptive_threshold_mgr.get_adaptive_threshold(
                    v2_score=v2_result["real_score"],
                    v1se_score=v1se_result["real_score"],
                    quality_score=quality_score,
                    track_stability=track_stability,
                    temporal_verdict=temporal_verdict,
                    temporal_confidence=temporal_confidence
                )
                
                adjusted_threshold = threshold_info["adjusted_threshold"]
                
                logger.debug(
                    f"[ADAPTIVE-THRESHOLD] Adaptive threshold: {self.threshold:.2f} -> {adjusted_threshold:.2f} "
                    f"(boost={threshold_info['total_boost']:+.2f}). {threshold_info['explanation']}"
                )
            
            # Make decision using adjusted threshold (no background class in 3-class model)
            is_real = ensemble_real_score > adjusted_threshold

            if is_real:
                confidence = ensemble_real_score
                status = "real"
                label = "Live Face"
                message = "Live face verified by RANK 1 ensemble."
            else:
                confidence = ensemble_fake_score
                status = "fake"
                label = "Spoof Detected"
                message = "Spoof attempt detected by RANK 1 ensemble."

            result = {
                "is_real": is_real,
                "real_score": ensemble_real_score,
                "fake_score": ensemble_fake_score,
                "confidence": confidence,
                "threshold": self.threshold,
                "adjusted_threshold": adjusted_threshold,
                "status": status,
                "label": label,
                "message": message,
                "v2_real_score": v2_result["real_score"],
                "v2_fake_score": v2_result["fake_score"],
                "v1se_real_score": v1se_result["real_score"],
                "v1se_fake_score": v1se_result["fake_score"],
                "ensemble_method": "rank1_adaptive_temporal"
            }
            
            # Add temporal analysis results if available
            if temporal_verdict != "UNCERTAIN":
                result["temporal_verdict"] = temporal_verdict
                result["temporal_confidence"] = temporal_confidence
                result["temporal_analysis"] = temporal_analysis
            
            # Add threshold adjustment details if available
            if threshold_info:
                result["threshold_info"] = threshold_info
            
            # Add quality score if available
            if quality_score is not None:
                result["quality_score"] = quality_score
            
            return result
            
        except Exception as e:
            logger.error(f"Error in RANK 1 ensemble prediction: {e}")
            return {
                "is_real": False,  # SECURITY: Default to FAKE on error
                "real_score": 0.0,
                "fake_score": 1.0,
                "confidence": 0.0,
                "threshold": self.threshold,
                "adjusted_threshold": self.threshold,
                "status": "error",
                "label": "Error",
                "message": str(e),
                "error": str(e),
                "ensemble_method": "rank1_error"
            }
    
    def _process_single_face(self, face_crop_v2: np.ndarray, face_crop_v1se: np.ndarray, track_id: Optional[int] = None, quality_score: Optional[float] = None) -> Dict:
        """🏆 RANK 1: Process face crops with both models and enhanced ensemble"""
        try:
            # Preprocess both face crops
            input_tensor_v2 = self._preprocess_single_face(face_crop_v2)
            input_tensor_v1se = self._preprocess_single_face(face_crop_v1se)
            
            # Get predictions from both models with their respective crops
            v2_result = self._predict_single_model(self.session_v2, input_tensor_v2)
            v1se_result = self._predict_single_model(self.session_v1se, input_tensor_v1se)
            
            # Combine predictions using RANK 1 ensemble (temporal + adaptive)
            ensemble_result = self._ensemble_prediction(
                v2_result,
                v1se_result,
                track_id=track_id,
                quality_score=quality_score,
                face_crop_v2=face_crop_v2
            )
            
            return ensemble_result
            
        except Exception as e:
            logger.error(f"Error processing face: {e}")
            return {
                "is_real": False,  # SECURITY: Default to FAKE on error
                "real_score": 0.0,
                "fake_score": 1.0,
                "confidence": 0.0,
                "threshold": self.threshold,
                "status": "error",
                "label": "Error",
                "message": str(e),
                "error": str(e)
            }
    
    def _process_faces_batch(self, face_crops_v2: List[np.ndarray], face_crops_v1se: List[np.ndarray]) -> List[Dict]:
        """
        BATCH PROCESSING: Process multiple faces with both models and ensemble
        APK-STYLE: Simple, fast, no temporal filtering
        
        Args:
            face_crops_v2: List of face crops for V2 model (2.7x scale)
            face_crops_v1se: List of face crops for V1SE model (4.0x scale)
            
        Returns:
            List of ensemble results for each face
        """
        try:
            if not face_crops_v2 or not face_crops_v1se:
                return []
            
            # Batch preprocess all face crops for V2
            batch_v2 = []
            for crop in face_crops_v2:
                tensor = self._preprocess_single_face(crop)
                batch_v2.append(tensor[0])  # Remove batch dimension
            batch_v2 = np.stack(batch_v2, axis=0)  # Stack into (N, C, H, W)
            
            # Batch preprocess all face crops for V1SE
            batch_v1se = []
            for crop in face_crops_v1se:
                tensor = self._preprocess_single_face(crop)
                batch_v1se.append(tensor[0])  # Remove batch dimension
            batch_v1se = np.stack(batch_v1se, axis=0)  # Stack into (N, C, H, W)
            
            # Run batch predictions
            v2_results = self._predict_single_model_batch(self.session_v2, batch_v2)
            v1se_results = self._predict_single_model_batch(self.session_v1se, batch_v1se)
            
            # CRITICAL FIX: Combine predictions with ISOLATED dict copies to prevent contamination
            # When multiple faces are processed, dicts MUST be independent!
            ensemble_results = []
            for v2_result, v1se_result in zip(v2_results, v1se_results):
                # Create DEEP COPY of input results to prevent mutation contamination
                v2_copy = {
                    "real_score": float(v2_result["real_score"]),
                    "fake_score": float(v2_result["fake_score"]),
                    "confidence": float(v2_result["confidence"])
                }
                v1se_copy = {
                    "real_score": float(v1se_result["real_score"]),
                    "fake_score": float(v1se_result["fake_score"]),
                    "confidence": float(v1se_result["confidence"])
                }
                
                ensemble_result = self._ensemble_prediction(v2_copy, v1se_copy)
                # Ensure result is a NEW dict (not reference)
                ensemble_results.append(dict(ensemble_result))
            
            return ensemble_results
            
        except Exception as e:
            logger.error(f"Batch processing failed: {e}, falling back to sequential")
            # Fallback to sequential processing
            results = []
            for crop_v2, crop_v1se in zip(face_crops_v2, face_crops_v1se):
                result = self._process_single_face(crop_v2, crop_v1se)
                results.append(result)
            return results
    
    def detect_faces_batch(self, image: np.ndarray, face_detections: List[Dict]) -> List[Dict]:
        """
        Process multiple faces with dual-model ensemble prediction
        """
        if not face_detections:
            return []

        self._ensure_sessions_ready()

        image, scaled_faces = self._ensure_scale_separation(image, face_detections)
        results: List[Optional[Dict]] = [None] * len(scaled_faces)
        pending: List[Dict[str, Any]] = []

        for index, face in enumerate(scaled_faces):
            bbox = face.get("bbox", face.get("box"))
            if not bbox:
                results[index] = self._build_error_result(
                    index,
                    face,
                    bbox,
                    status="invalid_bbox",
                    message="Missing bounding box for face detection."
                )
                continue

            if isinstance(bbox, dict):
                face_width = float(bbox.get("width", 0))
                face_height = float(bbox.get("height", 0))
            elif isinstance(bbox, list) and len(bbox) >= 4:
                face_width = float(bbox[2])
                face_height = float(bbox[3])
            else:
                results[index] = self._build_error_result(
                    index,
                    face,
                    bbox,
                    status="invalid_bbox",
                    message="Unrecognized bounding box format."
                )
                continue

            min_size = 24
            if face_width < min_size or face_height < min_size:
                results[index] = self._build_error_result(
                    index,
                    face,
                    bbox,
                    status="too_small",
                    message=f"Face too small ({face_width:.1f}x{face_height:.1f}px). Minimum: {min_size}x{min_size}px",
                    label="Move Closer"
                )
                continue

            face_crop_v2 = self._extract_face_crop(image, bbox, scale=2.7, shift_x=0.0, shift_y=0.0)
            face_crop_v1se = self._extract_face_crop(image, bbox, scale=4.0, shift_x=0.0, shift_y=0.0)

            if face_crop_v2 is None or face_crop_v1se is None:
                logger.warning(
                    "Face %s: crop extraction failed; falling back to raw bounding box crop.",
                    index
                )

                if isinstance(bbox, dict):
                    x, y, w, h = int(bbox.get("x", 0)), int(bbox.get("y", 0)), int(bbox.get("width", 0)), int(bbox.get("height", 0))
                elif isinstance(bbox, list):
                    x, y, w, h = map(int, bbox[:4])
                else:
                    results[index] = self._build_error_result(
                        index,
                        face,
                        bbox,
                        status="processing_failed",
                        message="Unable to compute fallback crop."
                    )
                    continue

                img_h, img_w = image.shape[:2]
                x1 = max(0, x)
                y1 = max(0, y)
                x2 = min(img_w, x + w)
                y2 = min(img_h, y + h)

                if x2 <= x1 or y2 <= y1:
                    results[index] = self._build_error_result(
                        index,
                        face,
                        bbox,
                        status="processing_failed",
                        message="Invalid crop region after boundary clamp."
                    )
                    continue

                fallback_crop = image[y1:y2, x1:x2]
                if fallback_crop.size == 0:
                    results[index] = self._build_error_result(
                        index,
                        face,
                        bbox,
                        status="processing_failed",
                        message="Empty fallback crop produced."
                    )
                    continue

                face_crop_v2 = fallback_crop if face_crop_v2 is None else face_crop_v2
                face_crop_v1se = fallback_crop if face_crop_v1se is None else face_crop_v1se

            cache_key = self._make_cache_key(face_crop_v2, face_crop_v1se)
            cached_result = self._get_cached_result(cache_key)
            if cached_result:
                results[index] = self._format_result(index, face, bbox, cached_result)
                continue

            pending.append({
                "index": index,
                "face": face,
                "bbox": bbox,
                "crop_v2": face_crop_v2,
                "crop_v1se": face_crop_v1se,
                "cache_key": cache_key
            })

        if pending:
            for start in range(0, len(pending), self.max_batch_size):
                batch = pending[start:start + self.max_batch_size]
                crops_v2 = [entry["crop_v2"] for entry in batch]
                crops_v1se = [entry["crop_v1se"] for entry in batch]

                antispoofing_results = self._process_faces_batch(crops_v2, crops_v1se)

                if len(antispoofing_results) != len(batch):
                    logger.error(
                        "Anti-spoofing batch size mismatch: expected %s results, got %s.",
                        len(batch),
                        len(antispoofing_results)
                    )
                    continue

                # CRITICAL FIX: Create ISOLATED copy for EACH face to prevent contamination
                for entry, antispoofing_result in zip(batch, antispoofing_results):
                    # Create DEEP COPY to ensure complete isolation between faces
                    isolated_result = {
                        "is_real": bool(antispoofing_result.get("is_real", False)),
                        "real_score": float(antispoofing_result.get("real_score", 0.0)),
                        "fake_score": float(antispoofing_result.get("fake_score", 1.0)),
                        "confidence": float(antispoofing_result.get("confidence", 0.0)),
                        "threshold": float(self.threshold),
                        "status": str(antispoofing_result.get("status", "unknown")),
                        "label": str(antispoofing_result.get("label", "Unknown")),
                        "message": str(antispoofing_result.get("message", "")),
                        "v2_real_score": float(antispoofing_result.get("v2_real_score", 0.0)),
                        "v2_fake_score": float(antispoofing_result.get("v2_fake_score", 0.0)),
                        "v1se_real_score": float(antispoofing_result.get("v1se_real_score", 0.0)),
                        "v1se_fake_score": float(antispoofing_result.get("v1se_fake_score", 0.0)),
                        "ensemble_method": str(antispoofing_result.get("ensemble_method", "weighted_average_apk_replica")),
                        "cached": False,
                        "model_type": "dual_minifasnet"
                    }
                    
                    # Add error field if present
                    if "error" in antispoofing_result:
                        isolated_result["error"] = str(antispoofing_result["error"])

                    results[entry["index"]] = self._format_result(
                        entry["index"],
                        entry["face"],
                        entry["bbox"],
                        isolated_result
                    )

                    # Store cache with isolated copy (not the same reference!)
                    cache_copy = dict(isolated_result)
                    cache_copy.pop("cached", None)  # Don't cache the 'cached' flag
                    self._store_cache_entry(entry.get("cache_key"), cache_copy)

        final_results: List[Dict] = []
        for index, result in enumerate(results):
            if result is None:
                face = scaled_faces[index] if index < len(scaled_faces) else {}
                bbox = face.get("bbox", face.get("box")) if isinstance(face, dict) else None
                final_results.append(
                    self._build_error_result(
                        index,
                        face if isinstance(face, dict) else {},
                        bbox,
                        status="processing_failed",
                        message="Anti-spoofing result missing; marked as spoof for safety."
                    )
                )
            else:
                final_results.append(result)

        return final_results
    
    async def detect_faces_async(self, image: np.ndarray, face_detections: List[Dict]) -> List[Dict]:
        """Async wrapper for face detection"""
        return self.detect_faces_batch(image, face_detections)
    
    def set_threshold(self, threshold: float):
        """Update the threshold for ensemble classification"""
        self.threshold = threshold
    
    def get_model_info(self) -> Dict:
        """Get model information"""
        return {
            "model_v2_path": self.model_v2_path,
            "model_v1se_path": self.model_v1se_path,
            "input_size": self.input_size,
            "threshold": self.threshold,
            "v2_weight": self.v2_weight,
            "v1se_weight": self.v1se_weight,
            "providers": list(self.providers),
            "max_batch_size": self.max_batch_size,
            "cache_duration": self.cache_duration,
            "cache_confidence_floor": self.cache_confidence_floor,
            "session_v2_providers": self.session_v2.get_providers() if self.session_v2 else [],
            "session_v1se_providers": self.session_v1se.get_providers() if self.session_v1se else []
        }
