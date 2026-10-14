'use client'

import React, { useState, useEffect } from 'react'

export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Gagal masuk fullscreen mode:', err)
      })
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }

  return (
    <button
      onClick={toggleFullscreen}
      className="fixed top-4 right-4 z-50 w-10 h-10 sm:w-11 sm:h-11 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-full shadow-md hover:shadow-lg border border-white flex items-center justify-center transition-all cursor-pointer select-none active:scale-95"
      title={isFullscreen ? 'Keluar Fullscreen' : 'Layar Penuh (Fullscreen)'}
      aria-label="Fullscreen"
    >
      <span className="text-lg sm:text-xl font-bold leading-none">
        {isFullscreen ? '✕' : '⛶'}
      </span>
    </button>
  )
}
