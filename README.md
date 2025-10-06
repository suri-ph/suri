# 🔥 Suri - Face Recognition System

[![Electron](https://img.shields.io/badge/Electron-28%2B-blue)](https://electronjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-18%2B-blue)](https://reactjs.org)

**Desktop face recognition system with real-time detection and SQLite3 database**

You can find the details of the model here:

- **[Face Detection Training](experiments/detection/README.md)** - Model training logs & datasets
- **[Face Recognition Model](experiments/recognition/README.md)** - Encoding & matching pipeline

##  Features

- **🔍 Face Detection**: SCRFD-based detection optimized for real-time performance
- **👤 Face Recognition**: EdgeFace embeddings for robust identity matching  
- **🗄️ Local Database**: SQLite3 database with automatic persistence
- **⚡ Performance**: ONNX optimized models, WebGL acceleration
- **🖥️ Desktop App**: Cross-platform Electron application
- **📊 Analytics**: Real-time statistics and attendance tracking
- **🎨 Modern UI**: Glass morphism design with dark theme
- **🔧 Configurable**: Real-time settings and camera management

## 🚀 Quick Start

### Prerequisites
- [Node.js 18+](https://nodejs.org/downloads)
- [Git](https://git-scm.com/downloads)

### 1. Clone & Setup
```bash
git clone https://github.com/johnraivenolazo/suri.git
cd suri/desktop
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

## 📁 Project Structure

```
desktop/
├── src/
│   ├── components/          # React components
│   ├── services/           # Face recognition & database services
│   ├── electron/           # Electron main process
│   └── weights/           # ONNX model files
├── public/                # Static assets
└── dist-electron/         # Built electron files
```

## 🎮 Usage

1. **Live Camera Recognition**: Real-time face detection and recognition
2. **System Management**: View attendance logs, manage people, database operations
3. **Add Person**: Register new faces to the recognition system
4. **Statistics**: View today's stats, recognition performance, and trends

## 🔧 Technical Details

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Electron main process with IPC communication
- **Database**: SQLite3 with automatic file persistence
- **AI Models**: SCRFD detection + EdgeFace recognition (ONNX)
- **Performance**: WebGL acceleration, optimized for real-time processing  

<div align="center">
  <strong>Built with ❤️</strong><br>
</div>