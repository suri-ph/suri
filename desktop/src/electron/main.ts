import { app, BrowserWindow, ipcMain, protocol } from "electron"
import path from "path"
import { fileURLToPath } from 'node:url'
import isDev from "./util.js";
import { readFile } from 'fs/promises';
import { PythonShell } from 'python-shell';


// Pre-loaded model buffers for better performance
const modelBuffers: Map<string, ArrayBuffer> = new Map();
// Legacy SCRFD service (node-onnx) is unused now; using WebWorker-based pipeline in renderer
import { setupFaceLogIPC } from "./faceLogIPC.js";
import { faceDatabase } from "../services/FaceDatabase.js";
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

// Suppress GPU process errors for old hardware (cosmetic fix)
app.commandLine.appendSwitch('disable-logging')
app.commandLine.appendSwitch('log-level', '3') // Only show fatal errors

let mainWindowRef: BrowserWindow | null = null
let pythonBackend: PythonShell | null = null
let backendPort = 8001
// Removed legacy scrfdService usage
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Python Backend Service Management
async function startPythonBackend(): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            // Get the backend directory path
            const backendPath = isDev() 
                ? path.join(__dirname, '..', '..', '..', 'backend')
                : path.join(process.resourcesPath, 'backend');
            
            console.log('Starting Python backend from:', backendPath);
            
            // Start Python backend
            pythonBackend = new PythonShell('run.py', {
                scriptPath: backendPath,
                pythonOptions: ['-u'], // Unbuffered output
                args: ['--port', backendPort.toString()],
                pythonPath: 'python' // Use system Python
            });

            // Handle Python backend messages
            pythonBackend.on('message', (message) => {
                console.log('[Python Backend]:', message);
                if (message.includes('Uvicorn running on') || message.includes('Application startup complete')) {
                    resolve();
                }
            });

            pythonBackend.on('error', (error) => {
                console.error('[Python Backend Error]:', error);
                reject(error);
            });

            pythonBackend.on('stderr', (stderr) => {
                console.error('[Python Backend stderr]:', stderr);
                // Also check stderr for startup completion messages
                if (stderr.includes('Uvicorn running on') || stderr.includes('Application startup complete')) {
                    resolve();
                }
            });

            pythonBackend.on('close', (code: number | null, signal: string | null) => {
                console.log(`Python Backend closed with code: ${code}, signal: ${signal}`);
                pythonBackend = null;
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (pythonBackend) {
                    reject(new Error('Python backend startup timeout'));
                }
            }, 30000);

        } catch (error) {
            reject(error);
        }
    });
}

function stopPythonBackend(): void {
    if (pythonBackend) {
        console.log('Stopping Python backend...');
        pythonBackend.kill();
        pythonBackend = null;
    }
}

// Face Recognition Pipeline IPC handlers
// Removed legacy face-recognition IPC; detection/recognition handled in renderer via Web Workers

// Backend Service IPC handlers for FastAPI integration
ipcMain.handle('backend:check-availability', async () => {
    try {
        // Check if embedded Python backend is running
        if (!pythonBackend) {
            return { available: false, error: 'Python backend not started' };
        }
        
        const response = await fetch(`http://127.0.0.1:${backendPort}/`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        return { available: response.ok, status: response.status };
    } catch (error) {
        return { available: false, error: error instanceof Error ? error.message : String(error) };
    }
});

ipcMain.handle('backend:get-models', async () => {
    try {
        const response = await fetch(`http://127.0.0.1:${backendPort}/models`, {
            method: 'GET',
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        throw new Error(`Failed to get models: ${error instanceof Error ? error.message : String(error)}`);
    }
});

ipcMain.handle('backend:detect-faces', async (_event, imageBase64: string, options: any = {}) => {
    try {
        const request = {
            image: imageBase64,
            model_type: options.model_type || 'yunet',
            confidence_threshold: options.confidence_threshold || 0.5,
            nms_threshold: options.nms_threshold || 0.3
        };

        const response = await fetch(`http://127.0.0.1:${backendPort}/detect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        throw new Error(`Face detection failed: ${error instanceof Error ? error.message : String(error)}`);
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
  const modelNames = [
    'det_500m_kps_640.onnx',
    'edgeface-recognition.onnx', 
    'AntiSpoofing_bin_1.5_128.onnx'
  ];
  
  try {
    for (const modelName of modelNames) {
      const modelPath = isDev()
        ? path.join(__dirname, '../../public/weights', modelName)
        : path.join(process.resourcesPath, 'weights', modelName);
      
      const buffer = await readFile(modelPath);
      const arrayBuffer = new ArrayBuffer(buffer.byteLength);
      new Uint8Array(arrayBuffer).set(new Uint8Array(buffer));
      modelBuffers.set(modelName, arrayBuffer);
  
    }
    


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
    
    // Start embedded Python backend
    try {
        await startPythonBackend();
        console.log('[INFO] Python backend started successfully');
    } catch (error) {
        console.error('[ERROR] Failed to start Python backend:', error);
    }
    
    // Pre-load models for optimal performance
    try {
        await preloadModels();
    } catch (error) {
        console.error('[ERROR] Failed to pre-load models:', error);
    }
    
    // Initialize SQLite database first
    try {
        await faceDatabase.initialize();
    
    } catch (error) {
        console.error('[ERROR] Failed to initialize SQLite3 database:', error);
    }
    
    // Setup database IPC handlers
    setupFaceLogIPC()

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
    stopPythonBackend();
})