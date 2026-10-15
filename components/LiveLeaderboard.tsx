'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { LeaderboardItem, RaceEvent } from '@/types/database'
import { getActiveRace, getLeaderboard } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import RankRow from './RankRow'

export default function LiveLeaderboard() {
  const [activeRace, setActiveRace] = useState<RaceEvent | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [logoError, setLogoError] = useState(false)

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
          setLeaderboard(boardRes.data || [])
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
  }, [])

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
    }
  }, [loadLeaderboardData])

  return (
    <div className="relative z-10 w-full max-w-6xl 2xl:max-w-7xl mx-auto px-3 sm:px-6 md:px-8 py-3 sm:py-5 flex flex-col items-center">
      {/* 1. BRANDING LOGO: ATAS BAWAH (TRANS TV KECIL DI ATAS, OLIMPIAKIDS BESAR DI BAWAH) */}
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="flex flex-col items-center justify-center gap-1.5 sm:gap-2 mb-3 sm:mb-4 px-2 select-none"
      >
        {/* LOGO TRANS TV (LEBIH KECIL DI ATAS) */}
        <div className="relative flex items-center justify-center">
          <Image
            src="/Trans_TV_2013.png"
            alt="Trans TV"
            width={100}
            height={32}
            priority
            className="w-auto h-4 sm:h-5 md:h-6 object-contain drop-shadow-sm opacity-85 hover:opacity-100 transition-opacity"
          />
        </div>

        {/* LOGO OLIMPIAKIDS (LEBIH BESAR DI BAWAH) */}
        <div className="relative flex items-center justify-center -mt-0.5 sm:-mt-1">
          {!logoError ? (
            <Image
              src="/olimpiakids.png"
              alt="Olimpiakids"
              width={420}
              height={160}
              priority
              className="w-auto h-20 sm:h-28 md:h-36 lg:h-40 xl:h-44 object-contain drop-shadow-lg"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="font-display font-black text-4xl sm:text-6xl md:text-7xl text-blue-900 tracking-wider drop-shadow-md">
              OLIMPIAKIDS
            </div>
          )}
        </div>
      </motion.div>

      {/* 2. HEADER TITLE PILL: LEBAR LEBIH LUAS DI TV, SELARAS DENGAN CONTAINER TABEL */}
      <div className="w-full mb-3 sm:mb-4">
        <motion.div
          animate={{ scale: [1, 1.008, 1] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          className="w-full bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 text-white rounded-2xl sm:rounded-full py-2.5 sm:py-3.5 md:py-4 px-4 sm:px-8 border-[3px] sm:border-[4px] border-white shadow-[0_4px_0_rgba(29,78,216,0.7)] text-center relative overflow-hidden"
        >
          {/* Subtle Ray Animation */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-150%] animate-[shimmer_3s_infinite]" />

          <h1 className="font-display font-black text-sm sm:text-xl md:text-2xl lg:text-3xl tracking-wide uppercase leading-none drop-shadow-sm flex items-center justify-center gap-2 sm:gap-3">
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

      {/* 3. RANKING CARD (CONTAINER UTAMA LEADERBOARD) - LEBAR DISESUAIKAN UNTUK DISPLAY TV */}
      <div className="w-full bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border-[3px] sm:border-[4px] border-white shadow-xl sm:shadow-2xl p-2.5 sm:p-4 md:p-5 overflow-hidden">
        {/* HEADER ROW TABEL (10% 20% 48% 22%) */}
        <div
          className="grid items-center bg-gradient-to-b from-blue-500 to-blue-600 text-white font-display font-black text-[11px] sm:text-sm md:text-base lg:text-lg uppercase tracking-wide rounded-xl sm:rounded-2xl min-h-[40px] sm:min-h-[48px] md:min-h-[52px] px-3 sm:px-6 py-2 sm:py-2.5 mb-2 sm:mb-3 shadow-sm select-none"
          style={{
            gridTemplateColumns: '10% 20% 48% 22%',
          }}
        >
          <div className="text-center">NO.</div>
          <div className="text-center truncate">NOMOR DADA</div>
          <div className="text-left pl-2 sm:pl-4 truncate">NAMA ANAK</div>
          <div className="text-center">TIMER</div>
        </div>

        {/* LIST BARIS PESERTA */}
        <div className="w-full">
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
                  key={item.participant_id || index}
                  rank={item.rank || index + 1}
                  bib_number={item.bib_number}
                  participant_name={item.participant_name}
                  duration_ms={item.duration_ms}
                  index={index}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
