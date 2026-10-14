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

  // 2. Initial load + Supabase Realtime Subscription
  useEffect(() => {
    loadLeaderboardData()

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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadLeaderboardData])

  return (
    <div className="relative z-10 w-full max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 flex flex-col items-center">
      {/* 1. LOGO DI TENGAH ATAS DENGAN ANIMASI FLOAT HALUS */}
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="flex justify-center -mb-[2px]"
      >
        {!logoError ? (
          <Image
            src="/logo.webp"
            alt="Olimpiakids"
            width={240}
            height={95}
            priority
            className="w-auto h-auto max-w-[min(54vw,230px)] object-contain drop-shadow select-none"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="font-display font-black text-2xl sm:text-3xl text-blue-900 tracking-wider">
            OLIMPIAKIDS
          </div>
        )}
      </motion.div>

      {/* 2. HEADER EVENT ROW: [EVENT TITLE PILL CLEAN TANPA BADGE LIVE & TANPA STATUS FOOTER] */}
      <div className="w-full flex items-center justify-center mb-4 sm:mb-5">
        <motion.div
          animate={{ scale: [1, 1.015, 1] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          className="w-full max-w-xl bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 text-white rounded-full py-3 sm:py-3.5 px-6 sm:px-8 border-[3.5px] border-white shadow-[0_5px_0_rgba(29,78,216,0.7)] text-center relative overflow-hidden"
        >
          {/* Subtle Shimmer Ray */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-150%] animate-[shimmer_3s_infinite]" />
          
          <h1 className="font-display font-black text-base sm:text-xl md:text-2xl tracking-tight uppercase leading-none drop-shadow-sm flex items-center justify-center gap-2">
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

      {/* 3. RANKING CARD (CONTAINER UTAMA LEADERBOARD) */}
      <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl border-[3.5px] border-white shadow-2xl p-2.5 sm:p-3">
        {/* HEADER ROW TABEL (12% 22% 41% 25%) */}
        <div
          className="grid items-center bg-gradient-to-b from-blue-500 to-blue-600 text-white font-display font-black text-xs sm:text-sm uppercase tracking-wide rounded-2xl min-h-[44px] px-3 sm:px-4 py-2.5 mb-2.5 shadow-sm select-none"
          style={{
            gridTemplateColumns: '12% 22% 41% 25%',
          }}
        >
          <div className="text-center flex items-center justify-center gap-1">
            <span>NO.</span>
          </div>
          <div className="text-center">NOMOR DADA</div>
          <div className="text-center">NAMA ANAK</div>
          <div className="text-center">TIMER</div>
        </div>

        {/* LIST BARIS PESERTA */}
        <div>
          <AnimatePresence>
            {isLoading && leaderboard.length === 0 ? (
              <div className="py-14 text-center text-slate-500 font-sans font-bold text-sm flex flex-col items-center justify-center gap-2.5">
                <div className="w-7 h-7 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-base text-blue-900 font-display">Memuat data peserta...</span>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-14 text-center text-slate-500 font-sans font-bold text-sm">
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
