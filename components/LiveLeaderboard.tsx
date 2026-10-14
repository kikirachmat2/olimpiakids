'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { LeaderboardItem, RaceEvent } from '@/types/database'
import { getActiveRace, getLeaderboard } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import RankRow from './RankRow'

// Data dummy fallback awal jika belum ada data di Supabase
const SAMPLE_ROWS: LeaderboardItem[] = [
  {
    rank: 1,
    participant_id: 1,
    participant_name: 'Muhammad Arka',
    bib_number: '07',
    duration_ms: 12450, // 00.12.45
    finish_time: '2026-10-14T15:01:12.450Z',
    status: 'finished',
  },
  {
    rank: 2,
    participant_id: 2,
    participant_name: 'Gwen Aurelia',
    bib_number: '12',
    duration_ms: 13820, // 00.13.82
    finish_time: '2026-10-14T15:01:13.820Z',
    status: 'finished',
  },
  {
    rank: 3,
    participant_id: 3,
    participant_name: 'Rayyan Al-Fatih',
    bib_number: '03',
    duration_ms: 15110, // 00.15.11
    finish_time: '2026-10-14T15:01:15.110Z',
    status: 'finished',
  },
  {
    rank: 4,
    participant_id: 4,
    participant_name: 'Alana Kirana',
    bib_number: '18',
    duration_ms: 16900, // 00.16.90
    finish_time: '2026-10-14T15:01:16.900Z',
    status: 'finished',
  },
  {
    rank: 5,
    participant_id: 5,
    participant_name: 'Mikail Ibrahim',
    bib_number: '05',
    duration_ms: 18240, // 00.18.24
    finish_time: '2026-10-14T15:01:18.240Z',
    status: 'finished',
  },
]

export default function LiveLeaderboard() {
  const [activeRace, setActiveRace] = useState<RaceEvent | null>({
    id: 1,
    name: 'LEADERBOARD BABY CRAWLING',
    status: 'running',
    start_time: '2026-10-14T15:00:00.000Z',
  })
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>(SAMPLE_ROWS)
  const [logoError, setLogoError] = useState(false)
  const [hasLiveConnection, setHasLiveConnection] = useState(false)

  // 1. Fetch data dari Supabase
  const loadLeaderboardData = async () => {
    try {
      const raceRes = await getActiveRace()
      if (raceRes.data) {
        setActiveRace(raceRes.data)
        const boardRes = await getLeaderboard(raceRes.data.id)
        if (boardRes.data && boardRes.data.length > 0) {
          setLeaderboard(boardRes.data)
        }
      }
    } catch (err) {
      console.error('Error fetching leaderboard data:', err)
    }
  }

  // 2. Initial load + Supabase Realtime Subscription
  useEffect(() => {
    loadLeaderboardData()

    // Dengarkan perubahan pada race_results dan race_events
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setHasLiveConnection(true)
        } else {
          setHasLiveConnection(false)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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
          <h1 className="font-display font-black text-base sm:text-xl md:text-2xl tracking-tight uppercase leading-none drop-shadow-sm">
            {activeRace?.name && activeRace.name.toLowerCase().includes('leaderboard')
              ? activeRace.name
              : 'LEADERBOARD BABY CRAWLING'}
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
            {leaderboard.length === 0 ? (
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

      {/* 4. STATUS BAR KECIL DI KANAN BAWAH */}
      <div className="w-full flex justify-end mt-3 pr-1">
        <div className="inline-flex items-center gap-1.5 bg-white/70 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-sans font-bold text-slate-600 shadow-xs">
          <span className={hasLiveConnection ? 'text-emerald-500' : 'text-slate-400'}>
            {hasLiveConnection ? '● LIVE' : '○ Menunggu data'}
          </span>
        </div>
      </div>
    </div>
  )
}
