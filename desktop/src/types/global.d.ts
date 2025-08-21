export {}

declare global {
  interface SuriWSClientAPI {
    connect: (url?: string) => Promise<void>
    send: (msg: unknown) => void
    sendRequest: (action: string, payload?: unknown, timeoutMs?: number) => Promise<unknown>
    onMessage: (handler: (msg: Record<string, unknown>) => void) => () => void
    close: () => void
  }

  interface SuriVideoAPI {
    start: (opts?: { device?: number; width?: number; height?: number; fps?: number; annotate?: boolean }) => Promise<boolean>
    startFast: (opts?: { device?: number; width?: number; height?: number; fps?: number; annotate?: boolean }) => Promise<boolean>
    stop: () => Promise<boolean>
    pause: () => Promise<boolean>
    resume: () => Promise<boolean>
    setDevice: (device: number) => Promise<boolean>
    onFrame: (handler: (buf: ArrayBuffer | Uint8Array) => void) => () => void
    onEvent: (handler: (evt: Record<string, unknown>) => void) => () => void
  }

  interface Window {
    suriWS?: SuriWSClientAPI
    suriVideo?: SuriVideoAPI
    __suriOffFrame?: () => void
  }
}
