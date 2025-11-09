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
        config: Dict = None,
    ):
        self.model_img_size = model_img_size
        self.confidence_threshold = confidence_threshold
        self.config = config or {}
        self.cache_duration = 0
        self.min_face_size = min_face_size
        self.bbox_inc = bbox_inc

        self.ort_session, self.input_name = self._init_session_(model_path)

        self.result_file_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "result.txt"
        )

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
        """Apply softmax to prediction"""

        def softmax(x):
            x = x - np.max(x)
            exp_x = np.exp(x)
            return exp_x / np.sum(exp_x)

        return softmax(prediction)

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

        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

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
                    }
                    results.append(detection)
                    continue

            try:
                face_crop = self.increased_crop(
                    image, (x, y, x + w, y + h), bbox_inc=self.bbox_inc
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

        raw_predictions = []
        for img in face_crops:
            if not self.ort_session:
                raw_predictions.append(None)
                continue

            try:
                onnx_result = self.ort_session.run(
                    [], {self.input_name: self.preprocessing(img)}
                )
                raw_logits = onnx_result[0]
                pred = self.postprocessing(raw_logits)

                if pred.shape[1] != 3:
                    raw_predictions.append(None)
                    continue

                raw_pred = pred[0]
                raw_predictions.append(raw_pred)
            except Exception:
                raw_predictions.append(None)

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

            is_real = live_score >= self.confidence_threshold

            if is_real:
                label = "Live"
            else:
                label = "Spoof"

            result = {
                "is_real": bool(is_real),
                "live_score": float(live_score),
                "confidence": float(max_confidence),
                "label": label,
            }
            processed_predictions.append(result)

            track_id_str = str(track_id) if track_id is not None else "None"
            bbox = detection.get("bbox", {})

            if isinstance(bbox, dict):
                bbox_x = int(bbox.get("x", 0))
                bbox_y = int(bbox.get("y", 0))
                bbox_w = int(bbox.get("width", 0))
                bbox_h = int(bbox.get("height", 0))
            elif isinstance(bbox, (list, tuple)) and len(bbox) >= 4:
                bbox_x = int(bbox[0])
                bbox_y = int(bbox[1])
                bbox_w = int(bbox[2])
                bbox_h = int(bbox[3])
            else:
                bbox_x = bbox_y = bbox_w = bbox_h = 0

            result_line = (
                f"track_id={track_id_str} "
                f"bbox=[{bbox_x},{bbox_y},{bbox_w},{bbox_h}] "
                f"probabilities=[live={live_score:.6f},print={print_score:.6f},replay={replay_score:.6f}] "
                f"spoof_score={spoof_score:.6f} max_confidence={max_confidence:.6f} "
                f"live_threshold={self.confidence_threshold:.2f} is_real={is_real} label={label}"
            )
            self._write_result_to_file(result_line)

        for detection, prediction in zip(valid_detections, processed_predictions):
            if prediction is not None:
                detection["liveness"] = {
                    "is_real": prediction["is_real"],
                    "live_score": prediction["live_score"],
                    "confidence": prediction["confidence"],
                    "label": prediction["label"],
                    "status": "real" if prediction["is_real"] else "fake",
                }
            results.append(detection)

        return results

    def _write_result_to_file(self, result_line: str):
        try:
            result_dir = os.path.dirname(self.result_file_path)
            if result_dir and not os.path.exists(result_dir):
                os.makedirs(result_dir, exist_ok=True)

            with open(self.result_file_path, "a", encoding="utf-8") as f:
                f.write(result_line + "\n")
        except Exception:
            pass

    def clear_cache(self):
        """Clear cache (stub method for API compatibility)"""
        pass
