"""
API Router Aggregator
Combines all API route modules into a single router
"""

from fastapi import APIRouter

from api.routes import detection, recognition, websocket, attendance

# Create main API router
api_router = APIRouter()

# Include all route modules
api_router.include_router(detection.router, tags=["detection"])
api_router.include_router(recognition.router, tags=["recognition"])
api_router.include_router(websocket.router, tags=["websocket"])
api_router.include_router(attendance.router, tags=["attendance"])

__all__ = ["api_router"]
