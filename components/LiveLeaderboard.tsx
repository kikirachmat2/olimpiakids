'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { LeaderboardItem, RaceEvent } from '@/types/database'
import { getActiveRace, getLeaderboard } from '@/lib/queries'

// Dummy fallback awal agar tampilan langsung ada sampel visual clean
const SAMPLE_LEADERBOARD: LeaderboardItem[] = [
  {
    rank: 1,
    participant_id: 101,
    participant_name: 'Muhammad Arka',
    bib_number: '07',
    duration_ms: 12450,
    finish_time: '2026-10-14T15:01:12.450Z',
    status: 'finished',
  },
  {
    rank: 2,
    participant_id: 102,
    participant_name: 'Gwen Aurelia',
    bib_number: '12',
    duration_ms: 13820,
    finish_time: '2026-10-14T15:01:13.820Z',
    status: 'finished',
  },
  {
    rank: 3,
    participant_id: 103,
    participant_name: 'Rayyan Al-Fatih',
    bib_number: '03',
    duration_ms: 15110,
    finish_time: '2026-10-14T15:01:15.110Z',
    status: 'finished',
  },
  {
    rank: 4,
    participant_id: 104,
    participant_name: 'Alana Kirana',
    bib_number: '18',
    duration_ms: 16900,
    finish_time: '2026-10-14T15:01:16.900Z',
    status: 'finished',
  },
  {
    rank: 5,
    participant_id: 105,
    participant_name: 'Mikail Ibrahim',
    bib_number: '05',
    duration_ms: 18240,
    finish_time: '2026-10-14T15:01:18.240Z',
    status: 'finished',
  },
  {
    rank: 6,
    participant_id: 106,
    participant_name: 'Zahra Shakila',
    bib_number: '21',
    duration_ms: 20510,
    finish_time: '2026-10-14T15:01:20.510Z',
    status: 'finished',
  },
]

