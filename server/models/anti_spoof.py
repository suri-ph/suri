import cv2
import numpy as np
import onnxruntime as ort
import os
from typing import List, Dict


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
            return np.exp(x) / np.sum(np.exp(x))

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

    async def detect_faces(
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

        predictions = self.predict(face_crops)

        # Match predictions with valid_detections (maintains 1:1 mapping)
        for detection, prediction in zip(valid_detections, predictions):
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
