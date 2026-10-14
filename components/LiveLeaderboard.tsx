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
  const [isRealtimeSubscribed, setIsRealtimeSubscribed] = useState(false)
  const [logoError, setLogoError] = useState(false)

  // 1. Fetch data dari Supabase
  const loadLeaderboardData = useCallback(async () => {
    try {
      setFetchError(null)
      console.log('🔄 [Leaderboard] Memuat data perlombaan dari Supabase...')

      const raceRes = await getActiveRace()
      if (raceRes.error) {
        console.warn('⚠️ [Leaderboard] Gagal memuat active race:', raceRes.error)
        setFetchError(raceRes.error)
        setIsLoading(false)
        return
      }

      if (raceRes.data) {
        setActiveRace(raceRes.data)
        const boardRes = await getLeaderboard(raceRes.data.id)
        if (boardRes.error) {
          console.warn('⚠️ [Leaderboard] Gagal memuat leaderboard:', boardRes.error)
          setFetchError(boardRes.error)
        } else {
          setLeaderboard(boardRes.data || [])
          console.log(`✅ [Leaderboard] Berhasil memuat ${boardRes.data?.length || 0} peserta.`)
        }
      } else {
        setActiveRace(null)
        setLeaderboard([])
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Gagal menghubungi server'
      console.error('❌ [Leaderboard] Error fetch:', errMsg)
      setFetchError(errMsg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 2. Initial load + Supabase Realtime Subscription
  useEffect(() => {
    loadLeaderboardData()

    console.log('📡 [Realtime] Menghubungkan ke channel Supabase "race-updates"...')

    // Dengarkan perubahan pada race_results dan race_events
    const channel = supabase
      .channel('race-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'race_results' },
        (payload) => {
          console.log('⚡ [Realtime Event] Perubahan terdeteksi pada race_results:', payload)
          loadLeaderboardData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'race_events' },
        (payload) => {
          console.log('⚡ [Realtime Event] Perubahan terdeteksi pada race_events:', payload)
          loadLeaderboardData()
        }
      )
      .subscribe((status, err) => {
        console.log(`📡 [Realtime Status]: ${status}`, err || '')
        if (status === 'SUBSCRIBED') {
          setIsRealtimeSubscribed(true)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsRealtimeSubscribed(false)
        }
      })

    return () => {
      console.log('🔌 [Realtime] Melepas channel "race-updates"')
      supabase.removeChannel(channel)
    }
  }, [loadLeaderboardData])

  // Logic Status Indicator yang akurat
  const renderStatusIndicator = () => {
    if (fetchError) {
      return (
        <span className="text-rose-500 font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          ● Offline
        </span>
      )
    }

    if (isLoading && leaderboard.length === 0) {
      return (
        <span className="text-slate-400 font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
          ○ Memuat data...
        </span>
      )
    }

    if (leaderboard.length === 0) {
      return (
        <span className="text-slate-500 font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          ○ Tidak ada data
        </span>
      )
    }

    // Jika data ada:
    if (isRealtimeSubscribed) {
      return (
        <span className="text-emerald-600 font-black flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          ● LIVE
        </span>
      )
    }

    // Ada data tapi realtime belum subscribed / reconnecting
    return (
      <span className="text-amber-500 font-black flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        ● LIVE
      </span>
    )
  }

  return (
    <div className="relative z-10 w-full max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 flex flex-col items-center">
      {/* 1. LOGO DI TENGAH ATAS DENGAN ANIMASI FLOAT (-3px) */}
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="flex justify-center -mb-[3px]"
      >
        {!logoError ? (
          <Image
            src="/logo.webp"
            alt="Olimpiakids"
            width={220}
            height={90}
            priority
            className="w-auto h-auto max-w-[min(52vw,220px)] object-contain drop-shadow-sm select-none"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="font-display font-black text-2xl sm:text-3xl text-blue-900 tracking-wider">
            OLIMPIAKIDS
          </div>
        )}
      </motion.div>

      {/* 2. HEADER EVENT ROW: [EVENT TITLE PILL] [LIVE BADGE] */}
      <div className="w-full flex items-center justify-center gap-2.5 sm:gap-3 mb-4 sm:mb-5">
        {/* EVENT TITLE PILL */}
        <div className="flex-1 max-w-xl bg-gradient-to-b from-blue-500 to-blue-600 text-white rounded-full py-2.5 sm:py-3.5 px-4 sm:px-6 border-[3px] border-white shadow-[0_4px_0_rgba(29,78,216,0.6)] text-center">
          <h1 className="font-display font-black text-base sm:text-xl md:text-2xl tracking-tight uppercase leading-none drop-shadow-sm truncate">
            {activeRace?.name && activeRace.name.toLowerCase().includes('leaderboard')
              ? activeRace.name
              : activeRace?.name || 'LEADERBOARD BABY CRAWLING'}
          </h1>
        </div>

        {/* LIVE BADGE: PILL PUTIH DENGAN DOT PULSING */}
        <div className="shrink-0 bg-white rounded-full px-3.5 sm:px-4 py-2 sm:py-2.5 border-2 border-rose-300 shadow-sm flex items-center gap-2 select-none">
          <span className="relative flex h-3 w-3">
            <motion.span
              animate={{ opacity: [1, 0.35, 1], scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              className="absolute inline-flex h-full w-full rounded-full bg-rose-500"
            />
          </span>
          <span className="font-display font-black text-rose-600 text-xs sm:text-sm tracking-wider uppercase leading-none">
            LIVE
          </span>
        </div>
      </div>

      {/* 3. RANKING CARD (CONTAINER UTAMA) */}
      <div className="w-full bg-white/95 backdrop-blur-sm rounded-3xl border-[3px] border-white shadow-xl p-2 sm:p-2.5">
        {/* HEADER ROW TABEL (12% 22% 41% 25%) */}
        <div
          className="grid items-center bg-gradient-to-b from-blue-500 to-blue-600 text-white font-display font-black text-xs sm:text-sm uppercase tracking-wide rounded-2xl min-h-[40px] px-3 sm:px-4 py-2 mb-2 shadow-sm select-none"
          style={{
            gridTemplateColumns: '12% 22% 41% 25%',
          }}
        >
          <div className="text-center">NO.</div>
          <div className="text-center">NOMOR DADA</div>
          <div className="text-center">NAMA ANAK</div>
          <div className="text-center">TIMER</div>
        </div>

        {/* LIST BARIS PESERTA */}
        <div>
          <AnimatePresence>
            {isLoading && leaderboard.length === 0 ? (
              <div className="py-12 text-center text-slate-500 font-sans font-bold text-sm flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Memuat data leaderboard...</span>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-12 text-center text-slate-500 font-sans font-bold text-sm">
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

      {/* 4. STATUS BAR AKURAT DI KANAN BAWAH */}
      <div className="w-full flex justify-end mt-3 pr-1">
        <div className="inline-flex items-center gap-1.5 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] font-sans shadow-xs border border-white">
          {renderStatusIndicator()}
        </div>
      </div>
    </div>
  )
}
