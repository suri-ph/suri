export {}

declare global {
  interface SuriWSClientAPI {
    connect: (url?: string) => Promise<void>
    send: (msg: unknown) => void
    sendRequest: (action: string, payload?: unknown, timeoutMs?: number) => Promise<unknown>
    onMessage: (handler: (msg: Record<string, unknown>) => void) => () => void
    close: () => void
  }

  interface SuriVideoAPI {
    start: (opts?: { device?: number; width?: number; height?: number; fps?: number; annotate?: boolean }) => Promise<boolean>
    startFast: (opts?: { device?: number; width?: number; height?: number; fps?: number; annotate?: boolean }) => Promise<boolean>
    stop: () => Promise<boolean>
    pause: () => Promise<boolean>
    resume: () => Promise<boolean>
    setDevice: (device: number) => Promise<boolean>
    onFrame: (handler: (buf: ArrayBuffer | Uint8Array) => void) => () => void
    onEvent: (handler: (evt: Record<string, unknown>) => void) => () => void
    onWebSocketBroadcast: (handler: (evt: Record<string, unknown>) => void) => () => void
  }

  interface SuriElectronAPI {
    minimize: () => Promise<boolean>
    maximize: () => Promise<boolean>
    close: () => Promise<boolean>
    onMaximize: (callback: () => void) => () => void
    onUnmaximize: (callback: () => void) => () => void
  }

  interface BackendAPI {
    checkAvailability: () => Promise<{ available: boolean; status?: number; error?: string }>
    checkReadiness: () => Promise<{ ready: boolean; modelsLoaded: boolean; error?: string }>
    getModels: () => Promise<Record<string, {
      name: string;
      type: string;
      version: string;
      loaded: boolean;
      size?: number;
      accuracy?: number;
    }>>
    detectFaces: (imageBase64: string, options?: {
      model_type?: string;
      confidence_threshold?: number;
      nms_threshold?: number;
    }) => Promise<{
      faces: Array<{
        bbox: [number, number, number, number];
        confidence: number;
        landmarks: number[][];
        landmarks_468?: number[][]; // FaceMesh 468 landmarks for frontend visualization
      }>;
      model_used: string;
      processing_time: number;
    }>
  }

  // Backend Service API interface is now the primary interface for face recognition functionality
  interface BackendServiceAPI {
    // Generic IPC invoke method
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    // Backend Service API
    backend: BackendAPI
  }

  interface Window {
    suriWS?: SuriWSClientAPI
    suriVideo?: SuriVideoAPI
    suriElectron?: SuriElectronAPI
    electronAPI?: BackendServiceAPI
    __suriOffFrame?: () => void
  }
}
