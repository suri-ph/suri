from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import CORS_CONFIG


def setup_cors(app: FastAPI):
    """Configure CORS middleware"""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_CONFIG["allow_origins"],
        allow_credentials=CORS_CONFIG["allow_credentials"],
        allow_methods=CORS_CONFIG["allow_methods"],
        allow_headers=CORS_CONFIG["allow_headers"],
        expose_headers=CORS_CONFIG.get("expose_headers", []),
    )
