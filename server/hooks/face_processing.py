"""
Face processing hooks for the API
Handles liveness detection and face tracking processing
"""

import asyncio
import logging
from typing import Dict, List

import numpy as np

logger = logging.getLogger(__name__)

# Global references to models (set from main.py)
liveness_detector = None
face_tracker = None
face_recognizer = None


def set_model_references(liveness, tracker, recognizer):
    """Set global model references from main.py"""
    global liveness_detector, face_tracker, face_recognizer
    liveness_detector = liveness
    face_tracker = tracker
    face_recognizer = recognizer


async def process_liveness_detection(
    faces: List[Dict], image: np.ndarray, enable: bool
) -> List[Dict]:
    """Helper to process liveness detection across all endpoints"""
    if not (enable and faces and liveness_detector):
        return faces

    try:
        # Process liveness detection
        loop = asyncio.get_event_loop()
        faces_with_liveness = await loop.run_in_executor(
            None, liveness_detector.detect_faces, image, faces
        )
        return faces_with_liveness

    except Exception as e:
        logger.warning(f"Liveness detection failed: {e}")
        # Mark ALL faces as SPOOF on error
        for face in faces:
            face["liveness"] = {
                "is_real": False,
                "live_score": 0.0,
                "spoof_score": 1.0,
                "confidence": 0.0,
                "status": "error",
                "message": f"Liveness detection error: {str(e)}",
            }

    return faces


async def process_face_tracking(faces: List[Dict], image: np.ndarray) -> List[Dict]:
    """
    Process face tracking with Deep SORT
    - Extracts embeddings for all frames for consistent tracking
    - Frontend controls frame rate, so no need for backend frame skipping
    """
    if not (faces and face_tracker and face_recognizer):
        return faces

    try:
        # Extract embeddings for all faces (batch processing for efficiency)
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(
            None, face_recognizer.extract_embeddings_for_tracking, image, faces
        )

        # Update Deep SORT tracker with faces and embeddings
        tracked_faces = await loop.run_in_executor(
            None, face_tracker.update, faces, embeddings
        )

        return tracked_faces

    except Exception as e:
        logger.warning(f"Deep SORT tracking failed: {e}")
        # Return original faces without tracking on error
        return faces


async def process_liveness_for_face_operation(
    image: np.ndarray,
    bbox: list,
    enable_liveness_detection: bool,
    operation_name: str,
) -> tuple[bool, str | None]:
    """
    Process liveness detection for face recognition/registration operations.
    Returns (should_block, error_message)
    """
    from core.lifespan import liveness_detector

    if not (liveness_detector and enable_liveness_detection):
        return False, None

    # Liveness detector supports list format directly - only bbox is required
    loop = asyncio.get_event_loop()
    liveness_results = await loop.run_in_executor(
        None, liveness_detector.detect_faces, image, [{"bbox": bbox}]
    )

    if liveness_results and len(liveness_results) > 0:
        liveness_data = liveness_results[0].get("liveness", {})
        is_real = liveness_data.get("is_real", False)
        status = liveness_data.get("status", "unknown")

        # Block for spoofed faces
        if not is_real or status == "spoof":
            return (
                True,
                f"{operation_name} blocked: spoofed face detected (status: {status})",
            )

        # Block other problematic statuses
        if status in ["too_small", "error"]:
            logger.warning(f"{operation_name} blocked for face with status: {status}")
            return True, f"{operation_name} blocked: face status {status}"

    return False, None
