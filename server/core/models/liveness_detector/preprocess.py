import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional


def preprocess(img: np.ndarray, model_img_size: int) -> np.ndarray:
    new_size = model_img_size
    old_size = img.shape[:2]

    ratio = float(new_size) / max(old_size)
    scaled_shape = tuple([int(x * ratio) for x in old_size])

    interpolation = cv2.INTER_LANCZOS4 if ratio > 1.0 else cv2.INTER_AREA
    img = cv2.resize(img, (scaled_shape[1], scaled_shape[0]), interpolation=interpolation)

    delta_w = new_size - scaled_shape[1]
    delta_h = new_size - scaled_shape[0]
    top, bottom = delta_h // 2, delta_h - (delta_h // 2)
    left, right = delta_w // 2, delta_w - (delta_w // 2)

    img = cv2.copyMakeBorder(img, top, bottom, left, right, cv2.BORDER_REFLECT_101)
    img = img.transpose(2, 0, 1).astype(np.float32) / 255.0

    return img


def preprocess_batch(face_crops: List[np.ndarray], model_img_size: int) -> np.ndarray:
    if not face_crops:
        raise ValueError("face_crops list cannot be empty")

    batch = np.zeros((len(face_crops), 3, model_img_size, model_img_size), dtype=np.float32)
    for i, face_crop in enumerate(face_crops):
        batch[i] = preprocess(face_crop, model_img_size)
    
    return batch


def crop(img: np.ndarray, bbox: tuple, bbox_inc: float) -> np.ndarray:
    real_h, real_w = img.shape[:2]
    x, y, w, h = bbox

    w = w - x
    h = h - y

    if w <= 0 or h <= 0:
        raise ValueError("Invalid bbox dimensions")

    max_dim = max(w, h)
    xc = x + w / 2
    yc = y + h / 2

    x = int(xc - max_dim * bbox_inc / 2)
    y = int(yc - max_dim * bbox_inc / 2)
    crop_size = int(max_dim * bbox_inc)

    crop_x1 = max(0, x)
    crop_y1 = max(0, y)
    crop_x2 = min(real_w, x + crop_size)
    crop_y2 = min(real_h, y + crop_size)

    top_pad = int(max(0, -y))
    left_pad = int(max(0, -x))
    bottom_pad = int(max(0, (y + crop_size) - real_h))
    right_pad = int(max(0, (x + crop_size) - real_w))

    if crop_x2 > crop_x1 and crop_y2 > crop_y1:
        img = img[crop_y1:crop_y2, crop_x1:crop_x2, :]
    else:
        img = np.zeros((0, 0, 3), dtype=img.dtype)

    result = cv2.copyMakeBorder(
        img,
        top_pad,
        bottom_pad,
        left_pad,
        right_pad,
        cv2.BORDER_REFLECT_101,
    )

    if result.shape[0] != crop_size or result.shape[1] != crop_size:
        raise ValueError(f"Crop size mismatch: expected {crop_size}x{crop_size}, got {result.shape[0]}x{result.shape[1]}")

    return result


def extract_bbox_coordinates(detection: Dict) -> Optional[Tuple[float, float, float, float]]:
    bbox = detection.get("bbox", {})
    if not isinstance(bbox, dict):
        return None

    x = float(bbox.get("x", 0))
    y = float(bbox.get("y", 0))
    w = float(bbox.get("width", 0))
    h = float(bbox.get("height", 0))

    if w <= 0 or h <= 0:
        return None

    return (x, y, w, h)


def extract_face_crops_from_detections(
    rgb_image: np.ndarray,
    detections: List[Dict],
    bbox_inc: float,
    crop_fn,
) -> Tuple[List[np.ndarray], List[Dict], List[Dict]]:
    face_crops = []
    valid_detections = []
    skipped_results = []

    for detection in detections:
        bbox_coords = extract_bbox_coordinates(detection)
        if bbox_coords is None:
            skipped_results.append(detection)
            continue

        x, y, w, h = bbox_coords

        try:
            face_crop = crop_fn(rgb_image, (x, y, x + w, y + h), bbox_inc)
            if len(face_crop.shape) != 3 or face_crop.shape[2] != 3:
                skipped_results.append(detection)
                continue
            if face_crop.shape[0] != face_crop.shape[1]:
                skipped_results.append(detection)
                continue
        except (ValueError, IndexError):
            skipped_results.append(detection)
            continue
        except Exception:
            skipped_results.append(detection)
            continue

        face_crops.append(face_crop)
        valid_detections.append(detection)

    return face_crops, valid_detections, skipped_results
