'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LeaderboardItem, RaceEvent } from '@/types/database'
import { getActiveRace, getLeaderboard } from '@/lib/queries'
import { Clock, Trophy, Sparkles } from 'lucide-react'

// Dummy fallback awal agar tampilan langsung ada sampel visual
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
  const [currentTime, setCurrentTime] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected')

  // Jam digital realtime untuk footer (dijalankan di useEffect agar aman saat SSR prerender)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour12: false }))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

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
    <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-8 sm:py-12 flex flex-col items-center">
      {/* 1. LOGO OLIMPIAKIDS PLAYFUL COLORFUL */}
      <motion.div
        initial={{ opacity: 0, y: -25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col items-center mb-6"
      >
        <div className="flex items-center gap-2 mb-1">
          <motion.span
            animate={{ rotate: [-8, 8, -8] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            className="text-3xl sm:text-4xl"
          >
            🏆
          </motion.span>
          <div className="flex items-center tracking-wider font-black text-4xl sm:text-6xl drop-shadow-lg select-none">
            <span className="text-red-500">O</span>
            <span className="text-amber-400">L</span>
            <span className="text-emerald-500">I</span>
            <span className="text-blue-500">M</span>
            <span className="text-purple-500">P</span>
            <span className="text-pink-500">I</span>
            <span className="text-teal-400">A</span>
            <span className="text-amber-500">K</span>
            <span className="text-rose-500">I</span>
            <span className="text-sky-500">D</span>
            <span className="text-yellow-400">S</span>
          </div>
          <motion.span
            animate={{ scale: [1, 1.25, 1], rotate: [0, 45, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            className="text-3xl sm:text-4xl"
          >
            🌟
          </motion.span>
        </div>
        <p className="text-sky-900 font-bold text-xs sm:text-sm tracking-widest uppercase bg-white/70 px-4 py-1 rounded-full shadow-sm">
          FESTIVAL LOMBA MERANGKAK BAYI 2026
        </p>
      </motion.div>

      {/* 2. CARD JUDUL UTAMA DENGAN BADGE LIVE & EMOJI */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
        className="w-full bg-gradient-to-r from-blue-600 via-sky-500 to-blue-600 rounded-3xl p-1.5 shadow-2xl mb-8"
      >
        <div className="bg-white/95 backdrop-blur-md rounded-[22px] px-6 py-5 sm:py-6 flex flex-col md:flex-row items-center justify-between gap-4 border-4 border-white">
          {/* Sisi Kiri: Emoji + Judul */}
          <div className="flex items-center gap-3 sm:gap-4 text-center md:text-left">
            <span className="text-4xl sm:text-5xl select-none">👶</span>
            <div>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-sky-950 tracking-tight uppercase">
                  LEADERBOARD BABY CRAWLING
                </h1>
                <span className="text-2xl sm:text-3xl select-none">🍼</span>
              </div>
              <p className="text-sky-700 font-bold text-sm sm:text-base mt-0.5">
                {activeRace?.name || 'Sesi Lomba Belum Dimulai'}
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Badge LIVE Merah Pulsa */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-rose-600 text-white font-black text-sm sm:text-base px-4 py-2 rounded-full shadow-lg shadow-rose-500/30">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
              </span>
              <span className="tracking-wider">LIVE</span>
            </div>

            {/* Badge Status Sesi */}
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                activeRace?.status === 'running'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {activeRace?.status === 'running' ? 'Balapan Berlangsung' : 'Selesai'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* 3. CARD CONTAINER TABEL LEADERBOARD */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
        className="w-full bg-white/95 backdrop-blur-xl rounded-3xl p-5 sm:p-8 shadow-2xl border-4 border-white/80"
      >
        {/* Header Tabel */}
        <div className="grid grid-cols-12 gap-2 sm:gap-4 bg-gradient-to-r from-blue-600 to-sky-600 text-white font-extrabold text-xs sm:text-sm lg:text-base uppercase tracking-wider py-4 px-4 sm:px-6 rounded-2xl shadow-md mb-3 select-none">
          <div className="col-span-2 sm:col-span-1 text-center">NO.</div>
          <div className="col-span-3 sm:col-span-3 text-center sm:text-left">NOMOR DADA</div>
          <div className="col-span-4 sm:col-span-5">NAMA ANAK</div>
          <div className="col-span-3 sm:col-span-3 text-right">TIMER</div>
        </div>

        {/* List Baris Peserta dengan Framer Motion */}
        <div className="space-y-3">
          <AnimatePresence>
            {leaderboard.map((item, index) => {
              const isFirst = index === 0
              const isSecond = index === 1
              const isThird = index === 2

              // Skema warna podium 1, 2, 3 dan baris reguler
              let rowStyle = 'bg-blue-50/90 border-2 border-blue-200 text-blue-950'
              let rankBadge = (
                <span className="font-extrabold text-base sm:text-lg text-blue-800">
                  #{item.rank}
                </span>
              )

              if (isFirst) {
                // Gold / Emas
                rowStyle =
                  'bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-300 border-3 border-amber-500 text-amber-950 shadow-lg shadow-amber-300/40 ring-2 ring-yellow-400/50'
                rankBadge = (
                  <div className="flex items-center justify-center gap-1">
                    <motion.span
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                      className="text-xl sm:text-2xl"
                    >
                      🥇
                    </motion.span>
                    <span className="font-black text-lg sm:text-xl text-amber-950">1</span>
                  </div>
                )
              } else if (isSecond) {
                // Silver / Perak
                rowStyle =
                  'bg-gradient-to-r from-gray-100 via-slate-200 to-gray-200 border-2 border-slate-400 text-slate-900 shadow-md shadow-slate-200/50'
                rankBadge = (
                  <div className="flex items-center justify-center gap-1">
                    <motion.span
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut', delay: 0.2 }}
                      className="text-xl sm:text-2xl"
                    >
                      🥈
                    </motion.span>
                    <span className="font-black text-lg sm:text-xl text-slate-800">2</span>
                  </div>
                )
              } else if (isThird) {
                // Bronze / Perunggu
                rowStyle =
                  'bg-gradient-to-r from-amber-100 via-orange-200 to-amber-200 border-2 border-amber-600 text-orange-950 shadow-md shadow-orange-200/50'
                rankBadge = (
                  <div className="flex items-center justify-center gap-1">
                    <motion.span
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut', delay: 0.4 }}
                      className="text-xl sm:text-2xl"
                    >
                      🥉
                    </motion.span>
                    <span className="font-black text-lg sm:text-xl text-amber-900">3</span>
                  </div>
                )
              }

              return (
                <motion.div
                  key={item.participant_id}
                  layout
                  initial={{ opacity: 0, x: -30, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{
                    duration: 0.45,
                    delay: index * 0.05,
                    ease: 'easeOut',
                  }}
                  whileHover={{ scale: 1.015, transition: { duration: 0.15 } }}
                  className={`grid grid-cols-12 gap-2 sm:gap-4 items-center py-3.5 sm:py-4 px-4 sm:px-6 rounded-2xl transition-shadow ${rowStyle}`}
                >
                  {/* Kolom 1: No / Peringkat */}
                  <div className="col-span-2 sm:col-span-1 text-center font-bold">
                    {rankBadge}
                  </div>

                  {/* Kolom 2: Nomor Dada (Badge Putih Rounded) */}
                  <div className="col-span-3 sm:col-span-3 text-center sm:text-left">
                    <span className="inline-block bg-white text-sky-950 font-mono font-extrabold text-sm sm:text-base px-3 py-1.5 rounded-xl border-2 border-sky-200 shadow-sm">
                      BIB #{item.bib_number}
                    </span>
                  </div>

                  {/* Kolom 3: Nama Anak */}
                  <div className="col-span-4 sm:col-span-5 font-black text-base sm:text-lg lg:text-xl tracking-tight truncate">
                    {item.participant_name}
                  </div>

                  {/* Kolom 4: Timer (Pill Biru Gelap Rounded) */}
                  <div className="col-span-3 sm:col-span-3 text-right">
                    <motion.span
                      animate={isFirst ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                      className="inline-block bg-blue-700 text-white font-mono font-black text-sm sm:text-base lg:text-lg px-3.5 sm:px-5 py-1.5 rounded-full shadow-inner border border-blue-500"
                    >
                      {formatDuration(item.duration_ms)}
                    </motion.span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* 4. FOOTER STATUS KONEKSI & JAM DIGITAL */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full mt-6 bg-white/75 backdrop-blur-md border border-white/80 rounded-2xl px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm font-semibold shadow-md"
      >
        {/* Status Koneksi Realtime */}
        <div className="flex items-center gap-2.5">
          {connectionStatus === 'connected' ? (
            <>
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
              <span className="text-emerald-900 font-bold">LIVE • Terhubung</span>
            </>
          ) : connectionStatus === 'connecting' ? (
            <>
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-amber-800 font-bold">LIVE • Menghubungkan...</span>
            </>
          ) : (
            <>
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="text-rose-800 font-bold">LIVE • Koneksi Terputus</span>
            </>
          )}
        </div>

        {/* Info Update Otomatis */}
        <div className="text-sky-800 flex items-center gap-1.5 text-center">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Layar Proyektor Resmi Olimpiakids</span>
        </div>

        {/* Jam Digital */}
        <div className="flex items-center gap-2 bg-sky-900 text-white font-mono font-bold px-3 py-1 rounded-xl shadow-sm text-xs sm:text-sm">
          <Clock className="w-3.5 h-3.5 text-amber-300" />
          <span>{currentTime || '00:00:00'} WIB</span>
        </div>
      </motion.div>
    </div>
  )
}
