import * as ort from 'onnxruntime-web/all';

export interface AntiSpoofingResult {
  isLive: boolean;
  confidence: number;
  score: number; // Raw model output score
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class WebAntiSpoofingService {
  private session: ort.InferenceSession | null = null;
  private threshold: number = 0.5; // Real face probability threshold

  // Model specs
  private readonly INPUT_SIZE = 128;

  private frameCount = 0;

  /**
   * Initialize the ONNX model
   */
  async initialize(modelUrl: string): Promise<void> {

    try {
      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        logSeverityLevel: 4,  // Minimal logging (4 = ERROR only)
        logVerbosityLevel: 0, // No verbose logs
        enableCpuMemArena: true,
        enableMemPattern: true,
        executionMode: 'sequential',
        graphOptimizationLevel: 'all',
      });

      console.log('✅ Anti-spoofing model loaded successfully');
      console.log('📊 Input names:', this.session.inputNames);
      console.log('📊 Output names:', this.session.outputNames);
    } catch (err) {
      console.error('❌ Failed to load anti-spoofing model:', err);
      throw new Error(`Anti-spoofing model initialization failed: ${err}`);
    }
  }

  /**
   * Detect if a face is live or spoofed
   * @param faceImageData - ImageData of the cropped face (should be square-ish)
   * @param bbox - Optional bounding box for increased cropping
   */
  async detectLiveness(
    faceImageData: ImageData,
    bbox?: BoundingBox,
    bboxInc: number = 1.5
  ): Promise<AntiSpoofingResult> {
    if (!this.session) {
      throw new Error('Anti-spoofing model not initialized');
    }

    try {
      this.frameCount++;

      // Apply increased crop if bbox is provided
      let processedImageData: ImageData;
      if (bbox) {
        processedImageData = this.increasedCrop(faceImageData, bbox, bboxInc);
      } else {
        processedImageData = faceImageData;
      }

      const tensor = this.preprocessFaceImage(processedImageData);

      if (this.frameCount === 1) {
        console.log('🔍 Model initialized - Input:', this.session.inputNames[0]);
        console.log('🔍 Tensor shape:', tensor.dims);
      }

      const feeds = { [this.session.inputNames[0]]: tensor };
      const outputs = await this.session.run(feeds);

      const outputTensor = outputs[this.session.outputNames[0]];
      const outputData = outputTensor.data as Float32Array;

      // Model outputs [1,2] logits: [live_logit, spoof_logit]
      const liveLogit = outputData[0];
      const spoofLogit = outputData[1];
      
      // Apply softmax to get probabilities
      const maxLogit = Math.max(spoofLogit, liveLogit);
      const spoofExp = Math.exp(spoofLogit - maxLogit);
      const liveExp = Math.exp(liveLogit - maxLogit);
      const sumExp = spoofExp + liveExp;
      
      const liveProb = liveExp / sumExp;
      
      // Determine if live based on probability threshold
      const liveThreshold = 0.5; // 50% confidence threshold
      const isLive = liveProb > liveThreshold;
      
      // Use live probability as confidence
      const confidence = liveProb;
      
      // Raw score is the difference between live and spoof logits
      const rawScore = liveLogit - spoofLogit;

      console.log(`Spoof: ${spoofLogit.toFixed(3)}, Live: ${liveLogit.toFixed(3)}, LiveProb: ${liveProb.toFixed(3)}, IsLive: ${isLive}`);

      return {
        isLive,
        confidence,
        score: rawScore,
      };
    } catch (err) {
      console.error('❌ Anti-spoofing detection failed:', err);
      return {
        isLive: false,
        confidence: 0,
        score: 0,
      };
    }
  }

  /**
   * Apply increased crop like Python's increased_crop
   */
  private increasedCrop(
    imgData: ImageData,
    bbox: BoundingBox,
    bboxInc: number
  ): ImageData {
    const { width: imgW, height: imgH } = imgData;

    const { x, y, width, height } = bbox;
    const l = Math.max(width, height);
    const xc = x + width / 2;
    const yc = y + height / 2;

    const x1 = Math.max(0, Math.round(xc - (l * bboxInc) / 2));
    const y1 = Math.max(0, Math.round(yc - (l * bboxInc) / 2));
    const x2 = Math.min(imgW, Math.round(xc + (l * bboxInc) / 2));
    const y2 = Math.min(imgH, Math.round(yc + (l * bboxInc) / 2));

    const cropW = x2 - x1;
    const cropH = y2 - y1;

    const canvas = new OffscreenCanvas(this.INPUT_SIZE, this.INPUT_SIZE);
    const ctx = canvas.getContext('2d')!;

    // Create temporary source canvas
    const srcCanvas = new OffscreenCanvas(imgW, imgH);
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.putImageData(imgData, 0, 0);

    // Draw cropped region and pad to square if necessary
    ctx.drawImage(srcCanvas, x1, y1, cropW, cropH, 0, 0, this.INPUT_SIZE, this.INPUT_SIZE);

    return ctx.getImageData(0, 0, this.INPUT_SIZE, this.INPUT_SIZE);
  }

  /**
   * Preprocess face image for anti-spoofing model
   * @param faceImageData - Face image data from canvas
   * @returns Preprocessed tensor data
   */
  private preprocessFaceImage(faceImageData: ImageData): ort.Tensor {
    const { width, height } = faceImageData;
    
    // Create canvas for resizing
    const canvas = new OffscreenCanvas(128, 128);
    const ctx = canvas.getContext('2d')!;
    
    // Create ImageData and draw to canvas
    const sourceCanvas = new OffscreenCanvas(width, height);
    const sourceCtx = sourceCanvas.getContext('2d')!;
    sourceCtx.putImageData(faceImageData, 0, 0);
    
    // Resize to exactly 128x128 with proper interpolation
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, 128, 128);
    
    // Get resized image data
    const resizedImageData = ctx.getImageData(0, 0, 128, 128);
    const resizedData = resizedImageData.data;
    
    // Convert to RGB and normalize to [0, 1] range (standard for most models)
    const tensorData = new Float32Array(3 * 128 * 128);
    
    for (let i = 0; i < 128 * 128; i++) {
      const pixelIndex = i * 4;
      
      // Extract RGB values
      const r = resizedData[pixelIndex];
      const g = resizedData[pixelIndex + 1];
      const b = resizedData[pixelIndex + 2];
      
      // Normalize to [0, 1] and arrange in CHW format
      tensorData[i] = r / 255.0;                    // R channel
      tensorData[128 * 128 + i] = g / 255.0;        // G channel
      tensorData[2 * 128 * 128 + i] = b / 255.0;    // B channel
    }
    
    return new ort.Tensor('float32', tensorData, [1, 3, this.INPUT_SIZE, this.INPUT_SIZE]);
  }


  setThreshold(threshold: number): void {
    this.threshold = Math.max(0, Math.min(1, threshold));
  }

  getThreshold(): number {
    return this.threshold;
  }

  getStats() {
    return {
      frameCount: this.frameCount,
      threshold: this.threshold,
      inputSize: this.INPUT_SIZE,
    };
  }

  dispose(): void {
    if (this.session) {
      // Explicitly dispose to free WASM memory
      if (typeof (this.session as unknown as { dispose?: () => void }).dispose === 'function') {
        (this.session as unknown as { dispose: () => void }).dispose();
      }
      this.session = null;
    }
  }
}
