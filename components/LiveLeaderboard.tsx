'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { LeaderboardItem, RaceEvent } from '@/types/database'
import { getActiveRace, getLeaderboard } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import RankRow, { RowMovement } from './RankRow'

export default function LiveLeaderboard() {
  const [activeRace, setActiveRace] = useState<RaceEvent | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([])
  const [movements, setMovements] = useState<Record<string, RowMovement>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [logoError, setLogoError] = useState(false)

  const previousRanksRef = React.useRef<Map<string, number>>(new Map())
  const isAnimatingRef = React.useRef(false)
  const pendingDataRef = React.useRef<LeaderboardItem[] | null>(null)
  const animationTimerRef = React.useRef<NodeJS.Timeout | null>(null)

  // Buffer & proses pergerakan peringkat dengan animasi broadcast 2.4 detik
  const applyLeaderboardUpdate = useCallback((nextData: LeaderboardItem[]) => {
    // Jika sedang dalam proses animasi pergerakan, tahan data baru agar transisi tidak patah/terpotong
    if (isAnimatingRef.current) {
      pendingDataRef.current = nextData
      return
    }

    const prevRanks = previousRanksRef.current
    const newMovements: Record<string, RowMovement> = {}
    let hasRankChanges = false

    // Initial load: simpan posisi awal tanpa memicu animasi perpindahan
    if (prevRanks.size === 0) {
      nextData.forEach((item, idx) => {
        const rank = item.rank || idx + 1
        prevRanks.set(item.bib_number, rank)
      })
      setLeaderboard(nextData)
      return
    }

    // Deteksi naik / turun untuk setiap nomor dada
    nextData.forEach((item, idx) => {
      const newRank = item.rank || idx + 1
      const oldRank = prevRanks.get(item.bib_number)

      if (oldRank !== undefined && oldRank !== newRank) {
        hasRankChanges = true
        if (newRank < oldRank) {
          // Naik ke peringkat lebih tinggi (misal: 8 -> 1)
          newMovements[item.bib_number] = 'up'
        } else {
          // Turun peringkat (misal: 1 -> 2)
          newMovements[item.bib_number] = 'down'
        }
      } else {
        newMovements[item.bib_number] = 'idle'
      }
    })

    // Perbarui map peringkat sekarang
    const newRanksMap = new Map<string, number>()
    nextData.forEach((item, idx) => {
      newRanksMap.set(item.bib_number, item.rank || idx + 1)
    })
    previousRanksRef.current = newRanksMap

    if (hasRankChanges) {
      // Kunci proses animasi selama 2.6 detik (2.4 detik animasi layout + buffer 200ms)
      isAnimatingRef.current = true
      setMovements(newMovements)
      setLeaderboard(nextData)

      if (animationTimerRef.current) clearTimeout(animationTimerRef.current)
      animationTimerRef.current = setTimeout(() => {
        isAnimatingRef.current = false
        setMovements({}) // Kembalikan scale & z-index ke posisi normal secara halus

        // Jika ada data baru yang masuk selama animasi, proses segera
        if (pendingDataRef.current) {
          const queued = pendingDataRef.current
          pendingDataRef.current = null
          applyLeaderboardUpdate(queued)
        }
      }, 2600)
    } else {
      // Tidak ada perubahan urutan peringkat (hanya update waktu atau nama jika ada)
      setLeaderboard((prev) => {
        if (
          prev.length === nextData.length &&
          prev.every(
            (item, idx) =>
              item.bib_number === nextData[idx].bib_number &&
              item.duration_ms === nextData[idx].duration_ms &&
              item.participant_name === nextData[idx].participant_name &&
              item.rank === nextData[idx].rank
          )
        ) {
          return prev
        }
        return nextData
      })
    }
  }, [])

  // 1. Fetch data dari Supabase
  const loadLeaderboardData = useCallback(async () => {
    try {
      setFetchError(null)
      const raceRes = await getActiveRace()
      if (raceRes.error) {
        setFetchError(raceRes.error)
        setIsLoading(false)
        return
      }

      if (raceRes.data) {
        setActiveRace(raceRes.data)
        const boardRes = await getLeaderboard(raceRes.data.id)
        if (boardRes.error) {
          setFetchError(boardRes.error)
        } else {
          applyLeaderboardUpdate(boardRes.data || [])
        }
      } else {
        setActiveRace(null)
        setLeaderboard([])
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Gagal menghubungi server'
      setFetchError(errMsg)
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

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current)
    }
  }, [loadLeaderboardData])

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

      {/* 2. HEADER TITLE PILL: LEBAR LEBIH LUAS DI TV, SELARAS DENGAN CONTAINER TABEL */}
      <div className="w-full mb-1 sm:mb-2 lg:mb-2 shrink-0">
        <motion.div
          animate={{ scale: [1, 1.005, 1] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          className="w-full bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 text-white rounded-xl sm:rounded-full py-1.5 sm:py-2.5 md:py-2.5 lg:py-3 px-3 sm:px-6 md:px-8 border-[2.5px] sm:border-[3.5px] border-white shadow-[0_3px_0_rgba(29,78,216,0.7)] text-center relative overflow-hidden"
        >
          {/* Subtle Ray Animation */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-150%] animate-[shimmer_3s_infinite]" />

          <h1 className="font-display font-black text-xs sm:text-lg md:text-xl lg:text-2xl tracking-wide uppercase leading-none drop-shadow-sm flex items-center justify-center gap-1.5 sm:gap-2">
            <span>🍼</span>
            <span className="truncate">
              {activeRace?.name && activeRace.name.toLowerCase().includes('leaderboard')
                ? activeRace.name
                : activeRace?.name || 'LEADERBOARD BABY CRAWLING'}
            </span>
            <span>⭐</span>
          </h1>
        </motion.div>
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
                  index={index}
                  movement={movements[item.bib_number] || 'idle'}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
