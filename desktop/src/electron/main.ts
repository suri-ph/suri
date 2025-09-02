import { app, BrowserWindow, ipcMain } from "electron"
import path from "path"
import { fileURLToPath } from 'node:url'
import isDev from "./util.js";
import { FaceRecognitionPipeline } from "../services/FaceRecognitionPipeline.js";

let mainWindowRef: BrowserWindow | null = null
let faceRecognitionPipeline: FaceRecognitionPipeline | null = null
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Face Recognition Pipeline IPC handlers
ipcMain.handle('face-recognition:initialize', async (_evt, options) => {
    try {
        if (!faceRecognitionPipeline) {
            faceRecognitionPipeline = new FaceRecognitionPipeline()
        }
        return { success: true, message: 'Pipeline initialized successfully' }
    } catch (error) {
        console.error('Failed to initialize face recognition pipeline:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('face-recognition:process-frame', async (_evt, imageData) => {
    try {
        if (!faceRecognitionPipeline) {
            throw new Error('Pipeline not initialized')
        }
        
        const startTime = performance.now()
        
        // Process frame through pipeline
        const result = await faceRecognitionPipeline.processFrame(imageData)
        
        return {
            success: true,
            detections: result.detections,
            processingTime: result.processingTime
        }
    } catch (error) {
        console.error('Frame processing error:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('face-recognition:register-person', async (_evt, personId, imageData, landmarks) => {
    try {
        if (!faceRecognitionPipeline) {
            throw new Error('Pipeline not initialized')
        }
        
        const success = await faceRecognitionPipeline.registerPerson(personId, imageData, landmarks)
        return success
    } catch (error) {
        console.error('Person registration error:', error)
        return false
    }
})

ipcMain.handle('face-recognition:get-persons', async () => {
    try {
        if (!faceRecognitionPipeline) {
            return []
        }
        return faceRecognitionPipeline.getAllPersons()
    } catch (error) {
        console.error('Get persons error:', error)
        return []
    }
})

ipcMain.handle('face-recognition:remove-person', async (_evt, personId) => {
    try {
        if (!faceRecognitionPipeline) {
            return false
        }
        return faceRecognitionPipeline.removePerson(personId)
    } catch (error) {
        console.error('Remove person error:', error)
        return false
    }
})

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

function createWindow(): void {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1600,
        height: 1000,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        titleBarStyle: 'hidden',
        frame: false,
        show: false,
        backgroundColor: '#000000'
    })

    mainWindowRef = mainWindow

    // Load the app
    if (isDev()) {
        mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(path.join(__dirname, '../index.html'))
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    // Handle window maximize/restore events
    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window:maximized')
    })

    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window:unmaximized')
    })

    // Handle window close
    mainWindow.on('closed', () => {
        mainWindowRef = null
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    createWindow()

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
    // Clean up face recognition pipeline
    if (faceRecognitionPipeline) {
        faceRecognitionPipeline.dispose()
    }
})