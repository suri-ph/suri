import base64
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import cv2
import numpy as np
from datetime import datetime
import queue

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'scripts'))

from scripts.run import (
    AttendanceSystem, 
    preprocess_yolo, 
    non_max_suppression, 
    yolo_sess, 
    conf_thresh, 
    iou_thresh, 
    input_size
)

# Import your enhanced utilities
sys.path.append(os.path.join(os.path.dirname(__file__), 'experiments', 'prototype'))
from experiments.prototype.utils import calculate_quality_score

# Initialize FastAPI app
app = FastAPI(
    title="🎯 Enterprise Face Recognition API",
    description="Production-ready Face Recognition Attendance System with advanced features",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize your attendance system globally
attendance_system = AttendanceSystem()

# Pydantic models for request/response
class RecognitionResult(BaseModel):
    name: Optional[str]
    confidence: float
    bbox: List[int]
    quality: float
    method: str
    should_log: bool
    additional_info: Dict[str, Any] = {}

class AttendanceRecord(BaseModel):
    name: str
    timestamp: str
    confidence: float
    date: str
    time: str
    recognition_info: Optional[Dict[str, Any]] = None

class PersonSummary(BaseModel):
    name: str
    num_templates: int
    in_legacy: bool
    total_attempts: Optional[int] = None
    total_successes: Optional[int] = None
    overall_success_rate: Optional[float] = None

class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
    error: Optional[str] = None

# Utility functions
def decode_image(image_data: str) -> np.ndarray:
    """Decode base64 image to OpenCV format"""
    try:
        # Remove data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return image
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")

def encode_image(image: np.ndarray) -> str:
    """Encode OpenCV image to base64"""
    try:
        _, buffer = cv2.imencode('.jpg', image)
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/jpeg;base64,{image_base64}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to encode image: {str(e)}")

async def process_uploaded_file(file: UploadFile) -> np.ndarray:
    """Process uploaded file to OpenCV image"""
    try:
        # Read file content
        content = await file.read()
        nparr = np.frombuffer(content, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        return image
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process image: {str(e)}")

# Global variables for video streaming
frame_queue = queue.Queue(maxsize=2)
streaming_active = False
camera_thread = None

# API Endpoints

@app.get("/", response_model=ApiResponse)
async def root():
    """API health check and info"""
    return ApiResponse(
        success=True,
        message="🎯 Enterprise Face Recognition API is running!",
        data={
            "version": "1.0.0",
            "features": [
                "Face Detection & Recognition",
                "Multi-template Management",
                "Attendance Logging",
                "Real-time Processing",
                "Quality Assessment"
            ],
            "endpoints": {
                "recognition": "/recognize",
                "attendance": "/attendance",
                "management": "/person",
                "system": "/system"
            }
        }
    )

@app.post("/recognize/image", response_model=Dict[str, Any])
async def recognize_from_image(file: UploadFile = File(...)):
    """
    🖼️ Recognize faces from uploaded image
    
    Upload an image file and get face recognition results with bounding boxes.
    """
    try:
        # Process uploaded image
        frame = await process_uploaded_file(file)
        orig = frame.copy()
        h, w = frame.shape[:2]
        
        # Run YOLO detection
        input_blob, scale, dx, dy = preprocess_yolo(frame)
        preds = yolo_sess.run(None, {'images': input_blob})[0]
        faces = non_max_suppression(preds, conf_thresh, iou_thresh, 
                                   img_shape=(h, w), input_shape=(input_size, input_size), 
                                   pad=(dx, dy), scale=scale)

        scene_crowding = len(faces)
        results = []
        
        # Process each detected face
        for i, box in enumerate(faces):
            x1, y1, x2, y2, conf = box
            
            if x2 <= x1 or y2 <= y1:
                continue

            face_img = orig[y1:y2, x1:x2]
            if face_img.size == 0:
                continue
            
            # Calculate quality and identify - USING YOUR EXACT LOGIC
            quality = calculate_quality_score(face_img, conf)
            identified_name, similarity, should_log, info = attendance_system.identify_face_enhanced(
                face_img, conf, scene_crowding
            )
            
            # Log attendance if recognized - USING YOUR EXACT METHOD
            attendance_logged = False
            if identified_name and should_log:
                attendance_logged = attendance_system.log_attendance(identified_name, similarity, info)
            
            # Create result
            result = {
                "face_id": i + 1,
                "name": identified_name,
                "confidence": float(similarity),
                "bbox": [int(x1), int(y1), int(x2), int(y2)],
                "quality": float(quality),
                "method": info.get('method', 'unknown'),
                "should_log": should_log,
                "attendance_logged": attendance_logged,
                "additional_info": info
            }
            results.append(result)
            
            # Draw on image for visualization - USING YOUR EXACT DRAWING STYLE
            if identified_name and should_log:
                color = (0, 255, 0)  # Green for recognized
                method_text = info.get('method', 'unknown')[:8]
                
                # Check data types like in your run.py
                person_summary = attendance_system.get_person_summary(identified_name)
                data_types = []
                if person_summary['in_legacy']:
                    data_types.append("L")
                if person_summary['num_templates'] > 0:
                    data_types.append(f"T{person_summary['num_templates']}")
                
                data_indicator = "+".join(data_types) if data_types else "?"
                label = f"{identified_name} ({similarity:.3f}) [{method_text}|{data_indicator}]"
            elif identified_name:
                color = (0, 255, 255)  # Yellow for low confidence
                label = f"{identified_name}? ({similarity:.3f})"
            else:
                color = (0, 0, 255)  # Red for unknown
                label = f"Unknown #{i+1} (Q:{quality:.2f})"
            
            cv2.rectangle(orig, (x1, y1), (x2, y2), color, 3)
            cv2.putText(orig, label, (x1, y1 - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        
        # Encode result image
        result_image = encode_image(orig)
        
        return {
            "success": True,
            "message": f"Processed {len(faces)} face(s)",
            "faces_detected": len(faces),
            "faces_recognized": sum(1 for r in results if r['should_log']),
            "results": results,
            "annotated_image": result_image,
            "processing_info": {
                "scene_crowding": scene_crowding,
                "image_size": [w, h]
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recognition failed: {str(e)}")

@app.post("/recognize/base64", response_model=Dict[str, Any])
async def recognize_from_base64(
    image_data: str = Form(...),
    return_image: bool = Form(False)
):
    """
    🔍 Recognize faces from base64 encoded image
    
    Send base64 image data and get recognition results.
    """
    try:
        # Decode image
        frame = decode_image(image_data)
        orig = frame.copy()
        h, w = frame.shape[:2]
        
        # Same processing logic as above
        input_blob, scale, dx, dy = preprocess_yolo(frame)
        preds = yolo_sess.run(None, {'images': input_blob})[0]
        faces = non_max_suppression(preds, conf_thresh, iou_thresh, 
                                   img_shape=(h, w), input_shape=(input_size, input_size), 
                                   pad=(dx, dy), scale=scale)

        scene_crowding = len(faces)
        results = []
        
        for i, box in enumerate(faces):
            x1, y1, x2, y2, conf = box
            
            if x2 <= x1 or y2 <= y1:
                continue

            face_img = orig[y1:y2, x1:x2]
            if face_img.size == 0:
                continue
            
            quality = calculate_quality_score(face_img, conf)
            identified_name, similarity, should_log, info = attendance_system.identify_face_enhanced(
                face_img, conf, scene_crowding
            )
            
            attendance_logged = False
            if identified_name and should_log:
                attendance_logged = attendance_system.log_attendance(identified_name, similarity, info)
            
            result = {
                "face_id": i + 1,
                "name": identified_name,
                "confidence": float(similarity),
                "bbox": [int(x1), int(y1), int(x2), int(y2)],
                "quality": float(quality),
                "method": info.get('method', 'unknown'),
                "should_log": should_log,
                "attendance_logged": attendance_logged
            }
            results.append(result)
        
        response_data = {
            "success": True,
            "message": f"Processed {len(faces)} face(s)",
            "faces_detected": len(faces),
            "faces_recognized": sum(1 for r in results if r['should_log']),
            "results": results
        }
        
        if return_image:
            # Draw annotations and return image - USING YOUR EXACT STYLE
            for i, result in enumerate(results):
                x1, y1, x2, y2 = result['bbox']
                if result['should_log']:
                    color = (0, 255, 0)
                    # Get the additional info to create proper label
                    info = result.get('additional_info', {})
                    method_text = info.get('method', 'unknown')[:8]
                    
                    # Check data types
                    person_summary = attendance_system.get_person_summary(result['name'])
                    data_types = []
                    if person_summary['in_legacy']:
                        data_types.append("L")
                    if person_summary['num_templates'] > 0:
                        data_types.append(f"T{person_summary['num_templates']}")
                    
                    data_indicator = "+".join(data_types) if data_types else "?"
                    label = f"{result['name']} ({result['confidence']:.3f}) [{method_text}|{data_indicator}]"
                elif result['name']:
                    color = (0, 255, 255)
                    label = f"{result['name']}? ({result['confidence']:.3f})"
                else:
                    color = (0, 0, 255)
                    label = f"Unknown #{i+1} (Q:{result['quality']:.2f})"
                
                cv2.rectangle(orig, (x1, y1), (x2, y2), color, 3)
                cv2.putText(orig, label, (x1, y1 - 10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            
            response_data["annotated_image"] = encode_image(orig)
        
        return response_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recognition failed: {str(e)}")

@app.post("/person/add", response_model=ApiResponse)
async def add_person(
    name: str = Form(...),
    file: UploadFile = File(...)
):
    """
    👤 Add new person to the system
    
    Upload a face image and person name to register them in the system.
    """
    try:
        # Check for duplicates
        summary = attendance_system.get_person_summary(name)
        if summary['in_legacy'] or summary['num_templates'] > 0:
            return ApiResponse(
                success=False,
                message=f"Person '{name}' already exists",
                data=summary,
                error="DUPLICATE_PERSON"
            )
        
        # Process image
        face_img = await process_uploaded_file(file)
        
        # Add to system
        success = attendance_system.add_new_face(face_img, name)
        
        if success:
            return ApiResponse(
                success=True,
                message=f"Successfully added {name} to the system",
                data={"name": name, "added_at": datetime.now().isoformat()}
            )
        else:
            return ApiResponse(
                success=False,
                message=f"Failed to add {name}",
                error="ADD_PERSON_FAILED"
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add person: {str(e)}")

@app.post("/person/add-multi", response_model=ApiResponse)
async def add_person_multi_templates(
    name: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """
    👥 Add person with multiple face templates
    
    Upload multiple face images for better recognition accuracy.
    """
    try:
        if len(files) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 images allowed")
        
        # Check for duplicates
        summary = attendance_system.get_person_summary(name)
        if summary['in_legacy'] or summary['num_templates'] > 0:
            return ApiResponse(
                success=False,
                message=f"Person '{name}' already exists",
                data=summary,
                error="DUPLICATE_PERSON"
            )
        
        # Process all images
        face_images = []
        for file in files:
            face_img = await process_uploaded_file(file)
            face_images.append(face_img)
        
        # Add to system with enhanced templates
        success = attendance_system.add_new_face_enhanced(face_images, name)
        
        if success:
            return ApiResponse(
                success=True,
                message=f"Successfully added {name} with {len(face_images)} templates",
                data={
                    "name": name,
                    "templates_count": len(face_images),
                    "added_at": datetime.now().isoformat()
                }
            )
        else:
            return ApiResponse(
                success=False,
                message=f"Failed to add {name}",
                error="ADD_PERSON_FAILED"
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add person: {str(e)}")

@app.get("/person/{name}", response_model=Dict[str, Any])
async def get_person_details(name: str):
    """
    🔍 Get person details and statistics
    """
    try:
        summary = attendance_system.get_person_summary(name)
        
        if not summary['in_legacy'] and summary['num_templates'] == 0:
            raise HTTPException(status_code=404, detail=f"Person '{name}' not found")
        
        # Get recent attendance records
        today_records = [r for r in attendance_system.get_today_attendance() if r['name'] == name]
        
        return {
            "success": True,
            "person": summary,
            "today_attendance": len(today_records),
            "recent_records": today_records[-5:] if today_records else []  # Last 5 records
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get person details: {str(e)}")

@app.delete("/person/{name}", response_model=ApiResponse)
async def delete_person(name: str):
    """
    🗑️ Delete person from the system
    """
    try:
        summary = attendance_system.get_person_summary(name)
        
        if not summary['in_legacy'] and summary['num_templates'] == 0:
            raise HTTPException(status_code=404, detail=f"Person '{name}' not found")
        
        # Remove from databases
        if name in attendance_system.face_database:
            del attendance_system.face_database[name]
        if name in attendance_system.multi_templates:
            del attendance_system.multi_templates[name]
        if name in attendance_system.recognition_stats:
            del attendance_system.recognition_stats[name]
        
        # Save changes
        attendance_system.save_face_database()
        attendance_system.save_multi_templates()
        
        return ApiResponse(
            success=True,
            message=f"Successfully deleted {name} from the system"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete person: {str(e)}")

@app.get("/attendance/today", response_model=Dict[str, Any])
async def get_today_attendance():
    """
    📋 Get today's attendance records
    """
    try:
        records = attendance_system.get_today_attendance()
        
        # Statistics
        unique_people = set(record['name'] for record in records)
        
        return {
            "success": True,
            "date": datetime.now().strftime('%Y-%m-%d'),
            "total_records": len(records),
            "unique_people": len(unique_people),
            "people_present": list(unique_people),
            "records": records
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get attendance: {str(e)}")

@app.get("/attendance/person/{name}", response_model=Dict[str, Any])
async def get_person_attendance(name: str, days: int = 7):
    """
    👤 Get attendance history for specific person
    """
    try:
        from datetime import timedelta
        
        # Get records for the last N days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        person_records = [
            record for record in attendance_system.attendance_log
            if record['name'] == name and 
            datetime.fromisoformat(record['timestamp']) >= start_date
        ]
        
        if not person_records:
            raise HTTPException(status_code=404, detail=f"No attendance records found for {name}")
        
        # Group by date
        daily_records = {}
        for record in person_records:
            date = record['date']
            if date not in daily_records:
                daily_records[date] = []
            daily_records[date].append(record)
        
        return {
            "success": True,
            "person": name,
            "period": f"Last {days} days",
            "total_records": len(person_records),
            "days_present": len(daily_records),
            "daily_records": daily_records,
            "latest_record": person_records[-1] if person_records else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get person attendance: {str(e)}")

@app.delete("/attendance/clear", response_model=ApiResponse)
async def clear_attendance():
    """
    🗑️ Clear all attendance records
    """
    try:
        attendance_system.attendance_log = []
        attendance_system.save_attendance_log()
        
        return ApiResponse(
            success=True,
            message="All attendance records cleared successfully"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear attendance: {str(e)}")

@app.get("/system/status", response_model=Dict[str, Any])
async def get_system_status():
    """
    📊 Get system statistics and status
    """
    try:
        # Database statistics
        legacy_count = len(attendance_system.face_database)
        template_count = sum(len(templates) for templates in attendance_system.multi_templates.values())
        people_count = len(attendance_system.multi_templates)
        
        # Attendance statistics
        today_records = attendance_system.get_today_attendance()
        total_records = len(attendance_system.attendance_log)
        
        # Recognition statistics
        total_attempts = sum(stats['attempts'] for stats in attendance_system.recognition_stats.values())
        total_successes = sum(stats['successes'] for stats in attendance_system.recognition_stats.values())
        overall_success_rate = total_successes / max(total_attempts, 1)
        
        return {
            "success": True,
            "system_info": {
                "status": "operational",
                "version": "1.0.0",
                "uptime": "Available via system metrics"
            },
            "database_stats": {
                "legacy_faces": legacy_count,
                "enhanced_templates": template_count,
                "total_people": people_count
            },
            "attendance_stats": {
                "today_records": len(today_records),
                "total_records": total_records,
                "unique_people_today": len(set(r['name'] for r in today_records))
            },
            "recognition_stats": {
                "total_attempts": total_attempts,
                "total_successes": total_successes,
                "success_rate": overall_success_rate
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get system status: {str(e)}")

@app.get("/system/people", response_model=Dict[str, Any])
async def list_all_people():
    """
    👥 List all registered people
    """
    try:
        # Get all unique names from both databases
        all_names = set()
        all_names.update(attendance_system.face_database.keys())
        all_names.update(attendance_system.multi_templates.keys())
        
        people_list = []
        for name in sorted(all_names):
            summary = attendance_system.get_person_summary(name)
            people_list.append(summary)
        
        return {
            "success": True,
            "total_people": len(people_list),
            "people": people_list
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list people: {str(e)}")

@app.get("/video/stream")
async def video_stream():
    """
    📹 Live video stream with face recognition and bounding boxes
    """
    def generate_frames():
        global streaming_active
        streaming_active = True
        
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("❌ Camera not available")
            streaming_active = False
            return
            
        print("🎥 Starting live video stream with face recognition...")
        
        try:
            while streaming_active:
                ret, frame = cap.read()
                if not ret:
                    print("❌ Failed to read frame from camera")
                    break
                
                # === SAME PROCESSING AS YOUR run.py ===
                orig = frame.copy()
                h, w = frame.shape[:2]
                
                try:
                    # YOLO detection
                    input_blob, scale, dx, dy = preprocess_yolo(frame)
                    preds = yolo_sess.run(None, {'images': input_blob})[0]
                    faces = non_max_suppression(preds, conf_thresh, iou_thresh, 
                                               img_shape=(h, w), input_shape=(input_size, input_size), 
                                               pad=(dx, dy), scale=scale)

                    scene_crowding = len(faces)
                    
                    # Process each face (EXACT SAME LOGIC as run.py)
                    for i, box in enumerate(faces):
                        x1, y1, x2, y2, conf = box
                        
                        if x2 <= x1 or y2 <= y1:
                            continue

                        face_img = orig[y1:y2, x1:x2]
                        if face_img.size == 0:
                            continue
                        
                        # Recognize face - USING YOUR EXACT ENHANCED METHOD
                        quality = calculate_quality_score(face_img, conf)
                        identified_name, similarity, should_log, info = attendance_system.identify_face_enhanced(
                            face_img, conf, scene_crowding
                        )
                        
                        # Log attendance - USING YOUR EXACT METHOD
                        if identified_name and should_log:
                            attendance_system.log_attendance(identified_name, similarity, info)
                        
                        # === DRAW BOUNDING BOXES (SAME AS YOUR OpenCV implementation) ===
                        if identified_name and should_log:
                            color = (0, 255, 0)  # Green for recognized
                            method_text = info.get('method', 'unknown')[:8]
                            
                            # Check data types like in your run.py
                            person_summary = attendance_system.get_person_summary(identified_name)
                            data_types = []
                            if person_summary['in_legacy']:
                                data_types.append("L")
                            if person_summary['num_templates'] > 0:
                                data_types.append(f"T{person_summary['num_templates']}")
                            
                            data_indicator = "+".join(data_types) if data_types else "?"
                            label = f"{identified_name} ({similarity:.3f}) [{method_text}|{data_indicator}]"
                            status = "✓ LOGGED"
                        elif identified_name:
                            color = (0, 255, 255)  # Yellow for low confidence
                            label = f"{identified_name}? ({similarity:.3f})"
                            status = "Low Confidence"
                        else:
                            color = (0, 0, 255)  # Red for unknown
                            label = f"Unknown #{i+1} (Q:{quality:.2f})"
                            status = "Unknown"
                        
                        # Draw bounding box and label - SAME AS YOUR run.py
                        cv2.rectangle(orig, (x1, y1), (x2, y2), color, 3)
                        cv2.putText(orig, label, (x1, y1 - 10), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                    
                    # Add system info overlay (TOP LEFT)
                    cv2.putText(orig, f"Faces Detected: {len(faces)}", (10, 35), 
                               cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
                    cv2.putText(orig, f"People in DB: {len(attendance_system.face_database)}", (10, 70), 
                               cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
                    cv2.putText(orig, f"Templates: {sum(len(t) for t in attendance_system.multi_templates.values())}", (10, 105), 
                               cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
                    
                except Exception as e:
                    print(f"❌ Frame processing error: {e}")
                    # Continue with original frame if processing fails
                
                try:
                    # Encode frame as JPEG for streaming
                    _, buffer = cv2.imencode('.jpg', orig, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    frame_bytes = buffer.tobytes()
                    
                    # Yield frame in MJPEG format (for web browsers)
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                except Exception as e:
                    print(f"❌ Frame encoding error: {e}")
                    break
                
        except Exception as e:
            print(f"❌ Stream error: {e}")
        finally:
            cap.release()
            streaming_active = False
            print("🎥 Video stream stopped")
    
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@app.post("/video/stop")
async def stop_video_stream():
    """Stop the video stream"""
    global streaming_active
    streaming_active = False
    return {"success": True, "message": "Video stream stopped"}

@app.get("/video/status")
async def video_stream_status():
    """Check if video stream is active"""
    return {
        "streaming": streaming_active,
        "camera_available": True,  # You can add actual camera check here
        "people_count": len(attendance_system.face_database)
    }
