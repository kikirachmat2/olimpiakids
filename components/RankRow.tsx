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
  if (ms === null || ms === undefined || isNaN(ms)) return '00.00.00'
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
    'bg-gradient-to-b from-white to-slate-50 border-2 border-blue-200 text-slate-800 shadow-[0_3px_0_rgba(191,219,254,1)]'
  let timerStyle = 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm'

  if (isFirst) {
    rowStyle =
      'bg-gradient-to-b from-yellow-200 to-yellow-400 border-2 border-yellow-400 text-amber-950 shadow-[0_3px_0_rgba(234,179,8,1)]'
    timerStyle = 'bg-gradient-to-b from-amber-600 to-yellow-600 text-white shadow-sm'
  } else if (isSecond) {
    rowStyle =
      'bg-gradient-to-b from-slate-100 to-slate-200 border-2 border-slate-300 text-slate-700 shadow-[0_3px_0_rgba(203,213,225,1)]'
    timerStyle = 'bg-gradient-to-b from-slate-600 to-slate-700 text-white shadow-sm'
  } else if (isThird) {
    rowStyle =
      'bg-gradient-to-b from-orange-200 to-orange-300 border-2 border-orange-400 text-orange-950 shadow-[0_3px_0_rgba(251,146,60,1)]'
    timerStyle = 'bg-gradient-to-b from-orange-600 to-amber-700 text-white shadow-sm'
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.03,
        ease: 'easeOut',
      }}
      className={`grid items-center rounded-2xl min-h-[54px] mb-1.5 px-3 sm:px-4 py-2 select-none transition-shadow ${rowStyle}`}
      style={{
        gridTemplateColumns: '12% 22% 41% 25%',
      }}
    >
      {/* Kolom 1 (12%): NO */}
      <div className="text-center font-display font-black text-lg sm:text-2xl">
        {rank}
      </div>

      {/* Kolom 2 (22%): NOMOR DADA */}
      <div className="text-center font-mono font-bold text-sm sm:text-base md:text-lg">
        {bib_number}
      </div>

      {/* Kolom 3 (41%): NAMA ANAK */}
      <div className="font-sans font-extrabold text-sm sm:text-base md:text-lg lg:text-xl truncate px-1">
        {participant_name}
      </div>

      {/* Kolom 4 (25%): TIMER */}
      <div className="flex justify-center items-center">
        <div
          className={`w-[88%] max-w-[125px] py-1.5 rounded-full text-center font-mono font-black text-xs sm:text-sm md:text-base tracking-tight ${timerStyle}`}
        >
          {formatTimerMMSSCC(duration_ms)}
        </div>
      </div>
    </motion.div>
  )
}
