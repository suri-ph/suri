"""
YuNet Face Detector
Simple, effective face detection using OpenCV's YuNet model
Based on the Face-AntiSpoofing prototype implementation
"""

import cv2
import numpy as np
import os
import logging
from typing import List, Dict, Tuple, Optional

logger = logging.getLogger(__name__)

class YuNet:
    def __init__(self,
                 model_path: str = None,
                 input_size: tuple = (320, 320),
                 conf_threshold: float = 0.6,
        nms_threshold: float = 0.3,
        top_k: int = 5000):
        """
        Initialize YuNet face detector
        
        Args:
            model_path: Path to the ONNX model file
            input_size: Input size (width, height) for the model
            conf_threshold: Confidence threshold for face detection
            nms_threshold: Non-maximum suppression threshold
            top_k: Maximum number of faces to detect
        """
        self.model_path = model_path
        self.input_size = input_size
        self.conf_threshold = conf_threshold
        self.nms_threshold = nms_threshold
        self.top_k = top_k
        self.detector = None
        
        if model_path and os.path.isfile(model_path):
            self._init_detector()

    def _init_detector(self):
        """Initialize the OpenCV FaceDetectorYN"""
        try:
            self.detector = cv2.FaceDetectorYN.create(
                self.model_path,
                "",
                self.input_size,
                self.conf_threshold,
                self.nms_threshold,
                self.top_k
            )
            logger.info(f"YuNet detector initialized with model: {self.model_path}")
        except Exception as e:
            logger.error(f"Error initializing YuNet detector: {e}")
            self.detector = None
    
    def detect_faces(self, image: np.ndarray) -> List[dict]:
        """
        Detect faces in image
        OPTIMIZED: Processes BGR image (OpenCV native format)
        
        Args:
            image: Input image (BGR format - OpenCV native)
            
        Returns:
            List of face detection dictionaries with bbox and confidence
        """
        if not self.detector:
            return []
    
        orig_height, orig_width = image.shape[:2]
        
        # OPTIMIZATION: No color conversion - YuNet expects BGR natively
        resized_img = cv2.resize(image, self.input_size)
        
        _, faces = self.detector.detect(resized_img)
        
        if faces is None or len(faces) == 0:
            return []
        
        # Convert detections to our format
        detections = []
        for face in faces:
            if face[4] >= self.conf_threshold:  # confidence check
                # YuNet returns [x, y, w, h, confidence]
                x, y, w, h, conf = face[:5]
                
                # Scale coordinates from resized image back to original image
                scale_x = orig_width / self.input_size[0]
                scale_y = orig_height / self.input_size[1]
                
                x1_orig = int(x * scale_x)
                y1_orig = int(y * scale_y)
                x2_orig = int((x + w) * scale_x)
                y2_orig = int((y + h) * scale_y)
                
                x1_orig = max(0, x1_orig)
                y1_orig = max(0, y1_orig)
                x2_orig = min(orig_width, x2_orig)
                y2_orig = min(orig_height, y2_orig)
                
                face_width_orig = x2_orig - x1_orig
                face_height_orig = y2_orig - y1_orig
                
                # 🚀 OPTIMIZATION: Remove bbox expansion here
                # Anti-spoofing already handles bbox expansion with its bbox_inc parameter (1.2)
                # This eliminates redundant expansion that was applied TWICE (30% perf loss)
                
                
                normalized_conf = float(conf)
                if normalized_conf > 1.0:
                    normalized_conf = min(1.0, normalized_conf / 3.0)
                
                # 🚀 OPTIMIZATION: Use original bbox as primary (no expansion)
                # This removes redundant bbox expansion that was causing 30% performance loss
                detection = {
                    'bbox': {
                        'x': x1_orig,
                        'y': y1_orig,
                        'width': face_width_orig,
                        'height': face_height_orig
                    },
                    'bbox_original': {
                        'x': x1_orig,
                        'y': y1_orig,
                        'width': face_width_orig,
                        'height': face_height_orig
                    },
                    'confidence': normalized_conf
                }
                detections.append(detection)
        
        return detections

    def set_input_size(self, input_size):
        """Update input size"""
        self.input_size = input_size
        if self.detector:
            self.detector.setInputSize(input_size)

    def set_score_threshold(self, threshold):
        """Update confidence threshold"""
        self.conf_threshold = threshold
        if self.detector:
            self.detector.setScoreThreshold(threshold)

    def set_nms_threshold(self, threshold):
        """Update NMS threshold"""
        self.nms_threshold = threshold
        if self.detector:
            self.detector.setNMSThreshold(threshold)

    def set_top_k(self, top_k):
        """Update maximum number of detections"""
        self.top_k = top_k
        if self.detector:
            self.detector.setTopK(top_k)

    def set_confidence_threshold(self, threshold):
        """Update confidence threshold (alias for set_score_threshold)"""
        self.set_score_threshold(threshold)

    def get_model_info(self):
        """Get model information"""
        return {
            "model_path": self.model_path,
            "input_size": self.input_size,
            "conf_threshold": self.conf_threshold,
            "nms_threshold": self.nms_threshold,
            "top_k": self.top_k
        }
