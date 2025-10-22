import type { RefObject } from 'react';
import type { QuickSettings } from '../../settings';

interface VideoCanvasProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  quickSettings: QuickSettings;
  detectionFps: number;
  isVideoLoading: boolean;
}

export function VideoCanvas({
  videoRef,
  canvasRef,
  overlayCanvasRef,
  quickSettings,
  detectionFps,
  isVideoLoading,
}: VideoCanvasProps) {
  return (
    <div className="relative w-full h-full min-h-[260px] overflow-hidden rounded-lg glass-card">
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-contain ${quickSettings.cameraMirrored ? 'scale-x-[-1]' : ''}`}
        playsInline
        muted
      />
      <canvas
        ref={overlayCanvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{
          zIndex: 10,
          mixBlendMode: "normal",
        }}
      />

      {quickSettings.showFPS && detectionFps > 0 && (
        <div className="absolute top-4 left-4 backdrop-blur-sm bg-white/5 px-3 py-1.5 rounded-full border border-white/10 pointer-events-none" style={{ zIndex: 20 }}>
          <span className="text-white/80 text-sm font-medium">{detectionFps.toFixed(1)} FPS</span>
        </div>
      )}


      {/* Minimalist Video Loader */}
      {isVideoLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none" style={{ zIndex: 15 }}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin"></div>
            <span className="text-white/60 text-sm">Loading camera...</span>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

