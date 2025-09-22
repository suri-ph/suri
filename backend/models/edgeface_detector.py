"""
EdgeFace Recognition Model Implementation
Based on EdgeFace research paper and optimized for production deployment
"""

import asyncio
import logging
import time
from typing import List, Dict, Tuple, Optional, Union
import os

import cv2
import numpy as np
import onnxruntime as ort

from ..utils.database_manager import FaceDatabaseManager

logger = logging.getLogger(__name__)

class EdgeFaceDetector:
    """
    EdgeFace recognition model wrapper with async support and database management
    """
    
    def __init__(
        self,
        model_path: str,
        input_size: Tuple[int, int] = (112, 112),
        similarity_threshold: float = 0.6,
        providers: Optional[List[str]] = None,
        database_path: Optional[str] = None
    ):
        """
        Initialize EdgeFace detector
        
        Args:
            model_path: Path to the ONNX model file
            input_size: Input size (width, height) - EdgeFace uses 112x112
            similarity_threshold: Similarity threshold for recognition
            providers: ONNX runtime providers
            database_path: Path to face database JSON file
        """
        self.model_path = model_path
        self.input_size = input_size
        self.similarity_threshold = similarity_threshold
        self.providers = providers or ['CPUExecutionProvider']
        self.database_path = database_path
        
        # Model specifications (matching EdgeFace research paper)
        self.INPUT_MEAN = 127.5
        self.INPUT_STD = 127.5
        self.EMBEDDING_DIM = 512
        
        # Face alignment reference points (5-point landmarks)
        self.REFERENCE_ALIGNMENT = np.array([
            [38.2946, 51.6963],   # left eye
            [73.5318, 51.5014],   # right eye  
            [56.0252, 71.7366],   # nose
            [41.5493, 92.3655],   # left mouth corner
            [70.7299, 92.2041]    # right mouth corner
        ], dtype=np.float32)
        
        # Model components
        self.session = None
        
        # Initialize SQLite database manager
        if self.database_path:
            # Convert .json extension to .db for SQLite
            if self.database_path.endswith('.json'):
                sqlite_path = self.database_path.replace('.json', '.db')
            else:
                sqlite_path = self.database_path
            
            self.db_manager = FaceDatabaseManager(sqlite_path)
            logger.info(f"Initialized SQLite database: {sqlite_path}")
        else:
            self.db_manager = None
            logger.warning("No database path provided, running without persistence")
        
        # Initialize the model
        self._initialize_model()
        
    def _initialize_model(self):
        """Initialize the ONNX model"""
        try:
            # Check if model file exists
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model file not found: {self.model_path}")
            
            logger.info(f"Loading EdgeFace model from: {self.model_path}")
            
            # Create ONNX session
            self.session = ort.InferenceSession(
                self.model_path,
                providers=self.providers
            )
            
            # Get model info
            input_info = self.session.get_inputs()[0]
            output_info = self.session.get_outputs()[0]
            
            logger.info(f"Model input shape: {input_info.shape}")
            logger.info(f"Model output shape: {output_info.shape}")
            logger.info(f"Available providers: {self.session.get_providers()}")
            logger.info(f"EdgeFace model initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize EdgeFace model: {e}")
            raise
    

    
    def _align_face(self, image: np.ndarray, landmarks: np.ndarray) -> np.ndarray:
        """
        Align face using 5-point landmarks
        
        Args:
            image: Input image
            landmarks: 5-point landmarks [[x1,y1], [x2,y2], ...]
            
        Returns:
            Aligned face crop (112x112)
        """
        try:
            # Ensure landmarks are in correct format
            if landmarks.shape != (5, 2):
                raise ValueError(f"Expected landmarks shape (5, 2), got {landmarks.shape}")
            
            # Calculate similarity transformation matrix
            tform = cv2.estimateAffinePartial2D(
                landmarks.astype(np.float32),
                self.REFERENCE_ALIGNMENT,
                method=cv2.RANSAC
            )[0]
            
            if tform is None:
                raise ValueError("Failed to estimate transformation matrix")
            
            # Apply transformation
            aligned_face = cv2.warpAffine(
                image,
                tform,
                self.input_size,
                flags=cv2.INTER_LINEAR,
                borderMode=cv2.BORDER_CONSTANT,
                borderValue=0
            )
            
            return aligned_face
            
        except Exception as e:
            logger.error(f"Face alignment failed: {e}")
            # Fallback: simple crop and resize
            h, w = image.shape[:2]
            center_x, center_y = w // 2, h // 2
            size = min(w, h) // 2
            
            x1 = max(0, center_x - size)
            y1 = max(0, center_y - size)
            x2 = min(w, center_x + size)
            y2 = min(h, center_y + size)
            
            face_crop = image[y1:y2, x1:x2]
            return cv2.resize(face_crop, self.input_size)
    
    def _preprocess_image(self, aligned_face: np.ndarray) -> np.ndarray:
        """
        Preprocess aligned face for EdgeFace model
        
        Args:
            aligned_face: Aligned face image (112x112)
            
        Returns:
            Preprocessed tensor ready for inference
        """
        try:
            # Convert BGR to RGB
            rgb_image = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2RGB)
            
            # Normalize to [-1, 1] range (EdgeFace preprocessing)
            normalized = (rgb_image.astype(np.float32) - self.INPUT_MEAN) / self.INPUT_STD
            
            # Transpose to CHW format and add batch dimension
            input_tensor = np.transpose(normalized, (2, 0, 1))  # HWC to CHW
            input_tensor = np.expand_dims(input_tensor, axis=0)  # Add batch dimension
            
            return input_tensor
            
        except Exception as e:
            logger.error(f"Image preprocessing failed: {e}")
            raise
    
    def _extract_embedding(self, image: np.ndarray, landmarks: np.ndarray) -> np.ndarray:
        """
        Extract face embedding from image using landmarks
        
        Args:
            image: Input image
            landmarks: 5-point facial landmarks
            
        Returns:
            Normalized face embedding (512-dim)
        """
        try:
            # Align face using landmarks
            aligned_face = self._align_face(image, landmarks)
            
            # Preprocess for model
            input_tensor = self._preprocess_image(aligned_face)
            
            # Run inference
            feeds = {self.session.get_inputs()[0].name: input_tensor}
            outputs = self.session.run(None, feeds)
            
            # Extract embedding
            embedding = outputs[0][0]  # Remove batch dimension
            
            # L2 normalization (critical for cosine similarity)
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            
            return embedding.astype(np.float32)
            
        except Exception as e:
            logger.error(f"Embedding extraction failed: {e}")
            raise
    
    def _calculate_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings"""
        try:
            # Cosine similarity (since embeddings are L2 normalized)
            similarity = np.dot(embedding1, embedding2)
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Similarity calculation failed: {e}")
            return 0.0
    
    def _find_best_match(self, embedding: np.ndarray) -> Tuple[Optional[str], float]:
        """
        Find best matching person in database
        
        Args:
            embedding: Query embedding
            
        Returns:
            Tuple of (person_id, similarity_score)
        """
        if not self.db_manager:
            return None, 0.0
        
        # Get all persons from SQLite database
        all_persons = self.db_manager.get_all_persons()
        
        if not all_persons:
            return None, 0.0
        
        best_person_id = None
        best_similarity = 0.0
        
        for person_id, stored_embedding in all_persons.items():
            similarity = self._calculate_similarity(embedding, stored_embedding)
            
            if similarity > best_similarity:
                best_similarity = similarity
                best_person_id = person_id
        
        # Only return match if above threshold
        if best_similarity >= self.similarity_threshold:
            return best_person_id, best_similarity
        else:
            return None, best_similarity
    
    def recognize_face(self, image: np.ndarray, landmarks: List[List[float]]) -> Dict:
        """
        Recognize face in image using landmarks (synchronous)
        
        Args:
            image: Input image as numpy array (BGR format)
            landmarks: 5-point facial landmarks [[x1,y1], [x2,y2], ...]
            
        Returns:
            Recognition result with person_id and similarity
        """
        try:
            # Convert landmarks to numpy array
            landmarks_array = np.array(landmarks, dtype=np.float32)
            
            if landmarks_array.shape[0] < 5:
                raise ValueError("Insufficient landmarks for face recognition (need 5 points)")
            
            # Take first 5 landmarks if more are provided
            landmarks_array = landmarks_array[:5]
            
            # Extract embedding
            embedding = self._extract_embedding(image, landmarks_array)
            
            # Find best match
            person_id, similarity = self._find_best_match(embedding)
            
            return {
                "person_id": person_id,
                "similarity": similarity,
                "embedding": embedding.tolist(),  # For potential storage
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Face recognition error: {e}")
            return {
                "person_id": None,
                "similarity": 0.0,
                "embedding": None,
                "success": False,
                "error": str(e)
            }
    
    async def recognize_face_async(self, image: np.ndarray, landmarks: List[List[float]]) -> Dict:
        """
        Recognize face in image using landmarks (asynchronous)
        
        Args:
            image: Input image as numpy array (BGR format)
            landmarks: 5-point facial landmarks
            
        Returns:
            Recognition result with person_id and similarity
        """
        # Run recognition in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.recognize_face, image, landmarks)
    
    def register_person(self, person_id: str, image: np.ndarray, landmarks: List[List[float]]) -> Dict:
        """
        Register a new person in the database
        
        Args:
            person_id: Unique identifier for the person
            image: Input image
            landmarks: 5-point facial landmarks
            
        Returns:
            Registration result
        """
        try:
            # Convert landmarks to numpy array
            landmarks_array = np.array(landmarks, dtype=np.float32)
            
            if landmarks_array.shape[0] < 5:
                raise ValueError("Insufficient landmarks for registration (need 5 points)")
            
            # Take first 5 landmarks if more are provided
            landmarks_array = landmarks_array[:5]
            
            # Extract embedding
            embedding = self._extract_embedding(image, landmarks_array)
            
            # Store in SQLite database
            if self.db_manager:
                save_success = self.db_manager.add_person(person_id, embedding)
                stats = self.db_manager.get_stats()
                total_persons = stats.get("total_persons", 0)
            else:
                save_success = False
                total_persons = 0
                logger.warning("No database manager available for registration")
            
            logger.info(f"Registered person: {person_id}")
            
            return {
                "success": True,
                "person_id": person_id,
                "database_saved": save_success,
                "total_persons": total_persons
            }
            
        except Exception as e:
            logger.error(f"Person registration failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "person_id": person_id
            }
    
    async def register_person_async(self, person_id: str, image: np.ndarray, landmarks: List[List[float]]) -> Dict:
        """Register person asynchronously"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.register_person, person_id, image, landmarks)
    
    def remove_person(self, person_id: str) -> Dict:
        """
        Remove person from database
        
        Args:
            person_id: Person to remove
            
        Returns:
            Removal result
        """
        try:
            if self.db_manager:
                remove_success = self.db_manager.remove_person(person_id)
                
                if remove_success:
                    stats = self.db_manager.get_stats()
                    total_persons = stats.get("total_persons", 0)
                    
                    logger.info(f"Removed person: {person_id}")
                    
                    return {
                        "success": True,
                        "person_id": person_id,
                        "database_saved": True,
                        "total_persons": total_persons
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Person {person_id} not found in database",
                        "person_id": person_id
                    }
            else:
                return {
                    "success": False,
                    "error": "No database manager available",
                    "person_id": person_id
                }
                
        except Exception as e:
            logger.error(f"Person removal failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "person_id": person_id
            }
    
    def get_all_persons(self) -> List[str]:
        """Get list of all registered persons"""
        if self.db_manager:
            all_persons = self.db_manager.get_all_persons()
            return list(all_persons.keys())
        return []
    
    def get_stats(self) -> Dict:
        """Get database statistics"""
        total_persons = 0
        if self.db_manager:
            stats = self.db_manager.get_stats()
            total_persons = stats.get("total_persons", 0)
            
        return {
            "total_persons": total_persons,
            "similarity_threshold": self.similarity_threshold,
            "embedding_dimension": self.EMBEDDING_DIM,
            "input_size": self.input_size,
            "model_path": self.model_path,
            "database_path": self.database_path
        }
    
    def set_similarity_threshold(self, threshold: float):
        """Set similarity threshold for recognition"""
        self.similarity_threshold = threshold
        logger.info(f"Updated similarity threshold to: {threshold}")
    
    def clear_database(self) -> Dict:
        """Clear all persons from database"""
        try:
            if self.db_manager:
                clear_success = self.db_manager.clear_database()
                
                if clear_success:
                    logger.info("Cleared face database")
                    
                    return {
                        "success": True,
                        "database_saved": True,
                        "total_persons": 0
                    }
                else:
                    return {
                        "success": False,
                        "error": "Failed to clear database"
                    }
            else:
                return {
                    "success": False,
                    "error": "No database manager available"
                }
            
        except Exception as e:
            logger.error(f"Database clearing failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_model_info(self) -> Dict:
        """Get model information"""
        return {
            "name": "EdgeFace",
            "model_path": self.model_path,
            "input_size": self.input_size,
            "embedding_dimension": self.EMBEDDING_DIM,
            "similarity_threshold": self.similarity_threshold,
            "providers": self.providers,
            "description": "EdgeFace recognition model for face identification",
            "version": "production",
            "supported_formats": ["jpg", "jpeg", "png", "bmp", "webp"],
            "requires_landmarks": True,
            "landmark_count": 5
        }