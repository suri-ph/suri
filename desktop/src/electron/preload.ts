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
    // Model loading API
    models: {
        isReady: () => {
            return ipcRenderer.invoke('models:is-ready')
        },
        onLoadingProgress: (callback: (data: { current: number; total: number; modelName: string; progress: number }) => void) => {
            const listener = (_event: any, data: any) => callback(data)
            ipcRenderer.on('model-loading-progress', listener)
            return () => ipcRenderer.removeListener('model-loading-progress', listener)
        }
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
        },
        // Real-time detection via IPC (replaces WebSocket)
        detectStream: (imageData: ArrayBuffer | string, options?: {
            model_type?: string;
            nms_threshold?: number;
            enable_antispoofing?: boolean;
            frame_timestamp?: number;
        }) => {
            return ipcRenderer.invoke('backend:detect-stream', imageData, options)
        },
        // Face recognition APIs
        recognizeFace: (imageData: string, bbox: number[], groupId?: string) => {
            return ipcRenderer.invoke('backend:recognize-face', imageData, bbox, groupId)
        },
        registerFace: (imageData: string, personId: string, bbox: number[], groupId?: string) => {
            return ipcRenderer.invoke('backend:register-face', imageData, personId, bbox, groupId)
        },
        getFaceStats: () => {
            return ipcRenderer.invoke('backend:get-face-stats')
        },
        removePerson: (personId: string) => {
            return ipcRenderer.invoke('backend:remove-person', personId)
        },
        updatePerson: (oldPersonId: string, newPersonId: string) => {
            return ipcRenderer.invoke('backend:update-person', oldPersonId, newPersonId)
        },
        getAllPersons: () => {
            return ipcRenderer.invoke('backend:get-all-persons')
        },
        setThreshold: (threshold: number) => {
            return ipcRenderer.invoke('backend:set-threshold', threshold)
        },
        clearDatabase: () => {
            return ipcRenderer.invoke('backend:clear-database')
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