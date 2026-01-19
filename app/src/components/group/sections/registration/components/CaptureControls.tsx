import { Dropdown } from "../../../../shared";
import type { CaptureSource } from "../types";

interface CaptureControlsProps {
  source: CaptureSource;
  setSource: (source: CaptureSource) => void;
  hasRequiredFrame: boolean;
  cameraDevices: MediaDeviceInfo[];
  selectedCamera: string;
  setSelectedCamera: (deviceId: string) => void;
  isStreaming: boolean;
  stopCamera: () => void;
}

export function CaptureControls({
  source,
  setSource,
  hasRequiredFrame,
  cameraDevices,
  selectedCamera,
  setSelectedCamera,
  isStreaming,
  stopCamera,
}: CaptureControlsProps) {
  // Only show camera dropdown if we have devices and are NOT streaming
  // or if we are streaming and we want to switch (though switching while streaming might require stop/start logic in parent)
  // For simplicity, match original behavior: show dropdown unless streaming
  const showCameraDropdown = cameraDevices.length > 0 && !isStreaming;

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex gap-2 flex-shrink-0">
        {(["upload", "live"] as CaptureSource[]).map((option) => (
          <button
            key={option}
            onClick={() => setSource(option)}
            disabled={hasRequiredFrame}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              source === option
                ? "bg-white/10 text-white border border-white/20"
                : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {option === "upload" ? "Upload" : "Camera"}
          </button>
        ))}
      </div>

      {source === "live" && showCameraDropdown && (
        <div className="z-10 w-full">
          <Dropdown
            options={cameraDevices.map((device, index) => ({
              value: device.deviceId,
              label: device.label || `Camera ${index + 1}`,
            }))}
            value={selectedCamera}
            onChange={(deviceId: string | null) => {
              if (deviceId) {
                setSelectedCamera(deviceId);
                if (isStreaming) {
                  stopCamera();
                }
              }
            }}
            placeholder="Select camera…"
            emptyMessage="No cameras available"
            disabled={isStreaming || cameraDevices.length <= 1}
            maxHeight={256}
            buttonClassName="text-xs px-2 py-2 bg-black/40 border border-white/10 w-full"
            showPlaceholderOption={false}
            allowClear={false}
          />
        </div>
      )}
    </div>
  );
}
