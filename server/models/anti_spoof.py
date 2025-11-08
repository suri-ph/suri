import cv2
import numpy as np
import onnxruntime as ort
import os
from collections import deque, defaultdict
from typing import List, Dict, Optional


class AntiSpoof:
    def __init__(
        self,
        model_path: str,
        model_img_size: int,
        confidence_threshold: float,
        config: Dict = None,
    ):
        self.model_path = model_path
        self.model_img_size = model_img_size
        self.config = config or {}
        self.confidence_threshold = confidence_threshold
        self.cache_duration = 0  # Cache disabled

        # Temporal fusion configuration
        # Window size: 10 frames recommended for 30 FPS, scales with frame rate
        self.temporal_window_size = self.config.get("temporal_window_size", 10)
        # Enable temporal fusion by default for better stability
        self.enable_temporal_fusion = self.config.get("enable_temporal_fusion", True)
        
        # Per-person temporal windows: track_id -> deque of [live, print, replay] predictions
        # Use a factory function to create deques with the correct maxlen
        def make_deque():
            return deque(maxlen=self.temporal_window_size)
        
        self.temporal_windows: Dict[int, deque] = defaultdict(make_deque)

        self.ort_session, self.input_name = self._init_session_(model_path)

    def _init_session_(self, onnx_model_path: str):
        """Initialize ONNX Runtime session"""
        ort_session = None
        input_name = None

        if os.path.isfile(onnx_model_path):
            try:
                ort_session = ort.InferenceSession(
                    onnx_model_path,
                    providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
                )
            except Exception:
                try:
                    ort_session = ort.InferenceSession(
                        onnx_model_path, providers=["CPUExecutionProvider"]
                    )
                except Exception:
                    return None, None

            if ort_session:
                input_name = ort_session.get_inputs()[0].name

        return ort_session, input_name

    def preprocessing(self, img: np.ndarray) -> np.ndarray:
        new_size = self.model_img_size
        img = cv2.resize(img, (new_size, new_size), interpolation=cv2.INTER_LINEAR)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img_normalized = img_rgb.astype(np.float32, copy=False)
        np.multiply(img_normalized, 1.0 / 255.0, out=img_normalized)
        img_chw = img_normalized.transpose(2, 0, 1)
        img_batch = np.expand_dims(img_chw, axis=0)
        return img_batch

    def postprocessing(self, prediction: np.ndarray) -> np.ndarray:
        """Apply softmax to prediction"""

        def softmax(x):
            x = x - np.max(x)
            exp_x = np.exp(x)
            return exp_x / np.sum(exp_x)

        pred = softmax(prediction)
        return pred

    def increased_crop(
        self, img: np.ndarray, bbox: tuple, bbox_inc: float = 1.5
    ) -> np.ndarray:
        """Crop face with expanded bounding box"""
        real_h, real_w = img.shape[:2]
        x1_input, y1_input, x2_input, y2_input = bbox
        w = x2_input - x1_input
        h = y2_input - y1_input
        max_dim = max(w, h)

        xc, yc = x1_input + w / 2, y1_input + h / 2
        x_expanded = int(xc - max_dim * bbox_inc / 2)
        y_expanded = int(yc - max_dim * bbox_inc / 2)

        x1_clamped = max(0, x_expanded)
        y1_clamped = max(0, y_expanded)
        x2_clamped = min(real_w, x_expanded + int(max_dim * bbox_inc))
        y2_clamped = min(real_h, y_expanded + int(max_dim * bbox_inc))

        crop = img[y1_clamped:y2_clamped, x1_clamped:x2_clamped, :]

        if (
            x_expanded < 0
            or y_expanded < 0
            or x_expanded + int(max_dim * bbox_inc) > real_w
            or y_expanded + int(max_dim * bbox_inc) > real_h
        ):
            top = max(0, y1_clamped - y_expanded)
            bottom = max(0, y_expanded + int(max_dim * bbox_inc) - y2_clamped)
            left = max(0, x1_clamped - x_expanded)
            right = max(0, x_expanded + int(max_dim * bbox_inc) - x2_clamped)

            crop = cv2.copyMakeBorder(
                crop, top, bottom, left, right, cv2.BORDER_REFLECT_101
            )

        return crop

    def temporal_fuse(
        self, track_id: Optional[int], raw_pred: np.ndarray
    ) -> np.ndarray:
        if not self.enable_temporal_fusion:
            return raw_pred
        
        # If track_id is None or negative, don't apply temporal fusion
        if track_id is None or track_id < 0:

            return raw_pred
        
        # Get or create temporal window for this track_id
        window = self.temporal_windows[track_id]
        
        # Add current prediction to window
        window.append(raw_pred.copy())
        
        # Convert window to numpy array for averaging
        preds = np.array(window)
        
        # Weight newer frames slightly more (linear weighting from 1.0 to 2.0)
        # This gives recent frames more influence while still using history
        if len(preds) > 1:
            weights = np.linspace(1.0, 2.0, len(preds))
            fused = np.average(preds, axis=0, weights=weights)
        else:
            # Single prediction, no fusion needed
            fused = preds[0]
        
        return fused

    def cleanup_temporal_windows(self, active_track_ids: List[int]):
        """Remove temporal windows for tracks that are no longer active"""
        active_set = set(active_track_ids)
        # Remove windows for tracks not in active set
        inactive_ids = [
            track_id for track_id in self.temporal_windows.keys()
            if track_id not in active_set
        ]
        for track_id in inactive_ids:
            del self.temporal_windows[track_id]

    def predict(self, imgs: List[np.ndarray]) -> List[Dict]:
        """Predict anti-spoofing for list of face images"""
        if not self.ort_session:
            return [None] * len(imgs)

        results = []
        for img in imgs:
            try:
                onnx_result = self.ort_session.run(
                    [], {self.input_name: self.preprocessing(img)}
                )
                raw_logits = onnx_result[0]  # Raw logits before softmax
                pred = self.postprocessing(raw_logits)

                if pred.shape[1] != 3:
                    results.append(None)
                    continue

                live_score = float(pred[0][0])
                print_score = float(pred[0][1])
                replay_score = float(pred[0][2])

                spoof_score = print_score + replay_score
                max_confidence = max(live_score, spoof_score)
                margin = live_score - spoof_score
                is_real = (
                    (live_score > spoof_score)
                    and (max_confidence >= self.confidence_threshold)
                    and (margin >= 0.05)  # safety margin
                )

                if is_real:
                    attack_type = "live"
                    label = "Live"
                else:
                    attack_type = "unknown"
                    label = "Spoof"

                result = {
                    "is_real": bool(is_real),
                    "live_score": float(live_score),
                    "spoof_score": float(spoof_score),
                    "confidence": float(max_confidence),
                    "label": label,
                    "attack_type": attack_type,
                }
                results.append(result)

            except Exception:
                results.append(None)

        return results

    def detect_faces(
        self, image: np.ndarray, face_detections: List[Dict]
    ) -> List[Dict]:
        """Process face detections with anti-spoofing"""
        if not face_detections:
            return []

        face_crops = []
        valid_detections = []
        results = []

        for detection in face_detections:
            # Skip faces already marked as too_small by face_detector
            if (
                "liveness" in detection
                and detection["liveness"].get("status") == "too_small"
            ):
                results.append(detection)
                continue

            bbox = detection.get("bbox", {})
            if not bbox:
                results.append(detection)
                continue

            x = int(bbox.get("x", 0))
            y = int(bbox.get("y", 0))
            w = int(bbox.get("width", 0))
            h = int(bbox.get("height", 0))

            if w <= 0 or h <= 0:
                results.append(detection)
                continue

            try:
                face_crop = self.increased_crop(
                    image, (x, y, x + w, y + h), bbox_inc=1.5
                )
                if face_crop is None or face_crop.size == 0:
                    results.append(detection)
                    continue
            except Exception:
                results.append(detection)
                continue

            face_crops.append(face_crop)
            valid_detections.append(detection)

        if not face_crops:
            return results if results else face_detections

        # Get raw predictions from model
        raw_predictions = []
        for img in face_crops:
            if not self.ort_session:
                raw_predictions.append(None)
                continue
            
            try:
                onnx_result = self.ort_session.run(
                    [], {self.input_name: self.preprocessing(img)}
                )
                raw_logits = onnx_result[0]  # Raw logits before softmax
                pred = self.postprocessing(raw_logits)
                
                if pred.shape[1] != 3:
                    raw_predictions.append(None)
                    continue
                
                # Extract [live, print, replay] scores
                raw_pred = pred[0]  # Shape: (3,)
                raw_predictions.append(raw_pred)
            except Exception:
                raw_predictions.append(None)

        # Apply temporal fusion and process predictions
        processed_predictions = []
        active_track_ids = []
        
        for detection, raw_pred in zip(valid_detections, raw_predictions):
            if raw_pred is None:
                processed_predictions.append(None)
                continue
            
            # Get track_id for temporal fusion
            track_id = detection.get("track_id", None)
            if track_id is not None:
                # Convert numpy integer types to Python int
                if isinstance(track_id, (np.integer, np.int32, np.int64)):
                    track_id = int(track_id)
                # Only track positive IDs (negative IDs are temporary/unmatched detections)
                if track_id >= 0:
                    active_track_ids.append(track_id)
            
            # Apply temporal fusion
            fused_pred = self.temporal_fuse(track_id, raw_pred)
            
            # Extract scores from fused prediction
            live_score = float(fused_pred[0])
            print_score = float(fused_pred[1])
            replay_score = float(fused_pred[2])
            
            spoof_score = print_score + replay_score
            max_confidence = max(live_score, spoof_score)
            margin = live_score - spoof_score
            is_real = (
                (live_score > spoof_score)
                and (max_confidence >= self.confidence_threshold)
                and (margin >= 0.05)  # safety margin
            )
            
            if is_real:
                attack_type = "live"
                label = "Live"
            else:
                attack_type = "unknown"
                label = "Spoof"
            
            result = {
                "is_real": bool(is_real),
                "live_score": float(live_score),
                "spoof_score": float(spoof_score),
                "confidence": float(max_confidence),
                "label": label,
                "attack_type": attack_type,
            }
            processed_predictions.append(result)
        
        # Cleanup temporal windows for inactive tracks
        if active_track_ids:
            self.cleanup_temporal_windows(active_track_ids)

        # Match processed predictions with valid_detections (maintains 1:1 mapping)
        for detection, prediction in zip(valid_detections, processed_predictions):
            if prediction is not None:
                detection["liveness"] = {
                    "is_real": prediction["is_real"],
                    "live_score": prediction["live_score"],
                    "spoof_score": prediction["spoof_score"],
                    "confidence": prediction["confidence"],
                    "label": prediction["label"],
                    "status": "real" if prediction["is_real"] else "fake",
                    "attack_type": prediction["attack_type"],
                }
            # If prediction is None, detection is added without liveness data
            results.append(detection)

        return results

    def clear_cache(self):
        """Clear cache (stub method for API compatibility)"""
        pass
    
    def reset_temporal_windows(self):
        """Reset all temporal windows (useful for testing or full reset)"""
        self.temporal_windows.clear()
