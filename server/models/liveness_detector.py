import cv2
import numpy as np
import onnxruntime as ort
import os
from typing import List, Dict


class LivenessDetector:
    def __init__(
        self,
        model_path: str,
        model_img_size: int,
        confidence_threshold: float,
        min_face_size: int,
        bbox_inc: float,
    ):
        self.model_img_size = model_img_size
        self.confidence_threshold = confidence_threshold
        self.min_face_size = min_face_size
        self.bbox_inc = bbox_inc

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
        """Preprocess image for model inference"""
        new_size = self.model_img_size
        old_size = img.shape[:2]

        ratio = float(new_size) / max(old_size)
        scaled_shape = tuple([int(x * ratio) for x in old_size])
        img = cv2.resize(img, (scaled_shape[1], scaled_shape[0]))

        delta_w = new_size - scaled_shape[1]
        delta_h = new_size - scaled_shape[0]
        top, bottom = delta_h // 2, delta_h - (delta_h // 2)
        left, right = delta_w // 2, delta_w - (delta_w // 2)

        img = cv2.copyMakeBorder(
            img, top, bottom, left, right, cv2.BORDER_CONSTANT, value=[0, 0, 0]
        )

        img = img.transpose(2, 0, 1).astype(np.float32) / 255.0
        img_batch = np.expand_dims(img, axis=0)
        return img_batch

    def postprocessing(self, prediction: np.ndarray) -> np.ndarray:
        """Apply softmax to prediction (supports both single and batch predictions)"""
        # Handle both single prediction [1, 3] and batch predictions [N, 3]
        if len(prediction.shape) == 1:
            prediction = prediction.reshape(1, -1)
        
        # Apply softmax along the last dimension (axis=-1) for each sample
        # Subtract max for numerical stability
        exp_pred = np.exp(prediction - np.max(prediction, axis=-1, keepdims=True))
        return exp_pred / np.sum(exp_pred, axis=-1, keepdims=True)

    def increased_crop(
        self, img: np.ndarray, bbox: tuple, bbox_inc: float
    ) -> np.ndarray:
        """Crop face with expanded bounding box"""
        real_h, real_w = img.shape[:2]
        x, y, w, h = bbox

        w = w - x
        h = h - y
        max_dimension = max(w, h)

        xc = x + w / 2
        yc = y + h / 2

        x = int(xc - max_dimension * bbox_inc / 2)
        y = int(yc - max_dimension * bbox_inc / 2)

        x1 = 0 if x < 0 else x
        y1 = 0 if y < 0 else y
        x2 = (
            real_w
            if x + max_dimension * bbox_inc > real_w
            else x + int(max_dimension * bbox_inc)
        )
        y2 = (
            real_h
            if y + max_dimension * bbox_inc > real_h
            else y + int(max_dimension * bbox_inc)
        )

        img = img[y1:y2, x1:x2, :]

        pad_top = y1 - y
        pad_bottom = int(max_dimension * bbox_inc - y2 + y)
        pad_left = x1 - x
        pad_right = int(max_dimension * bbox_inc - x2 + x)

        img = cv2.copyMakeBorder(
            img,
            pad_top,
            pad_bottom,
            pad_left,
            pad_right,
            cv2.BORDER_CONSTANT,
            value=[0, 0, 0],
        )

        return img

    def detect_faces(
        self, image: np.ndarray, face_detections: List[Dict]
    ) -> List[Dict]:
        """Process face detections with anti-spoofing"""
        if not face_detections:
            return []

        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        seen_bboxes = {}
        deduplicated_detections = []

        for detection in face_detections:
            bbox = detection.get("bbox", {})
            if isinstance(bbox, dict):
                bbox_key = (
                    bbox.get("x", 0),
                    bbox.get("y", 0),
                    bbox.get("width", 0),
                    bbox.get("height", 0),
                )
            elif isinstance(bbox, (list, tuple)) and len(bbox) >= 4:
                bbox_key = (int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3]))
            else:
                deduplicated_detections.append(detection)
                continue

            track_id = detection.get("track_id", None)
            if track_id is not None:
                if isinstance(track_id, (np.integer, np.int32, np.int64)):
                    track_id = int(track_id)

            if bbox_key in seen_bboxes:
                existing_track_id = seen_bboxes[bbox_key].get("track_id", None)
                if existing_track_id is not None:
                    if isinstance(existing_track_id, (np.integer, np.int32, np.int64)):
                        existing_track_id = int(existing_track_id)

                if track_id is not None and track_id >= 0:
                    if existing_track_id is None or existing_track_id < 0:
                        idx = deduplicated_detections.index(seen_bboxes[bbox_key])
                        deduplicated_detections[idx] = detection
                        seen_bboxes[bbox_key] = detection
            else:
                deduplicated_detections.append(detection)
                seen_bboxes[bbox_key] = detection

        face_crops = []
        valid_detections = []
        results = []

        for detection in deduplicated_detections:
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

            if self.min_face_size > 0:
                if w < self.min_face_size or h < self.min_face_size:
                    detection["liveness"] = {
                        "is_real": False,
                        "status": "too_small",
                        "live_score": 0.0,
                        "spoof_score": 1.0,
                        "confidence": 0.0,
                    }
                    results.append(detection)
                    continue

            try:
                face_crop = self.increased_crop(
                    rgb_image, (x, y, x + w, y + h), bbox_inc=self.bbox_inc
                )
                if (
                    face_crop is None
                    or face_crop.size == 0
                    or len(face_crop.shape) != 3
                    or face_crop.shape[0] < 10
                    or face_crop.shape[1] < 10
                    or face_crop.shape[2] != 3
                ):
                    results.append(detection)
                    continue
            except Exception:
                results.append(detection)
                continue

            face_crops.append(face_crop)
            valid_detections.append(detection)

        if not face_crops:
            return results if results else face_detections

        # Batch inference for performance (single ONNX call for all faces)
        raw_predictions = []
        if not self.ort_session:
            raw_predictions = [None] * len(face_crops)
        else:
            try:
                # Batch preprocess all face crops: [N, C, H, W]
                batch_inputs = np.concatenate(
                    [self.preprocessing(img) for img in face_crops], axis=0
                )
                
                # Run single batch inference (much faster than N individual calls, especially on GPU)
                onnx_results = self.ort_session.run([], {self.input_name: batch_inputs})
                batch_logits = onnx_results[0]  # Shape: [N, 3]
                
                # Validate batch output shape
                if batch_logits.shape[1] != 3:
                    raw_predictions = [None] * len(face_crops)
                else:
                    # Apply postprocessing (softmax) to entire batch at once
                    batch_predictions = self.postprocessing(batch_logits)  # Shape: [N, 3]
                    
                    # Extract individual predictions
                    for i in range(len(face_crops)):
                        try:
                            raw_pred = batch_predictions[i]  # Shape: [3]
                            raw_predictions.append(raw_pred)
                        except Exception:
                            raw_predictions.append(None)
            except Exception:
                # Fallback to None for all predictions on batch failure
                raw_predictions = [None] * len(face_crops)

        processed_predictions = []

        for detection, raw_pred in zip(valid_detections, raw_predictions):
            if raw_pred is None:
                processed_predictions.append(None)
                continue

            track_id = detection.get("track_id", None)
            if track_id is not None:
                if isinstance(track_id, (np.integer, np.int32, np.int64)):
                    track_id = int(track_id)

            live_score = float(raw_pred[0])
            print_score = float(raw_pred[1])
            replay_score = float(raw_pred[2])

            spoof_score = print_score + replay_score
            max_confidence = max(live_score, spoof_score)

            is_real = live_score > spoof_score and live_score >= self.confidence_threshold

            result = {
                "is_real": bool(is_real),
                "live_score": float(live_score),
                "spoof_score": float(spoof_score),
                "confidence": float(max_confidence),
                "status": "live" if is_real else "spoof",
            }
            processed_predictions.append(result)

        for detection, prediction in zip(valid_detections, processed_predictions):
            if prediction is not None:
                detection["liveness"] = {
                    "is_real": prediction["is_real"],
                    "live_score": prediction["live_score"],
                    "spoof_score": prediction["spoof_score"],
                    "confidence": prediction["confidence"],
                    "status": prediction["status"],
                }
            results.append(detection)

        return results
