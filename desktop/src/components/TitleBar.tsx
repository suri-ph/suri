import { useState, useEffect } from 'react'

interface TitleBarProps {
  title?: string
}

export default function TitleBar({ title = 'SURI' }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // Listen for window state changes
    const handleMaximize = () => setIsMaximized(true)
    const handleUnmaximize = () => setIsMaximized(false)

    let cleanupMaximize: (() => void) | undefined
    let cleanupUnmaximize: (() => void) | undefined

    if (window.suriElectron) {
      cleanupMaximize = window.suriElectron.onMaximize(handleMaximize)
      cleanupUnmaximize = window.suriElectron.onUnmaximize(handleUnmaximize)
    }

    return () => {
      if (cleanupMaximize) cleanupMaximize()
      if (cleanupUnmaximize) cleanupUnmaximize()
    }
  }, [])

  const handleMinimize = () => {
    if (window.suriElectron) {
      window.suriElectron.minimize()
    }
  }

  const handleMaximize = () => {
    if (window.suriElectron) {
      window.suriElectron.maximize()
    }
  }

  const handleClose = () => {
    if (window.suriElectron) {
      window.suriElectron.close()
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-8 bg-black/90 backdrop-blur-xl border-b border-white/[0.05] flex items-center justify-between px-4 select-none">
      {/* Drag Region - Left Side */}
      <div className="flex items-center space-x-3 flex-1">
        <div className="w-3 h-3 rounded-full bg-white/20"></div>
        <span className="text-xs text-white/60 font-light tracking-wider uppercase">
          {title}
        </span>
      </div>

      {/* Window Controls - Right Side */}
      <div className="flex items-center space-x-1">
        <button
          onClick={handleMinimize}
          className="w-12 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.05] transition-all duration-200 group"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
          </svg>
        </button>

        <button
          onClick={handleMaximize}
          className="w-12 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.05] transition-all duration-200 group"
        >
          {isMaximized ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0l5.25 5.25M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15m-11.25 5.25h4.5m-4.5 0v-4.5m0 4.5L9 15" />
            </svg>
          )}
        </button>

        <button
          onClick={handleClose}
          className="w-12 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-red-500/20 transition-all duration-200 group"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
