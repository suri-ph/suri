/// <reference types="../types/global.d.ts" />

/**
 * IPC Face Service - High-performance face detection/recognition via IPC
 * Replaces WebSocket with faster IPC communication (no network overhead)
 */

interface DetectionResponse {
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
}

interface IPCFaceServiceConfig {
  enableAntispoofing?: boolean;
  modelType?: string;
  nmsThreshold?: number;
}

export class IPCFaceService {
  private config: IPCFaceServiceConfig;
  private isProcessing = false;
  private messageHandlers: Map<string, (data: DetectionResponse) => void> = new Map();
  private clientId: string;

  constructor(config?: Partial<IPCFaceServiceConfig>) {
    this.config = {
      enableAntispoofing: true,
      modelType: 'yunet',
      nmsThreshold: 0.3,
      ...config
    };
    
    this.clientId = `ipc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize the IPC service (replaces WebSocket connect)
   */
  async connect(): Promise<void> {
    // IPC is always "connected" - just check backend availability
    try {
      const availability = await window.electronAPI.backend.checkAvailability();
      if (!availability.available) {
        throw new Error('Backend not available');
      }
    } catch (error) {
      console.error('[IPCFaceService] Backend not available:', error);
      throw error;
    }
  }

  /**
   * Send detection request via IPC (replaces WebSocket sendDetectionRequest)
   */
  async sendDetectionRequest(
    imageData: ImageData | string | ArrayBuffer,
    options: {
      model_type?: string;
      nms_threshold?: number;
      enable_antispoofing?: boolean;
      frame_timestamp?: number;
    } = {}
  ): Promise<void> {
    if (this.isProcessing) {
      // Skip frame if already processing (similar to WebSocket behavior)
      return;
    }

    this.isProcessing = true;

    try {
      let imageToSend: ArrayBuffer | string;

      // Handle different image data types
      if (imageData instanceof ArrayBuffer) {
        imageToSend = imageData;
      } else if (typeof imageData === 'string') {
        imageToSend = imageData;
      } else {
        // Convert ImageData to base64
        imageToSend = await this.imageDataToBase64(imageData);
      }

      // Send detection request via IPC
      const result = await window.electronAPI.backend.detectStream(imageToSend, {
        model_type: options.model_type || this.config.modelType,
        nms_threshold: options.nms_threshold || this.config.nmsThreshold,
        enable_antispoofing: options.enable_antispoofing !== undefined 
          ? options.enable_antispoofing 
          : this.config.enableAntispoofing,
        frame_timestamp: options.frame_timestamp || Date.now()
      }) as DetectionResponse;

      // Trigger message handlers
      this.handleMessage(result);

    } catch (error) {
      console.error('[IPCFaceService] Detection failed:', error);
      
      // Send error response to handlers
      const errorResponse: DetectionResponse = {
        type: 'error',
        faces: [],
        model_used: this.config.modelType || 'yunet',
        processing_time: 0,
        timestamp: Date.now(),
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
      
      this.handleMessage(errorResponse);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Register message handler (replaces WebSocket onMessage)
   */
  onMessage(type: string, handler: (data: DetectionResponse) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Remove message handler (replaces WebSocket offMessage)
   */
  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  /**
   * Disconnect (replaces WebSocket disconnect - no-op for IPC)
   */
  disconnect(): void {
    this.messageHandlers.clear();
  }

  /**
   * Get connection status (always connected for IPC)
   */
  getConnectionStatus(): {
    http: boolean;
    websocket: boolean;
    clientId: string;
  } {
    return {
      http: true,
      websocket: true, // IPC is "always connected"
      clientId: this.clientId
    };
  }

  /**
   * Check if ready (replaces WebSocket isWebSocketReady)
   */
  isReady(): boolean {
    return true; // IPC is always ready
  }

  /**
   * Get status string (replaces getWebSocketStatus)
   */
  getStatus(): 'disconnected' | 'connecting' | 'connected' {
    return 'connected'; // IPC is always connected
  }

  // Face Recognition Methods (IPC-based)

  /**
   * Recognize a face via IPC
   */
  async recognizeFace(
    imageData: ImageData | string | ArrayBuffer,
    bbox?: number[],
    groupId?: string
  ): Promise<any> {
    try {
      let base64Image: string;
      
      if (typeof imageData === 'string') {
        base64Image = imageData;
      } else if (imageData instanceof ArrayBuffer) {
        // Convert ArrayBuffer to base64
        const blob = new Blob([imageData], { type: 'image/jpeg' });
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        base64Image = dataUrl.split(',')[1];
      } else {
        base64Image = await this.imageDataToBase64(imageData);
      }

      return await window.electronAPI.backend.recognizeFace(base64Image, bbox || [], groupId);
    } catch (error) {
      console.error('[IPCFaceService] Face recognition failed:', error);
      throw error;
    }
  }

  /**
   * Register a new face via IPC
   */
  async registerFace(
    imageData: ImageData | string,
    personId: string,
    bbox?: number[],
    groupId?: string
  ): Promise<any> {
    try {
      const base64Image = typeof imageData === 'string' 
        ? imageData 
        : await this.imageDataToBase64(imageData);

      return await window.electronAPI.backend.registerFace(
        base64Image, 
        personId, 
        bbox || [], 
        groupId
      );
    } catch (error) {
      console.error('[IPCFaceService] Face registration failed:', error);
      throw error;
    }
  }

  /**
   * Remove a person via IPC
   */
  async removePerson(personId: string): Promise<any> {
    try {
      return await window.electronAPI.backend.removePerson(personId);
    } catch (error) {
      console.error('[IPCFaceService] Person removal failed:', error);
      throw error;
    }
  }

  /**
   * Update person ID via IPC
   */
  async updatePerson(oldPersonId: string, newPersonId: string): Promise<any> {
    try {
      return await window.electronAPI.backend.updatePerson(oldPersonId, newPersonId);
    } catch (error) {
      console.error('[IPCFaceService] Person update failed:', error);
      throw error;
    }
  }

  /**
   * Get all registered persons via IPC
   */
  async getAllPersons(): Promise<any> {
    try {
      return await window.electronAPI.backend.getAllPersons();
    } catch (error) {
      console.error('[IPCFaceService] Get all persons failed:', error);
      throw error;
    }
  }

  /**
   * Set similarity threshold via IPC
   */
  async setSimilarityThreshold(threshold: number): Promise<any> {
    try {
      return await window.electronAPI.backend.setThreshold(threshold);
    } catch (error) {
      console.error('[IPCFaceService] Set threshold failed:', error);
      throw error;
    }
  }

  /**
   * Clear face database via IPC
   */
  async clearDatabase(): Promise<any> {
    try {
      return await window.electronAPI.backend.clearDatabase();
    } catch (error) {
      console.error('[IPCFaceService] Clear database failed:', error);
      throw error;
    }
  }

  /**
   * Get database statistics via IPC
   */
  async getDatabaseStats(): Promise<any> {
    try {
      return await window.electronAPI.backend.getFaceStats();
    } catch (error) {
      console.error('[IPCFaceService] Get database stats failed:', error);
      throw error;
    }
  }

  // Private helper methods

  private handleMessage(data: DetectionResponse): void {
    const messageType = data.type || 'detection_response';
    const handler = this.messageHandlers.get(messageType);
    if (handler) {
      handler(data);
    }
    
    // Always invoke the generic broadcast handler if registered
    const broadcastHandler = this.messageHandlers.get('*');
    if (broadcastHandler && messageType !== '*') {
      broadcastHandler(data);
    }
  }

  private async imageDataToBase64(imageData: ImageData): Promise<string> {
    // Validate ImageData dimensions
    if (!imageData || typeof imageData.width !== 'number' || typeof imageData.height !== 'number' || 
        imageData.width <= 0 || imageData.height <= 0) {
      throw new Error('Invalid ImageData: width and height must be positive numbers');
    }

    // Create a canvas to convert ImageData to base64
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    
    // Convert to blob and then to base64
    return new Promise<string>((resolve, reject) => {
      canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
        .then(blob => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
        .catch(reject);
    });
  }
}

// Singleton instance for global use
export const ipcFaceService = new IPCFaceService();

