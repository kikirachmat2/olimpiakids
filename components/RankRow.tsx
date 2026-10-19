'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface RankRowProps {
  rank: number
  bib_number: string
  participant_name: string
  duration_ms: number | null
  index: number
}

// Format timer MM.SS.CC (menit.detik.centidetik) contoh: 15000ms -> "00.15.00"
export function formatTimerMMSSCC(ms: number | null): string {
  if (ms === null || ms === undefined || isNaN(ms)) return '--.--.--'
  const min = Math.floor(ms / 60000)
  const sec = Math.floor((ms % 60000) / 1000)
  const cs = Math.floor((ms % 1000) / 10)

  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(min)}.${pad(sec)}.${pad(cs)}`
}

export default function RankRow({
  rank,
  bib_number,
  participant_name,
  duration_ms,
  index,
}: RankRowProps) {
  const isFirst = rank === 1
  const isSecond = rank === 2
  const isThird = rank === 3

  // Base style & bevel shadow: shadow-[0_3px_0_rgba(...)]
  let rowStyle =
    'bg-gradient-to-b from-white to-slate-50 border-2 border-blue-200 text-slate-800 shadow-[0_3px_0_rgba(191,219,254,1)] sm:shadow-[0_3.5px_0_rgba(191,219,254,1)]'
  let timerStyle = 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm'
  let badgeIcon: React.ReactNode = null

  if (isFirst) {
    // 🥇 Juara 1: Special Gold berkilau dengan efek bevel emas tebal
    rowStyle =
      'bg-gradient-to-b from-amber-200 via-yellow-300 to-amber-300 border-2 border-amber-400 text-amber-950 shadow-[0_3px_0_rgba(217,119,6,1)] sm:shadow-[0_4px_0_rgba(217,119,6,1)] ring-1 sm:ring-2 ring-yellow-400/40'
    timerStyle = 'bg-gradient-to-b from-amber-600 to-yellow-600 text-white shadow-md'
    badgeIcon = (
      <motion.span
        animate={{ scale: [1, 1.2, 1], rotate: [0, 8, -8, 0] }}
        transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
        className="inline-block mr-0.5 sm:mr-1 text-base sm:text-xl md:text-2xl"
      >
        🥇
      </motion.span>
    )
  } else if (isSecond) {
    // 🥈 Juara 2: Special Silver / Platinum Metalik tegas (Jauh lebih pekat & kontras dari baris 4 kebawah)
    rowStyle =
      'bg-gradient-to-b from-slate-200 via-zinc-300 to-slate-400 border-[2.5px] sm:border-[3px] border-slate-400 text-slate-900 shadow-[0_4px_0_rgba(100,116,139,1)] sm:shadow-[0_5px_0_rgba(100,116,139,1)] ring-2 ring-slate-300/80'
    timerStyle = 'bg-gradient-to-b from-slate-700 to-slate-900 text-white shadow-md border border-slate-500/30'
    badgeIcon = (
      <motion.span
        animate={{ scale: [1, 1.2, 1], rotate: [0, -7, 7, 0] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut', delay: 0.2 }}
        className="inline-block mr-0.5 sm:mr-1 text-base sm:text-2xl md:text-3xl drop-shadow-sm"
      >
        🥈
      </motion.span>
    )
  } else if (isThird) {
    // 🥉 Juara 3: Special Bronze perunggu cerah
    rowStyle =
      'bg-gradient-to-b from-orange-200 via-amber-200 to-orange-300 border-2 border-orange-400 text-orange-950 shadow-[0_3px_0_rgba(234,88,12,1)] sm:shadow-[0_4px_0_rgba(234,88,12,1)] ring-1 ring-orange-300/60'
    timerStyle = 'bg-gradient-to-b from-orange-600 to-amber-700 text-white shadow-md'
    badgeIcon = (
      <motion.span
        animate={{ scale: [1, 1.15, 1], rotate: [0, 6, -6, 0] }}
        transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut', delay: 0.4 }}
        className="inline-block mr-0.5 sm:mr-1 text-base sm:text-xl md:text-2xl"
      >
        🥉
      </motion.span>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
      whileHover={{ scale: 1.015, y: -1, transition: { duration: 0.15 } }}
      transition={{
        type: 'spring',
        stiffness: 280,
        damping: 22,
        mass: 0.8,
        delay: index * 0.06,
      }}
      className={`grid items-center rounded-lg sm:rounded-xl md:rounded-2xl min-h-[36px] sm:min-h-[44px] md:min-h-[50px] lg:min-h-[48px] xl:min-h-[52px] mb-1 sm:mb-1.5 md:mb-1.5 px-2.5 sm:px-4 md:px-5 py-1 sm:py-1.5 select-none transition-all ${rowStyle}`}
      style={{
        gridTemplateColumns: '10% 20% 48% 22%',
      }}
    >
      {/* Kolom 1 (10%): NO DENGAN MEDALI SPESIAL */}
      <div className="text-center font-display font-black text-sm sm:text-xl md:text-2xl lg:text-2xl flex items-center justify-center">
        {badgeIcon}
        <span>{rank}</span>
      </div>

      {/* Kolom 2 (20%): NOMOR DADA */}
      <div className="text-center font-mono font-bold text-xs sm:text-sm md:text-base lg:text-lg tracking-wide">
        {bib_number}
      </div>

      {/* Kolom 3 (48%): NAMA ANAK */}
      <div className="font-sans font-extrabold text-xs sm:text-base md:text-lg lg:text-xl truncate pl-2 sm:pl-3 pr-1 flex items-center gap-1.5">
        <span className="truncate">{participant_name}</span>
        {isFirst && <span className="text-xs sm:text-sm">👑</span>}
      </div>

      {/* Kolom 4 (22%): TIMER DENGAN WARNA SPESIAL */}
      <div className="flex justify-center items-center">
        <motion.div
          animate={isFirst ? { scale: [1, 1.03, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className={`w-[95%] sm:w-[88%] max-w-[130px] md:max-w-[145px] py-1 sm:py-1.5 rounded-full text-center font-mono font-black text-[11px] sm:text-sm md:text-base lg:text-lg tracking-tight ${timerStyle}`}
        >
          {formatTimerMMSSCC(duration_ms)}
        </motion.div>
      </div>
    </motion.div>
  )
}
