import { useState, useEffect } from 'react'

export default function TitleBar() {
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
    <div 
      className="h-auto bg-black/98 backdrop-blur-xl flex items-center justify-between select-none flex-shrink-0 border-b border-white/[0.02]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Minimal Left Side - Just a subtle indicator */}
      <div className="flex items-center ml-3 space-x-2 flex-1">
        <div className="w-1.5 h-1.5 rounded-full bg-white/30"></div>
        <div className="w-1 h-1 rounded-full bg-white/20"></div>
        <div className="w-0.5 h-0.5 rounded-full bg-white/10"></div>
      </div>

      {/* Ultra-minimal Window Controls */}
      <div 
        className="flex items-center space-x-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="titlebar-btn w-10 h-9 flex items-center justify-center text-white/40 hover:!text-black hover:!bg-white/80 hover:!rounded-none transition-all duration-200"
        >
          <i className="fas fa-window-minimize text-[10px]"></i>
        </button>

        <button
          onClick={handleMaximize}
          className="titlebar-btn w-10 h-9 flex items-center justify-center text-white/40 hover:!text-black hover:!bg-white/80 hover:!rounded-none transition-all duration-200"
        >
          {isMaximized ? (
            <i className="fas fa-window-restore text-[10px]"></i>
          ) : (
            <i className="fas fa-window-maximize text-[10px]"></i>
          )}
        </button>

        <button
          onClick={handleClose}
          className="titlebar-btn w-10 h-9 flex items-center justify-center text-white/40 hover:!text-black hover:!bg-red-500/90 hover:!rounded-none transition-all duration-200"
        >
          <i className="fas fa-times text-[10px]"></i>
        </button>
      </div>
    </div>
  )
}
