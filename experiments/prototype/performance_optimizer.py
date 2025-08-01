# ============================================================================ #
# Performance Optimization & Edge Device Optimizations
# For high-speed inference and resource-constrained environments

import cv2
import numpy as np
import time
from collections import deque
import threading
import queue

class PerformanceOptimizer:
    """Optimize system performance for edge deployment"""
    
    def __init__(self):
        self.frame_skip_counter = 0
        self.processing_times = deque(maxlen=100)
        self.target_fps = 30
        self.adaptive_quality = True
        
    def should_process_frame(self, current_fps):
        """Determine if current frame should be processed"""
        if current_fps > self.target_fps:
            # Skip frames to maintain target FPS
            self.frame_skip_counter += 1
            return self.frame_skip_counter % 2 == 0  # Process every other frame
        return True
    
    def optimize_detection_params(self, scene_complexity):
        """Dynamically adjust detection parameters based on scene"""
        if scene_complexity > 0.8:  # Complex scene
            return {
                'conf_thresh': 0.3,  # Lower threshold for crowded scenes
                'nms_thresh': 0.4,
                'input_size': 416    # Smaller input for speed
            }
        else:  # Simple scene
            return {
                'conf_thresh': 0.5,  # Higher threshold for quality
                'nms_thresh': 0.45,
                'input_size': 640    # Full resolution
            }

class AsyncFrameProcessor:
    """Asynchronous frame processing for better performance"""
    
    def __init__(self, process_func, max_queue_size=3):
        self.process_func = process_func
        self.input_queue = queue.Queue(maxsize=max_queue_size)
        self.output_queue = queue.Queue(maxsize=max_queue_size)
        self.processing_thread = None
        self.stop_flag = threading.Event()
        
    def start(self):
        """Start async processing thread"""
        self.processing_thread = threading.Thread(target=self._process_loop)
        self.processing_thread.daemon = True
        self.processing_thread.start()
    
    def stop(self):
        """Stop async processing"""
        self.stop_flag.set()
        if self.processing_thread:
            self.processing_thread.join(timeout=1.0)
    
    def _process_loop(self):
        """Main processing loop"""
        while not self.stop_flag.is_set():
            try:
                frame_data = self.input_queue.get(timeout=0.1)
                result = self.process_func(frame_data)
                
                try:
                    self.output_queue.put_nowait(result)
                except queue.Full:
                    # Drop oldest result if queue is full
                    try:
                        self.output_queue.get_nowait()
                        self.output_queue.put_nowait(result)
                    except queue.Empty:
                        pass
                        
            except queue.Empty:
                continue
            except Exception as e:
                print(f"[ERROR] Processing error: {e}")
    
    def add_frame(self, frame_data):
        """Add frame for processing"""
        try:
            self.input_queue.put_nowait(frame_data)
        except queue.Full:
            # Drop oldest frame if queue is full
            try:
                self.input_queue.get_nowait()
                self.input_queue.put_nowait(frame_data)
            except queue.Empty:
                pass
    
    def get_result(self):
        """Get processed result"""
        try:
            return self.output_queue.get_nowait()
        except queue.Empty:
            return None

class AdaptiveImageProcessor:
    """Adaptive image processing based on hardware capabilities"""
    
    def __init__(self):
        self.processing_mode = self._detect_processing_capability()
        self.pyramid_levels = 3 if self.processing_mode == 'high' else 2
        
    def _detect_processing_capability(self):
        """Detect hardware processing capability"""
        # Simple CPU benchmark
        start_time = time.time()
        test_array = np.random.rand(1000, 1000)
        np.linalg.svd(test_array[:100, :100])
        processing_time = time.time() - start_time
        
        if processing_time < 0.1:
            return 'high'
        elif processing_time < 0.3:
            return 'medium'
        else:
            return 'low'
    
    def adaptive_resize(self, image, target_size, quality_priority=False):
        """Resize image with adaptive quality"""
        h, w = image.shape[:2]
        
        if self.processing_mode == 'low' and not quality_priority:
            # Use faster, lower quality resize
            return cv2.resize(image, target_size, interpolation=cv2.INTER_LINEAR)
        elif self.processing_mode == 'medium':
            # Balanced approach
            return cv2.resize(image, target_size, interpolation=cv2.INTER_AREA)
        else:
            # High quality resize
            return cv2.resize(image, target_size, interpolation=cv2.INTER_CUBIC)
    
    def adaptive_enhancement(self, image):
        """Apply enhancement based on processing capability"""
        if self.processing_mode == 'low':
            # Minimal processing
            return cv2.equalizeHist(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY))
        elif self.processing_mode == 'medium':
            # CLAHE only
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            lab[:,:,0] = clahe.apply(lab[:,:,0])
            return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        else:
            # Full enhancement pipeline
            return self._full_enhancement(image)
    
    def _full_enhancement(self, image):
        """Full enhancement pipeline for high-end hardware"""
        # Multi-step enhancement
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        
        # CLAHE
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
        lab[:,:,0] = clahe.apply(lab[:,:,0])
        
        # Convert back
        enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        
        # Gaussian blur for noise reduction
        enhanced = cv2.GaussianBlur(enhanced, (3, 3), 0.5)
        
        return enhanced

