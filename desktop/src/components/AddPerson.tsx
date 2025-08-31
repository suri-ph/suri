import { useState, useRef, useEffect } from 'react'

interface CameraDevice {
  index: number
  name: string
  backend: string
  backend_id?: number
  works: boolean
  width: number
  height: number
  fps: number
}

export default function AddPerson() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [isAddingPerson, setIsAddingPerson] = useState(false)
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([])
  const [currentCamera, setCurrentCamera] = useState<number>(0)
  const [showCameraSelector, setShowCameraSelector] = useState(false)
  const [isLoadingCameras, setIsLoadingCameras] = useState(false)
  const [systemStats, setSystemStats] = useState({ total_people: 0 })
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraSelectorRef = useRef<HTMLDivElement>(null)

  // Close camera selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cameraSelectorRef.current && !cameraSelectorRef.current.contains(event.target as Node)) {
        setShowCameraSelector(false)
      }
    }

    if (showCameraSelector) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCameraSelector])

  useEffect(() => {
    fetchAvailableCameras()
    fetchSystemStats()
  }, [])

  const fetchSystemStats = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8770/system/status')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSystemStats({
            total_people: data.database_stats?.total_people ?? 0
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch system stats:', error)
    }
  }

  const fetchAvailableCameras = async () => {
    setIsLoadingCameras(true)
    try {
      const response = await fetch('http://127.0.0.1:8770/video/devices')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAvailableCameras(data.devices)
          setCurrentCamera(data.current_device)
        }
      }
    } catch (error) {
      console.error('Failed to fetch cameras:', error)
    } finally {
      setIsLoadingCameras(false)
    }
  }

  const startCamera = async () => {
    try {
      setIsStreaming(true)
      
      // Get camera stream using browser's native API
      let stream: MediaStream
      try {
        // Try to use the specific camera device if available
        if (currentCamera !== null) {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              deviceId: { exact: currentCamera.toString() },
              width: { ideal: 640 },
              height: { ideal: 480 }
            } 
          })
        } else {
          // Fallback to default camera
                  stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640, min: 320, max: 1920 },
            height: { ideal: 480, min: 240, max: 1080 },
            facingMode: 'user'
          } 
        })
        }
      } catch (error) {
        // If specific device fails, try default camera
        console.warn('Failed to get specific camera, trying default:', error)
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640, min: 320, max: 1920 },
            height: { ideal: 480, min: 240, max: 1080 },
            facingMode: 'user'
          } 
        })
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }
    } catch (error) {
      console.error('Failed to start camera:', error)
      alert('Failed to start camera. Please check camera permissions.')
      setIsStreaming(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreaming(false)
  }

  const switchCamera = async (deviceIndex: number) => {
    try {
      // Stop current camera if running
      if (isStreaming) {
        stopCamera()
      }
      
      setCurrentCamera(deviceIndex)
      setShowCameraSelector(false)
      
      // If we were streaming before, restart with new camera
      if (isStreaming) {
        setTimeout(() => {
          startCamera()
        }, 300)
      }
      
      // Show success message
      const camera = availableCameras.find(c => c.index === deviceIndex)
      alert(`✅ Switched to: ${camera?.name || `Camera ${deviceIndex}`}`)
    } catch (error) {
      console.error('Failed to switch camera:', error)
      alert('❌ Failed to switch camera')
    }
  }

  const addPersonFromCamera = async () => {
    if (!newPersonName.trim() || !isStreaming) return
    
    setIsAddingPerson(true)
    try {
      if (!videoRef.current || !canvasRef.current) {
        throw new Error('Camera not ready')
      }
      
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        throw new Error('Canvas context not available')
      }
      
      // Set canvas size to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0)
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to capture frame'))
          }
        }, 'image/jpeg', 0.9)
      })
      
      // Send the captured frame to the API
      const form = new FormData()
      form.append('name', newPersonName.trim())
      form.append('file', blob, 'camera_capture.jpg')
      
      const response = await fetch('http://127.0.0.1:8770/person/add', {
        method: 'POST',
        body: form
      })
      
      if (!response.ok) {
        // Handle HTTP errors
        let errorMessage = `HTTP ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorData.message || errorMessage
        } catch {
          // Failed to parse JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }
      
      const data = await response.json()
      if (data.success) {
        alert(`✅ ${newPersonName} added successfully!`)
        setNewPersonName('')
        fetchSystemStats()
      } else {
        alert(`❌ Failed to add ${newPersonName}: ${data.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Add person error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Connection error'
      alert(`❌ Failed to add ${newPersonName}: ${errorMessage}`)
    } finally {
      setIsAddingPerson(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-light text-white mb-2">Add New Person</h1>
        <p className="text-white/60 font-light">Capture and register a new person in the face recognition system</p>
      </div>

      <div className="flex gap-8">
        {/* Camera Section */}
        <div className="flex-1">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-light text-white">Camera Capture</h2>
              <div className="flex items-center space-x-4">
                {/* Camera Selector */}
                <div className="relative" ref={cameraSelectorRef}>
                  <button
                    onClick={() => setShowCameraSelector(!showCameraSelector)}
                    className="px-4 py-2 rounded-xl text-sm font-light text-white/60 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] transition-all duration-300 flex items-center gap-2"
                  >
                    📷 {availableCameras.find(c => c.index === currentCamera)?.name?.split(' ')[0] || `Camera ${currentCamera}`}
                    <span className="text-white/40">▼</span>
                  </button>
                  
                  {showCameraSelector && (
                    <div className="absolute top-full left-0 mt-2 min-w-[280px] bg-black/80 backdrop-blur-xl border border-white/[0.15] rounded-xl overflow-hidden z-50">
                      <div className="p-3 border-b border-white/[0.10]">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/70 font-light">Select Camera</span>
                          <button
                            onClick={fetchAvailableCameras}
                            disabled={isLoadingCameras}
                            className="text-sm text-white/50 hover:text-white/80 transition-colors"
                          >
                            {isLoadingCameras ? '⟳' : '↻'}
                          </button>
                        </div>
                      </div>
                      
                      {isLoadingCameras ? (
                        <div className="p-4 text-center">
                          <div className="text-sm text-white/60">Scanning cameras...</div>
                        </div>
                      ) : availableCameras.length === 0 ? (
                        <div className="p-4 text-center">
                          <div className="text-sm text-white/60">No cameras found</div>
                          <div className="text-xs text-white/40 mt-1">Check camera connections</div>
                        </div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto">
                          {availableCameras.map((camera) => (
                            <button
                              key={camera.index}
                              onClick={() => switchCamera(camera.index)}
                              className={`w-full p-3 text-left hover:bg-white/[0.05] transition-colors border-b border-white/[0.05] last:border-b-0 ${
                                camera.index === currentCamera ? 'bg-white/[0.08] text-white' : 'text-white/80'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="text-sm font-light">{camera.name}</div>
                                  <div className="text-xs text-white/50 mt-1">
                                    {camera.width}x{camera.height} • {camera.backend}
                                    {camera.index === currentCamera && ' • Active'}
                                  </div>
                                </div>
                                <div className={`w-2 h-2 rounded-full ${camera.works ? 'bg-green-400' : 'bg-red-400'}`} />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Camera Control */}
                <button
                  onClick={isStreaming ? stopCamera : startCamera}
                  className={`px-6 py-2 rounded-xl text-sm font-light backdrop-blur-xl border transition-all duration-500 ${
                    isStreaming 
                      ? 'bg-red-500/[0.2] border-red-500/[0.3] text-red-300 hover:bg-red-500/[0.3]'
                      : 'bg-green-500/[0.2] border-green-500/[0.3] text-green-300 hover:bg-green-500/[0.3]'
                  }`}
                >
                  {isStreaming ? '⏹ Stop Camera' : '▶ Start Camera'}
                </button>
              </div>
            </div>

            {/* Video Display */}
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
              {isStreaming ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-white/40">
                    <div className="flex items-center justify-center w-20 h-20 rounded-full bg-white/[0.02] border border-white/[0.05] mb-4 mx-auto">
                      <svg className="w-10 h-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <p className="text-sm font-light">Click "Start Camera" to begin</p>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden canvas for capturing frames */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Form Section */}
        <div className="w-96">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-xl font-light text-white mb-6">Person Details</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-white/60 mb-3 font-light">Person's Name</label>
                <input
                  type="text"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/[0.20] focus:bg-white/[0.05] transition-all duration-300 font-light"
                  disabled={isAddingPerson}
                />
              </div>
              
              <div className="text-sm text-white/50 bg-white/[0.02] p-4 rounded-xl font-light">
                <div className="flex items-start space-x-3">
                  <div className="text-blue-400 mt-0.5">💡</div>
                  <div>
                    <div className="font-medium mb-2">Instructions:</div>
                    <ul className="space-y-1 text-xs">
                      <li>• Start the camera first</li>
                      <li>• Position the person's face clearly in view</li>
                      <li>• Ensure good lighting</li>
                      <li>• Enter the person's name</li>
                      <li>• Click "Add Person" to capture and register</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <button
                onClick={addPersonFromCamera}
                disabled={!newPersonName.trim() || !isStreaming || isAddingPerson}
                className="w-full px-6 py-4 bg-white/[0.08] border border-white/[0.15] text-white rounded-xl hover:bg-white/[0.12] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed font-light"
              >
                {isAddingPerson ? 'Adding...' : 'Add Person'}
              </button>
            </div>
          </div>

          {/* System Stats */}
          <div className="mt-6 bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6">
            <h3 className="text-sm font-light text-white/60 uppercase tracking-[0.15em] mb-4">System Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/60 font-light">Total People</span>
                <span className="text-lg font-light text-white">{systemStats.total_people}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
