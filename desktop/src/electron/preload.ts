import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('suriVideo', {
    start: async (opts?: { device?: number; width?: number; height?: number; fps?: number; annotate?: boolean }) => {
        return ipcRenderer.invoke('video:start', opts)
    },
    startFast: async (opts?: { device?: number; width?: number; height?: number; fps?: number; annotate?: boolean }) => {
        return ipcRenderer.invoke('video:start-fast', opts)
    },
    stop: async () => {
        return ipcRenderer.invoke('video:stop')
    },
    pause: async () => {
        return ipcRenderer.invoke('video:pause')
    },
    resume: async () => {
        return ipcRenderer.invoke('video:resume')
    },
    setDevice: async (device: number) => {
        return ipcRenderer.invoke('video:setDevice', device)
    },
    onFrame: (handler: (buf: ArrayBuffer | Uint8Array) => void) => {
        const listener = (_: Electron.IpcRendererEvent, data: ArrayBuffer | Uint8Array) => handler(data)
        ipcRenderer.on('video:frame', listener)
        return () => {
            ipcRenderer.removeListener('video:frame', listener)
        }
    },
    onEvent: (handler: (evt: Record<string, unknown>) => void) => {
        const listener = (_: Electron.IpcRendererEvent, data: Record<string, unknown>) => handler(data)
        ipcRenderer.on('video:event', listener)
        return () => {
            ipcRenderer.removeListener('video:event', listener)
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

// Signal to main that preload is ready
ipcRenderer.send('preload-ready')
