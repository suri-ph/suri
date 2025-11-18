import type { DetectionResult } from "../types";

export function resetLastDetectionRef(
  lastDetectionRef: React.RefObject<DetectionResult | null>
): void {
  if (lastDetectionRef.current !== null) {
    (lastDetectionRef as React.RefObject<DetectionResult | null>).current = null;
  }
}

export function resetFrameCounters(
  frameCounterRef: React.RefObject<number>,
  skipFramesRef: React.RefObject<number>,
  lastFrameTimestampRef: React.RefObject<number>
): void {
  (frameCounterRef as React.RefObject<number>).current = 0;
  (skipFramesRef as React.RefObject<number>).current = 0;
  (lastFrameTimestampRef as React.RefObject<number>).current = 0;
}

