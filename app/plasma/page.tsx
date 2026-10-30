'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, CheckCircle2, Lock, Sparkles, Clock, Zap } from 'lucide-react'
import { DEFAULT_MATCHES, WasitMatch, WasitParticipant } from '@/lib/wasitDefaults'
import {
  getSyncChannel,
  broadcastSessionEvent,
  CLIENT_ID,
  RealtimeSessionPayload,
} from '@/lib/realtimeSync'
import {
  ActiveMatchSession,
  INITIAL_MATCH_SESSION,
  getActiveSession,
} from '@/lib/sessionStore'

function formatTime(ms: number): string {
  if (ms < 0) ms = 0
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const centiseconds = Math.floor((ms % 1000) / 10)
  const pad = (n: number) => (n < 10 ? '0' + n : String(n))
  return `${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`
}

export default function PlasmaDisplayPage() {
  const [matches, setMatches] = useState<WasitMatch[]>(DEFAULT_MATCHES)

  // Match yang sedang AKTIF DITAMPILKAN di layar Plasma
  // Aturan Plasma: Plasma TETAP STAY di data match terakhir yang selesai (LOCKED_FINAL)
  // dan HANYA BERUBAH jika Wasit membuka gembok match baru (UNLOCKED).
  const [displayedMatchId, setDisplayedMatchId] = useState<number>(1)
  const [isLockedFinal, setIsLockedFinal] = useState<boolean>(false)

  // Data peserta yang ditampilkan di Plasma
  const [participants, setParticipants] = useState<WasitParticipant[]>(
    DEFAULT_MATCHES[0]?.participants || []
  )

  // Splits timer aktif
  const [splits, setSplits] = useState<Array<{ position: number; timer: string; elapsedMs: number }>>([])

  // Final merged results saat LOCKED_FINAL
  const [finalResults, setFinalResults] = useState<
    Array<{ position: number; bib_number: string; name: string; status: string; timer: string }>
  >([])

  // Stopwatch state
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  // Status gembok match yang sedang ditampilkan
  const [matchStatus, setMatchStatus] = useState<
    'LOCKED' | 'UNLOCKED' | 'RUNNING' | 'TIMER_COMPLETED' | 'LOCKED_FINAL'
  >('LOCKED')

  const startTimeRef = useRef<number | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const lastVersionRef = useRef<number>(0)

  const displayedMatch =
    matches.find((m) => m.id === displayedMatchId) || matches[0] || DEFAULT_MATCHES[0]

  // =========================================================================
  // 1. INITIAL LOAD: Fetch matches & Active Session
  // =========================================================================
  useEffect(() => {
    // A. Ambil daftar match
    fetch('/api/wasit/matches?refresh=true')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.matches && data.matches.length > 0) {
          setMatches(data.matches)
          setParticipants((prev) => {
            if (!prev || prev.length === 0) {
              const found = data.matches.find((m: WasitMatch) => m.id === displayedMatchId) || data.matches[0]
              return found?.participants || DEFAULT_MATCHES[0]?.participants || []
            }
            return prev
          })
        }
      })
      .catch(() => {})

    // B. Ambil session aktif dari server
    fetch('/api/plasma/state', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && json.ok && json.session) {
          const s = json.session as ActiveMatchSession
          applySessionToPlasma(s, true)
        }
      })
      .catch(() => {})
  }, [displayedMatchId])

  // =========================================================================
  // 2. STOPWATCH RAF LOOP (Smooth 60FPS)
  // =========================================================================
  useEffect(() => {
    if (isRunning && startTimeRef.current) {
      const loop = () => {
        const now = Date.now()
        setElapsedMs(Math.max(0, now - (startTimeRef.current || now)))
        animFrameRef.current = requestAnimationFrame(loop)
      }
      animFrameRef.current = requestAnimationFrame(loop)
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
  }, [isRunning])

  // =========================================================================
  // 3. LOGIKA PENERIMAAN SESI (SESSION DISPATCHER)
  // =========================================================================
  const applySessionToPlasma = useCallback(
    (s: ActiveMatchSession, isInitial = false) => {
      if (!s) return

      const targetId = s.matchId || 1
      const statusUpper = (s.status || 'LOCKED').toUpperCase() as
        | 'LOCKED'
        | 'UNLOCKED'
        | 'RUNNING'
        | 'TIMER_COMPLETED'
        | 'LOCKED_FINAL'
      const fallbackList =
        DEFAULT_MATCHES.find((m) => m.id === targetId)?.participants ||
        DEFAULT_MATCHES[0]?.participants ||
        []
      const resolvedParticipants =
        s.participants && s.participants.length > 0 ? s.participants : fallbackList

      // ATURAN KRUSIAL:
      // Jika match sebelumnya sudah LOCKED_FINAL, Plasma HARUS TETAP STAY
      // dengan data match tersebut sampai wasit secara eksplisit MEMBUKA GEMBOK
      // match baru (status === 'UNLOCKED').
      setDisplayedMatchId((currentDisplayedId) => {
        const isMatchSwitch = targetId !== currentDisplayedId

        if (isInitial) {
          // Saat pertama kali buka: tampilkan match 1 (atau match aktif)
          setParticipants(resolvedParticipants)
          setSplits(s.splits || [])
          setMatchStatus(statusUpper)
          if (statusUpper === 'LOCKED_FINAL') {
            setIsLockedFinal(true)
            if (s.results) setFinalResults(s.results)
          } else {
            setIsLockedFinal(false)
          }
          if (statusUpper === 'RUNNING' && s.startTime) {
            startTimeRef.current = s.startTime
            setIsRunning(true)
          } else {
            setIsRunning(false)
            setElapsedMs(s.elapsedMs || 0)
          }
          return targetId
        }

        // Jika Wasit sedang memilih match baru di HP tapi statusnya MASIH 'LOCKED':
        // Plasma JANGAN ganti tampilan! Tetap stay di match sebelumnya.
        if (isMatchSwitch && statusUpper === 'LOCKED') {
          return currentDisplayedId
        }

        // Jika Wasit MEMBUKA GEMBOK match baru (status === 'UNLOCKED'):
        // Plasma BERUBAH dengan animasi pindah ke data match baru & timer 00:00.00!
        if (isMatchSwitch && statusUpper === 'UNLOCKED') {
          setParticipants(resolvedParticipants)
          setSplits([])
          setFinalResults([])
          setIsLockedFinal(false)
          setMatchStatus('UNLOCKED')
          setIsRunning(false)
          setIsPaused(false)
          setElapsedMs(0)
          startTimeRef.current = null
          return targetId
        }

        // Jika masih di match yang sama (atau switch yang valid):
        if (!isMatchSwitch || statusUpper !== 'LOCKED') {
          setMatchStatus(statusUpper)
          setParticipants(resolvedParticipants)

          if (s.splits) {
            setSplits(s.splits)
          }

          if (statusUpper === 'LOCKED_FINAL') {
            setIsLockedFinal(true)
            setIsRunning(false)
            setIsPaused(false)
            if (s.results && s.results.length > 0) {
              setFinalResults(s.results)
            } else {
              // Rekonstruksi jika results belum terformat
              const merged = resolvedParticipants.map((p, idx) => {
                const isDnf = p.status === 'dnf'
                const sp = s.splits?.[idx]
                return {
                  position: isDnf ? 9999 : idx + 1,
                  bib_number: p.bib_number,
                  name: p.name,
                  status: isDnf ? 'dnf' : 'finished',
                  timer: isDnf ? 'DNF' : sp?.timer || '--.--.--',
                }
              })
              setFinalResults(merged)
            }
          } else {
            setIsLockedFinal(false)
          }

          if (statusUpper === 'RUNNING') {
            if (s.startTime) startTimeRef.current = s.startTime
            setIsRunning(true)
            setIsPaused(false)
          } else if (statusUpper === 'TIMER_COMPLETED') {
            setIsRunning(false)
            setIsPaused(false)
            if (s.elapsedMs) setElapsedMs(s.elapsedMs)
          } else if (statusUpper === 'UNLOCKED') {
            setIsRunning(false)
            setIsPaused(false)
            setElapsedMs(0)
            startTimeRef.current = null
          }

          return targetId
        }

        return currentDisplayedId
      })
    },
    []
  )

  // =========================================================================
  // 4. REALTIME WEBSOCKET SUBSCRIPTION + HEARTBEAT
  // =========================================================================
  useEffect(() => {
    const channel = getSyncChannel()

    const handleSessionSync = ({ payload }: { payload: RealtimeSessionPayload }) => {
      if (!payload || payload.senderId === CLIENT_ID) return
      if (payload.session) {
        applySessionToPlasma(payload.session, false)
      }
    }

    channel.on('broadcast', { event: 'session-sync' }, handleSessionSync)

    // Polling background setiap 1.5 detik sebagai backup anti-putus
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/plasma/state', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (json && json.ok && json.session) {
          applySessionToPlasma(json.session as ActiveMatchSession, false)
        }
      } catch {}
    }, 1500)

    return () => {
      clearInterval(interval)
    }
  }, [applySessionToPlasma])

  // =========================================================================
  // 5. FULLSCREEN HOTKEY 'F' (Tanpa Button di Layar)
  // =========================================================================
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {})
        } else {
          document.exitFullscreen().catch(() => {})
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const effectiveList =
    participants.length > 0
      ? participants
      : DEFAULT_MATCHES.find((m) => m.id === displayedMatchId)?.participants ||
        DEFAULT_MATCHES[0]?.participants ||
        []

  // Urutkan peserta: Yang DNF selalu ditaruh paling bawah di layar Plasma!
  const sortedParticipants = [...effectiveList].sort((a, b) => {
    const aDnf = a.status === 'dnf'
    const bDnf = b.status === 'dnf'
    if (aDnf && !bDnf) return 1
    if (!aDnf && bDnf) return -1
    return 0
  })

  // Jumlah baris untuk kalkulasi grid CSS
  const participantCount = Math.max(1, sortedParticipants.length)

  // Global Arena Status Badge
  const isArenaActive = isRunning || matchStatus === 'RUNNING'
  const isArenaTimerDone = matchStatus === 'TIMER_COMPLETED'

  return (
    <div className="h-screen w-screen bg-[#070b14] text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans overflow-hidden select-none">
      {/* =========================================================================
          TOP BROADCAST BAR (CLEAN, JUDUL MATCH GEDE, BEBAS SAMPAH)
      ========================================================================= */}
      <header className="bg-slate-900/95 border-b border-slate-800/80 px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 shadow-2xl">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center font-black text-xl sm:text-2xl md:text-3xl shadow-[0_0_25px_rgba(251,191,36,0.5)] shrink-0">
            🏆
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* JUDUL MATCH BESAR & MENCOLOK */}
              <span className="font-display font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-amber-300 tracking-wider uppercase drop-shadow-[0_2px_10px_rgba(251,191,36,0.5)] truncate">
                {displayedMatch?.title || `MATCH ${displayedMatchId}`}
              </span>
              <span className="text-xs sm:text-sm md:text-base bg-amber-400/20 text-amber-300 font-black px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg border border-amber-400/40 shadow-inner shrink-0">
                Match {displayedMatchId} / {matches.length}
              </span>
            </div>
          </div>
        </div>

        {/* Global Status Pill */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {isLockedFinal ? (
            <div className="flex items-center gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-2 border-yellow-400/80 text-yellow-300 text-xs sm:text-sm md:text-base font-black uppercase tracking-wider shadow-[0_0_20px_rgba(250,204,21,0.4)]">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
              <span>HASIL RESMI TERKUNCI</span>
            </div>
          ) : isArenaActive ? (
            <div className="flex items-center gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 text-xs sm:text-sm md:text-base font-black uppercase tracking-wider shadow-[0_0_20px_rgba(52,211,153,0.4)] animate-pulse">
              <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              <span>ARENA BERJALAN</span>
            </div>
          ) : isArenaTimerDone ? (
            <div className="flex items-center gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full bg-blue-500/20 border-2 border-blue-400 text-blue-300 text-xs sm:text-sm md:text-base font-black uppercase tracking-wider">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              <span>FINISH • MENUNGGU WASIT</span>
            </div>
          ) : matchStatus === 'UNLOCKED' ? (
            <div className="flex items-center gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-bold uppercase tracking-wider">
              <span>SIAP TANDING</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 text-xs sm:text-sm font-bold uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>STANDBY</span>
            </div>
          )}
        </div>
      </header>

      {/* =========================================================================
          DYNAMIC MAIN CONTENT:
          1. JIKA LOCKED_FINAL: TAMPILAN TERPADU PENUH (URUTAN + TIMER NYATU)
          2. JIKA ARENA BERJALAN / STANDBY: DUAL SPLIT SCREEN (100% FIT NO SCROLL)
      ========================================================================= */}
      <main className="flex-1 p-2 sm:p-3 overflow-hidden min-h-0 flex flex-col">
        <AnimatePresence mode="wait">
          {isLockedFinal ? (
            /* =====================================================================
               TAMPILAN TERPADU HASIL RESMI (UNIFIED FULL SCREEN RESULTS)
               Muncul seketika saat Wasit menekan Kunci Hasil Match!
            ===================================================================== */
            <motion.div
              key={`final-results-${displayedMatchId}`}
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -10 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-h-0 bg-slate-900/90 border-2 border-amber-500/50 rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col shadow-[0_0_50px_rgba(245,158,11,0.2)] backdrop-blur-md overflow-hidden"
            >
              {/* Header Kartu Hasil Terpadu */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl sm:text-3xl">🏅</span>
                  <h2 className="font-display font-black text-sm sm:text-base md:text-lg lg:text-xl text-white uppercase tracking-wider">
                    HASIL RESMI PERTANDINGAN
                  </h2>
                </div>

                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs sm:text-sm font-black uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>SAH</span>
                </div>
              </div>

              {/* Grid Baris Hasil Terpadu: 100% Fit Vertikal Mengisi Seluruh Layar */}
              <div
                className="flex-1 min-h-0 grid gap-1.5 sm:gap-2 pt-2 overflow-hidden"
                style={{
                  gridTemplateRows: `repeat(${participantCount}, minmax(0, 1fr))`,
                }}
              >
                {sortedParticipants.map((p, idx) => {
                  const position = idx + 1
                  const isDnf = p.status === 'dnf'

                  // Cari catatan waktu dari finalResults atau splits
                  const matchingResult = finalResults.find((r) => r.bib_number === p.bib_number)
                  const timerDisplay = isDnf
                    ? 'DNF'
                    : matchingResult?.timer || splits[idx]?.timer || '--.--.--'

                  // Rank Badge
                  let rankBadge = (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl font-black text-xs sm:text-sm md:text-base flex items-center justify-center bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                      {position}
                    </div>
                  )

                  if (isDnf) {
                    rankBadge = (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center bg-red-600 text-white border-2 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] shrink-0">
                        DNF
                      </div>
                    )
                  } else if (position === 1) {
                    rankBadge = (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl font-black text-sm sm:text-base md:text-lg flex items-center justify-center bg-gradient-to-tr from-yellow-400 to-amber-300 text-slate-950 shadow-[0_0_20px_rgba(250,204,21,0.6)] shrink-0 ring-2 ring-yellow-400/80">
                        🥇 1
                      </div>
                    )
                  } else if (position === 2) {
                    rankBadge = (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl font-black text-sm sm:text-base md:text-lg flex items-center justify-center bg-gradient-to-tr from-slate-200 to-white text-slate-900 shadow-md shrink-0">
                        🥈 2
                      </div>
                    )
                  } else if (position === 3) {
                    rankBadge = (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl font-black text-sm sm:text-base md:text-lg flex items-center justify-center bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-md shrink-0">
                        🥉 3
                      </div>
                    )
                  }

                  return (
                    <motion.div
                      key={p.bib_number}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: idx * 0.04,
                        duration: 0.35,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className={`h-full min-h-0 flex items-center justify-between px-3 sm:px-5 rounded-xl sm:rounded-2xl border transition-all ${
                        isDnf
                          ? 'bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                          : position === 1
                          ? 'bg-gradient-to-r from-yellow-500/20 via-amber-500/15 to-slate-800/90 border-2 border-yellow-400/70 shadow-[0_0_25px_rgba(250,204,21,0.25)]'
                          : position <= 3
                          ? 'bg-gradient-to-r from-slate-800/90 to-slate-800/70 border-amber-500/40'
                          : 'bg-slate-800/70 border-slate-700/70'
                      }`}
                    >
                      {/* Left: Rank + Huge Bib + Full Name */}
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        {rankBadge}

                        <div className="flex items-baseline gap-2.5 sm:gap-4 min-w-0">
                          <span
                            className={`font-mono font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-wider leading-none shrink-0 ${
                              isDnf ? 'text-red-300' : 'text-amber-300'
                            }`}
                          >
                            {p.bib_number}
                          </span>
                          <span className="text-xs sm:text-sm md:text-base lg:text-lg font-bold text-slate-100 truncate uppercase tracking-wide">
                            {p.name}
                          </span>
                        </div>
                      </div>

                      {/* Right: Official Linked Time Pill */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {isDnf ? (
                          <div className="font-mono font-black text-xs sm:text-sm md:text-base px-3 sm:px-4 py-1 rounded-xl bg-red-600 text-white border border-red-400 shadow-md">
                            DNF
                          </div>
                        ) : (
                          <div
                            className={`font-mono font-black text-base sm:text-xl md:text-2xl lg:text-3xl px-3 sm:px-5 py-0.5 sm:py-1 rounded-xl border tabular-nums shadow-inner ${
                              position === 1
                                ? 'bg-slate-950 text-amber-300 border-amber-400/60 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                                : 'bg-slate-950 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(52,211,153,0.2)]'
                            }`}
                          >
                            {timerDisplay}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          ) : (
            /* =====================================================================
               DUAL SPLIT SCREEN: LEFT = URUTAN, RIGHT = TIMER
               (100% FIT NO SCROLL, ZERO BOTTOM VOID, CLEAN HEADER & NO FOOTER)
            ===================================================================== */
            <motion.div
              key={`live-dual-${displayedMatchId}`}
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 overflow-hidden"
            >
              {/* ===================================================================
                  PANEL KIRI: WASIT DISPLAY (URUTAN POSISI ARENA)
              =================================================================== */}
              <section className="bg-slate-900/80 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 flex flex-col shadow-2xl relative overflow-hidden backdrop-blur-md h-full min-h-0">
                {/* Header Clean: Bebas Standby */}
                <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-slate-800 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base sm:text-lg">🏃</span>
                    <h2 className="font-display font-black text-xs sm:text-sm md:text-base text-white uppercase tracking-wider">
                      URUTAN POSISI ARENA
                    </h2>
                  </div>

                  {isArenaActive && (
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full animate-pulse">
                      LIVE
                    </span>
                  )}
                </div>

                {/* List Peserta: CSS Grid 100% Fit Mengisi Penuh Tanpa Void Space */}
                <div
                  className="flex-1 min-h-0 grid gap-1 sm:gap-1.5 pt-1.5 overflow-hidden"
                  style={{
                    gridTemplateRows: `repeat(${participantCount}, minmax(0, 1fr))`,
                  }}
                >
                  {sortedParticipants.map((p, idx) => {
                    const position = idx + 1
                    const isDnf = p.status === 'dnf'

                    let rankBadge = (
                      <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm flex items-center justify-center bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                        {position}
                      </div>
                    )

                    if (isDnf) {
                      rankBadge = (
                        <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-xs flex items-center justify-center bg-red-600 text-white border border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)] shrink-0">
                          DNF
                        </div>
                      )
                    } else if (position === 1) {
                      rankBadge = (
                        <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm flex items-center justify-center bg-gradient-to-tr from-yellow-400 to-amber-300 text-slate-950 shadow-[0_0_15px_rgba(250,204,21,0.5)] shrink-0 ring-2 ring-yellow-400/60">
                          1
                        </div>
                      )
                    } else if (position === 2) {
                      rankBadge = (
                        <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm flex items-center justify-center bg-gradient-to-tr from-slate-200 to-white text-slate-900 shadow-md shrink-0">
                          2
                        </div>
                      )
                    } else if (position === 3) {
                      rankBadge = (
                        <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm flex items-center justify-center bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-md shrink-0">
                          3
                        </div>
                      )
                    }

                    return (
                      <motion.div
                        key={p.bib_number}
                        layout
                        transition={{
                          layout: { type: 'spring', stiffness: 450, damping: 34 },
                        }}
                        className={`h-full min-h-0 flex items-center justify-between px-3 sm:px-4 rounded-xl sm:rounded-2xl border transition-colors ${
                          isDnf
                            ? 'bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                            : position === 1
                            ? 'bg-gradient-to-r from-yellow-500/15 via-amber-500/10 to-slate-800/80 border-yellow-500/50 shadow-sm'
                            : 'bg-slate-800/70 border-slate-700/70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                          {rankBadge}

                          {/* NOMOR DADA GEDE BANGET + NAMA JELAS */}
                          <div className="min-w-0 flex-1 flex items-baseline gap-2.5">
                            <span
                              className={`font-mono font-black text-xl sm:text-2xl md:text-3xl lg:text-4xl tracking-wider leading-none shrink-0 ${
                                isDnf ? 'text-red-300' : 'text-amber-300'
                              }`}
                            >
                              {p.bib_number}
                            </span>
                            <span className="text-xs sm:text-sm md:text-base font-bold text-slate-200 truncate uppercase tracking-wide">
                              {p.name}
                            </span>
                          </div>
                        </div>

                        {isDnf && (
                          <div className="text-right shrink-0">
                            <span className="text-[10px] sm:text-xs font-black text-white uppercase bg-red-600 px-2.5 py-0.5 rounded-lg border border-red-400 shadow-sm">
                              DNF
                            </span>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </section>

              {/* ===================================================================
                  PANEL KANAN: TIMER DISPLAY (STOPWATCH & URUTAN SPLIT)
              =================================================================== */}
              <section className="bg-slate-900/80 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 flex flex-col shadow-2xl relative overflow-hidden backdrop-blur-md h-full min-h-0">
                {/* Header Clean: Bebas Standby */}
                <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-slate-800 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base sm:text-lg">⏱️</span>
                    <h2 className="font-display font-black text-xs sm:text-sm md:text-base text-white uppercase tracking-wider">
                      STOPWATCH RESMI
                    </h2>
                  </div>

                  {isRunning && (
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full animate-pulse">
                      LIVE
                    </span>
                  )}
                  {isPaused && (
                    <span className="text-[11px] font-black uppercase tracking-wider text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-0.5 rounded-full">
                      DIJEDA
                    </span>
                  )}
                </div>

                {/* STOPWATCH MASTER NEON DISPLAY (COMPACT, GLOWING, SHIFT FIT) */}
                <div className="my-1.5 shrink-0">
                  <div className="bg-slate-950/95 border-2 border-slate-800 rounded-2xl py-2 px-4 text-center shadow-inner relative overflow-hidden">
                    <div className="font-mono font-black text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-amber-300 tracking-wider tabular-nums leading-none select-none drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                      {formatTime(elapsedMs)}
                    </div>
                  </div>
                </div>

                {/* Urutan Waktu Finish Slots: CSS Grid 100% Fit Mengisi Seluruh Space */}
                <div
                  className="flex-1 min-h-0 grid gap-1 sm:gap-1.5 overflow-hidden"
                  style={{
                    gridTemplateRows: `repeat(${participantCount}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: participantCount }).map((_, idx) => {
                    const position = idx + 1
                    const isSlotDnf = sortedParticipants[idx]?.status === 'dnf'
                    const splitRecord = isSlotDnf ? undefined : splits[idx]
                    const isFilled = !!splitRecord
                    const isNextSlot = !isSlotDnf && splits.length === idx && isRunning

                    return (
                      <div
                        key={position}
                        className={`h-full min-h-0 flex items-center justify-between px-3 sm:px-4 rounded-xl sm:rounded-2xl border transition-colors ${
                          isSlotDnf
                            ? 'bg-red-950/50 border-red-500/60 text-red-300'
                            : isFilled
                            ? 'bg-slate-800/90 border-emerald-500/50 shadow-sm'
                            : isNextSlot
                            ? 'bg-slate-800/50 border-amber-400 ring-2 ring-amber-400/30 animate-pulse'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                              isSlotDnf
                                ? 'bg-red-600 text-white border border-red-400'
                                : position === 1 && isFilled
                                ? 'bg-yellow-400 text-slate-950 font-black'
                                : position === 2 && isFilled
                                ? 'bg-slate-200 text-slate-950 font-black'
                                : position === 3 && isFilled
                                ? 'bg-amber-600 text-white font-black'
                                : isFilled
                                ? 'bg-slate-700 text-white'
                                : 'bg-slate-800 text-slate-500 border border-slate-700'
                            }`}
                          >
                            {isSlotDnf ? 'DNF' : `#${position}`}
                          </span>
                          <div className={`text-xs sm:text-sm font-bold ${isSlotDnf ? 'text-red-300' : 'text-slate-300'}`}>
                            {isSlotDnf ? 'Tidak Finish' : `Posisi ${position}`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div
                            className={`font-mono font-black text-sm sm:text-base md:text-lg px-2.5 sm:px-3 py-0.5 rounded-lg sm:rounded-xl border tabular-nums ${
                              isSlotDnf
                                ? 'bg-red-600 text-white border-red-400'
                                : isFilled
                                ? 'bg-slate-950 text-emerald-400 border-emerald-500/40 tracking-wider shadow-[0_0_10px_rgba(52,211,153,0.2)]'
                                : isNextSlot
                                ? 'bg-slate-950/60 text-amber-300 border-amber-500/40 animate-pulse'
                                : 'bg-slate-950/40 text-slate-600 border-slate-800'
                            }`}
                          >
                            {isSlotDnf ? 'DNF' : isFilled ? splitRecord.timer : '--.--.--'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
