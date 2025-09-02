import { contextBridge, ipcRenderer } from 'electron'

// Face Recognition API
contextBridge.exposeInMainWorld('electronAPI', {
    initializeFaceRecognition: (options?: { similarityThreshold?: number }) => {
        return ipcRenderer.invoke('face-recognition:initialize', options)
    },
    processFrame: (imageData: ImageData) => {
        return ipcRenderer.invoke('face-recognition:process-frame', imageData)
    },
    registerPerson: (personId: string, imageData: ImageData, landmarks: number[][]) => {
        return ipcRenderer.invoke('face-recognition:register-person', personId, imageData, landmarks)
    },
    getAllPersons: () => {
        return ipcRenderer.invoke('face-recognition:get-persons')
    },
    removePerson: (personId: string) => {
        return ipcRenderer.invoke('face-recognition:remove-person', personId)
    }
})

// Window control functions
contextBridge.exposeInMainWorld('suriElectron', {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    onMaximize: (callback: () => void) => {
        const listener = () => callback()
        ipcRenderer.on('window:maximized', listener)
        return () => ipcRenderer.removeListener('window:maximized', listener)
    },
    onUnmaximize: (callback: () => void) => {
        const listener = () => callback()
        ipcRenderer.on('window:unmaximized', listener)
        return () => ipcRenderer.removeListener('window:unmaximized', listener)
    }
})


