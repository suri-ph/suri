import { useState, useEffect } from 'react'

export default function WindowBar() {
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
      className="z-60 absolute top-0 w-full h-auto bg-gradient-surface backdrop-blur-xl flex items-center justify-between select-none flex-shrink-0 border-b border-white/[0.08]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center ml-3 space-x-2 flex-1">
        <div className="text-white text-sm font-medium">SURI <span className="text-white/70 text-xs">- AI Vision</span></div>
      </div>

      <div 
        className="flex items-center [webkit-app-region:no-drag]"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="w-15 h-11 flex items-center justify-center text-white/40 hover:bg-white/10 transition-all duration-200 border-none bg-transparent p-0 rounded"
        >
          <i className="fas fa-window-minimize text-[12px] pb-1.5"></i>
        </button>

        <button
          onClick={handleMaximize}
          className="w-15 h-11 flex items-center justify-center text-white/40 hover:bg-white/10 transition-all duration-200 border-none bg-transparent p-0 rounded"
        >
            {isMaximized ? (
              <i className="far fa-window-restore text-[13px]"></i>
            ) : (
              <i className="far fa-square text-[13px]"></i>
            )}
        </button>

        <button
          onClick={handleClose}
          className="w-15 h-11 flex items-center justify-center text-white/40 hover:bg-red-500/90 hover:text-white bg-transparent transition-all duration-200 border-none p-0 rounded"
        >
          <i className="fa fa-times text-[16px]"></i>
        </button>
      </div>
    </div>
  )
}
