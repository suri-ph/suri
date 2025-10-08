import { app, BrowserWindow, ipcMain, protocol } from "electron"
import path from "path"
import { fileURLToPath } from 'node:url'
import isDev from "./util.js";
import { readFile } from 'fs/promises';
import { backendService, type DetectionOptions } from './backendService.js';

// Pre-loaded model buffers for better performance
const modelBuffers: Map<string, ArrayBuffer> = new Map();
// Set consistent app name across all platforms for userData directory
app.setName('Suri');

// Dynamic GPU configuration - works on both old and new hardware
// Enable modern GPU features for capable hardware, graceful fallback for old GPUs

// Always try modern GPU features first (for new laptops)
app.commandLine.appendSwitch('enable-features', 'Vulkan,UseSkiaRenderer')
app.commandLine.appendSwitch('enable-webgl')
app.commandLine.appendSwitch('enable-webgl2-compute-context')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('ignore-gpu-blacklist') // Legacy support
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')

// Add graceful fallback options for old hardware
app.commandLine.appendSwitch('enable-unsafe-swiftshader') // Software WebGL fallback
app.commandLine.appendSwitch('use-gl', 'any') // Try any available GL implementation

// Platform-specific optimizations
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('use-angle', 'default') // Let ANGLE choose best backend
}

// Enable logging for debugging (commented out GPU error suppression)
// app.commandLine.appendSwitch('disable-logging')
// app.commandLine.appendSwitch('log-level', '3') // Only show fatal errors

let mainWindowRef: BrowserWindow | null = null
// Removed legacy scrfdService usage
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Backend Service Management
async function startBackend(): Promise<void> {
    try {
        await backendService.start();
    } catch (error) {
        console.error('Failed to start backend service:', error);
        throw error;
    }
}

function stopBackend(): void {
    backendService.stop().catch(error => {
        console.error('Error stopping backend service:', error);
    });
}

// Face Recognition Pipeline IPC handlers
// Removed legacy face-recognition IPC; detection/recognition handled in renderer via Web Workers

// Backend Service IPC handlers for FastAPI integration
ipcMain.handle('backend:check-availability', async () => {
    try {
        return await backendService.checkAvailability();
    } catch (error) {
        return { available: false, error: error instanceof Error ? error.message : String(error) };
    }
});

ipcMain.handle('backend:check-readiness', async () => {
    try {
        return await backendService.checkReadiness();
    } catch (error) {
        return { ready: false, modelsLoaded: false, error: error instanceof Error ? error.message : String(error) };
    }
});

ipcMain.handle('backend:get-models', async () => {
    try {
        return await backendService.getModels();
    } catch (error) {
        throw new Error(`Failed to get models: ${error instanceof Error ? error.message : String(error)}`);
    }
});

