from typing import Dict, List, Optional
from pydantic import BaseModel


# Detection Models
class DetectionRequest(BaseModel):
    image: str  # Base64 encoded image
    model_type: str = "face_detector"
    confidence_threshold: float = 0.6
    nms_threshold: float = 0.3
    enable_liveness_detection: bool = True


class DetectionResponse(BaseModel):
    success: bool
    faces: List[Dict]
    processing_time: float
    model_used: str
    suggested_skip: int = 0


class StreamingRequest(BaseModel):
    session_id: str
    model_type: str = "face_detector"
    confidence_threshold: float = 0.6
    nms_threshold: float = 0.3
    enable_liveness_detection: bool = True


# Face Recognition Models
class FaceRecognitionRequest(BaseModel):
    image: str  # Base64 encoded image
    bbox: List[float]  # Face bounding box [x, y, width, height]
    landmarks_5: Optional[List[List[float]]] = (
        None  # Optional 5-point landmarks from face detector (FAST!)
    )
    group_id: Optional[str] = (
        None  # Optional group ID to filter recognition to specific group members
    )
    enable_liveness_detection: bool = (
        True  # Enable/disable liveness detection for spoof protection
    )


class FaceRecognitionResponse(BaseModel):
    success: bool
    person_id: Optional[str] = None
    similarity: float
    processing_time: float
    error: Optional[str] = None


# Face Registration Models
class FaceRegistrationRequest(BaseModel):
    person_id: str
    image: str  # Base64 encoded image
    bbox: List[float]  # Face bounding box [x, y, width, height]
    enable_liveness_detection: bool = (
        True  # Enable/disable liveness detection for spoof protection
    )
    landmarks_5: Optional[List[List[float]]] = (
        None  # Optional 5-point landmarks from face detector (FAST!)
    )


class FaceRegistrationResponse(BaseModel):
    success: bool
    person_id: str
    total_persons: int
    processing_time: float
    error: Optional[str] = None


# Person Management Models
class PersonRemovalRequest(BaseModel):
    person_id: str


class PersonUpdateRequest(BaseModel):
    old_person_id: str
    new_person_id: str


# Settings Models
class SimilarityThresholdRequest(BaseModel):
    threshold: float


class OptimizationRequest(BaseModel):
    cache_duration: float = 1.0
    clear_cache: bool = False
