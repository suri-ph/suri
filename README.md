# 🔥 Suri - Face Recognition System

[![Python](https://img.shields.io/badge/Python-3.8%2B-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104%2B-green)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Enterprise-grade face recognition system built for real-world deployment**

## 🎯 Features

- **🔍 Face Detection**: YOLOv8n-based detection optimized for production
- **👤 Face Recognition**: EdgeFace embeddings for robust identity matching  
- **🛡️ Security**: Anti-spoofing, liveness detection, encrypted storage
- **⚡ Performance**: ONNX optimized models, async processing, GPU support
- **🌐 API-First**: RESTful FastAPI with OpenAPI documentation
- **📊 Monitoring**: Prometheus metrics, structured logging, health checks
- **🔧 Configurable**: Environment-based configuration management

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Git

### 1. Clone & Setup
```bash
# Auto-setup (recommended)
python scripts/setup/install_dependencies.py --dev

# Manual setup
pip install -r requirements-dev.txt
cp .env.example .env
```

### 2. Download Models
```bash
# Place your models in:
# assets/models/detection/yolov8n_face.onnx
# assets/models/recognition/edgeface_s.onnx

python scripts/model/download_models.py
```

### 3. Run Development Server
```bash
uvicorn src.api.app:app --reload
```

### 4. Access API
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs  
- **Health**: http://localhost:8000/health

## 📁 Project Structure

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detailed folder organization.

## 🧪 Training & Experiments

You can find the details of training the model **[here](experiments/README.md)**

---

<div align="center">
  <strong>Built with ❤️</strong><br>
</div>