class BatteryOptimizer:
    """Optimize for battery-powered edge devices"""
    
    def __init__(self):
        self.power_mode = 'balanced'  # 'performance', 'balanced', 'power_save'
        self.last_detection_time = time.time()
        self.idle_threshold = 10.0  # seconds
        
    def get_processing_interval(self):
        """Get frame processing interval based on power mode"""
        intervals = {
            'performance': 1,    # Process every frame
            'balanced': 2,       # Process every 2nd frame
            'power_save': 3      # Process every 3rd frame
        }
        return intervals.get(self.power_mode, 2)
    
    def should_enter_sleep_mode(self):
        """Check if system should enter low-power mode"""
        time_since_detection = time.time() - self.last_detection_time
        return time_since_detection > self.idle_threshold
    
    def optimize_for_power(self, frame):
        """Apply power-saving optimizations"""
        if self.power_mode == 'power_save':
            # Reduce resolution for power saving
            h, w = frame.shape[:2]
            small_frame = cv2.resize(frame, (w//2, h//2))
            return small_frame
        return frame

# Utility functions for optimization
def benchmark_system():
    """Benchmark system performance for optimal settings"""
    print("[INFO] Benchmarking system performance...")
    
    # CPU benchmark
    start_time = time.time()
    test_array = np.random.rand(1000, 1000)
    for _ in range(10):
        np.dot(test_array, test_array.T)
    cpu_time = time.time() - start_time
    
    # Memory benchmark
    import psutil
    memory_gb = psutil.virtual_memory().total / (1024**3)
    
    # Determine optimal settings
    if cpu_time < 1.0 and memory_gb > 8:
        settings = {
            'processing_mode': 'high_performance',
            'max_templates': 10,
            'pyramid_scales': 3,
            'quality_threshold': 0.6
        }
    elif cpu_time < 3.0 and memory_gb > 4:
        settings = {
            'processing_mode': 'balanced',
            'max_templates': 5,
            'pyramid_scales': 2,
            'quality_threshold': 0.5
        }
    else:
        settings = {
            'processing_mode': 'power_efficient',
            'max_templates': 3,
            'pyramid_scales': 1,
            'quality_threshold': 0.4
        }
    
    print(f"[INFO] Recommended settings: {settings}")
    return settings

def create_optimized_model_sessions(yolo_path, recog_path, device_capability='medium'):
    """Create optimized ONNX sessions based on device capability"""
    import onnxruntime as ort
    
    if device_capability == 'high':
        # Use all available optimizations
        providers = ['CPUExecutionProvider']
        sess_options = ort.SessionOptions()
        sess_options.intra_op_num_threads = 0  # Use all cores
        sess_options.inter_op_num_threads = 0
        sess_options.execution_mode = ort.ExecutionMode.ORT_PARALLEL
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    elif device_capability == 'medium':
        # Balanced settings
        providers = ['CPUExecutionProvider']
        sess_options = ort.SessionOptions()
        sess_options.intra_op_num_threads = 4
        sess_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    else:
        # Minimal resource usage
        providers = ['CPUExecutionProvider']
        sess_options = ort.SessionOptions()
        sess_options.intra_op_num_threads = 2
        sess_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
    
    try:
        yolo_session = ort.InferenceSession(yolo_path, sess_options, providers=providers)
        recog_session = ort.InferenceSession(recog_path, sess_options, providers=providers)
        print(f"[INFO] Created optimized sessions for {device_capability} capability device")
        return yolo_session, recog_session
    except Exception as e:
        print(f"[ERROR] Failed to create optimized sessions: {e}")
        # Fallback to basic sessions
        return ort.InferenceSession(yolo_path), ort.InferenceSession(recog_path)
