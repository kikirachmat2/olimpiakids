'use client'

import React from 'react'
import { motion } from 'framer-motion'

export default function CloudsBackground() {
  // Posisi awan mengambang dengan durasi berbeda untuk ilusi kedalaman
  const clouds = [
    { id: 1, top: '8%', left: '4%', scale: 1.1, duration: 8, delay: 0 },
    { id: 2, top: '16%', right: '6%', scale: 1.3, duration: 9.5, delay: 1.5 },
    { id: 3, top: '48%', left: '2%', scale: 0.9, duration: 7, delay: 0.8 },
    { id: 4, top: '68%', right: '5%', scale: 1.15, duration: 8.5, delay: 2 },
    { id: 5, top: '82%', left: '8%', scale: 0.85, duration: 6.5, delay: 1 },
  ]

  // Bintang-bintang kecil yang berkedip lembut
  const stars = [
    { id: 1, top: '6%', left: '28%', size: 'w-4 h-4', duration: 3.2, delay: 0 },
    { id: 2, top: '12%', right: '32%', size: 'w-3 h-3', duration: 4.1, delay: 1 },
    { id: 3, top: '28%', left: '15%', size: 'w-5 h-5', duration: 3.6, delay: 0.5 },
    { id: 4, top: '40%', right: '18%', size: 'w-3.5 h-3.5', duration: 4.5, delay: 2 },
    { id: 5, top: '75%', right: '25%', size: 'w-4 h-4', duration: 3.8, delay: 1.2 },
    { id: 6, top: '88%', left: '32%', size: 'w-3 h-3', duration: 4.8, delay: 0.4 },
  ]

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* 1. AWAN MENGAMBANG */}
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
            y: [-12, 14, -12],
            x: [-6, 8, -6],
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
            className="w-32 h-20 sm:w-48 sm:h-28 text-white/90 drop-shadow-md"
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

      {/* 2. BINTANG KECIL BERKEDIP */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className={`absolute ${star.size} text-amber-200 drop-shadow`}
          style={{
            top: star.top,
            left: star.left,
            right: star.right,
          }}
          animate={{
            opacity: [0.25, 1, 0.25],
            scale: [0.85, 1.2, 0.85],
            rotate: [0, 45, 0],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: star.delay,
          }}
        >
          {/* Bintang 4-sudut (Sparkle) */}
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z" />
          </svg>
        </motion.div>
      ))}
    </div>
  )
}
