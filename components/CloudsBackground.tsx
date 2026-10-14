'use client'

import React from 'react'
import { motion } from 'framer-motion'

export default function CloudsBackground() {
  // Posisi awan mengambang dengan opacity lebih soft (40-60%)
  const clouds = [
    { id: 1, top: '7%', left: '3%', scale: 1.05, duration: 9, delay: 0 },
    { id: 2, top: '15%', right: '5%', scale: 1.2, duration: 11, delay: 1.5 },
    { id: 3, top: '55%', left: '4%', scale: 0.9, duration: 8.5, delay: 0.8 },
    { id: 4, top: '75%', right: '6%', scale: 1.1, duration: 10, delay: 2 },
  ]

  // Bintang-bintang dikurangi menjadi 4 buah dengan opacity halus
  const stars = [
    { id: 1, top: '8%', left: '25%', size: 'w-4 h-4', duration: 4.2, delay: 0 },
    { id: 2, top: '14%', right: '28%', size: 'w-3 h-3', duration: 5, delay: 1 },
    { id: 3, top: '35%', right: '12%', size: 'w-3.5 h-3.5', duration: 4.6, delay: 2 },
    { id: 4, top: '80%', left: '18%', size: 'w-3 h-3', duration: 4.8, delay: 0.5 },
  ]

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* 1. AWAN MENGAMBANG (SUBTLE & SOFT) */}
      {clouds.map((cloud) => (
        <motion.div
          key={cloud.id}
          className="absolute opacity-50"
          style={{
            top: cloud.top,
            left: cloud.left,
            right: cloud.right,
          }}
          animate={{
            y: [-10, 10, -10],
            x: [-5, 6, -5],
          }}
          transition={{
            duration: cloud.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: cloud.delay,
          }}
        >
          {/* SVG Bentuk Awan Kartun Bersahabat */}
          <svg
            className="w-32 h-20 sm:w-44 sm:h-26 text-white/80 drop-shadow-sm"
            viewBox="0 0 100 60"
            fill="currentColor"
            style={{ transform: `scale(${cloud.scale})` }}
          >
            <path d="M 20 45 A 15 15 0 0 1 35 25 A 20 20 0 0 1 70 25 A 15 15 0 0 1 85 45 Z" />
            <circle cx="32" cy="38" r="16" />
            <circle cx="50" cy="30" r="18" />
            <circle cx="68" cy="38" r="15" />
            <rect x="22" y="36" width="58" height="16" rx="8" />
          </svg>
        </motion.div>
      ))}

      {/* 2. BINTANG KECIL BERKEDIP LEMBUT */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className={`absolute ${star.size} text-amber-100 drop-shadow-sm`}
          style={{
            top: star.top,
            left: star.left,
            right: star.right,
          }}
          animate={{
            opacity: [0.2, 0.7, 0.2],
            scale: [0.9, 1.1, 0.9],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: star.delay,
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z" />
          </svg>
        </motion.div>
      ))}
    </div>
  )
}
