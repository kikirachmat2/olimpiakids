'use client'

import React from 'react'
import { motion } from 'framer-motion'

export default function CloudsBackground() {
  // Awan putih playful dengan float animation yang dinamis & halus
  const clouds = [
    { id: 1, top: '6%', left: '2%', scale: 1.15, duration: 6, delay: 0 },
    { id: 2, top: '14%', right: '3%', scale: 1.25, duration: 6.8, delay: 1.2 },
    { id: 3, top: '54%', left: '3%', scale: 1.0, duration: 5.5, delay: 0.6 },
    { id: 4, top: '76%', right: '4%', scale: 1.2, duration: 6.2, delay: 1.8 },
  ]

  // Bintang kuning berkilau (★ & ✨) di sekeliling - diperbesar signifikan
  const sparkles = [
    { id: 1, top: '4%', left: '5%', text: '★', size: 'text-4xl sm:text-6xl lg:text-7xl', color: 'text-amber-300', dur: 2.2 },
    { id: 2, top: '6%', right: '8%', text: '★', size: 'text-3xl sm:text-5xl lg:text-6xl', color: 'text-yellow-300', dur: 2.8 },
    { id: 3, top: '38%', left: '3.5%', text: '✨', size: 'text-3xl sm:text-5xl lg:text-6xl', color: 'text-yellow-200', dur: 3 },
    { id: 4, top: '44%', right: '3.5%', text: '✨', size: 'text-3xl sm:text-5xl lg:text-6xl', color: 'text-yellow-200', dur: 2.5 },
    { id: 5, bottom: '10%', left: '5%', text: '★', size: 'text-4xl sm:text-6xl lg:text-7xl', color: 'text-amber-300', dur: 2.6 },
    { id: 6, bottom: '8%', right: '5%', text: '★', size: 'text-4xl sm:text-6xl lg:text-7xl', color: 'text-yellow-300', dur: 2.4 },
  ]

  // Aksen mainan & balon anak-anak melayang - diperbesar drastis (balon, bintang, dot, boneka)
  const kidElements = [
    { id: 1, top: '19%', left: '3.5%', icon: '🎈', dur: 7, delay: 0, size: 'text-5xl sm:text-6xl md:text-7xl lg:text-8xl' },
    { id: 2, top: '25%', right: '3.5%', icon: '⭐', dur: 6.5, delay: 1, size: 'text-5xl sm:text-6xl md:text-7xl lg:text-8xl' },
    { id: 3, bottom: '26%', left: '2.5%', icon: '🍼', dur: 7.2, delay: 2, size: 'text-5xl sm:text-6xl md:text-7xl lg:text-8xl' },
    { id: 4, bottom: '20%', right: '2.5%', icon: '🧸', dur: 8, delay: 0.5, size: 'text-5xl sm:text-6xl md:text-7xl lg:text-8xl' },
  ]

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* 1. AWAN PUTIH PLAYFUL ROUNDED */}
      {clouds.map((cloud) => (
        <motion.div
          key={cloud.id}
          className="absolute opacity-80"
          style={{
            top: cloud.top,
            left: cloud.left,
            right: cloud.right,
          }}
          animate={{
            y: [-7, 7, -7],
            x: [-4, 4, -4],
          }}
          transition={{
            duration: cloud.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: cloud.delay,
          }}
        >
          <div
            className="relative bg-white rounded-full w-32 sm:w-52 h-12 sm:h-20 shadow-md drop-shadow-sm"
            style={{ transform: `scale(${cloud.scale})` }}
          >
            <div className="absolute -top-6 sm:-top-10 left-3 sm:left-5 bg-white rounded-full w-14 sm:w-22 h-14 sm:h-22" />
            <div className="absolute -top-8 sm:-top-14 left-10 sm:left-18 bg-white rounded-full w-18 sm:w-28 h-18 sm:h-28" />
            <div className="absolute -top-5 sm:-top-9 right-3 sm:right-6 bg-white rounded-full w-12 sm:w-18 h-12 sm:h-18" />
          </div>
        </motion.div>
      ))}

      {/* 2. ELEMEN MAINAN ANAK-ANAK MENGAMBANG (BALON, BINTANG, BONEKA, DOT) */}
      {kidElements.map((el) => (
        <motion.div
          key={el.id}
          className={`absolute ${el.size} select-none opacity-90 drop-shadow-[0_8px_16px_rgba(0,0,0,0.18)] hover:opacity-100 transition-opacity`}
          style={{
            top: el.top,
            bottom: el.bottom,
            left: el.left,
            right: el.right,
          }}
          animate={{
            y: [-12, 12, -12],
            rotate: [-8, 8, -8],
          }}
          transition={{
            duration: el.dur,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: el.delay,
          }}
        >
          {el.icon}
        </motion.div>
      ))}

      {/* 3. BINTANG KUNING BERKEDIP & BERKILAU */}
      {sparkles.map((star) => (
        <motion.div
          key={star.id}
          className={`absolute ${star.size} ${star.color} font-black select-none drop-shadow-[0_6px_12px_rgba(0,0,0,0.15)]`}
          style={{
            top: star.top,
            bottom: star.bottom,
            left: star.left,
            right: star.right,
          }}
          animate={{
            scale: [0.9, 1.25, 0.9],
            opacity: [0.75, 1, 0.75],
            rotate: [0, 15, 0],
          }}
          transition={{
            duration: star.dur,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {star.text}
        </motion.div>
      ))}
    </div>
  )
}
