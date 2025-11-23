import onnxruntime as ort
import os
from typing import Tuple, Optional, List, Dict, Any


def init_onnx_session(
    model_path: str,
    providers: Optional[List] = None,
    session_options: Optional[Dict[str, Any]] = None,
) -> Tuple[Optional[ort.InferenceSession], Optional[str]]:
    """Initialize ONNX Runtime session with optimized providers and session options."""
    ort_session = None
    input_name = None

    if not os.path.isfile(model_path):
        return None, None

    if providers is None:
        try:
            try:
                from config.settings import OPTIMIZED_PROVIDERS
            except ImportError:
                from server.config.settings import OPTIMIZED_PROVIDERS
            providers = [
                p[0] if isinstance(p, tuple) else p for p in OPTIMIZED_PROVIDERS
            ]
        except (ImportError, AttributeError):
            providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]

    sess_opts = None
    if session_options is None:
        try:
            try:
                from config.settings import OPTIMIZED_SESSION_OPTIONS
            except ImportError:
                from server.config.settings import OPTIMIZED_SESSION_OPTIONS
            sess_opts = ort.SessionOptions()
            for key, value in OPTIMIZED_SESSION_OPTIONS.items():
                if hasattr(sess_opts, key):
                    setattr(sess_opts, key, value)
        except (ImportError, AttributeError):
            pass

    try:
        if sess_opts:
            ort_session = ort.InferenceSession(
                model_path, sess_options=sess_opts, providers=providers
            )
        else:
            ort_session = ort.InferenceSession(model_path, providers=providers)
    except Exception:
        try:
            ort_session = ort.InferenceSession(
                model_path, providers=["CPUExecutionProvider"]
            )
        except Exception:
            return None, None

    if ort_session:
        input_name = ort_session.get_inputs()[0].name

    return ort_session, input_name
