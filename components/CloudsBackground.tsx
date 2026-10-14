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

  // Bintang kuning berkilau (★ & ✨) di sekeliling
  const sparkles = [
    { id: 1, top: '4%', left: '7%', text: '★', size: 'text-3xl sm:text-4xl', color: 'text-amber-300', dur: 2.2 },
    { id: 2, top: '7%', right: '11%', text: '★', size: 'text-2xl sm:text-3xl', color: 'text-yellow-300', dur: 2.8 },
    { id: 3, top: '38%', left: '6%', text: '✨', size: 'text-2xl sm:text-3xl', color: 'text-yellow-200', dur: 3 },
    { id: 4, top: '44%', right: '8%', text: '✨', size: 'text-2xl sm:text-3xl', color: 'text-yellow-200', dur: 2.5 },
    { id: 5, bottom: '12%', left: '8%', text: '★', size: 'text-3xl sm:text-4xl', color: 'text-amber-300', dur: 2.6 },
    { id: 6, bottom: '8%', right: '7%', text: '★', size: 'text-3xl sm:text-4xl', color: 'text-yellow-300', dur: 2.4 },
  ]

  // Aksen mainan & balon anak-anak melayang lembut di background
  const kidElements = [
    { id: 1, top: '22%', left: '6%', icon: '🎈', dur: 7, delay: 0 },
    { id: 2, top: '28%', right: '5%', icon: '⭐', dur: 6.5, delay: 1 },
    { id: 3, bottom: '24%', left: '4%', icon: '🍼', dur: 7.2, delay: 2 },
    { id: 4, bottom: '20%', right: '5%', icon: '🧸', dur: 8, delay: 0.5 },
  ]

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* 1. AWAN PUTIH PLAYFUL ROUNDED */}
      {clouds.map((cloud) => (
        <motion.div
          key={cloud.id}
          className="absolute opacity-75"
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
            className="relative bg-white rounded-full w-28 sm:w-44 h-11 sm:h-16 shadow-md drop-shadow-sm"
            style={{ transform: `scale(${cloud.scale})` }}
          >
            <div className="absolute -top-5 sm:-top-8 left-3 sm:left-4 bg-white rounded-full w-12 sm:w-18 h-12 sm:h-18" />
            <div className="absolute -top-7 sm:-top-11 left-9 sm:left-14 bg-white rounded-full w-15 sm:w-22 h-15 sm:h-22" />
            <div className="absolute -top-4 sm:-top-7 right-3 sm:right-5 bg-white rounded-full w-11 sm:w-15 h-11 sm:h-15" />
          </div>
        </motion.div>
      ))}

      {/* 2. ELEMEN MAINAN ANAK-ANAK MENGAMBANG */}
      {kidElements.map((el) => (
        <motion.div
          key={el.id}
          className="absolute text-2xl sm:text-3xl select-none opacity-80 drop-shadow"
          style={{
            top: el.top,
            bottom: el.bottom,
            left: el.left,
            right: el.right,
          }}
          animate={{
            y: [-10, 10, -10],
            rotate: [-6, 6, -6],
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
          className={`absolute ${star.size} ${star.color} font-black select-none drop-shadow`}
          style={{
            top: star.top,
            bottom: star.bottom,
            left: star.left,
            right: star.right,
          }}
          animate={{
            scale: [0.9, 1.25, 0.9],
            opacity: [0.65, 1, 0.65],
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
