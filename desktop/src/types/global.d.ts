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
    // Real-time detection via IPC (replaces WebSocket)
    detectStream: (imageData: ArrayBuffer | string, options?: {
      model_type?: string;
      nms_threshold?: number;
      enable_antispoofing?: boolean;
      frame_timestamp?: number;
    }) => Promise<{
      type: string;
      faces: Array<{
        bbox: number[] | { x: number; y: number; width: number; height: number };
        confidence: number;
        landmarks?: number[][];
        landmarks_468?: number[][];
        antispoofing?: {
          is_real?: boolean | null;
          live_score?: number;
          spoof_score?: number;
          confidence?: number;
          status?: 'real' | 'fake' | 'error';
          label?: string;
        };
        track_id?: number;
      }>;
      model_used: string;
      processing_time: number;
      timestamp: number;
      frame_timestamp?: number;
      success: boolean;
      message?: string;
    }>
    // Face recognition APIs
    recognizeFace: (imageData: string, bbox: number[], groupId?: string) => Promise<{
      success: boolean;
      person_id?: string;
      similarity?: number;
      processing_time: number;
      error?: string;
    }>
    registerFace: (imageData: string, personId: string, bbox: number[], groupId?: string) => Promise<{
      success: boolean;
      person_id: string;
      processing_time: number;
      total_persons?: number;
      error?: string;
    }>
    getFaceStats: () => Promise<{
      total_persons: number;
      total_embeddings: number;
      persons: Array<{
        person_id: string;
        embedding_count: number;
        last_seen?: string;
      }>;
    }>
    removePerson: (personId: string) => Promise<{
      success: boolean;
      message: string;
      total_persons?: number;
    }>
    updatePerson: (oldPersonId: string, newPersonId: string) => Promise<{
      success: boolean;
      message: string;
      updated_records: number;
    }>
    getAllPersons: () => Promise<{
      success: boolean;
      persons: Array<{
        person_id: string;
        embedding_count: number;
      }>;
      total_count: number;
    }>
    setThreshold: (threshold: number) => Promise<{
      success: boolean;
      message: string;
      threshold: number;
    }>
    clearDatabase: () => Promise<{
      success: boolean;
      message: string;
      total_persons: number;
    }>
  }

  interface ModelsAPI {
    isReady: () => Promise<boolean>
    onLoadingProgress: (callback: (data: {
      current: number;
      total: number;
      modelName: string;
      progress: number;
    }) => void) => () => void
  }

  // Backend Service API interface is now the primary interface for face recognition functionality
  interface BackendServiceAPI {
    // Face Recognition Database API (File-based)
    saveFaceDatabase: (databaseData: Record<string, number[]>) => Promise<unknown>
    loadFaceDatabase: () => Promise<unknown>
    removeFacePerson: (personId: string) => Promise<unknown>
    getAllFacePersons: () => Promise<unknown>
    // Generic IPC invoke method
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    // Model loading API
    models: ModelsAPI
    // Backend Service API
    backend: BackendAPI
  }

  interface Window {
    suriWS?: SuriWSClientAPI
    suriVideo?: SuriVideoAPI
    suriElectron?: SuriElectronAPI
    electronAPI: BackendServiceAPI  // Required for IPC mode
    __suriOffFrame?: () => void
  }
}
