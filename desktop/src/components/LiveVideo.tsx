import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BackendService } from '../services/BackendService';

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
    antispoofing?: {
      is_real: boolean | null;
      confidence: number;
      status: 'real' | 'fake' | 'error';
    };
  }>;
  model_used: string;
  processing_time: number;
}

interface LiveVideoProps {
  onBack?: () => void;
}

export default function LiveVideo({ onBack }: LiveVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const detectionIntervalRef = useRef<NodeJS.Timeout>();
  const detectionEnabledRef = useRef<boolean>(false);
  const backendServiceRef = useRef<BackendService | null>(null);
  const frameQueueRef = useRef<string[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const lastFrameTimeRef = useRef<number>(0);
  
  // Performance optimization refs
  const lastCanvasSizeRef = useRef<{width: number, height: number}>({width: 0, height: 0});
  const lastVideoSizeRef = useRef<{width: number, height: number}>({width: 0, height: 0});
  const scaleFactorsRef = useRef<{scaleX: number, scaleY: number, offsetX: number, offsetY: number}>({scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0});
  const lastDetectionHashRef = useRef<string>('');

  const [isStreaming, setIsStreaming] = useState(false);
  const [detectionEnabled, setDetectionEnabled] = useState(false);
  const [currentDetections, setCurrentDetections] = useState<DetectionResult | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [detectionFps, setDetectionFps] = useState<number>(0);
  const [websocketStatus, setWebsocketStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [queueLength, setQueueLength] = useState<number>(0);
  const lastDetectionRef = useRef<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  
  // Anti-spoofing settings
  const [antispoofingEnabled, setAntispoofingEnabled] = useState(true);
  const [antispoofingThreshold, setAntispoofingThreshold] = useState(0.5);

  // Performance tracking - throttled updates
  const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now(), lastUpdate: 0 });
  const detectionCounterRef = useRef({ detections: 0, lastTime: Date.now() });

  // Initialize WebSocket connection
  const initializeWebSocket = useCallback(async () => {
    try {
      if (!backendServiceRef.current) {
        backendServiceRef.current = new BackendService();
      }

      setWebsocketStatus('connecting');
      
      // Connect to WebSocket
      await backendServiceRef.current.connectWebSocket();
        
        // Register message handler for detection responses
        backendServiceRef.current.onMessage('detection_response', (data: any) => {
        // Reduced logging for performance
        if (process.env.NODE_ENV === 'development') {
          console.log('📨 Detection response received');
        }
        
        // Update detection FPS - throttled
        detectionCounterRef.current.detections++;
        const now = Date.now();
        const elapsed = now - detectionCounterRef.current.lastTime;
        
        if (elapsed >= 1000) {
          setDetectionFps(Math.round((detectionCounterRef.current.detections * 1000) / elapsed));
          detectionCounterRef.current.detections = 0;
          detectionCounterRef.current.lastTime = now;
        }

        // Process the detection result
        if (data.faces && Array.isArray(data.faces)) {
          const detectionResult: DetectionResult = {
            faces: data.faces.map((face: any) => {
              // Safe extraction of face data with fallbacks
              const bbox = face.bbox || [0, 0, 0, 0];
              const landmarks = face.landmarks || [];
              
              return {
                bbox: {
                  x: bbox[0] || 0,
                  y: bbox[1] || 0,
                  width: bbox[2] || 0,
                  height: bbox[3] || 0
                },
                confidence: face.confidence || 0,
                landmarks: {
                  right_eye: { 
                    x: (landmarks[0] && landmarks[0][0]) || 0, 
                    y: (landmarks[0] && landmarks[0][1]) || 0 
                  },
                  left_eye: { 
                    x: (landmarks[1] && landmarks[1][0]) || 0, 
                    y: (landmarks[1] && landmarks[1][1]) || 0 
                  },
                  nose_tip: { 
                    x: (landmarks[2] && landmarks[2][0]) || 0, 
                    y: (landmarks[2] && landmarks[2][1]) || 0 
                  },
                  right_mouth_corner: { 
                    x: (landmarks[3] && landmarks[3][0]) || 0, 
                    y: (landmarks[3] && landmarks[3][1]) || 0 
                  },
                  left_mouth_corner: { 
                    x: (landmarks[4] && landmarks[4][0]) || 0, 
                    y: (landmarks[4] && landmarks[4][1]) || 0 
                  }
                },
                antispoofing: face.antispoofing || {}
              };
            }),
            model_used: data.model_used || 'unknown',
            processing_time: data.processing_time || 0
          };

          setCurrentDetections(detectionResult);
          lastDetectionRef.current = detectionResult;
        }

        // Process next frame in queue
        isProcessingRef.current = false;
        processNextFrame();
      });

      // Handle connection messages
      backendServiceRef.current.onMessage('connection', (data: any) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔗 WebSocket connection message:', data);
        }
      });

      // Handle error messages
      backendServiceRef.current.onMessage('error', (data: any) => {
        console.error('❌ WebSocket error message:', data);
        setError(`Detection error: ${data.message || 'Unknown error'}`);
        isProcessingRef.current = false;
        processNextFrame();
      });

      // Handle pong messages
      backendServiceRef.current.onMessage('pong', (data: any) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('🏓 WebSocket pong received:', data);
        }
      });

      setWebsocketStatus('connected');
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ WebSocket initialized and connected');
      }
      
    } catch (error) {
      console.error('❌ WebSocket initialization failed:', error);
      setWebsocketStatus('disconnected');
      setError('Failed to connect to real-time detection service');
    }
  }, []);

  // Process next frame from queue
  const processNextFrame = useCallback(() => {
    if (frameQueueRef.current.length > 0 && !isProcessingRef.current && websocketStatus === 'connected') {
      const frameData = frameQueueRef.current.shift();
      setQueueLength(frameQueueRef.current.length);
      if (frameData && backendServiceRef.current) {
        isProcessingRef.current = true;
        
        backendServiceRef.current.sendDetectionRequest(frameData, {
          model_type: 'yunet',
          confidence_threshold: 0.5,
          nms_threshold: 0.3,
          enable_antispoofing: antispoofingEnabled,
          antispoofing_threshold: antispoofingThreshold
        }).catch(error => {
          console.error('❌ WebSocket detection request failed:', error);
          isProcessingRef.current = false;
          processNextFrame();
        });
      }
    }
  }, [websocketStatus, antispoofingEnabled, antispoofingThreshold]);

  // Get available camera devices
  const getCameraDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameraDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error getting camera devices:', err);
      setError('Failed to get camera devices');
    }
  }, [selectedCamera]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err) {
      console.error('Error starting camera:', err);
      setError('Failed to start camera. Please check permissions.');
    }
  }, [selectedCamera]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🛑 stopCamera called - cleaning up all resources');
    }
    
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Stop detection
    setDetectionEnabled(false);
    detectionEnabledRef.current = false;
    setIsStreaming(false);
    
    // Clear all intervals and animation frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = undefined;
    }
    
    // Clear detection results
    setCurrentDetections(null);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Camera stopped successfully');
    }
  }, []);

  // Optimized capture frame with reduced logging
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.videoWidth === 0) {
      return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    // Only resize canvas if video dimensions changed
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64 with reduced quality for better performance
    const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    return base64;
  }, []);

  // Optimized frame queuing with better throttling
  const queueFrameForDetection = useCallback(() => {
    const currentDetectionEnabled = detectionEnabledRef.current;
    if (!currentDetectionEnabled || !isStreaming || websocketStatus !== 'connected') {
      return;
    }

    try {
      const frameData = captureFrame();
      if (!frameData) {
        return;
      }

      const now = Date.now();
      
      // Implement frame skipping logic - only process 1 frame per second for better performance
      if (now - lastFrameTimeRef.current < 1000) { // 1000ms = 1 FPS
        return;
      }

      lastFrameTimeRef.current = now;

      // Add frame to queue (limit queue size to prevent memory issues)
      if (frameQueueRef.current.length < 3) { // Reduced queue size
        frameQueueRef.current.push(frameData);
        setQueueLength(frameQueueRef.current.length);
        processNextFrame();
      }

    } catch (error) {
      console.error('❌ Frame capture failed:', error);
    }
  }, [captureFrame, isStreaming, websocketStatus, processNextFrame]);

  // Memoized scale calculation to avoid recalculation
  const calculateScaleFactors = useCallback(() => {
    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    
    if (!video || !overlayCanvas) return null;

    // Check if video dimensions changed
    const currentVideoWidth = video.videoWidth;
    const currentVideoHeight = video.videoHeight;
    
    if (lastVideoSizeRef.current.width === currentVideoWidth && 
        lastVideoSizeRef.current.height === currentVideoHeight &&
        lastCanvasSizeRef.current.width === overlayCanvas.width &&
        lastCanvasSizeRef.current.height === overlayCanvas.height) {
      return scaleFactorsRef.current; // Return cached values
    }

    // Update cached sizes
    lastVideoSizeRef.current = { width: currentVideoWidth, height: currentVideoHeight };
    lastCanvasSizeRef.current = { width: overlayCanvas.width, height: overlayCanvas.height };

    const displayWidth = overlayCanvas.width;
    const displayHeight = overlayCanvas.height;

    const videoAspectRatio = currentVideoWidth / currentVideoHeight;
    const containerAspectRatio = displayWidth / displayHeight;
    
    let actualVideoWidth: number;
    let actualVideoHeight: number;
    let offsetX = 0;
    let offsetY = 0;
    
    if (videoAspectRatio > containerAspectRatio) {
      actualVideoWidth = displayWidth;
      actualVideoHeight = displayWidth / videoAspectRatio;
      offsetY = (displayHeight - actualVideoHeight) / 2;
    } else {
      actualVideoHeight = displayHeight;
      actualVideoWidth = displayHeight * videoAspectRatio;
      offsetX = (displayWidth - actualVideoWidth) / 2;
    }
    
    const scaleX = actualVideoWidth / currentVideoWidth;
    const scaleY = actualVideoHeight / currentVideoHeight;

    // Cache the calculated values
    scaleFactorsRef.current = { scaleX, scaleY, offsetX, offsetY };
    return scaleFactorsRef.current;
  }, []);

  // Highly optimized drawing system
  const drawOverlays = useCallback(() => {
    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    
    if (!video || !overlayCanvas || !currentDetections) return;

    const ctx = overlayCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Optimize canvas sizing - only update when necessary
    const rect = video.getBoundingClientRect();
    const displayWidth = Math.round(rect.width);
    const displayHeight = Math.round(rect.height);

    if (overlayCanvas.width !== displayWidth || overlayCanvas.height !== displayHeight) {
      overlayCanvas.width = displayWidth;
      overlayCanvas.height = displayHeight;
      overlayCanvas.style.width = `${displayWidth}px`;
      overlayCanvas.style.height = `${displayHeight}px`;
    }

    // Clear canvas efficiently
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (!currentDetections.faces || currentDetections.faces.length === 0) {
      return;
    }

    // Get cached scale factors
    const scaleFactors = calculateScaleFactors();
    if (!scaleFactors) return;

    const { scaleX, scaleY, offsetX, offsetY } = scaleFactors;

    // Validate scale factors
    if (!isFinite(scaleX) || !isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
      return;
    }

    // Simplified drawing with reduced visual effects for better performance
    currentDetections.faces.forEach((face, index) => {
      const { bbox, confidence, antispoofing } = face;
      
      const x1 = bbox.x;
      const y1 = bbox.y;
      const x2 = bbox.x + bbox.width;
      const y2 = bbox.y + bbox.height;

      if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) {
        return;
      }

      const scaledX1 = x1 * scaleX + offsetX;
      const scaledY1 = y1 * scaleY + offsetY;
      const scaledX2 = x2 * scaleX + offsetX;
      const scaledY2 = y2 * scaleY + offsetY;

      if (!isFinite(scaledX1) || !isFinite(scaledY1) || !isFinite(scaledX2) || !isFinite(scaledY2)) {
        return;
      }

      const width = scaledX2 - scaledX1;
      const height = scaledY2 - scaledY1;

      // Simplified color determination
      const isHighConfidence = confidence > 0.8;
      let primaryColor: string;
      
      if (antispoofing) {
        if (antispoofing.status === 'real') {
          primaryColor = "#00ff41";
        } else if (antispoofing.status === 'fake') {
          primaryColor = "#ff0000";
        } else {
          primaryColor = "#ff8800";
        }
      } else {
        primaryColor = isHighConfidence ? "#00ffff" : "#ff6b6b";
      }

      // Simplified corner brackets - no shadows for better performance
      const cornerSize = Math.min(20, width * 0.2, height * 0.2);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;

      // Draw corners in one path for better performance
      ctx.beginPath();
      // Top-left
      ctx.moveTo(scaledX1, scaledY1 + cornerSize);
      ctx.lineTo(scaledX1, scaledY1);
      ctx.lineTo(scaledX1 + cornerSize, scaledY1);
      // Top-right
      ctx.moveTo(scaledX2 - cornerSize, scaledY1);
      ctx.lineTo(scaledX2, scaledY1);
      ctx.lineTo(scaledX2, scaledY1 + cornerSize);
      // Bottom-left
      ctx.moveTo(scaledX1, scaledY2 - cornerSize);
      ctx.lineTo(scaledX1, scaledY2);
      ctx.lineTo(scaledX1 + cornerSize, scaledY2);
      // Bottom-right
      ctx.moveTo(scaledX2 - cornerSize, scaledY2);
      ctx.lineTo(scaledX2, scaledY2);
      ctx.lineTo(scaledX2, scaledY2 - cornerSize);
      ctx.stroke();

      // Simplified text rendering
      let label = `FACE ${index + 1}`;
      let statusText = `${(confidence * 100).toFixed(1)}%`;
      
      if (antispoofing && antispoofing.status) {
        if (antispoofing.status === 'real') {
          label = `✓ REAL FACE ${index + 1}`;
        } else if (antispoofing.status === 'fake') {
          label = `⚠ FAKE FACE ${index + 1}`;
        } else {
          label = `? UNKNOWN FACE ${index + 1}`;
        }
      }

      // Simple text without shadows
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = primaryColor;
      ctx.fillText(label, scaledX1, scaledY1 - 10);

      ctx.font = 'normal 12px Arial';
      ctx.fillText(statusText, scaledX1, scaledY1 - 25);
    });
  }, [currentDetections, calculateScaleFactors]);

  // Optimized animation loop with reduced frequency
  const animate = useCallback(() => {
    const now = Date.now();
    
    // Update FPS counter less frequently
    fpsCounterRef.current.frames++;
    if (now - fpsCounterRef.current.lastUpdate >= 1000) { // Update every second
      setFps(fpsCounterRef.current.frames);
      fpsCounterRef.current.frames = 0;
      fpsCounterRef.current.lastUpdate = now;
    }

    // Clear canvas when there are no detections
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas && (!currentDetections || !isStreaming)) {
      const ctx = overlayCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
    }

    // Only redraw if detection results changed
    const currentHash = currentDetections ? JSON.stringify(currentDetections.faces.map(f => f.bbox)) : '';
    if (currentHash !== lastDetectionHashRef.current && currentDetections) {
      drawOverlays();
      lastDetectionHashRef.current = currentHash;
    }

    if (isStreaming) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [isStreaming, drawOverlays, currentDetections]);

  // Start/stop detection
  const toggleDetection = useCallback(() => {
    if (detectionEnabled) {
      setDetectionEnabled(false);
      detectionEnabledRef.current = false;
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = undefined;
      }
      frameQueueRef.current = [];
      isProcessingRef.current = false;
      setCurrentDetections(null);
    } else {
      setDetectionEnabled(true);
      detectionEnabledRef.current = true;
      if (websocketStatus === 'disconnected') {
        initializeWebSocket();
      }
      // Reduced frequency for better performance
      detectionIntervalRef.current = setInterval(queueFrameForDetection, 200); // 200ms = 5 FPS
    }
  }, [detectionEnabled, queueFrameForDetection, websocketStatus, initializeWebSocket]);

  // Initialize
  useEffect(() => {
    getCameraDevices();
    return () => {
      stopCamera();
    };
  }, [getCameraDevices, stopCamera]);

  // Start animation loop when streaming starts
  useEffect(() => {
    if (isStreaming) {
      animate();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isStreaming, animate]);

  // Monitor detectionEnabled state changes
  useEffect(() => {
    console.log('🔍 detectionEnabled state changed to:', detectionEnabled);
  }, [detectionEnabled]);

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Live Video Detection</h1>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
            >
              ← Back
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            {/* Camera Selection */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Camera:</label>
              <select
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                disabled={isStreaming}
              >
                {cameraDevices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Camera Controls */}
            <button
              onClick={isStreaming ? stopCamera : startCamera}
              className={`px-4 py-2 rounded transition-colors ${
                isStreaming 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isStreaming ? 'Stop Camera' : 'Start Camera'}
            </button>

            {/* Detection Toggle */}
            <button
              onClick={toggleDetection}
              disabled={!isStreaming}
              className={`px-4 py-2 rounded transition-colors ${
                detectionEnabled
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } disabled:bg-gray-600`}
            >
              {detectionEnabled ? 'Stop Detection' : 'Start Detection'}
            </button>
          </div>

          {/* Anti-spoofing Controls */}
          <div className="flex flex-wrap items-center gap-4 mb-4 pt-4 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Anti-Spoofing:</label>
              <button
                onClick={() => setAntispoofingEnabled(!antispoofingEnabled)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  antispoofingEnabled
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {antispoofingEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {antispoofingEnabled && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Threshold:</label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.1"
                  value={antispoofingThreshold}
                  onChange={(e) => setAntispoofingThreshold(parseFloat(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-gray-300 min-w-[3rem]">
                  {antispoofingThreshold.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className={`px-2 py-1 rounded ${isStreaming ? 'bg-green-600' : 'bg-gray-600'}`}>
              Camera: {isStreaming ? 'Active' : 'Inactive'}
            </div>
            <div className={`px-2 py-1 rounded ${detectionEnabled ? 'bg-orange-600' : 'bg-gray-600'}`}>
              Detection: {detectionEnabled ? 'Active' : 'Inactive'}
            </div>
            <div className={`px-2 py-1 rounded ${websocketStatus === 'connected' ? 'bg-blue-600' : websocketStatus === 'connecting' ? 'bg-yellow-600' : 'bg-gray-600'}`}>
              WebSocket: {websocketStatus === 'connected' ? 'Connected' : websocketStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </div>
            <div className={`px-2 py-1 rounded ${antispoofingEnabled ? 'bg-purple-600' : 'bg-gray-600'}`}>
              Anti-Spoofing: {antispoofingEnabled ? 'Enabled' : 'Disabled'}
            </div>
            <div className="text-gray-300">Video FPS: {fps}</div>
            <div className="text-gray-300">Detection FPS: {detectionFps}</div>
            <div className="text-gray-300">Queue: {queueLength}</div>
            {currentDetections && (
              <div className="text-gray-300">
                Faces: {currentDetections.faces.length}
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900 border border-red-600 p-3 rounded mb-6 text-red-200">
            {error}
          </div>
        )}

        {/* Video Display */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="relative inline-block">
            <video
              ref={videoRef}
              className="max-w-full h-auto rounded border border-gray-600"
              playsInline
              muted
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 pointer-events-none"
              style={{
                width: '100%',
                height: '100%'
              }}
            />
          </div>
          
          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Detection Info */}
        {currentDetections && (
          <div className="bg-gray-800 p-4 rounded-lg mt-6">
            <h3 className="text-lg font-semibold mb-3">Latest Detection Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="text-gray-300">
                <span className="font-medium">Model:</span> {currentDetections.model_used}
              </div>
              <div className="text-gray-300">
                <span className="font-medium">Processing Time:</span> {currentDetections.processing_time.toFixed(3)}s
              </div>
              <div className="text-gray-300">
                <span className="font-medium">Faces Detected:</span> {currentDetections.faces.length}
              </div>
            </div>
            
            {currentDetections.faces.map((face, index) => (
              <div key={index} className="bg-gray-700 p-3 rounded mt-3">
                <div className="text-white font-medium">Face {index + 1}</div>
                <div className="text-gray-300 text-xs mt-1">
                  <div>Confidence: {(face.confidence * 100).toFixed(1)}%</div>
                  <div>
                    BBox: [{face.bbox.x.toFixed(0)}, {face.bbox.y.toFixed(0)}, {face.bbox.width.toFixed(0)}, {face.bbox.height.toFixed(0)}]
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}