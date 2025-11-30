"""
Hooks package for request processing pipelines
"""

from .face_processing import (
    process_face_detection,
    process_liveness_detection,
    process_face_tracking,
    process_liveness_for_face_operation,
    set_model_references,
)

__all__ = [
    "process_face_detection",
    "process_liveness_detection",
    "process_face_tracking",
    "process_liveness_for_face_operation",
    "set_model_references",
]
