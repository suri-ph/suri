/**
 * Backend Service for integrating with FastAPI face detection backend
 * Provides HTTP and WebSocket communication with the Python backend
 */

interface DetectionRequest {
  image: string; // base64 encoded image
  model_type?: string;
  confidence_threshold?: number;
  nms_threshold?: number;
}

interface DetectionResponse {
  faces: Array<{
    bbox: [number, number, number, number];
    confidence: number;
    landmarks: number[][];
  }>;
  model_used: string;
  processing_time: number;
  session_id?: string;
}

interface BackendConfig {
  baseUrl: string;
  wsUrl: string;
  timeout: number;
  retryAttempts: number;
}

export class BackendService {
  private config: BackendConfig;
  private websocket: WebSocket | null = null;
  private clientId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private isConnecting = false;

  constructor(config?: Partial<BackendConfig>) {
    this.config = {
      baseUrl: 'http://127.0.0.1:8001',
      wsUrl: 'ws://127.0.0.1:8001',
      timeout: 30000,
      retryAttempts: 3,
      ...config
    };
    
    this.clientId = `electron_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if the backend is available
   */
  async isBackendAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      console.warn('Backend not available:', error);
      return false;
    }
  }

  /**
   * Get available models from the backend
   */
  async getAvailableModels(): Promise<Record<string, any>> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get available models:', error);
      throw error;
    }
  }

  /**
   * Detect faces using HTTP API
   */
  async detectFaces(
    imageData: ImageData | string,
    options: {
      model_type?: string;
      confidence_threshold?: number;
      nms_threshold?: number;
    } = {}
  ): Promise<DetectionResponse> {
    try {
      let imageBase64: string;
      
      if (typeof imageData === 'string') {
        imageBase64 = imageData;
      } else {
        imageBase64 = this.imageDataToBase64(imageData);
      }

      const request: DetectionRequest = {
        image: imageBase64,
        model_type: options.model_type || 'yunet',
        confidence_threshold: options.confidence_threshold || 0.5,
        nms_threshold: options.nms_threshold || 0.3
      };

      const response = await fetch(`${this.config.baseUrl}/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Face detection failed:', error);
      throw error;
    }
  }

  /**
   * Detect faces using file upload
   */
  async detectFacesFromFile(
    file: File,
    options: {
      model_type?: string;
      confidence_threshold?: number;
      nms_threshold?: number;
    } = {}
  ): Promise<DetectionResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model_type', options.model_type || 'yunet');
      formData.append('confidence_threshold', (options.confidence_threshold || 0.5).toString());
      formData.append('nms_threshold', (options.nms_threshold || 0.3).toString());

      const response = await fetch(`${this.config.baseUrl}/detect/upload`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('File upload detection failed:', error);
      throw error;
    }
  }

  /**
   * Connect to WebSocket for real-time detection
   */
  async connectWebSocket(): Promise<void> {
    if (this.websocket?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const wsUrl = `${this.config.wsUrl}/ws/${this.clientId}`;
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('✅ WebSocket connected to backend');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.websocket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.websocket = null;
        
        // Auto-reconnect if not a clean close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

    } catch (error) {
      this.isConnecting = false;
      console.error('Failed to connect WebSocket:', error);
      throw error;
    }
  }

  /**
   * Send detection request via WebSocket
   */
  async sendDetectionRequest(
    imageData: ImageData | string,
    options: {
      model_type?: string;
      confidence_threshold?: number;
      nms_threshold?: number;
      enable_antispoofing?: boolean;
      antispoofing_threshold?: number;
    } = {}
  ): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      await this.connectWebSocket();
    }

    let imageBase64: string;
    if (typeof imageData === 'string') {
      imageBase64 = imageData;
    } else {
      imageBase64 = this.imageDataToBase64(imageData);
    }

    const message = {
      type: 'detection_request',
      image: imageBase64,
      model_type: options.model_type || 'yunet',
      confidence_threshold: options.confidence_threshold || 0.5,
      nms_threshold: options.nms_threshold || 0.3,
      enable_antispoofing: options.enable_antispoofing !== undefined ? options.enable_antispoofing : true,
      antispoofing_threshold: options.antispoofing_threshold || 0.5
    };

    this.websocket!.send(JSON.stringify(message));
  }

  /**
   * Send ping to keep connection alive
   */
  ping(): void {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type: 'ping' }));
    }
  }

  /**
   * Register message handler for WebSocket responses
   */
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Remove message handler
   */
  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.websocket) {
      this.websocket.close(1000, 'Client disconnect');
      this.websocket = null;
    }
    this.messageHandlers.clear();
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    http: boolean;
    websocket: boolean;
    clientId: string;
  } {
    return {
      http: true, // HTTP is stateless, assume available
      websocket: this.websocket?.readyState === WebSocket.OPEN,
      clientId: this.clientId
    };
  }

  // Private methods

  private handleWebSocketMessage(data: any): void {
    const handler = this.messageHandlers.get(data.type);
    if (handler) {
      handler(data);
    } else {
      console.log('Unhandled WebSocket message:', data.type, data);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    console.log(`Scheduling WebSocket reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);
    
    setTimeout(() => {
      this.connectWebSocket().catch(error => {
        console.error('Reconnect failed:', error);
      });
    }, this.reconnectDelay);
    
    // Exponential backoff with max delay of 30 seconds
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  private imageDataToBase64(imageData: ImageData): string {
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
    }) as any; // Type assertion for synchronous usage pattern
  }
}

// Singleton instance for global use
export const backendService = new BackendService();