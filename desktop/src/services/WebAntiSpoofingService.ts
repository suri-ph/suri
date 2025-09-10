import * as ort from 'onnxruntime-web/all';

export interface AntiSpoofingResult {
  isLive: boolean;
  confidence: number;
  score: number; // Raw model output score
}

export class WebAntiSpoofingService {
  private session: ort.InferenceSession | null = null;
  private threshold: number = 0.497; // Real face probability threshold (standard anti-spoofing threshold)
  
  // Model specifications based on Silent-Face-Anti-Spoofing research
  private readonly INPUT_SIZE = 128; // 128x128 input size
  private readonly INPUT_MEAN = 0.5;   // Normalize to [-1, 1] range
  private readonly INPUT_STD = 0.5;
  
  // Performance monitoring
  private frameCount = 0;

  async initialize(isDev?: boolean): Promise<void> {
    // Use different paths for development vs production
    const isDevMode = isDev !== undefined ? isDev : (typeof window !== 'undefined' && window.location.protocol === 'http:');
    const modelUrl = isDevMode 
      ? '/weights/AntiSpoofing_bin_1.5_128.onnx' 
      : './app.asar.unpacked/dist-react/weights/AntiSpoofing_bin_1.5_128.onnx';
    
    try {
      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: [
          'wasm'       // Use CPU only for better compatibility
        ],
        logSeverityLevel: 0,  // Enable more logging for debugging
        logVerbosityLevel: 1,
        enableCpuMemArena: false,
        enableMemPattern: false,
        executionMode: 'sequential',
        graphOptimizationLevel: 'disabled'
      });
      
      console.log('✅ Anti-spoofing model loaded successfully');
      console.log('📊 Model input names:', this.session.inputNames);
      console.log('📊 Model output names:', this.session.outputNames);
      
      // Log input shape for debugging
      if (this.session.inputNames.length > 0) {
        const inputName = this.session.inputNames[0];
        console.log('📊 Input name:', inputName);
        
        // Access model metadata to check expected input shape
        try {
          const inputMetadata = (this.session as ort.InferenceSession & { inputMetadata?: Record<string, { dims: number[]; type: string }> }).inputMetadata;
          console.log('📊 Input metadata:', inputMetadata);
          if (inputMetadata && inputMetadata[inputName]) {
            console.log('📊 Expected input shape:', inputMetadata[inputName].dims);
            console.log('📊 Expected input type:', inputMetadata[inputName].type);
          }
        } catch (e) {
          console.log('📊 Could not access input metadata:', e);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to load anti-spoofing model:', error);
      throw new Error(`Anti-spoofing model initialization failed: ${error}`);
    }
  }

  /**
   * Detect if a face is live or spoofed
   * @param faceImageData - Cropped and aligned face image data (should be close to square)
   * @returns AntiSpoofingResult with live/spoof classification
   */
  async detectLiveness(faceImageData: ImageData): Promise<AntiSpoofingResult> {
    if (!this.session) {
      throw new Error('Anti-spoofing model not initialized');
    }

    try {
      this.frameCount++;
      
      // Preprocess the face image to 128x128
      const preprocessedTensor = this.preprocessFaceImage(faceImageData);
      
      // Debug logging for tensor shape (only log once per session)
      if (this.frameCount === 0) {
        console.log('🔍 Model initialized - Input:', this.session.inputNames[0], 'Output:', this.session.outputNames[0]);
        console.log('🔍 Tensor shape:', preprocessedTensor.dims);
      }
      
      // Run inference with NCHW format [1, 3, 128, 128]
      const feeds = { [this.session.inputNames[0]]: preprocessedTensor };
      const outputs = await this.session.run(feeds);
      
      // Get the output tensor (should be a single probability score)
      const outputTensor = outputs[this.session.outputNames[0]];
      const score = outputTensor.data[0] as number;
      
      // Convert raw score to probability using sigmoid-like function
      // Based on Face-AntiSpoofing repository implementation
      const probability = 1 / (1 + Math.exp(-score / 1000)); // Normalize score to probability
      // Real scores are lower, spoof scores are higher.
      // Real faces: 0.493-0.496, Spoof faces: 0.498-0.499
      const isLive = probability < this.threshold;
      const confidence = Math.abs(probability - 0.5) * 2; // Distance from decision boundary
      
      return {
          isLive,
          confidence,
          score: probability // Return probability instead of raw score for consistency
        };
      
    } catch (error) {
      console.error('Anti-spoofing detection failed:', error);
      // Return safe default (assume spoof on error)
      return {
        isLive: false,
        confidence: 0,
        score: 0
      };
    }
  }

  /**
   * Preprocess face image for anti-spoofing model
   * Based on Silent-Face-Anti-Spoofing preprocessing requirements
   */
  private preprocessFaceImage(imageData: ImageData): ort.Tensor {
    const { width, height, data } = imageData;
    
    // Create canvas for resizing to 128x128
    const canvas = new OffscreenCanvas(this.INPUT_SIZE, this.INPUT_SIZE);
    const ctx = canvas.getContext('2d')!;
    
    // Create ImageData from input
    const sourceCanvas = new OffscreenCanvas(width, height);
    const sourceCtx = sourceCanvas.getContext('2d')!;
    const sourceImageData = new ImageData(data, width, height);
    sourceCtx.putImageData(sourceImageData, 0, 0);
    
    // Resize to 128x128 (this handles aspect ratio automatically)
    ctx.drawImage(sourceCanvas, 0, 0, this.INPUT_SIZE, this.INPUT_SIZE);
    
    // Get resized image data
    const resizedImageData = ctx.getImageData(0, 0, this.INPUT_SIZE, this.INPUT_SIZE);
    const resizedData = resizedImageData.data;
    
    // Convert to CHW format and normalize
    const tensorData = new Float32Array(3 * this.INPUT_SIZE * this.INPUT_SIZE);
    
    for (let i = 0; i < this.INPUT_SIZE * this.INPUT_SIZE; i++) {
      const pixelIndex = i * 4; // RGBA format
      
      // Extract RGB values and normalize to [-1, 1] range
      // Based on research: (pixel/255.0 - 0.5) / 0.5
      const r = (resizedData[pixelIndex] / 255.0 - this.INPUT_MEAN) / this.INPUT_STD;
      const g = (resizedData[pixelIndex + 1] / 255.0 - this.INPUT_MEAN) / this.INPUT_STD;
      const b = (resizedData[pixelIndex + 2] / 255.0 - this.INPUT_MEAN) / this.INPUT_STD;
      
      // CHW format: [C, H, W]
      tensorData[i] = r;                                    // R channel
      tensorData[this.INPUT_SIZE * this.INPUT_SIZE + i] = g;     // G channel  
      tensorData[2 * this.INPUT_SIZE * this.INPUT_SIZE + i] = b; // B channel
    }
    
    // Create tensor with shape [1, 3, 128, 128] (NCHW format)
    return new ort.Tensor('float32', tensorData, [1, 3, this.INPUT_SIZE, this.INPUT_SIZE]);
  }

  /**
   * Update the threshold for live/spoof classification
   */
  setThreshold(threshold: number): void {
    this.threshold = Math.max(0, Math.min(1, threshold)); // Clamp to [0,1]
  }

  /**
   * Get current threshold
   */
  getThreshold(): number {
    return this.threshold;
  }

  /**
   * Get performance stats
   */
  getStats() {
    return {
      frameCount: this.frameCount,
      threshold: this.threshold,
      inputSize: this.INPUT_SIZE
    };
  }

  /**
   * Dispose of the model and free resources
   */
  dispose(): void {
    if (this.session) {
      this.session = null;
    }
  }
}