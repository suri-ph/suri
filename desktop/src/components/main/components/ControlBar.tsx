interface ControlBarProps {
  cameraDevices: MediaDeviceInfo[];
  selectedCamera: string;
  setSelectedCamera: (deviceId: string) => void;
  isStreaming: boolean;
  trackingMode: 'auto' | 'manual';
  setTrackingMode: (mode: 'auto' | 'manual') => void;
  startCamera: () => void;
  stopCamera: () => void;
  // Late threshold functionality
  lateThresholdMinutes: number;
  onLateThresholdChange: (minutes: number) => void;
  // Start time functionality
  classStartTime: string;
  onClassStartTimeChange: (time: string) => void;
}

export function ControlBar({
  cameraDevices,
  selectedCamera,
  setSelectedCamera,
  isStreaming,
  trackingMode,
  setTrackingMode,
  startCamera,
  stopCamera,
  lateThresholdMinutes,
  onLateThresholdChange,
  classStartTime,
  onClassStartTimeChange,
}: ControlBarProps) {
  return (
    <div className="px-4 pt-2 pb-2">
      <div className="glass-card rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* Camera Selection */}
          {cameraDevices.length > 0 && (
            <div className="flex items-center space-x-2">
              <select
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                disabled={isStreaming || cameraDevices.length <= 1}
                className="bg-white/[0.05] text-white text-sm border border-white/[0.1] rounded px-2 py-1 focus:border-white/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {cameraDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId} className="bg-black text-white">
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-green-400' : 'bg-red-400'}`}></div>
          </div>

          {/* Late Threshold Control */}
          <div className="flex items-center space-x-3">
            <span className="text-white/60 text-sm">Late Threshold</span>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={lateThresholdMinutes}
                onChange={(e) => onLateThresholdChange(parseInt(e.target.value))}
                className="w-20 accent-amber-500"
                disabled={isStreaming}
              />
              <span className="text-white font-medium text-sm min-w-[3rem]">{lateThresholdMinutes}min</span>
            </div>
          </div>

          {/* Class Start Time Control */}
          <div className="flex items-center space-x-3">
            <span className="text-white/60 text-sm">Start Time</span>
            <div className="flex items-center space-x-2">
              <input
                type="time"
                value={classStartTime}
                onChange={(e) => onClassStartTimeChange(e.target.value)}
                className="px-2 py-1 bg-white/[0.05] text-white text-sm border border-white/[0.1] rounded focus:border-white/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={isStreaming}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Tracking Mode Toggle */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <span className={`text-xs transition-colors ${trackingMode === 'auto' ? 'text-white' : 'text-white/40'}`}>Auto</span>
              <button
                onClick={() => setTrackingMode(trackingMode === 'auto' ? 'manual' : 'auto')}
                className={`relative w-10 h-3 rounded-full transition-all focus:outline-none flex items-center ${
                  trackingMode === 'auto' ? 'bg-white/20' : 'bg-white/10'
                }`}
              >
                <div className={`absolute left-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${
                  trackingMode === 'auto' ? 'translate-x-0' : 'translate-x-4'
                }`}></div>
              </button>
              <span className={`text-xs transition-colors ${trackingMode === 'manual' ? 'text-white' : 'text-white/40'}`}>Manual</span>
            </div>
          </div>

          <button
            onClick={isStreaming ? stopCamera : startCamera}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              isStreaming ? 'btn-error' : 'btn-success'
            }`}
          >
            {isStreaming ? 'Stop' : 'Start Scan'}
          </button>
        </div>
      </div>
    </div>
  );
}

