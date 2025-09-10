/**
 * Face cropping and alignment utilities for anti-spoofing preprocessing
 */

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceLandmarks {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  nose: { x: number; y: number };
  leftMouth: { x: number; y: number };
  rightMouth: { x: number; y: number };
}

/**
 * Crop face region from image with padding
 * @param imageData - Source image data
 * @param faceBox - Face bounding box from SCRFD
 * @param padding - Padding factor (0.3 = 30% padding)
 * @returns Cropped face image data
 */
export function cropFaceRegion(
  imageData: ImageData,
  faceBox: FaceBox,
  padding: number = 0.3
): ImageData {
  const { width: imgWidth, height: imgHeight, data } = imageData;
  
  // Calculate padded bounding box
  const padX = faceBox.width * padding;
  const padY = faceBox.height * padding;
  
  const cropX = Math.max(0, Math.floor(faceBox.x - padX));
  const cropY = Math.max(0, Math.floor(faceBox.y - padY));
  const cropWidth = Math.min(
    imgWidth - cropX,
    Math.ceil(faceBox.width + 2 * padX)
  );
  const cropHeight = Math.min(
    imgHeight - cropY,
    Math.ceil(faceBox.height + 2 * padY)
  );
  
  // Create cropped image data
  const croppedData = new Uint8ClampedArray(cropWidth * cropHeight * 4);
  
  for (let y = 0; y < cropHeight; y++) {
    for (let x = 0; x < cropWidth; x++) {
      const srcX = cropX + x;
      const srcY = cropY + y;
      
      if (srcX < imgWidth && srcY < imgHeight) {
        const srcIndex = (srcY * imgWidth + srcX) * 4;
        const dstIndex = (y * cropWidth + x) * 4;
        
        croppedData[dstIndex] = data[srcIndex];     // R
        croppedData[dstIndex + 1] = data[srcIndex + 1]; // G
        croppedData[dstIndex + 2] = data[srcIndex + 2]; // B
        croppedData[dstIndex + 3] = data[srcIndex + 3]; // A
      }
    }
  }
  
  return new ImageData(croppedData, cropWidth, cropHeight);
}

/**
 * Align face based on eye positions (if landmarks are available)
 * @param imageData - Face image data
 * @param landmarks - Face landmarks (optional)
 * @returns Aligned face image data
 */
export function alignFace(
  imageData: ImageData,
  landmarks?: FaceLandmarks
): ImageData {
  if (!landmarks) {
    // No landmarks available, return original
    return imageData;
  }
  
  const { width, height, data } = imageData;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  
  // Calculate rotation angle based on eye positions
  const eyeCenter = {
    x: (landmarks.leftEye.x + landmarks.rightEye.x) / 2,
    y: (landmarks.leftEye.y + landmarks.rightEye.y) / 2
  };
  
  const deltaX = landmarks.rightEye.x - landmarks.leftEye.x;
  const deltaY = landmarks.rightEye.y - landmarks.leftEye.y;
  const angle = Math.atan2(deltaY, deltaX);
  
  // Only apply rotation if angle is significant (> 5 degrees)
  if (Math.abs(angle) > 0.087) { // 5 degrees in radians
    // Create source image
    const sourceImageData = new ImageData(data, width, height);
    ctx.putImageData(sourceImageData, 0, 0);
    
    // Apply rotation around eye center
    ctx.translate(eyeCenter.x, eyeCenter.y);
    ctx.rotate(-angle); // Negative to correct the rotation
    ctx.translate(-eyeCenter.x, -eyeCenter.y);
    
    // Redraw the image
    ctx.drawImage(canvas, 0, 0);
  } else {
    // No significant rotation needed
    const sourceImageData = new ImageData(data, width, height);
    ctx.putImageData(sourceImageData, 0, 0);
  }
  
  // Get aligned image data
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Convert SCRFD detection result to FaceBox format
 * @param detection - SCRFD detection result
 * @returns FaceBox object
 */
export function scrfdToFaceBox(detection: number[] | [number, number, number, number]): FaceBox {
  // SCRFD typically returns [x1, y1, x2, y2, confidence]
  const [x1, y1, x2, y2] = detection;
  
  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1
  };
}

/**
 * Convert SCRFD landmarks to FaceLandmarks format (if available)
 * @param landmarks - SCRFD landmarks array
 * @returns FaceLandmarks object or undefined
 */
export function scrfdToFaceLandmarks(landmarks?: number[]): FaceLandmarks | undefined {
  if (!landmarks || landmarks.length < 10) {
    return undefined;
  }
  
  // SCRFD landmarks format: [x1, y1, x2, y2, x3, y3, x4, y4, x5, y5]
  // Typically: left_eye, right_eye, nose, left_mouth, right_mouth
  return {
    leftEye: { x: landmarks[0], y: landmarks[1] },
    rightEye: { x: landmarks[2], y: landmarks[3] },
    nose: { x: landmarks[4], y: landmarks[5] },
    leftMouth: { x: landmarks[6], y: landmarks[7] },
    rightMouth: { x: landmarks[8], y: landmarks[9] }
  };
}

/**
 * Ensure face region is roughly square for better anti-spoofing performance
 * @param imageData - Face image data
 * @returns Square face image data
 */
export function makeSquareFace(imageData: ImageData): ImageData {
  const { width, height } = imageData;
  
  if (width === height) {
    return imageData; // Already square
  }
  
  const size = Math.max(width, height);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  
  // Fill with black background
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);
  
  // Create source canvas
  const sourceCanvas = new OffscreenCanvas(width, height);
  const sourceCtx = sourceCanvas.getContext('2d')!;
  sourceCtx.putImageData(imageData, 0, 0);
  
  // Center the face in the square
  const offsetX = (size - width) / 2;
  const offsetY = (size - height) / 2;
  
  ctx.drawImage(sourceCanvas, offsetX, offsetY);
  
  return ctx.getImageData(0, 0, size, size);
}

/**
 * Complete face preprocessing pipeline for anti-spoofing
 * @param imageData - Source image
 * @param detection - SCRFD detection result
 * @param landmarks - SCRFD landmarks (optional)
 * @returns Preprocessed face image ready for anti-spoofing
 */
export function preprocessFaceForAntiSpoofing(
  imageData: ImageData,
  detection: number[] | [number, number, number, number],
  landmarks?: number[]
): ImageData {
  // Step 1: Convert detection to face box
  const faceBox = scrfdToFaceBox(detection);
  
  // Step 2: Crop face region with padding
  let faceImage = cropFaceRegion(imageData, faceBox, 0.3);
  
  // Step 3: Align face if landmarks are available
  const faceLandmarks = scrfdToFaceLandmarks(landmarks);
  if (faceLandmarks) {
    faceImage = alignFace(faceImage, faceLandmarks);
  }
  
  // Step 4: Make face region square for consistent input
  faceImage = makeSquareFace(faceImage);
  
  return faceImage;
}