import logging
import numpy as np

if not logging.getLogger().handlers:
    logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def serialize_faces(faces: list, endpoint_name: str = "") -> list:
    """Serialize face detection results for API response"""
    serialized_faces = []
    for face in faces:
        # Validate required fields - no fallbacks
        if "bbox" not in face or not isinstance(face["bbox"], dict):
            logger.warning(f"Face missing bbox in {endpoint_name}: {face}")
            continue

        # Use bbox_original if present, otherwise use bbox
        if "bbox_original" in face:
            bbox_orig = face["bbox_original"]
            if not isinstance(bbox_orig, dict):
                logger.warning(f"Face bbox_original is not a dict: {face}")
                continue
        else:
            bbox_orig = face["bbox"]

        # Validate bbox has all required fields
        required_bbox_fields = ["x", "y", "width", "height"]
        if not all(field in bbox_orig for field in required_bbox_fields):
            logger.warning(f"Face bbox missing required fields: {bbox_orig}")
            continue

        # Validate confidence is present
        if "confidence" not in face or face["confidence"] is None:
            logger.warning(f"Face missing confidence: {face}")
            continue

        # Serialize bbox as array [x, y, width, height]
        face["bbox"] = [
            bbox_orig["x"],
            bbox_orig["y"],
            bbox_orig["width"],
            bbox_orig["height"],
        ]

        # Convert track_id to int if present
        if "track_id" in face and face["track_id"] is not None:
            track_id_value = face["track_id"]
            if isinstance(track_id_value, (np.integer, np.int32, np.int64)):
                face["track_id"] = int(track_id_value)

        # Validate liveness data if present
        if "liveness" in face:
            liveness = face["liveness"]
            if not isinstance(liveness, dict):
                logger.warning(f"Face liveness is not a dict: {face}")
                del face["liveness"]
            else:
                # Validate required liveness fields
                if "status" not in liveness:
                    logger.warning(f"Face liveness missing status: {liveness}")
                    del face["liveness"]
                elif "is_real" not in liveness:
                    logger.warning(f"Face liveness missing is_real: {liveness}")
                    del face["liveness"]

        # Remove embedding to reduce payload size
        if "embedding" in face:
            del face["embedding"]

        serialized_faces.append(face)

    return serialized_faces
