import { useEffect, useState } from 'react'

interface ModelLoadingState {
  modelsReady: boolean
  isChecking: boolean
}

/**
 * Custom hook to check if backend server is ready
 * All AI models are loaded on the server side, not in Electron
 */
export function useModelLoading(): ModelLoadingState {
  const [modelsReady, setModelsReady] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Check if backend server is ready
    const checkBackendReady = async () => {
      try {
        if (window.electronAPI && 'backend_ready' in window.electronAPI) {
          const ready = await window.electronAPI.backend_ready.isReady()
          setModelsReady(ready || false)
          setIsChecking(false)
        } else {
          setModelsReady(false)
          setIsChecking(false)
        }
      } catch (error) {
        console.error('Failed to check backend readiness:', error)
        // If check fails, assume not ready and show loading screen
        setModelsReady(false)
        setIsChecking(false)
      }
    }

    // Initial check
    checkBackendReady()

    // Poll backend readiness every 500ms until ready
    const pollInterval = setInterval(() => {
      if (!modelsReady) {
        checkBackendReady()
      }
    }, 500)

    return () => {
      clearInterval(pollInterval)
    }
  }, [modelsReady])

  return { modelsReady, isChecking }
}
