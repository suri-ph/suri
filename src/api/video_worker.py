"""
Video Worker: Real-time OpenCV inference over stdout for Electron child_process

Design
- Opens the camera once (prefers DirectShow on Windows), sets low-latency options.
- Runs detection + recognition using the same prototype pipeline.
- Annotates frames and writes them as length-prefixed JPEG to stdout:
  [uint32_le length][JPEG bytes]
- Logs diagnostics and JSON events (e.g., errors) to stderr (never stdout).
- Listens for optional JSON control commands on stdin (device switch, pause, resume, stop).

Why
- Avoids WebSocket overhead for video streaming. Meant to be spawned from Electron main.

Usage
  python -m src.api.video_worker --device 0 --width 640 --height 480 --fps 30 --annotate

Protocol
- Frames: stdout stream with length-prefixed JPEGs (uint32 little-endian)
- Control: newline-delimited JSON commands on stdin, e.g.
    {"action":"set_device","device":1}
    {"action":"pause"}
    {"action":"resume"}
    {"action":"stop"}
  Responses and logs are written to stderr as JSON lines prefixed with EVT or LOG for easy parsing.
"""

from __future__ import annotations

import os
import sys
import json
import time
import struct
import threading
from dataclasses import dataclass
from typing import Optional

import cv2

# Ensure UTF-8 logs on Windows and avoid buffering delays; prefer DirectShow over MSMF
if sys.platform.startswith('win'):
    os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
    # Disable MSMF to avoid latency/warnings and force DirectShow path
    os.environ.setdefault('OPENCV_VIDEOIO_MSMF_ENABLE', '0')

# Add parent-of-src to path to import experiments
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

# Direct imports from prototype - only what we actually use
from experiments.prototype.main import (
    preprocess_yolo,
    non_max_suppression,
    yolo_sess,
    input_size,
    conf_thresh,
    iou_thresh,
    Main,
)
from experiments.prototype.utils import calculate_quality_score


@dataclass
class Options:
    device: int = 0
    annotate: bool = True
    fast_preview: bool = False


class ControlState:
    def __init__(self):
        self.lock = threading.Lock()
        self.paused = False
        self.request_stop = False
        self.request_device: Optional[int] = None

    def set_paused(self, value: bool):
        with self.lock:
            self.paused = value

    def get(self):
        with self.lock:
            return self.paused, self.request_stop, self.request_device

    def set_stop(self):
        with self.lock:
            self.request_stop = True

    def consume_device_switch(self) -> Optional[int]:
        with self.lock:
            d = self.request_device
            self.request_device = None
            return d


def control_loop(ctrl: ControlState):
    """Read JSON control messages from stdin (blocking in a thread)."""
    while True:
        line = sys.stdin.readline()
        if not line:
            # stdin closed -> stop
            ctrl.set_stop()
            return
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception:
            print(f"[video_worker] invalid control JSON: {line!r}", file=sys.stderr)
            continue
        action = msg.get('action')
        if action == 'pause':
            ctrl.set_paused(True)
            print(f"EVT {json.dumps({'type': 'video.paused'})}", file=sys.stderr)
        elif action == 'resume':
            ctrl.set_paused(False)
            print(f"EVT {json.dumps({'type': 'video.resumed'})}", file=sys.stderr)
        elif action == 'stop':
            ctrl.set_stop()
            print(f"EVT {json.dumps({'type': 'video.stopping'})}", file=sys.stderr)
        elif action == 'set_device':
            try:
                d = int(msg.get('device', 0))
                with ctrl.lock:
                    ctrl.request_device = d
                print(f"EVT {json.dumps({'type': 'video.switch_device', 'device': d})}", file=sys.stderr)
            except Exception:
                print("[video_worker] set_device missing/invalid 'device'", file=sys.stderr)
        else:
            print(f"[video_worker] unknown action: {action}", file=sys.stderr)


