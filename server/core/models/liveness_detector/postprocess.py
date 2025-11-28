import numpy as np
from typing import Dict, List, Tuple, Optional
from .preprocess import preprocess_batch


def softmax(prediction: np.ndarray) -> np.ndarray:
    """
    Apply numerically stable softmax to batch predictions.
    
    Args:
        prediction: Input logits with shape [N, 3] where N is batch size
        
    Returns:
        np.ndarray: Softmax probabilities with shape [N, 3]
    """
    exp_pred = np.exp(prediction - np.max(prediction, axis=-1, keepdims=True))
    return exp_pred / np.sum(exp_pred, axis=-1, keepdims=True)


def process_prediction(raw_pred: np.ndarray, confidence_threshold: float) -> Dict:
    """Process raw prediction into liveness result."""
    if len(raw_pred) < 3:
        raise ValueError(f"Expected 3-class prediction, got {len(raw_pred)} classes")

    live_score = float(raw_pred[0])
    print_score = float(raw_pred[1])
    replay_score = float(raw_pred[2])

    spoof_score = print_score + replay_score
    max_confidence = max(live_score, spoof_score)
    is_real = live_score >= confidence_threshold

    result = {
        "is_real": bool(is_real),
        "live_score": float(live_score),
        "spoof_score": float(spoof_score),
        "confidence": float(max_confidence),
        "status": "live" if is_real else "spoof",
    }

    return result


def validate_detection(
    detection: Dict, min_face_size: int
) -> Tuple[bool, Optional[Dict]]:
    """
    Validate detection and check if it meets minimum face size requirement.

    Returns:
        Tuple of (is_valid, liveness_status_dict)
        - is_valid: True if detection should be processed, False if skipped
        - liveness_status_dict: None if valid, or liveness dict if marked as too_small
    """
    # Skip if already marked as too_small
    if "liveness" in detection and detection["liveness"].get("status") == "too_small":
        return False, None

    bbox = detection.get("bbox", {})
    if not isinstance(bbox, dict):
        return False, None

    w = int(bbox.get("width", 0))
    h = int(bbox.get("height", 0))

    if w <= 0 or h <= 0:
        return False, None

    # Check minimum face size
    if min_face_size > 0:
        if w < min_face_size or h < min_face_size:
            liveness_status = {
                "is_real": False,
                "status": "too_small",
                "live_score": 0.0,
                "spoof_score": 1.0,
                "confidence": 0.0,
            }
            return False, liveness_status

    return True, None


def run_batch_inference(
    face_crops: List[np.ndarray],
    ort_session,
    input_name: str,
    postprocess_fn,
    model_img_size: int,
) -> List[np.ndarray]:
    """
    Run batch inference on multiple face crops simultaneously.
    
    Args:
        face_crops: List of face crop images (each is [H, W, 3] RGB)
        ort_session: ONNX Runtime inference session
        input_name: Name of the input tensor
        postprocess_fn: Function to apply softmax postprocessing
        model_img_size: Target image size for preprocessing
        
    Returns:
        List of raw predictions, each with shape [3] (live, print, replay scores).
    """
    if not face_crops:
        return []

    if not ort_session:
        raise RuntimeError("ONNX session is not available")

    # Preprocess all face crops into a single batch tensor: [N, 3, H, W]
    batch_input = preprocess_batch(face_crops, model_img_size)
    
    # Run batch inference
    onnx_results = ort_session.run([], {input_name: batch_input})
    logits = onnx_results[0]  # Shape: [N, 3]
    
    # Apply softmax to all predictions at once
    predictions = postprocess_fn(logits)  # Shape: [N, 3]
    
    # Convert batch predictions to list of individual predictions
    raw_predictions = [predictions[i] for i in range(len(face_crops))]
    
    return raw_predictions


def assemble_liveness_results(
    valid_detections: List[Dict],
    raw_predictions: List[np.ndarray],
    confidence_threshold: float,
    results: List[Dict],
    temporal_smoother=None,
    frame_number: int = 0,
) -> List[Dict]:
    """
    Assemble liveness results from predictions and add to results list.

    Args:
        valid_detections: List of valid face detections
        raw_predictions: List of raw model predictions, each with shape [3]
        confidence_threshold: Threshold for liveness classification
        results: List to append results to
        temporal_smoother: Optional TemporalSmoother instance
        frame_number: Current video frame number (for proper frame tracking)
    """
    for detection, raw_pred in zip(valid_detections, raw_predictions):
        prediction = process_prediction(raw_pred, confidence_threshold)

        # Apply temporal smoothing if enabled
        live_score = prediction["live_score"]
        spoof_score = prediction["spoof_score"]

        if temporal_smoother:
            track_id = detection.get("track_id")
            # Only apply temporal smoothing to positive track IDs (tracked faces)
            # Negative track IDs are temporary and change per frame - using them
            # would cause state leakage between different faces
            if track_id is not None and track_id > 0:
                live_score, spoof_score = temporal_smoother.smooth(
                    track_id, live_score, spoof_score, frame_number
                )

        # Recalculate is_real and status with smoothed scores
        max_confidence = max(live_score, spoof_score)
        is_real = live_score >= confidence_threshold

        detection["liveness"] = {
            "is_real": is_real,
            "live_score": live_score,
            "spoof_score": spoof_score,
            "confidence": max_confidence,
            "status": "live" if is_real else "spoof",
        }

        results.append(detection)

    return results
