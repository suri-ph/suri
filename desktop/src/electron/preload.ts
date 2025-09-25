import { contextBridge, ipcRenderer } from 'electron'

// Backend API
contextBridge.exposeInMainWorld('electronAPI', {
    // Face Recognition Database API (File-based)
    saveFaceDatabase: (databaseData: Record<string, number[]>) => {
        return ipcRenderer.invoke('face-recognition:save-database', databaseData)
    },
    loadFaceDatabase: () => {
        return ipcRenderer.invoke('face-recognition:load-database')
    },
    removeFacePerson: (personId: string) => {
        return ipcRenderer.invoke('face-recognition:remove-person', personId)
    },
    getAllFacePersons: () => {
        return ipcRenderer.invoke('face-recognition:get-all-persons')
    },
    // Generic IPC invoke method
    invoke: (channel: string, ...args: unknown[]) => {
        return ipcRenderer.invoke(channel, ...args)
    },
    // Backend Service API
    backend: {
        checkAvailability: () => {
            return ipcRenderer.invoke('backend:check-availability')
        },
        checkReadiness: () => {
            return ipcRenderer.invoke('backend:check-readiness')
        },
        getModels: () => {
            return ipcRenderer.invoke('backend:get-models')
        },
        detectFaces: (imageBase64: string, options?: { threshold?: number; max_faces?: number }) => {
            return ipcRenderer.invoke('backend:detect-faces', imageBase64, options)
        }
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