export default function LiveLeaderboard() {
  const [activeRace, setActiveRace] = useState<RaceEvent | null>({
    id: 1,
    name: 'Babak Penyisihan - Heat 1',
    status: 'running',
    start_time: '2026-10-14T15:00:00.000Z',
  })
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>(SAMPLE_LEADERBOARD)
  const [logoError, setLogoError] = useState(false)

  // Coba fetch data aktual dari Supabase jika ada
  useEffect(() => {
    async function loadData() {
      const raceRes = await getActiveRace()
      if (raceRes.data) {
        setActiveRace(raceRes.data)
        const boardRes = await getLeaderboard(raceRes.data.id)
        if (boardRes.data && boardRes.data.length > 0) {
          setLeaderboard(boardRes.data)
        }
      }
    }
    loadData()
  }, [])

  // Helper format durasi dari milidetik ke detik "XX.XXs"
  const formatDuration = (ms: number | null) => {
    if (ms === null || ms === undefined) return '00.00s'
    return `${(ms / 1000).toFixed(2)}s`
  }

  return (
    <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-8 sm:py-10 flex flex-col items-center">
      {/* 1. HEADER: LOGO GAMBAR + JUDUL CLEAN + SUBTITLE */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col items-center text-center mb-8"
      >
        {/* LOGO IMAGE (max-w-[320px] desktop, 200px mobile) */}
        <div className="mb-4 flex items-center justify-center">
          {!logoError ? (
            <Image
              src="/logo.webp"
              alt="Olimpiakids"
              width={320}
              height={100}
              priority
              className="w-auto h-auto max-w-[200px] sm:max-w-[260px] md:max-w-[320px] object-contain drop-shadow-sm"
              onError={() => setLogoError(true)}
            />
          ) : (
            // Fallback anggun jika user belum meletakkan logo.webp di public/
            <div className="font-display font-black text-3xl sm:text-4xl text-blue-700 tracking-wider">
              OLIMPIAKIDS
            </div>
          )}
        </div>

        {/* JUDUL BESAR TANPA CARD BERAT */}
        <h1 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-blue-950 tracking-tight leading-tight">
          LEADERBOARD BABY CRAWLING
        </h1>

        {/* SUBTITLE ABU-ABU */}
        <p className="font-sans font-semibold text-slate-600 text-sm sm:text-base mt-1.5">
          {activeRace?.name || 'Babak Perlombaan'}
        </p>
      </motion.div>

      {/* 2. CARD CONTAINER TABEL LEADERBOARD (CLEAN & MINIMALIST) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
        className="w-full bg-white/95 backdrop-blur-sm rounded-2xl p-5 sm:p-7 md:p-8 shadow-xl border border-white/60"
      >
        {/* Header Tabel (Solid bg-blue-600) */}
        <div className="grid grid-cols-12 gap-3 sm:gap-4 bg-blue-600 text-white font-display font-semibold text-xs sm:text-sm uppercase tracking-wider py-3.5 px-4 sm:px-6 rounded-xl mb-3 select-none">
          <div className="col-span-2 sm:col-span-1 text-center">NO.</div>
          <div className="col-span-3 sm:col-span-3 text-center sm:text-left">NOMOR DADA</div>
          <div className="col-span-4 sm:col-span-5">NAMA ANAK</div>
          <div className="col-span-3 sm:col-span-3 text-right">TIMER</div>
        </div>

        {/* List Baris Peserta */}
        <div className="space-y-2.5">
          <AnimatePresence>
            {leaderboard.map((item, index) => {
              const isFirst = index === 0
              const isSecond = index === 1
              const isThird = index === 2

              // Skema warna baris: Top 1-3 subtle gradient + border-l-4
              let rowStyle = 'bg-white border-l-4 border-slate-200'
              if (index % 2 === 1) {
                rowStyle = 'bg-slate-50/70 border-l-4 border-slate-200'
              }

              let medalIcon: React.ReactNode = null

              if (isFirst) {
                rowStyle = 'bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400'
                medalIcon = <span className="text-xl sm:text-2xl mr-1">🥇</span>
              } else if (isSecond) {
                rowStyle = 'bg-gradient-to-r from-slate-50 to-gray-50 border-l-4 border-slate-400'
                medalIcon = <span className="text-xl sm:text-2xl mr-1">🥈</span>
              } else if (isThird) {
                rowStyle = 'bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-400'
                medalIcon = <span className="text-xl sm:text-2xl mr-1">🥉</span>
              }

              return (
                <motion.div
                  key={item.participant_id}
                  layout
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: index * 0.03,
                    ease: 'easeOut',
                  }}
                  className={`grid grid-cols-12 gap-3 sm:gap-4 items-center px-4 py-3 sm:py-3.5 md:py-4 rounded-xl transition-shadow duration-150 hover:shadow-md ${rowStyle}`}
                >
                  {/* Kolom 1: No / Peringkat (Fixed width look, font-display) */}
                  <div className="col-span-2 sm:col-span-1 text-center font-display font-bold text-lg sm:text-xl text-slate-800 flex items-center justify-center">
                    {medalIcon}
                    <span>{item.rank}</span>
                  </div>

                  {/* Kolom 2: Nomor Dada (Badge rounded-md bg-slate-100 font-mono) */}
                  <div className="col-span-3 sm:col-span-3 text-center sm:text-left">
                    <span className="inline-block bg-slate-100 text-slate-800 font-mono font-bold text-xs sm:text-sm md:text-base px-3 py-1 rounded-md border border-slate-200">
                      BIB #{item.bib_number}
                    </span>
                  </div>

                  {/* Kolom 3: Nama Anak (Font Nunito font-bold text-slate-800) */}
                  <div className="col-span-4 sm:col-span-5 font-sans font-bold text-slate-800 text-base sm:text-lg md:text-xl tracking-tight truncate">
                    {item.participant_name}
                  </div>

                  {/* Kolom 4: Timer (Pill bg-blue-600 font-mono font-bold px-4 py-1.5) */}
                  <div className="col-span-3 sm:col-span-3 text-right">
                    <span className="inline-block bg-blue-600 text-white font-mono font-bold text-xs sm:text-sm md:text-base px-3.5 sm:px-4 py-1.5 rounded-full shadow-sm min-w-[80px] sm:min-w-[95px] text-center">
                      {formatDuration(item.duration_ms)}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
