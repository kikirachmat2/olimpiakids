'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { LeaderboardItem, RaceEvent } from '@/types/database'
import { getActiveRace, getLeaderboard } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import RankRow, { RowCelebration, formatTimerMMSSCC } from './RankRow'
import { fireTop3Confetti, fireChampionConfetti, playCelebrationSound, playRevealSound } from '@/lib/celebration'

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

  // PENGATURAN JEDA ANTAR NAMA BERBARENGAN (10 - 15 DETIK)
  const [revealDelay, setRevealDelay] = useState<number>(12)
  const [isRevealing, setIsRevealing] = useState(false)
  const [revealingItem, setRevealingItem] = useState<LeaderboardItem | null>(null)
  const [revealProgress, setRevealProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [countdown, setCountdown] = useState<number>(0)

  const isRevealingRef = React.useRef(false)
  const revealDelayRef = React.useRef(revealDelay)
  const targetDataRef = React.useRef<LeaderboardItem[]>([])
  const pendingQueueRef = React.useRef<LeaderboardItem[]>([])
  const countdownIntervalRef = React.useRef<NodeJS.Timeout | null>(null)

  const previousRanksRef = React.useRef<Map<string, number>>(new Map())
  const toastTimerRef = React.useRef<NodeJS.Timeout | null>(null)
  const celebrationTimerRef = React.useRef<NodeJS.Timeout | null>(null)
  const isMutedRef = React.useRef(isMuted)
  const leaderboardRef = React.useRef(leaderboard)

  useEffect(() => {
    revealDelayRef.current = revealDelay
  }, [revealDelay])

  useEffect(() => {
    isRevealingRef.current = isRevealing
  }, [isRevealing])

  // Muat preferensi jeda dari localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('olimpiakids_reveal_delay')
      if (saved) {
        const val = parseInt(saved, 10)
        if (val >= 10 && val <= 15) setRevealDelay(val)
      }
    } catch {}
  }, [])

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

  // 1. LEWATI JEDA / TAMPILKAN SEMUA LANGSUNG (Emergency Override untuk Operator TV)
  const skipReveal = useCallback(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    pendingQueueRef.current = []
    if (targetDataRef.current.length > 0) {
      setLeaderboard(targetDataRef.current)
      leaderboardRef.current = targetDataRef.current
    }
    setIsRevealing(false)
    isRevealingRef.current = false
    setRevealingItem(null)
    setCountdown(0)
    setCelebrations({})
  }, [])

  // 2. REVEAL TUNGGAL (Jika hanya 1 nama yang finish)
  const revealSingleItem = useCallback((item: LeaderboardItem, nextData: LeaderboardItem[]) => {
    setLeaderboard(nextData)
    leaderboardRef.current = nextData
    targetDataRef.current = nextData

    const currentRank = item.rank || 1
    if (currentRank === 1) {
      setCelebrations({ [item.bib_number]: 'champion' })
      fireChampionConfetti()
      playCelebrationSound('champion', isMutedRef.current)
      setActiveToast({
        type: 'champion',
        title: '👑 JUARA 1 BARU!',
        subtitle: `${item.participant_name} merebut posisi 1 (${formatTimerMMSSCC(item.duration_ms)})`,
      })
    } else if (currentRank <= 3) {
      setCelebrations({ [item.bib_number]: 'top3' })
      fireTop3Confetti()
      playCelebrationSound('top3', isMutedRef.current)
      setActiveToast({
        type: 'top3',
        title: `🎉 MASUK PERINGKAT ${currentRank}!`,
        subtitle: `${item.participant_name} menembus 3 besar (${formatTimerMMSSCC(item.duration_ms)})`,
      })
    } else {
      setCelebrations({ [item.bib_number]: 'reveal' })
      playRevealSound(isMutedRef.current)
      setActiveToast({
        type: 'top3',
        title: `🍼 HASIL FINISH PERINGKAT ${currentRank}`,
        subtitle: `${item.participant_name} (${formatTimerMMSSCC(item.duration_ms)})`,
      })
    }

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setActiveToast(null), 4500)
    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current)
    celebrationTimerRef.current = setTimeout(() => setCelebrations({}), 4000)
  }, [])

  // 3. STAGGERED REVEAL QUEUE: JEDA 10 - 15 DETIK PER NAMA JIKA MASUK BERSAMAAN
  const startStaggeredReveal = useCallback((newlyFinished: LeaderboardItem[], finalData: LeaderboardItem[]) => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)

    // Urutkan reveal: dari peringkat paling bawah naik ke Juara 1 (format suspense TV)
    const sortedToReveal = [...newlyFinished].sort((a, b) => (b.rank || 0) - (a.rank || 0))

    targetDataRef.current = finalData
    pendingQueueRef.current = sortedToReveal
    setIsRevealing(true)
    isRevealingRef.current = true
    setRevealProgress({ current: 0, total: sortedToReveal.length })

    const stepReveal = (stepIdx: number) => {
      if (pendingQueueRef.current.length === 0) {
        // Periksa apakah ada batch match baru yang masuk saat proses reveal sebelumnya berjalan
        const currentBoard = leaderboardRef.current
        const newlyArrivedDuringReveal = targetDataRef.current.filter((newItem) => {
          const cur = currentBoard.find((c) => c.bib_number === newItem.bib_number)
          const hadNoTime = !cur || cur.duration_ms === null || cur.duration_ms === undefined
          const nowHasTime = newItem.duration_ms !== null && newItem.duration_ms !== undefined
          return hadNoTime && nowHasTime
        })

        if (newlyArrivedDuringReveal.length > 0) {
          const nextBatch = [...newlyArrivedDuringReveal].sort((a, b) => (b.rank || 0) - (a.rank || 0))
          pendingQueueRef.current = nextBatch
          setRevealProgress({ current: 0, total: nextBatch.length })
          stepReveal(0)
          return
        }

        // Semua nama selesai direveal!
        setLeaderboard(targetDataRef.current)
        leaderboardRef.current = targetDataRef.current
        setIsRevealing(false)
        isRevealingRef.current = false
        setRevealingItem(null)
        setCountdown(0)
        setTimeout(() => setCelebrations({}), 3500)
        return
      }

      const item = pendingQueueRef.current.shift()!
      setRevealingItem(item)
      setRevealProgress({ current: stepIdx + 1, total: sortedToReveal.length })

      // Update tampilan papan skor bertahap:
      // Bayi ini mendapatkan nilai durasinya, sedangkan bayi di antrean berikutnya masih menunggu
      const currentBoard = [...leaderboardRef.current]
      let existsInBoard = false
      const nextBoard = currentBoard.map((c) => {
        if (c.bib_number === item.bib_number) {
          existsInBoard = true
          return { ...c, duration_ms: item.duration_ms, rank: item.rank }
        }
        return c
      })

      // JIKA BAYI INI BARU MASUK (BELUM ADA DI PAPAN SKOR), TAMBAHKAN SATU PERSATU SECARA BERTAHAP!
      if (!existsInBoard) {
        nextBoard.push({ ...item })
      }

      // Sortir urutan: yang sudah ada catatan waktu di atas, yang belum tetap di bawah
      nextBoard.sort((a, b) => {
        const hasA = a.duration_ms !== null && a.duration_ms !== undefined
        const hasB = b.duration_ms !== null && b.duration_ms !== undefined
        if (hasA && hasB) return (a.duration_ms || 0) - (b.duration_ms || 0)
        if (hasA && !hasB) return -1
        if (!hasA && hasB) return 1
        return 0
      })

      nextBoard.forEach((p, idx) => {
        p.rank = idx + 1
      })

      setLeaderboard(nextBoard)
      leaderboardRef.current = nextBoard

      // Selebrasi & efek audio per nama yang muncul
      const currentRank = item.rank || 1
      const isChamp = currentRank === 1
      const isTop3 = currentRank <= 3

      if (isChamp) {
        setCelebrations({ [item.bib_number]: 'champion' })
        fireChampionConfetti()
        playCelebrationSound('champion', isMutedRef.current)
        setActiveToast({
          type: 'champion',
          title: '👑 JUARA 1 BARU!',
          subtitle: `${item.participant_name} merebut posisi 1 (${formatTimerMMSSCC(item.duration_ms)})`,
        })
      } else if (isTop3) {
        setCelebrations({ [item.bib_number]: 'top3' })
        fireTop3Confetti()
        playCelebrationSound('top3', isMutedRef.current)
        setActiveToast({
          type: 'top3',
          title: `🎉 MASUK PERINGKAT ${currentRank}!`,
          subtitle: `${item.participant_name} menembus 3 besar (${formatTimerMMSSCC(item.duration_ms)})`,
        })
      } else {
        setCelebrations({ [item.bib_number]: 'reveal' })
        playRevealSound(isMutedRef.current)
        setActiveToast({
          type: 'top3',
          title: `🍼 HASIL FINISH PERINGKAT ${currentRank}`,
          subtitle: `${item.participant_name} (${formatTimerMMSSCC(item.duration_ms)})`,
        })
      }

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setActiveToast(null), 4500)

      // Mulai countdown jeda untuk nama berikutnya (10 - 15 detik)
      let timeLeft = revealDelayRef.current
      setCountdown(timeLeft)

      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = setInterval(() => {
        timeLeft -= 1
        setCountdown(Math.max(0, timeLeft))
        if (timeLeft <= 0) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
          stepReveal(stepIdx + 1)
        }
      }, 1000)
    }

    stepReveal(0)
  }, [])

  // 4. Proses update peringkat: deteksi apakah data masuk bersamaan atau tunggal
  const applyLeaderboardUpdate = useCallback((nextData: LeaderboardItem[]) => {
    const prevRanks = previousRanksRef.current

    // Initial load: langsung render penuh tanpa antrean
    if (prevRanks.size === 0) {
      for (let idx = 0; idx < nextData.length; idx++) {
        const item = nextData[idx]
        const rank = item.rank || idx + 1
        prevRanks.set(item.bib_number, rank)
      }
      setLeaderboard(nextData)
      leaderboardRef.current = nextData
      targetDataRef.current = nextData
      return
    }

    // Jika sedang dalam proses reveal animasi bertahap, simpan data final tapi jangan potong animasi
    if (isRevealingRef.current) {
      targetDataRef.current = nextData
      return
    }

    // Deteksi nama-nama yang baru saja selesai bertanding di batch update ini
    const currentBoard = leaderboardRef.current
    const newlyFinished: LeaderboardItem[] = []

    nextData.forEach((newItem) => {
      const cur = currentBoard.find((c) => c.bib_number === newItem.bib_number)
      const hadNoTime = !cur || cur.duration_ms === null || cur.duration_ms === undefined
      const nowHasTime = newItem.duration_ms !== null && newItem.duration_ms !== undefined
      const timeChanged = cur && cur.duration_ms !== newItem.duration_ms && nowHasTime
      if ((hadNoTime && nowHasTime) || timeChanged) {
        newlyFinished.push(newItem)
      }
    })

    // Perbarui map peringkat
    const newRanksMap = new Map<string, number>()
    for (let idx = 0; idx < nextData.length; idx++) {
      const item = nextData[idx]
      newRanksMap.set(item.bib_number, item.rank || idx + 1)
    }
    previousRanksRef.current = newRanksMap

    // Tidak ada waktu baru yang masuk
    if (newlyFinished.length === 0) {
      setLeaderboard(nextData)
      leaderboardRef.current = nextData
      targetDataRef.current = nextData
      return
    }

    // Hanya 1 nama
    if (newlyFinished.length === 1) {
      revealSingleItem(newlyFinished[0], nextData)
      return
    }

    // NAMA-NAMA MASUK BERSAMAAN (1 MATCH SELESAI / BATCH SHEET):
    // KASIH JEDA PER NAMA 10 - 15 DETIK!
    startStaggeredReveal(newlyFinished, nextData)
  }, [revealSingleItem, startStaggeredReveal])

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
    // [Spasi] = Lewati Reveal / Tampilkan Semua Langsung
    // [J] / [T] = Ganti Jeda (10s -> 12s -> 15s)
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase()
      if (activeTag === 'input' || activeTag === 'textarea') return

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        triggerTestCelebration()
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        setIsMuted((prev) => !prev)
      } else if (e.code === 'Space') {
        e.preventDefault()
        skipReveal()
      } else if (e.key === 'j' || e.key === 'J' || e.key === 't' || e.key === 'T') {
        e.preventDefault()
        setRevealDelay((prev) => {
          const next = prev === 10 ? 12 : prev === 12 ? 15 : 10
          try { localStorage.setItem('olimpiakids_reveal_delay', next.toString()) } catch {}
          return next
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      supabase.removeChannel(channel)
      clearInterval(interval)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current)
    }
  }, [loadLeaderboardData, triggerTestCelebration, skipReveal])

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

      {/* 2.5 STAGGERED REVEAL BANNER (JEDA 10 - 15 DETIK PER NAMA JIKA MASUK BERSAMAAN) */}
      <AnimatePresence>
        {isRevealing && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-amber-950 px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl flex items-center justify-between shadow-lg border-2 border-white mb-1.5 sm:mb-2 shrink-0 overflow-hidden select-none"
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="text-base sm:text-xl animate-pulse">⏱️</span>
              <div className="font-display font-black text-xs sm:text-sm md:text-base truncate flex items-center gap-1.5">
                <span className="text-amber-900 uppercase">
                  REVEAL HASIL ({revealProgress.current}/{revealProgress.total}):
                </span>
                <span className="bg-white/95 px-2 py-0.5 rounded-lg text-amber-950 shadow-sm font-black truncate max-w-[140px] sm:max-w-xs">
                  {revealingItem?.participant_name}
                </span>
                <span className="text-[11px] bg-amber-950 text-yellow-300 font-mono px-1.5 py-0.5 rounded font-black">
                  #{revealingItem?.rank}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="font-mono font-black text-xs sm:text-sm flex items-center gap-1">
                <span className="opacity-75 hidden md:inline">Berikutnya:</span>
                <span className="bg-amber-950 text-yellow-300 px-2 py-0.5 rounded-lg text-xs sm:text-sm font-black shadow-inner min-w-[32px] text-center">
                  {countdown}s
                </span>
              </div>

              <button
                onClick={skipReveal}
                className="bg-amber-950 hover:bg-black text-white font-bold text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl active:scale-95 transition-all shadow-sm"
                title="Tampilkan semua langsung tanpa jeda (Hotkey: Spasi)"
              >
                Lewati [Spasi]
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* 4. FLOATING OPERATOR CONTROLS (PENGATURAN JEDA & MUTE) */}
      <div className="fixed bottom-2 right-2 sm:bottom-3 sm:right-3 z-50 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-white px-2.5 py-1 rounded-full text-[10px] sm:text-xs shadow-lg opacity-40 hover:opacity-100 transition-opacity">
        <span className="text-slate-400 font-bold hidden sm:inline">⏱️ Jeda:</span>
        {[10, 12, 15].map((sec) => (
          <button
            key={sec}
            onClick={() => {
              setRevealDelay(sec)
              try { localStorage.setItem('olimpiakids_reveal_delay', sec.toString()) } catch {}
            }}
            className={`px-1.5 py-0.5 rounded-md font-bold transition-all ${
              revealDelay === sec
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={`Atur jeda reveal antar nama ke ${sec} detik`}
          >
            {sec}s
          </button>
        ))}
        <span className="text-slate-600">|</span>
        <button
          onClick={() => setIsMuted((prev) => !prev)}
          className="text-slate-300 hover:text-white"
          title="Toggle Mute (Hotkey: M)"
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  )
}