def write_frame(jpeg: bytes):
    """Write length-prefixed JPEG to stdout (uint32_le)."""
    try:
        sys.stdout.buffer.write(struct.pack('<I', len(jpeg)))
        sys.stdout.buffer.write(jpeg)
        sys.stdout.buffer.flush()
    except BrokenPipeError:
        # consumer went away
        raise


def streaming_camera_recognition(app, opts: Options, ctrl: ControlState):
    """Adapted from prototype's live_camera_recognition for streaming"""
    cap = cv2.VideoCapture(opts.device)
    if not cap.isOpened():
        print(f"EVT {json.dumps({'type': 'video.error', 'message': f'Could not open camera {opts.device}'})}", file=sys.stderr)
        return 2

    # Configure camera for optimal performance
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce latency
    cap.set(cv2.CAP_PROP_FPS, 30)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    print(f"EVT {json.dumps({'type': 'video.started', 'device': opts.device, 'fast_preview': opts.fast_preview})}", file=sys.stderr)
    
    # In fast preview mode, start sending frames immediately without model loading
    if opts.fast_preview:
        print(f"EVT {json.dumps({'type': 'video.fast_preview_ready'})}", file=sys.stderr)
    
    consecutive_fail = 0
    frame_count = 0
    last_db_check = time.time()
    db_check_interval = 2.0  # Check for database updates every 2 seconds
    
    while True:
        paused, req_stop, _ = ctrl.get()
        if req_stop:
            break
        if paused:
            time.sleep(0.02)
            continue

        # Device switch request?
        nd = ctrl.consume_device_switch()
        if nd is not None:
            try:
                if cap is not None:
                    cap.release()
                cap = cv2.VideoCapture(nd)
                if not cap or not cap.isOpened():
                    print(f"EVT {json.dumps({'type': 'video.error', 'message': f'Failed to switch to camera {nd}'})}", file=sys.stderr)
                else:
                    opts.device = nd
                    print(f"EVT {json.dumps({'type': 'video.device', 'device': nd})}", file=sys.stderr)
                    consecutive_fail = 0
            except Exception as e:
                print(f"EVT {json.dumps({'type': 'video.error', 'message': f'Switch device error: {e}'})}", file=sys.stderr)

        if cap is None or not cap.isOpened():
            time.sleep(0.05)
            continue

        ret, frame = cap.read()
        if not ret or frame is None or frame.size == 0:
            consecutive_fail += 1
            if consecutive_fail >= 10:
                try:
                    if cap:
                        cap.release()
                except Exception:
                    pass
                cap = cv2.VideoCapture(opts.device)
                consecutive_fail = 0
            else:
                time.sleep(0.005)
            continue

        consecutive_fail = 0
        
        # Check for database updates periodically
        current_time = time.time()
        if current_time - last_db_check > db_check_interval:
            try:
                # Reload face databases to pick up new people added via API
                old_face_count = len(app.face_database)
                old_template_count = sum(len(templates) for templates in app.multi_templates.values())
                
                app.load_face_database()
                app.load_multi_templates()
                
                new_face_count = len(app.face_database)
                new_template_count = sum(len(templates) for templates in app.multi_templates.values())
                
                if new_face_count != old_face_count or new_template_count != old_template_count:
                    print(f"LOG Database reloaded: {new_face_count} faces, {new_template_count} templates", file=sys.stderr)
                
                last_db_check = current_time
            except Exception as e:
                print(f"LOG Database reload error: {e}", file=sys.stderr)
                last_db_check = current_time  # Don't spam errors
        
        # Use prototype's exact processing logic
        orig = frame.copy()
        h, w = frame.shape[:2]
        frame_count += 1
        
        # In fast preview mode, skip heavy processing for first few seconds
        skip_recognition = opts.fast_preview and frame_count < 90  # ~3 seconds at 30fps
        
        if opts.annotate and not skip_recognition:
            try:
                # Preprocess for YOLO (same as prototype)
                input_blob, scale, dx, dy = preprocess_yolo(frame)
                
                # Run YOLO inference (same as prototype)
                preds = yolo_sess.run(None, {'images': input_blob})[0]
                faces = non_max_suppression(preds, conf_thresh, iou_thresh, 
                                           img_shape=(h, w), input_shape=(input_size, input_size), 
                                           pad=(dx, dy), scale=scale)

                scene_crowding = len(faces)
                
                # Process each detected face (same as prototype)
                for box in faces:
                    x1, y1, x2, y2, conf = box
                    
                    if x2 <= x1 or y2 <= y1:
                        continue

                    face_img = orig[y1:y2, x1:x2]
                    if face_img.size == 0:
                        continue
                    
                    # Calculate quality score (same as prototype)
                    quality = calculate_quality_score(face_img, conf)
                    
                    # Enhanced identification (same as prototype)
                    identified_name, similarity, should_log, info = app.identify_face_enhanced(
                        face_img, conf, scene_crowding
                    )
                    
                    if identified_name and should_log:
                        # Log attendance with enhanced info (same as prototype)
                        app.log_attendance(identified_name, similarity, info)
                    
                    # Visualization based on confidence and method (same as prototype)
                    if identified_name and should_log:
                        # High confidence - green box
                        color = (0, 255, 0)
                        method_text = info.get('method', 'unknown')[:8]  # Truncate for display
                        label = f"{identified_name} ({similarity:.3f}) [{method_text}]"
                    elif identified_name:
                        # Low confidence - yellow box
                        color = (0, 255, 255)
                        label = f"{identified_name}? ({similarity:.3f})"
                    else:
                        # Unknown - red box
                        color = (0, 0, 255)
                        label = f"Unknown (Q:{quality:.2f})"
                    
                    # Draw enhanced bounding box (same as prototype)
                    cv2.rectangle(orig, (x1, y1), (x2, y2), color, 2)
                    
                    # Multi-line label with enhanced info (same as prototype)
                    cv2.putText(orig, label, (x1, y1 - 35), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                    
                    if 'conditions' in info and info['conditions']:
                        conditions_text = ", ".join(info['conditions'][:2])  # Show first 2 conditions
                        cv2.putText(orig, f"Cond: {conditions_text}", (x1, y1 - 20), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
                    
                    # Quality and threshold info (same as prototype)
                    threshold_used = info.get('threshold_used', 0.20)
                    cv2.putText(orig, f"Q:{quality:.2f} T:{threshold_used:.2f}", (x1, y1 - 5), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
                
                # Enhanced UI overlay (same as prototype)
                cv2.putText(orig, "Mode: STREAMING", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                
                # Performance metrics (same as prototype)
                fps_text = f"Faces: {len(faces)} | Crowding: {scene_crowding}"
                cv2.putText(orig, fps_text, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                
                # Show today's attendance count (same as prototype)
                today_count = len(app.get_today_attendance())
                cv2.putText(orig, f"Today's Attendance: {today_count}", (10, h - 20), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                
            except Exception as e:
                print(f"[video_worker] inference error: {e}", file=sys.stderr)
        elif skip_recognition:
            # Show loading indicator during fast preview mode
            cv2.putText(orig, "Mode: FAST PREVIEW - Loading Models...", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
            cv2.putText(orig, f"Frame: {frame_count}/90", (10, 60), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            # Signal when switching to full recognition mode
            if frame_count == 90:
                print(f"EVT {json.dumps({'type': 'video.recognition_ready'})}", file=sys.stderr)
        else:
            # Basic streaming mode without annotation
            cv2.putText(orig, "Mode: PREVIEW ONLY", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        # Encode and send
        try:
            ok, buf = cv2.imencode('.jpg', orig, [cv2.IMWRITE_JPEG_QUALITY, 85])
        except Exception as e:
            print(f"[video_worker] encode error: {e}", file=sys.stderr)
            ok, buf = False, None
        if ok and buf is not None:
            try:
                write_frame(buf.tobytes())
            except BrokenPipeError:
                # Consumer closed; exit cleanly
                return 0
            except Exception as e:
                print(f"[video_worker] send error: {e}", file=sys.stderr)
        else:
            time.sleep(0.005)

    cap.release()
    print(f"EVT {json.dumps({'type': 'video.stopped'})}", file=sys.stderr)
    return 0


def streaming_camera_recognition_fast(model_future, opts: Options, ctrl: ControlState):
    """Fast preview mode - start camera immediately, add recognition when models load"""
    cap = cv2.VideoCapture(opts.device)
    if not cap.isOpened():
        print(f"EVT {json.dumps({'type': 'video.error', 'message': f'Could not open camera {opts.device}'})}", file=sys.stderr)
        return 2

    # Configure camera for optimal performance
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    cap.set(cv2.CAP_PROP_FPS, 30)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    print(f"EVT {json.dumps({'type': 'video.started', 'device': opts.device, 'fast_preview': True})}", file=sys.stderr)
    print(f"EVT {json.dumps({'type': 'video.fast_preview_ready'})}", file=sys.stderr)
    
    frame_count = 0
    attendance = None
    models_loaded = False
    
    while True:
        paused, req_stop, _ = ctrl.get()
        if req_stop:
            break
        if paused:
            time.sleep(0.02)
            continue

        # Check if models are loaded
        if not models_loaded and model_future.done():
            try:
                attendance = model_future.result()
                models_loaded = True
                print(f"EVT {json.dumps({'type': 'video.recognition_ready'})}", file=sys.stderr)
            except Exception as e:
                print(f"LOG Model loading error: {e}", file=sys.stderr)
                models_loaded = True  # Prevent endless checking

        # Handle device switching
        nd = ctrl.consume_device_switch()
        if nd is not None:
            try:
                if cap is not None:
                    cap.release()
                cap = cv2.VideoCapture(nd)
                if not cap or not cap.isOpened():
                    print(f"EVT {json.dumps({'type': 'video.error', 'message': f'Failed to switch to camera {nd}'})}", file=sys.stderr)
                else:
                    opts.device = nd
                    print(f"EVT {json.dumps({'type': 'video.device', 'device': nd})}", file=sys.stderr)
            except Exception as e:
                print(f"EVT {json.dumps({'type': 'video.error', 'message': f'Switch device error: {e}'})}", file=sys.stderr)

        if cap is None or not cap.isOpened():
            time.sleep(0.05)
            continue

        ret, frame = cap.read()
        if not ret or frame is None or frame.size == 0:
            time.sleep(0.005)
            continue
        
        orig = frame.copy()
        h, w = frame.shape[:2]
        frame_count += 1
        
        # Only do recognition if models are loaded and we want annotation
        if models_loaded and attendance is not None and opts.annotate:
            try:
                # Full recognition pipeline
                input_blob, scale, dx, dy = preprocess_yolo(frame)
                preds = yolo_sess.run(None, {'images': input_blob})[0]
                faces = non_max_suppression(preds, conf_thresh, iou_thresh, 
                                           img_shape=(h, w), input_shape=(input_size, input_size), 
                                           pad=(dx, dy), scale=scale)

                scene_crowding = len(faces)
                for box in faces:
                    x1, y1, x2, y2, conf = box
                    if x2 <= x1 or y2 <= y1:
                        continue

                    face_img = orig[y1:y2, x1:x2]
                    if face_img.size == 0:
                        continue
                    
                    quality = calculate_quality_score(face_img, conf)
                    identified_name, similarity, should_log, info = attendance.identify_face_enhanced(
                        face_img, conf, scene_crowding
                    )
                    
                    if identified_name and should_log:
                        attendance.log_attendance(identified_name, similarity, info)
                    
                    # Draw recognition results
                    if identified_name and should_log:
                        color = (0, 255, 0)
                        method_text = info.get('method', 'unknown')[:8]
                        label = f"{identified_name} ({similarity:.3f}) [{method_text}]"
                    elif identified_name:
                        color = (0, 255, 255)
                        label = f"{identified_name}? ({similarity:.3f})"
                    else:
                        color = (0, 0, 255)
                        label = f"Unknown (Q:{quality:.2f})"
                    
                    cv2.rectangle(orig, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(orig, label, (x1, y1 - 10), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                
                # Status overlay for full recognition mode
                cv2.putText(orig, "Mode: FULL RECOGNITION", (10, 30), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                cv2.putText(orig, f"Faces: {len(faces)}", (10, 60), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                
            except Exception as e:
                print(f"LOG Recognition error: {e}", file=sys.stderr)
                cv2.putText(orig, "Mode: PREVIEW (Recognition Error)", (10, 30), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        elif not models_loaded:
            # Still loading models - show preview with loading indicator
            cv2.putText(orig, "Mode: FAST PREVIEW - Loading Models...", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
            cv2.putText(orig, "Camera ready instantly!", (10, 60), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        else:
            # Preview only mode
            cv2.putText(orig, "Mode: PREVIEW ONLY", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        # Encode and send frame
        try:
            ok, buf = cv2.imencode('.jpg', orig, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if ok and buf is not None:
                write_frame(buf.tobytes())
        except BrokenPipeError:
            return 0
        except Exception as e:
            print(f"LOG Frame send error: {e}", file=sys.stderr)

    cap.release()
    print(f"EVT {json.dumps({'type': 'video.stopped'})}", file=sys.stderr)
    return 0


def run(opts: Options):
    ctrl = ControlState()
    
    if opts.fast_preview:
        # In fast preview mode, start camera first, load models in background
        print(f"EVT {json.dumps({'type': 'video.loading_models'})}", file=sys.stderr)
        
        # Start with minimal initialization for camera preview
        attendance = None
        
        # Load models in background thread
        def load_models():
            global attendance
            try:
                print(f"LOG Background model loading started", file=sys.stderr)
                temp_attendance = Main()
                # Do a warmup inference
                import numpy as np
                dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
                from experiments.prototype.main import preprocess_yolo, non_max_suppression, conf_thresh, iou_thresh, input_size
                input_blob, scale, dx, dy = preprocess_yolo(dummy_frame)
                _ = yolo_sess.run(None, {'images': input_blob})[0]
                print(f"EVT {json.dumps({'type': 'video.models_loaded'})}", file=sys.stderr)
                # Use a simple assignment instead of global modification during streaming
                return temp_attendance
            except Exception as e:
                print(f"LOG Background model loading failed: {e}", file=sys.stderr)
                return Main()  # Fallback to basic loading
        
        # Start model loading in background
        import concurrent.futures
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        model_future = executor.submit(load_models)
        
        # Start camera immediately with no models for preview
        attendance = None
    else:
        # Normal mode - load everything upfront
        attendance = Main()
    
    threading.Thread(target=control_loop, args=(ctrl,), daemon=True).start()

    # Use adapted prototype camera function
    if opts.fast_preview and attendance is None:
        # Start with preview, switch to full recognition when models are ready
        return streaming_camera_recognition_fast(model_future, opts, ctrl)
    else:
        return streaming_camera_recognition(attendance, opts, ctrl)


def parse_args() -> Options:
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--device', type=int, default=0)
    p.add_argument('--no-annotate', action='store_true')
    p.add_argument('--fast-preview', action='store_true', help='Start with fast preview mode (no recognition for first 3 seconds)')
    a = p.parse_args()
    return Options(device=a.device, annotate=not a.no_annotate, fast_preview=a.fast_preview)


if __name__ == '__main__':
    opts = parse_args()
    try:
        code = run(opts)
    except Exception as e:
        print(f"[video_worker] fatal: {e}", file=sys.stderr)
        code = 1
    sys.exit(code)