ipcMain.handle('backend:detect-faces', async (_event, imageBase64: string, options: DetectionOptions = {}) => {
    try {
        return await backendService.detectFaces(imageBase64, options);
    } catch (error) {
        throw new Error(`Face detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
});

// Real-time detection with binary support (IPC replacement for WebSocket)
ipcMain.handle('backend:detect-stream', async (_event, imageData: ArrayBuffer | string, options: {
    model_type?: string;
    nms_threshold?: number;
    enable_antispoofing?: boolean;
    frame_timestamp?: number;
} = {}) => {
    try {
        const url = `${backendService.getUrl()}/detect`;
        
        let imageBase64: string;
        if (imageData instanceof ArrayBuffer) {
            // Convert ArrayBuffer to base64
            const bytes = new Uint8Array(imageData);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            imageBase64 = Buffer.from(binary, 'binary').toString('base64');
        } else {
            imageBase64 = imageData;
        }

        const requestBody = {
            image: imageBase64,
            model_type: options.model_type || 'yunet',
            confidence_threshold: 0.6,
            nms_threshold: options.nms_threshold || 0.3,
            enable_antispoofing: options.enable_antispoofing !== undefined ? options.enable_antispoofing : true
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        return {
            type: 'detection_response',
            faces: result.faces || [],
            model_used: result.model_used || 'yunet',
            processing_time: result.processing_time || 0,
            timestamp: Date.now(),
            frame_timestamp: options.frame_timestamp || Date.now(),
            success: result.success !== undefined ? result.success : true
        };
    } catch (error) {
        console.error('Stream detection failed:', error);
        return {
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
            timestamp: Date.now()
        };
    }
});

// Face recognition via IPC
ipcMain.handle('backend:recognize-face', async (_event, imageData: string, bbox: number[], groupId?: string) => {
    try {
        const url = `${backendService.getUrl()}/face/recognize`;
        
        const requestBody = {
            image: imageData,
            bbox: bbox,
            group_id: groupId
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Face recognition failed:', error);
        return {
            success: false,
            person_id: null,
            similarity: 0.0,
            processing_time: 0,
            error: error instanceof Error ? error.message : String(error)
        };
    }
});

// Face registration via IPC
ipcMain.handle('backend:register-face', async (_event, imageData: string, personId: string, bbox: number[], groupId?: string) => {
    try {
        const url = `${backendService.getUrl()}/face/register`;
        
        const requestBody = {
            image: imageData,
            person_id: personId,
            bbox: bbox,
            group_id: groupId
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Face registration failed:', error);
        return {
            success: false,
            person_id: personId,
            total_persons: 0,
            processing_time: 0,
            error: error instanceof Error ? error.message : String(error)
        };
    }
});

// Get face database stats via IPC
ipcMain.handle('backend:get-face-stats', async () => {
    try {
        const url = `${backendService.getUrl()}/face/stats`;
        
        const response = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Get face stats failed:', error);
        throw error;
    }
});

// Remove person via IPC
ipcMain.handle('backend:remove-person', async (_event, personId: string) => {
    try {
        const url = `${backendService.getUrl()}/face/person/${encodeURIComponent(personId)}`;
        
        const response = await fetch(url, {
            method: 'DELETE',
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Remove person failed:', error);
        throw error;
    }
});

// Update person via IPC
ipcMain.handle('backend:update-person', async (_event, oldPersonId: string, newPersonId: string) => {
    try {
        const url = `${backendService.getUrl()}/face/person`;
        
        const requestBody = {
            old_person_id: oldPersonId,
            new_person_id: newPersonId
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Update person failed:', error);
        throw error;
    }
});

// Get all persons via IPC
ipcMain.handle('backend:get-all-persons', async () => {
    try {
        const url = `${backendService.getUrl()}/face/persons`;
        
        const response = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Get all persons failed:', error);
        throw error;
    }
});

// Set similarity threshold via IPC
ipcMain.handle('backend:set-threshold', async (_event, threshold: number) => {
    try {
        const url = `${backendService.getUrl()}/face/threshold`;
        
        const requestBody = {
            threshold: threshold
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Set threshold failed:', error);
        throw error;
    }
});

// Clear face database via IPC
ipcMain.handle('backend:clear-database', async () => {
    try {
        const url = `${backendService.getUrl()}/face/database`;
        
        const response = await fetch(url, {
            method: 'DELETE',
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Clear database failed:', error);
        throw error;
    }
});

// Window control IPC handlers
ipcMain.handle('window:minimize', () => {
    if (mainWindowRef) mainWindowRef.minimize()
    return true
})

ipcMain.handle('window:maximize', () => {
    if (mainWindowRef) {
        if (mainWindowRef.isMaximized()) {
            mainWindowRef.unmaximize()
        } else {
            mainWindowRef.maximize()
        }
    }
    return true
})

ipcMain.handle('window:close', () => {
    if (mainWindowRef) mainWindowRef.close()
    return true
})

// Pre-load all models during app startup
async function preloadModels(): Promise<void> {
  // Only preload models that are actually used in the current pipeline
  // Based on backend/main.py startup configuration:
  // - YuNet for face detection
  // - AntiSpoof for liveness detection
  // - FaceMesh for landmark detection and alignment
  // - EdgeFace for face recognition
  const modelNames = [
    'face_detection_yunet_2023mar.onnx',
    'AntiSpoofing_print-replay_1.5_128.onnx',
    'face_mesh_Nx3x192x192_post.onnx',
    'edgeface-recognition-xs.onnx'
  ];
  
  try {
    console.log('[Main] Starting model preloading...');
    let loadedCount = 0;
    
    for (const modelName of modelNames) {
      const modelPath = isDev()
        ? path.join(__dirname, '../../public/weights', modelName)
        : path.join(process.resourcesPath, 'weights', modelName);
      
      console.log(`[Main] Loading model: ${modelName}`);
      const buffer = await readFile(modelPath);
      const arrayBuffer = new ArrayBuffer(buffer.byteLength);
      new Uint8Array(arrayBuffer).set(new Uint8Array(buffer));
      modelBuffers.set(modelName, arrayBuffer);
      
      loadedCount++;
      const progress = (loadedCount / modelNames.length) * 100;
      console.log(`[Main] Loaded ${loadedCount}/${modelNames.length} models (${progress.toFixed(0)}%)`);
      
      // Notify renderer process of loading progress
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('model-loading-progress', {
          current: loadedCount,
          total: modelNames.length,
          modelName,
          progress
        });
      }
    }
    
    console.log('[Main] ✅ All models preloaded successfully!');
  } catch (error) {
    console.error('❌ Failed to pre-load models:', error);
    throw error;
  }
}

// Model loading IPC handlers - now returns pre-loaded buffers
ipcMain.handle('model:load', async (_event, modelName: string) => {
  const buffer = modelBuffers.get(modelName);
  if (!buffer) {
    throw new Error(`Model ${modelName} not found in pre-loaded cache`);
  }
  return buffer;
});

// Get all pre-loaded model buffers (for worker initialization)
ipcMain.handle('models:get-all', async () => {
  const result: Record<string, ArrayBuffer> = {};
  for (const [name, buffer] of modelBuffers.entries()) {
    result[name] = buffer;
  }
  return result;
});

// Check if models are ready
ipcMain.handle('models:is-ready', async () => {
  return modelBuffers.size > 0;
});

function createWindow(): void {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webgl: true,
        },
        titleBarStyle: 'hidden',
        transparent: true
    })

    mainWindowRef = mainWindow

    // Create rounded window shape
    const createShape = (width: number, height: number) => {
        const radius = 4 // corner radius
        const shapes = []
        
        for (let y = 0; y < height; y++) {
            let startX = 0
            let endX = width

            // Top-left corner
            if (y < radius) {
                const offset = Math.ceil(radius - Math.sqrt(radius * radius - (radius - y) * (radius - y)))
                startX = offset
            }

            // Top-right corner
            if (y < radius) {
                const offset = Math.ceil(radius - Math.sqrt(radius * radius - (radius - y) * (radius - y)))
                endX = width - offset
            }

            // Bottom-left corner
            if (y >= height - radius) {
                const offset = Math.ceil(radius - Math.sqrt(radius * radius - (y - (height - radius)) * (y - (height - radius))))
                startX = offset
            }

            // Bottom-right corner
            if (y >= height - radius) {
                const offset = Math.ceil(radius - Math.sqrt(radius * radius - (y - (height - radius)) * (y - (height - radius))))
                endX = width - offset
            }

            if (endX > startX) {
                shapes.push({ x: startX, y, width: endX - startX, height: 1 })
            }
        }
        
        return shapes
    }

    // Function to update window shape
    const updateWindowShape = () => {
        if (process.platform === 'win32') {
            try {
                const { width, height } = mainWindow.getBounds()
                mainWindow.setShape(createShape(width, height))
            } catch (error) {
                console.warn('Could not set window shape:', error)
            }
        }
    }

    // Load the app
    if (isDev()) {
        mainWindow.loadURL('http://localhost:3000')
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist-react/index.html'))
    }

    // Set rounded window shape after window is ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
        if (process.platform === 'win32') {
            try {
                const { width, height } = mainWindow.getBounds()
                mainWindow.setShape(createShape(width, height))
            } catch (error) {
                console.warn('Could not set window shape:', error)
            }
        }
    })

    // Handle window maximize/restore events
    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window:maximized')
        mainWindow.setResizable(false)
        // Reset shape when maximized (rectangular)
        if (process.platform === 'win32') {
            try {
                mainWindow.setShape([])
            } catch (error) {
                console.warn('Could not reset window shape:', error)
            }
        }
    })

    mainWindow.on('unmaximize', () => {
        mainWindow.setResizable(true)
        mainWindow.webContents.send('window:unmaximized')
        // Restore rounded shape when unmaximized
        setTimeout(updateWindowShape, 100)
    })
    
    // Update shape on resize
    mainWindow.on('resize', () => {
        if (!mainWindow.isMaximized()) {
            updateWindowShape()
        }
    })

    // Handle window close
    mainWindow.on('closed', () => {
        mainWindowRef = null
    })
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,  // 👈 allow fetch() to use app://
      corsEnabled: true,
      stream: true
    },
  },
]);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
    // Register custom protocol for direct static file access
    protocol.registerFileProtocol('app', (request, callback) => {
        const url = request.url.replace('app://', ''); // Remove 'app://' prefix
        const filePath = isDev()
            ? path.join(__dirname, '../../public', url)
            : path.join(process.resourcesPath, url);
        callback(filePath);
    });
    
    createWindow()
    
    // Start backend service
    console.log('[Main] Starting backend service...');
    try {
        await startBackend();
        console.log('[Main] Backend service started successfully!');
    } catch (error) {
        console.error('[ERROR] Failed to start backend service:', error);
    }
    
    // Pre-load models for optimal performance
    console.log('[Main] Pre-loading models...');
    try {
        await preloadModels();
        console.log('[Main] Models pre-loaded successfully!');
    } catch (error) {
        console.error('[ERROR] Failed to pre-load models:', error);
    }

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// Handle app quit
app.on('before-quit', () => {
    // Clean up resources
    stopBackend();
})