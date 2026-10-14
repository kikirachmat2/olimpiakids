'use client'

import React from 'react'
import { motion } from 'framer-motion'

export default function CloudsBackground() {
  // Awan putih (3-4 buah) posisi fixed, bentuk rounded alami, opacity 60-70%, animasi translateY +-5px 5s
  const clouds = [
    { id: 1, top: '8%', left: '3%', scale: 1.1, duration: 5, delay: 0 },
    { id: 2, top: '16%', right: '4%', scale: 1.25, duration: 5.4, delay: 1.2 },
    { id: 3, top: '56%', left: '2%', scale: 0.95, duration: 4.8, delay: 0.5 },
    { id: 4, top: '78%', right: '5%', scale: 1.15, duration: 5.2, delay: 1.8 },
  ]

  // Bintang kuning kecil (★) warna #ffd300 di pojok-pojok
  const stars = [
    { id: 1, top: '5%', left: '8%', size: 'text-2xl sm:text-3xl' },
    { id: 2, top: '8%', right: '10%', size: 'text-xl sm:text-2xl' },
    { id: 3, bottom: '8%', left: '7%', size: 'text-xl sm:text-2xl' },
    { id: 4, bottom: '6%', right: '8%', size: 'text-2xl sm:text-3xl' },
  ]

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* 1. AWAN PUTIH ROUNDED (OPACITY 60-70%) */}
      {clouds.map((cloud) => (
        <motion.div
          key={cloud.id}
          className="absolute opacity-65"
          style={{
            top: cloud.top,
            left: cloud.left,
            right: cloud.right,
          }}
          animate={{
            y: [-5, 5, -5],
          }}
          transition={{
            duration: cloud.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: cloud.delay,
          }}
        >
          <div
            className="relative bg-white rounded-full w-28 sm:w-40 h-10 sm:h-14 shadow-sm"
            style={{ transform: `scale(${cloud.scale})` }}
          >
            <div className="absolute -top-5 sm:-top-7 left-3 sm:left-4 bg-white rounded-full w-12 sm:w-16 h-12 sm:h-16" />
            <div className="absolute -top-7 sm:-top-10 left-10 sm:left-14 bg-white rounded-full w-14 sm:w-20 h-14 sm:h-20" />
            <div className="absolute -top-4 sm:-top-6 right-3 sm:right-5 bg-white rounded-full w-10 sm:w-14 h-10 sm:h-14" />
          </div>
        </motion.div>
      ))}

      {/* 2. BINTANG KUNING KECIL (#ffd300) DI POJOK-POJOK */}
      {stars.map((star) => (
        <div
          key={star.id}
          className={`absolute ${star.size} text-[#ffd300] font-bold select-none drop-shadow`}
          style={{
            top: star.top,
            bottom: star.bottom,
            left: star.left,
            right: star.right,
          }}
        >
          ★
        </div>
      ))}
    </div>
  )
}
