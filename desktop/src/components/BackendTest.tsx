import React, { useState, useEffect, useRef } from 'react';

interface BackendStatus {
  available: boolean;
  status?: number;
  error?: string;
}

interface DetectionResult {
  faces: Array<{
    bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    confidence: number;
    landmarks: {
      right_eye: { x: number; y: number };
      left_eye: { x: number; y: number };
      nose_tip: { x: number; y: number };
      right_mouth_corner: { x: number; y: number };
      left_mouth_corner: { x: number; y: number };
    };
  }>;
  model_used: string;
  processing_time: number;
}

export default function BackendTest() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [models, setModels] = useState<Record<string, any> | null>(null);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testImage, setTestImage] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check backend availability on component mount
  useEffect(() => {
    checkBackendStatus();
  }, []);

  const checkBackendStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (window.electronAPI?.backend) {
        const status = await window.electronAPI.backend.checkAvailability();
        setBackendStatus(status);
        
        if (status.available) {
          // If backend is available, get models
          try {
            const modelsData = await window.electronAPI.backend.getModels();
            setModels(modelsData);
          } catch (err) {
            console.error('Failed to get models:', err);
            setError(`Failed to get models: ${err.message}`);
          }
        }
      } else {
        setError('Backend API not available - make sure Electron is running');
      }
    } catch (err) {
      console.error('Backend status check failed:', err);
      setError(`Backend check failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const createTestImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 320;
    canvas.height = 320;

    // Clear canvas
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, 320, 320);

    // Draw a simple face-like pattern
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 2;

    // Face outline (circle)
    ctx.beginPath();
    ctx.arc(160, 160, 80, 0, 2 * Math.PI);
    ctx.stroke();

    // Eyes
    ctx.beginPath();
    ctx.arc(140, 140, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(180, 140, 8, 0, 2 * Math.PI);
    ctx.fill();

    // Nose
    ctx.beginPath();
    ctx.arc(160, 160, 4, 0, 2 * Math.PI);
    ctx.fill();

    // Mouth
    ctx.beginPath();
    ctx.ellipse(160, 180, 20, 8, 0, 0, Math.PI);
    ctx.stroke();

    // Convert to base64
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
    setTestImage(imageBase64);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64 = result.split(',')[1];
      setTestImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const testDetection = async () => {
    if (!testImage) {
      setError('No test image available');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setDetectionResult(null);

      if (window.electronAPI?.backend) {
        const result = await window.electronAPI.backend.detectFaces(testImage, {
          model_type: 'yunet',
          confidence_threshold: 0.5,
          nms_threshold: 0.3
        });
        setDetectionResult(result);
      } else {
        setError('Backend API not available');
      }
    } catch (err) {
      console.error('Detection failed:', err);
      setError(`Detection failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderDetectionResult = () => {
    if (!detectionResult) return null;

    return (
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-3">Detection Results</h3>
        <div className="space-y-2 text-sm">
          <div className="text-gray-300">
            <span className="font-medium">Model:</span> {detectionResult.model_used}
          </div>
          <div className="text-gray-300">
            <span className="font-medium">Processing Time:</span> {detectionResult.processing_time.toFixed(3)}s
          </div>
          <div className="text-gray-300">
            <span className="font-medium">Faces Detected:</span> {detectionResult.faces.length}
          </div>
          
          {detectionResult.faces.map((face, index) => (
            <div key={index} className="bg-gray-700 p-3 rounded mt-2">
              <div className="text-white font-medium">Face {index + 1}</div>
              <div className="text-gray-300 text-xs mt-1">
                <div>Confidence: {(face.confidence * 100).toFixed(1)}%</div>
                <div>BBox: [{face.bbox.x.toFixed(0)}, {face.bbox.y.toFixed(0)}, {face.bbox.width.toFixed(0)}, {face.bbox.height.toFixed(0)}]</div>
                <div>Landmarks: 5 points</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">FastAPI Backend Integration Test</h1>
        
        {/* Backend Status */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-3">Backend Status</h2>
          <div className="flex items-center gap-4 mb-3">
            <button
              onClick={checkBackendStatus}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition-colors"
            >
              {isLoading ? 'Checking...' : 'Check Status'}
            </button>
            
            {backendStatus && (
              <div className={`px-3 py-1 rounded text-sm font-medium ${
                backendStatus.available 
                  ? 'bg-green-600 text-white' 
                  : 'bg-red-600 text-white'
              }`}>
                {backendStatus.available ? '✅ Available' : '❌ Unavailable'}
                {backendStatus.status && ` (${backendStatus.status})`}
              </div>
            )}
          </div>
          
          {error && (
            <div className="bg-red-900 border border-red-600 p-3 rounded text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Models Information */}
        {models && (
          <div className="bg-gray-800 p-4 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-3">Available Models</h2>
            <pre className="bg-gray-900 p-3 rounded text-sm overflow-x-auto">
              {JSON.stringify(models, null, 2)}
            </pre>
          </div>
        )}

        {/* Test Image Section */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-3">Test Image</h2>
          <div className="flex gap-4 mb-4">
            <button
              onClick={createTestImage}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
            >
              Generate Test Pattern
            </button>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
            >
              Upload Image
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          
          <div className="flex gap-4">
            <canvas
              ref={canvasRef}
              className="border border-gray-600 rounded max-w-xs"
              style={{ maxHeight: '200px' }}
            />
            
            {testImage && (
              <div>
                <div className="text-sm text-gray-400 mb-2">Preview:</div>
                <img
                  src={`data:image/jpeg;base64,${testImage}`}
                  alt="Test"
                  className="border border-gray-600 rounded max-w-xs max-h-48"
                />
              </div>
            )}
          </div>
        </div>

        {/* Detection Test */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-3">Face Detection Test</h2>
          <button
            onClick={testDetection}
            disabled={!testImage || isLoading || !backendStatus?.available}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded transition-colors"
          >
            {isLoading ? 'Detecting...' : 'Test Detection'}
          </button>
          
          {!testImage && (
            <p className="text-gray-400 text-sm mt-2">
              Generate a test pattern or upload an image first
            </p>
          )}
          
          {!backendStatus?.available && (
            <p className="text-red-400 text-sm mt-2">
              Backend must be available to test detection
            </p>
          )}
        </div>

        {/* Detection Results */}
        {renderDetectionResult()}
      </div>
    </div>
  );
}