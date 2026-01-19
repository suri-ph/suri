export type CaptureSource = "upload" | "live";

export type FrameStatus =
  | "pending"
  | "processing"
  | "ready"
  | "error"
  | "registered";

export type BoundingBox = [number, number, number, number];

export interface CapturedFrame {
  id: string;
  angle: string;
  label: string;
  dataUrl: string;
  width: number;
  height: number;
  status: FrameStatus;
  confidence?: number;
  bbox?: BoundingBox;
  landmarks_5?: number[][];
  error?: string;
}
