import { useState, useEffect, useRef, useCallback } from 'react'

interface DetectionResult {
  bbox: [number, number, number, number];
  confidence: number;
  landmarks: number[][];
  recognition?: {
    personId: string | null;
    similarity: number;
  };
}

export default function LiveCameraRecognition() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [detectionResults, setDetectionResults] = useState<DetectionResult[]>([])
  const [systemStats, setSystemStats] = useState({ today_records: 0, total_people: 0 })
  const [cameraStatus, setCameraStatus] = useState<'stopped' | 'starting' | 'preview' | 'recognition'>('stopped')
  const [fps, setFps] = useState(0)
  const [processingTime, setProcessingTime] = useState(0)
  const [registrationMode, setRegistrationMode] = useState(false)
  const [newPersonId, setNewPersonId] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const fpsCounterRef = useRef({ frames: 0, lastTime: 0 })
  const canvasInitializedRef = useRef(false)
  const lastCaptureRef = useRef(0)
  const captureIntervalRef = useRef<number | undefined>(undefined)

  // Define startProcessing first (will be defined later with useCallback)
  const startProcessingRef = useRef<(() => void) | null>(null)

  // Initialize face recognition pipeline
  const initializePipeline = useCallback(async () => {
    try {
      console.log('Initializing face recognition pipeline...')
      
      // Check if electronAPI is available
      if (!window.electronAPI) {
        throw new Error('electronAPI not available')
      }
      
      // Initialize the pipeline via IPC
      const result = await window.electronAPI.initializeFaceRecognition({
        similarityThreshold: 0.6
      })
      
      console.log('Pipeline initialization result:', result)
      
      if (result.success) {
        setCameraStatus('recognition')
        console.log('Face recognition pipeline ready')
        
        // Start processing now that everything is ready
        setTimeout(() => {
          console.log('Starting processing after status update')
          if (startProcessingRef.current) {
            startProcessingRef.current()
          }
        }, 100)
      } else {
        throw new Error(result.error || 'Pipeline initialization failed')
      }
    } catch (error) {
      console.error('Failed to initialize pipeline:', error)
      setCameraStatus('stopped')
    }
  }, [])

  const startCamera = useCallback(async () => {
    try {
      console.log('Starting camera...')
      setIsStreaming(true)
      setCameraStatus('starting')

                // Get user media with ultra-low-latency settings for real-time recognition
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              frameRate: { ideal: 60, min: 30 }, // Maximum FPS for real-time
              facingMode: 'user',
              // Disable ALL video processing that can cause delays
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            },
            audio: false
          })

      console.log('Camera stream obtained')

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, starting playback')
          
          // Configure video for ultra-minimal latency
          if (videoRef.current) {
            const video = videoRef.current
            
            // Ultra-low latency settings
            video.currentTime = 0
            
            // Critical low-latency attributes
            video.setAttribute('playsinline', 'true')
            video.setAttribute('webkit-playsinline', 'true')
            video.muted = true
            
            // Minimize buffering completely
            video.setAttribute('x5-video-player-type', 'h5')
            video.setAttribute('x5-video-player-fullscreen', 'false')
            video.setAttribute('x5-video-orientation', 'portraint')
            
            // Disable all buffering
            if ('mozInputLatency' in video) {
              (video as any).mozInputLatency = 0
            }
            
            // Set playback rate for minimal latency
            video.playbackRate = 1.0
            
            // Start playback immediately
            video.play()
          }
          
          setCameraStatus('preview')
          
          // Initialize canvas size once when video loads
          if (videoRef.current && canvasRef.current) {
            const video = videoRef.current
            const canvas = canvasRef.current
            
            // Use video's natural resolution for canvas - more performant
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            canvasInitializedRef.current = true
            console.log('Canvas initialized with video resolution:', canvas.width, 'x', canvas.height)
          }
          
          // Initialize pipeline (it will start processing automatically)
          initializePipeline()
        }
      }
    } catch (error) {
      console.error('Failed to start camera:', error)
      setIsStreaming(false)
      setCameraStatus('stopped')
    }
  }, [initializePipeline])

  const stopCamera = useCallback(() => {
    setIsStreaming(false)
    setCameraStatus('stopped')
    
    // Clean up any remaining intervals and frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = undefined
    }
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current)
      captureIntervalRef.current = undefined
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    
    // Reset canvas initialization flag for next session
    canvasInitializedRef.current = false
  }, [])

  const captureFrame = useCallback((): ImageData | null => {
    if (!videoRef.current || !canvasRef.current) return null
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    
    if (!ctx || video.videoWidth === 0) return null
    
    // Only set canvas size if not already initialized (prevents flickering)
    if (!canvasInitializedRef.current) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvasInitializedRef.current = true
      console.log('Canvas initialized during capture with video resolution:', canvas.width, 'x', canvas.height)
    }
    
    // Draw video frame to canvas (scale from video resolution to canvas size)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Get image data
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }, [])

  const processFrameRealTime = useCallback(() => {
    if (!isStreaming || cameraStatus !== 'recognition') {
      return
    }

    try {
      const imageData = captureFrame()
      if (!imageData) {
        return
      }

      // Process frame through face recognition pipeline immediately
      if (window.electronAPI?.processFrame) {
        // Process frame without await to prevent blocking - real-time processing
        window.electronAPI.processFrame(imageData).then(result => {
          setDetectionResults(result.detections)
          setProcessingTime(result.processingTime)
          
          // Update FPS counter for real-time monitoring
          fpsCounterRef.current.frames++
          
          const now = performance.now()
          if (now - fpsCounterRef.current.lastTime >= 1000) {
            setFps(fpsCounterRef.current.frames)
            fpsCounterRef.current.frames = 0
            fpsCounterRef.current.lastTime = now
          }
        }).catch(error => {
          console.error('Frame processing error:', error)
        })
      }
      
    } catch (error) {
      console.error('Frame capture error:', error)
    }
  }, [isStreaming, cameraStatus, captureFrame])

  const startProcessing = useCallback(() => {
    // Clean up any existing intervals
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = undefined
    }
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current)
      captureIntervalRef.current = undefined
    }
    
    fpsCounterRef.current = { frames: 0, lastTime: performance.now() }
    lastCaptureRef.current = 0
    
    // Use requestAnimationFrame for maximum real-time performance
    // This provides the highest possible frame rate with zero buffering
    const processFrame = () => {
      if (isStreaming && cameraStatus === 'recognition') {
        processFrameRealTime()
      }
      animationFrameRef.current = requestAnimationFrame(processFrame)
    }
    
    // Start the real-time processing loop
    animationFrameRef.current = requestAnimationFrame(processFrame)
    
    console.log('Real-time processing started with requestAnimationFrame')
  }, [processFrameRealTime, isStreaming, cameraStatus])

  // Set the ref after the function is defined
  useEffect(() => {
    startProcessingRef.current = startProcessing
  }, [startProcessing])

  const registerFace = useCallback(async () => {
    if (!newPersonId.trim()) {
      alert('Please enter a person ID')
      return
    }
    
    try {
      const imageData = captureFrame()
      if (!imageData) {
        alert('Failed to capture frame')
        return
      }
      
      // Find the largest face detection for registration
      const largestDetection = detectionResults.reduce((largest, current) => {
        const currentArea = (current.bbox[2] - current.bbox[0]) * (current.bbox[3] - current.bbox[1])
        const largestArea = largest ? (largest.bbox[2] - largest.bbox[0]) * (largest.bbox[3] - largest.bbox[1]) : 0
        return currentArea > largestArea ? current : largest
      }, null as DetectionResult | null)
      
      if (!largestDetection || !largestDetection.landmarks) {
        alert('No face detected for registration')
        return
      }
      
      const success = await window.electronAPI?.registerPerson(newPersonId.trim(), imageData, largestDetection.landmarks)
      
      if (success) {
        alert(`Successfully registered ${newPersonId}`)
        setNewPersonId('')
        setRegistrationMode(false)
        setSystemStats(prev => ({ ...prev, total_people: prev.total_people + 1 }))
      } else {
        alert('Failed to register face')
      }
    } catch (error) {
      console.error('Registration error:', error)
      alert('Registration failed')
    }
  }, [newPersonId, detectionResults, captureFrame])

  const drawDetections = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    
    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw detections
    detectionResults.forEach((detection) => {
      const [x1, y1, x2, y2] = detection.bbox
      
      // Scale coordinates properly for canvas display
      const scaleX = canvas.width / videoRef.current!.videoWidth
      const scaleY = canvas.height / videoRef.current!.videoHeight
      
      const scaledX1 = x1 * scaleX
      const scaledY1 = y1 * scaleY
      const scaledX2 = x2 * scaleX
      const scaledY2 = y2 * scaleY
      
      // Draw bounding box
      ctx.strokeStyle = detection.recognition?.personId ? '#00ff00' : '#ff0000'
      ctx.lineWidth = 2
      ctx.strokeRect(scaledX1, scaledY1, scaledX2 - scaledX1, scaledY2 - scaledY1)
      
      // Draw label
      const label = detection.recognition?.personId 
        ? `${detection.recognition.personId} (${(detection.recognition.similarity * 100).toFixed(1)}%)`
        : `Unknown (${(detection.confidence * 100).toFixed(1)}%)`
      
      ctx.fillStyle = detection.recognition?.personId ? '#00ff00' : '#ff0000'
      ctx.font = '14px Arial'
      ctx.fillText(label, scaledX1, scaledY1 - 5)
      
      // Draw landmarks
      if (detection.landmarks) {
        ctx.fillStyle = '#ffff00'
        detection.landmarks.forEach(([x, y]) => {
          ctx.beginPath()
          ctx.arc(x, y, 3, 0, 2 * Math.PI)
          ctx.fill()
        })
      }
    })
  }, [detectionResults])

  // Draw detections overlay
  useEffect(() => {
    if (isStreaming) {
      drawDetections()
    }
  }, [detectionResults, drawDetections, isStreaming])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Control Bar */}
      <div className="px-8 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <button
            onClick={isStreaming ? stopCamera : startCamera}
            className={`px-8 py-3 rounded-xl text-sm font-light backdrop-blur-xl border transition-all duration-500 ${
              isStreaming 
                ? 'bg-white/[0.08] border-white/[0.15] text-white hover:bg-white/[0.12]'
                : 'bg-white/[0.05] border-white/[0.10] text-white/80 hover:bg-white/[0.08]'
            }`}
          >
            {isStreaming ? '⏹ Stop Camera' : '▶ Start Camera'}
          </button>
          
          <button
            onClick={() => setRegistrationMode(!registrationMode)}
            className={`px-6 py-3 rounded-xl text-sm font-light backdrop-blur-xl border transition-all duration-500 ${
              registrationMode
                ? 'bg-blue-500/20 border-blue-400/30 text-blue-300'
                : 'bg-white/[0.05] border-white/[0.10] text-white/80 hover:bg-white/[0.08]'
            }`}
          >
            {registrationMode ? '✕ Cancel' : '👤 Register Face'}
          </button>
          
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span>Camera: {cameraStatus}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span>FPS: {fps}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-purple-400"></div>
              <span>Processing: {processingTime.toFixed(2)}ms</span>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-white/60">
          Real-Time Face Recognition • Zero Buffering • Maximum FPS
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Video Stream */}
        <div className="flex-1 relative">
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            
            {/* Canvas Overlay for Detections */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
            
            {/* Status Overlay */}
            {cameraStatus === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <div className="text-white text-lg">Starting Camera...</div>
                </div>
              </div>
            )}
            
            {cameraStatus === 'preview' && (
              <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded text-sm">
                Preview Mode - Loading Recognition...
              </div>
            )}
            
            {cameraStatus === 'recognition' && (
              <div className="absolute top-4 left-4 bg-green-500/50 px-3 py-1 rounded text-sm">
                Real-Time Recognition Active
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white/[0.02] border-l border-white/[0.1] p-6">
          {/* Registration Form */}
          {registrationMode && (
            <div className="mb-6 p-4 bg-white/[0.05] rounded-lg border border-white/[0.1]">
              <h3 className="text-lg font-medium mb-4">Register New Person</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  value={newPersonId}
                  onChange={(e) => setNewPersonId(e.target.value)}
                  placeholder="Enter Person ID"
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.1] rounded text-white placeholder-white/50"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={registerFace}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Register
                  </button>
                  <button
                    onClick={() => setRegistrationMode(false)}
                    className="px-4 py-2 bg-white/[0.1] text-white rounded hover:bg-white/[0.2] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Detection Results */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4">Live Detections</h3>
            <div className="space-y-2">
              {detectionResults.length === 0 ? (
                <div className="text-white/50 text-sm">No faces detected</div>
              ) : (
                detectionResults.map((detection, index) => (
                  <div key={index} className="p-3 bg-white/[0.05] rounded border border-white/[0.1]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {detection.recognition?.personId || 'Unknown'}
                      </span>
                      <span className="text-xs text-white/60">
                        {detection.confidence.toFixed(2)}
                      </span>
                    </div>
                    {detection.recognition?.personId && (
                      <div className="text-xs text-green-400">
                        Similarity: {(detection.recognition.similarity * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* System Stats */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4">System Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-white/70">People in DB:</span>
                <span className="text-white">{systemStats.total_people}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Today's Records:</span>
                <span className="text-white">{systemStats.today_records}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Current FPS:</span>
                <span className="text-green-400">{fps}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Processing Time:</span>
                <span className="text-purple-400">{processingTime.toFixed(2)}ms</span>
              </div>
            </div>
          </div>

          {/* Performance Info */}
          <div className="text-xs text-white/50 space-y-2">
            <div>• Real-time processing with zero buffering</div>
            <div>• Maximum FPS for minimal latency</div>
            <div>• SCRFD + EdgeFace pipeline</div>
            <div>• Direct camera access</div>
          </div>
        </div>
      </div>
    </div>
  )
}