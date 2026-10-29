'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { LeaderboardItem, RaceEvent } from '@/types/database'
import { getActiveRace, getLeaderboard } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import RankRow, { RowCelebration, formatTimerMMSSCC } from './RankRow'
import { fireTop3Confetti, fireChampionConfetti, playCelebrationSound } from '@/lib/celebration'

interface CelebrationTriggerData {
  type: 'champion' | 'top3'
  name: string
  rank: number
  timeStr: string
}

export default function LiveLeaderboard() {
  const [activeRace, setActiveRace] = useState<RaceEvent | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([])
  const [celebrations, setCelebrations] = useState<Record<string, RowCelebration>>({})
  const [activeToast, setActiveToast] = useState<{
    type: 'top3' | 'champion'
    title: string
    subtitle: string
  } | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [logoError, setLogoError] = useState(false)

  const previousRanksRef = React.useRef<Map<string, number>>(new Map())
  const toastTimerRef = React.useRef<NodeJS.Timeout | null>(null)
  const celebrationTimerRef = React.useRef<NodeJS.Timeout | null>(null)
  const isMutedRef = React.useRef(isMuted)
  const leaderboardRef = React.useRef(leaderboard)

  // Hitung jumlah sisa bayi yang belum tanding (skor/timer belum diinput / null)
  const remainingCount = React.useMemo(() => {
    return leaderboard.filter(
      (item) => item.duration_ms === null || item.duration_ms === undefined
    ).length
  }, [leaderboard])

  const [isCountPulsing, setIsCountPulsing] = useState(false)
  const prevRemainingRef = React.useRef<number | null>(null)

  useEffect(() => {
    // Picu animasi pop/pulse setiap kali angka sisa peserta berubah (setelah initial load)
    if (prevRemainingRef.current !== null && prevRemainingRef.current !== remainingCount) {
      setIsCountPulsing(true)
      const timer = setTimeout(() => setIsCountPulsing(false), 800)
      prevRemainingRef.current = remainingCount
      return () => clearTimeout(timer)
    }
    prevRemainingRef.current = remainingCount
  }, [remainingCount])

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    leaderboardRef.current = leaderboard
  }, [leaderboard])

  // Fungsi Test Selebrasi manual untuk Operator Panggung (Tekan tombol 'C')
  const triggerTestCelebration = useCallback((forcedType?: 'top3' | 'champion') => {
    const type = forcedType || (Math.random() > 0.5 ? 'champion' : 'top3')
    const currentBoard = leaderboardRef.current

    // Aktifkan juga selebrasi pada baris teratas saat test
    if (currentBoard.length > 0) {
      const topBib = currentBoard[0].bib_number
      setCelebrations({ [topBib]: type })
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current)
      celebrationTimerRef.current = setTimeout(() => {
        setCelebrations({})
      }, 4000)
    }

    if (type === 'champion') {
      fireChampionConfetti()
      playCelebrationSound('champion', isMutedRef.current)
      setActiveToast({
        type: 'champion',
        title: 'TEST JUARA 1 BARU!',
        subtitle: 'Uji coba visual confetti & efek panggung juara 1',
      })
    } else {
      fireTop3Confetti()
      playCelebrationSound('top3', isMutedRef.current)
      setActiveToast({
        type: 'top3',
        title: 'TEST MASUK 3 BESAR!',
        subtitle: 'Uji coba visual confetti & efek panggung 3 besar',
      })
    }

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setActiveToast(null)
    }, 4500)
  }, [])

  // Proses update peringkat secara instan dan picu selebrasi jika ada yang masuk 3 besar / Juara 1
  const applyLeaderboardUpdate = useCallback((nextData: LeaderboardItem[]) => {
    const prevRanks = previousRanksRef.current
    const newCelebrations: Record<string, RowCelebration> = {}
    let celebrationToTrigger: CelebrationTriggerData | null = null

    // Initial load: simpan posisi awal
    if (prevRanks.size === 0) {
      for (let idx = 0; idx < nextData.length; idx++) {
        const item = nextData[idx]
        const rank = item.rank || idx + 1
        prevRanks.set(item.bib_number, rank)
      }
      setLeaderboard(nextData)
      return
    }

    // Deteksi naik ke 3 besar / juara 1
    for (let idx = 0; idx < nextData.length; idx++) {
      const item = nextData[idx]
      const newRank = item.rank || idx + 1
      const oldRank = prevRanks.get(item.bib_number)

      if (oldRank !== undefined && oldRank !== newRank && newRank < oldRank) {
        if (newRank === 1) {
          newCelebrations[item.bib_number] = 'champion'
          celebrationToTrigger = {
            type: 'champion',
            name: item.participant_name,
            rank: 1,
            timeStr: formatTimerMMSSCC(item.duration_ms),
          }
        } else if (newRank <= 3 && !celebrationToTrigger) {
          newCelebrations[item.bib_number] = 'top3'
          celebrationToTrigger = {
            type: 'top3',
            name: item.participant_name,
            rank: newRank,
            timeStr: formatTimerMMSSCC(item.duration_ms),
          }
        }
      }
    }

    // Perbarui map peringkat sekarang
    const newRanksMap = new Map<string, number>()
    for (let idx = 0; idx < nextData.length; idx++) {
      const item = nextData[idx]
      newRanksMap.set(item.bib_number, item.rank || idx + 1)
    }
    previousRanksRef.current = newRanksMap

    // Update state leaderboard langsung (Framer Motion layout="position" menangani animasi perpindahan secara otomatis)
    setLeaderboard(nextData)

    if (celebrationToTrigger) {
      const cel: CelebrationTriggerData = celebrationToTrigger
      setCelebrations(newCelebrations)

      setTimeout(() => {
        if (cel.type === 'champion') {
          fireChampionConfetti()
          playCelebrationSound('champion', isMutedRef.current)
          setActiveToast({
            type: 'champion',
            title: 'JUARA 1 BARU!',
            subtitle: `${cel.name} merebut posisi 1 (${cel.timeStr})`,
          })
        } else {
          fireTop3Confetti()
          playCelebrationSound('top3', isMutedRef.current)
          setActiveToast({
            type: 'top3',
            title: `MASUK PERINGKAT ${cel.rank}!`,
            subtitle: `${cel.name} menembus 3 besar (${cel.timeStr})`,
          })
        }

        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        toastTimerRef.current = setTimeout(() => {
          setActiveToast(null)
        }, 4500)
      }, 300)

      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current)
      celebrationTimerRef.current = setTimeout(() => {
        setCelebrations({})
      }, 4000)
    }
  }, [])

  // 1. Fetch data dari Supabase
  const loadLeaderboardData = useCallback(async () => {
    try {
      const raceRes = await getActiveRace()
      if (raceRes.error) {
        setIsLoading(false)
        return
      }

      if (raceRes.data) {
        setActiveRace(raceRes.data)
        const boardRes = await getLeaderboard(raceRes.data.id)
        if (!boardRes.error) {
          applyLeaderboardUpdate(boardRes.data || [])
        }
      } else {
        setActiveRace(null)
        setLeaderboard([])
      }
    } catch {
      // Abaikan error jaringan sesaat, polling berikutnya akan mencoba lagi
    } finally {
      setIsLoading(false)
    }
  }, [applyLeaderboardUpdate])

  // 2. Initial load + Supabase Realtime Subscription + Auto Polling Fallback (setiap 2 detik)
  useEffect(() => {
    loadLeaderboardData()

    // Realtime channel
    const channel = supabase
      .channel('race-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'race_results' },
        () => {
          loadLeaderboardData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'race_events' },
        () => {
          loadLeaderboardData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants' },
        () => {
          loadLeaderboardData()
        }
      )
      .subscribe()

    // Polling interval setiap 2 detik agar perubahan dari Google Sheets langsung muncul tanpa delay
    const interval = setInterval(() => {
      loadLeaderboardData()
    }, 2000)

    // Keyboard Hotkeys untuk Operator Panggung:
    // [C] = Test Selebrasi Confetti (gladi resik)
    // [M] = Toggle Mute Audio
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase()
      if (activeTag === 'input' || activeTag === 'textarea') return

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        triggerTestCelebration()
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        setIsMuted((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      supabase.removeChannel(channel)
      clearInterval(interval)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current)
    }
  }, [loadLeaderboardData, triggerTestCelebration])

  return (
    <div className="relative z-10 w-full max-w-6xl 2xl:max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-1 sm:py-2 lg:py-1 flex flex-col items-center justify-between h-full max-h-screen">
      {/* 1. BRANDING LOGO: ATAS BAWAH (PROPORSI KOMPAK DI LAYAR TV) */}
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="w-full flex flex-col items-center justify-center gap-0.5 sm:gap-1.5 mb-1 sm:mb-2 lg:mb-1.5 px-2 select-none shrink-0"
      >
        {/* LOGO TRANS TV (PENYELENGGARA) */}
        <div className="relative flex items-center justify-center">
          <Image
            src="/Trans_TV_2013.png"
            alt="Trans TV"
            width={200}
            height={36}
            priority
            className="w-20 sm:w-28 md:w-32 lg:w-36 xl:w-40 h-auto object-contain drop-shadow-sm opacity-90 hover:opacity-100 transition-opacity"
          />
        </div>

        {/* LOGO OLIMPIAKIDS (ACARA UTAMA) */}
        <div className="relative flex items-center justify-center w-full max-w-[240px] sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl -mt-1">
          {!logoError ? (
            <Image
              src="/olimpiakids.png"
              alt="Olimpiakids"
              width={550}
              height={300}
              priority
              className="w-full h-auto max-h-16 sm:max-h-24 md:max-h-28 lg:max-h-32 xl:max-h-36 object-contain drop-shadow-lg"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="font-display font-black text-3xl sm:text-5xl md:text-6xl text-blue-900 tracking-wider drop-shadow-md">
              OLIMPIAKIDS
            </div>
          )}
        </div>
      </motion.div>

      {/* 2. HEADER TITLE & REMAINING BAR (PROPORSIONAL 3/4 & 1/4) */}
      <div className="w-full grid grid-cols-4 gap-1.5 sm:gap-2.5 md:gap-3 mb-1 sm:mb-2 shrink-0">
        {/* 3/4 BAGIAN: JUDUL LOMBA ATAU TOAST SELEBRASI */}
        <div className="col-span-3 min-w-0">
          <AnimatePresence mode="wait">
            {activeToast ? (
              <motion.div
                key="toast-active"
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 6 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className={`w-full rounded-xl sm:rounded-full py-1.5 sm:py-2.5 md:py-2.5 lg:py-3 px-2 sm:px-4 md:px-6 border-[2.5px] sm:border-[3.5px] border-white shadow-xl text-center relative overflow-hidden select-none ${
                  activeToast.type === 'champion'
                    ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-amber-950 shadow-[0_8px_25px_rgba(234,179,8,0.7)] ring-4 ring-yellow-300/90'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-[0_8px_25px_rgba(37,99,235,0.7)] ring-4 ring-blue-300/90'
                }`}
              >
                {/* Shimmer sweep */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 translate-x-[-150%] animate-[shimmer_2s_infinite]" />

                <div className="font-display font-black text-xs sm:text-base md:text-lg lg:text-xl xl:text-2xl tracking-wide uppercase leading-none drop-shadow-sm flex items-center justify-center gap-1.5 sm:gap-2">
                  <span className="text-base sm:text-2xl animate-bounce shrink-0">
                    {activeToast.type === 'champion' ? '👑' : '🎉'}
                  </span>
                  <span className="truncate">
                    <span className="font-black tracking-wider">{activeToast.title}</span>
                    <span className="mx-1.5 sm:mx-2 opacity-60">•</span>
                    <span className="font-bold opacity-90">{activeToast.subtitle}</span>
                  </span>
                  <span className="text-base sm:text-2xl animate-bounce shrink-0">
                    {activeToast.type === 'champion' ? '👑' : '⭐'}
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="default-title"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="w-full bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 text-white rounded-xl sm:rounded-full py-1.5 sm:py-2.5 md:py-2.5 lg:py-3 px-2 sm:px-4 md:px-6 border-[2.5px] sm:border-[3.5px] border-white shadow-[0_3px_0_rgba(29,78,216,0.7)] text-center relative overflow-hidden flex items-center justify-center min-w-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-150%] animate-[shimmer_3s_infinite] pointer-events-none" />
                <h1 className="font-display font-black text-xs sm:text-lg md:text-xl lg:text-2xl tracking-wide uppercase leading-none drop-shadow-sm flex items-center justify-center gap-1.5 sm:gap-2 truncate">
                  <span>🍼</span>
                  <span className="truncate">
                    {activeRace?.name && activeRace.name.toLowerCase().includes('leaderboard')
                      ? activeRace.name
                      : activeRace?.name || 'LEADERBOARD BABY CRAWLING'}
                  </span>
                  <span>⭐</span>
                </h1>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 1/4 BAGIAN: BAR REMAINING (UKURAN FONT IDENTIK & BOLD) */}
        <div className="col-span-1 min-w-0">
          <motion.div
            animate={
              isCountPulsing
                ? {
                    scale: [1, 1.05, 0.97, 1.02, 1],
                    boxShadow: [
                      '0 3px 0 rgba(29,78,216,0.7)',
                      '0 0 20px rgba(250,204,21,0.9), 0 3px 0 rgba(29,78,216,0.7)',
                      '0 3px 0 rgba(29,78,216,0.7)',
                    ],
                  }
                : { scale: 1 }
            }
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="w-full bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 text-white rounded-xl sm:rounded-full py-1.5 sm:py-2.5 md:py-2.5 lg:py-3 px-1 sm:px-3 md:px-4 border-[2.5px] sm:border-[3.5px] border-white shadow-[0_3px_0_rgba(29,78,216,0.7)] text-center relative overflow-hidden flex items-center justify-center min-w-0 select-none"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-150%] animate-[shimmer_3s_infinite] pointer-events-none" />
            <div className="font-display font-black text-xs sm:text-lg md:text-xl lg:text-2xl tracking-wide uppercase leading-none drop-shadow-sm flex items-center justify-center gap-1 sm:gap-2 truncate">
              <motion.span
                animate={{ rotate: [-6, 6, -6], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                className="inline-block shrink-0"
              >
                👶
              </motion.span>
              <span className="hidden md:inline">REMAINING:</span>
              <span className="inline md:hidden">REM:</span>
              <div className="relative inline-flex items-center justify-center min-w-[1.2ch] overflow-hidden shrink-0">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={remainingCount}
                    initial={{ y: -16, opacity: 0, scale: 0.6 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 16, opacity: 0, scale: 0.6 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                    className="text-yellow-300 font-black inline-block drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                  >
                    {remainingCount}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 3. RANKING CARD (CONTAINER UTAMA LEADERBOARD) - TAMPILKAN 10 BESAR SECARA PRESISI */}
      <div className="w-full bg-white/95 backdrop-blur-md rounded-xl sm:rounded-3xl border-[2.5px] sm:border-[3.5px] border-white shadow-xl sm:shadow-2xl p-1.5 sm:p-2.5 md:p-3 lg:p-3.5 overflow-hidden flex flex-col flex-1 min-h-0">
        {/* HEADER ROW TABEL (10% 20% 48% 22%) */}
        <div
          className="grid items-center bg-gradient-to-b from-blue-500 to-blue-600 text-white font-display font-black text-[10px] sm:text-xs md:text-sm lg:text-base uppercase tracking-wide rounded-lg sm:rounded-xl min-h-[30px] sm:min-h-[36px] md:min-h-[40px] px-2 sm:px-4 md:px-5 py-1 sm:py-1.5 mb-1 sm:mb-1.5 shadow-sm select-none shrink-0"
          style={{
            gridTemplateColumns: '10% 20% 48% 22%',
          }}
        >
          <div className="text-center">NO.</div>
          <div className="text-center truncate">NOMOR DADA</div>
          <div className="text-left pl-2 sm:pl-4 truncate">NAMA ANAK</div>
          <div className="text-center">TIMER</div>
        </div>

        {/* LIST BARIS PESERTA (TERLIHAT 10 BESAR DI AWAL & BISA DI-SCROLL KE BAWAH) */}
        <div className="w-full flex-1 min-h-0 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
          <AnimatePresence>
            {isLoading && leaderboard.length === 0 ? (
              <div className="py-12 sm:py-14 text-center text-slate-500 font-sans font-bold text-sm flex flex-col items-center justify-center gap-2.5">
                <div className="w-7 h-7 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm sm:text-base text-blue-900 font-display">Memuat data peserta...</span>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-12 sm:py-14 text-center text-slate-500 font-sans font-bold text-sm">
                Belum ada data hasil lomba untuk babak ini.
              </div>
            ) : (
              leaderboard.map((item, index) => (
                <RankRow
                  key={item.bib_number || item.participant_id || index}
                  rank={item.rank || index + 1}
                  bib_number={item.bib_number}
                  participant_name={item.participant_name}
                  duration_ms={item.duration_ms}
                  celebration={celebrations[item.bib_number] || 'none'}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
