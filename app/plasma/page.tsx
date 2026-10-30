'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, Minimize2 } from 'lucide-react'
import { DEFAULT_MATCHES, WasitMatch, WasitParticipant } from '@/lib/wasitDefaults'
import {
  getSyncChannel,
  broadcastTimerEvent,
  broadcastWasitEvent,
  CLIENT_ID,
  RealtimeTimerPayload,
  RealtimeWasitPayload,
} from '@/lib/realtimeSync'

type MatchStatus = 'standby' | 'active' | 'final'

interface MatchTimerState {
  status: MatchStatus
  splits: Array<{
    position: number
    timer: string
    elapsedMs: number
  }>
}

interface MatchWasitState {
  status: MatchStatus
  participants: WasitParticipant[]
}

function formatTime(ms: number) {
  if (ms < 0) ms = 0
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const centiseconds = Math.floor((ms % 1000) / 10)
  const pad = (n: number) => (n < 10 ? '0' + n : String(n))
  return `${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`
}

export default function PlasmaDisplayPage() {
  const [matches, setMatches] = useState<WasitMatch[]>(DEFAULT_MATCHES)
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0)
  const [isConnected, setIsConnected] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Timer states
  const [timerStates, setTimerStates] = useState<Record<number, MatchTimerState>>({})
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  // Wasit states
  const [wasitStates, setWasitStates] = useState<Record<number, MatchWasitState>>({})

  // Version tracker for HTTP polling sync
  const lastVersionRef = useRef<number>(0)

  // Stopwatch animation frame ref
  const startTimeRef = useRef<number>(0)
  const animFrameRef = useRef<number | null>(null)

  const currentMatch = matches[currentMatchIdx] || matches[0]
  const currentTimer = timerStates[currentMatch?.id] || { status: 'standby', splits: [] }
  const currentWasit = wasitStates[currentMatch?.id] || {
    status: 'standby',
    participants: currentMatch?.participants || [],
  }

  // 1. Initial Load: Fetch matches
  useEffect(() => {
    fetch('/api/wasit/matches')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.matches && data.matches.length > 0) {
          setMatches(data.matches)
        }
      })
      .catch(() => {})
  }, [])

  // 2. Stopwatch RAF Loop (60 FPS smooth timer)
  useEffect(() => {
    if (isRunning) {
      const loop = () => {
        const now = performance.now()
        setElapsedMs(Math.max(0, now - startTimeRef.current))
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

  // 3. Sync initial timer display when idle
  useEffect(() => {
    if (!isRunning && !isPaused) {
      if (currentTimer.splits.length === 0) {
        setElapsedMs(0)
      } else {
        const last = currentTimer.splits[currentTimer.splits.length - 1]
        if (last) setElapsedMs(last.elapsedMs)
      }
    }
  }, [currentMatchIdx, currentTimer.splits, isRunning, isPaused])

  // 4. HYBRID REALTIME ENGINE: Supabase WebSocket + HTTP State Sync
  useEffect(() => {
    // A. Fetch shared state immediately on mount
    const fetchSharedState = async () => {
      try {
        const res = await fetch('/api/plasma/state', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (json && json.ok && json.data) {
          const d = json.data
          lastVersionRef.current = d.version || 0

          if (typeof d.currentMatchIdx === 'number') {
            setCurrentMatchIdx(d.currentMatchIdx)
          }

          if (d.currentMatchId) {
            // Sync wasit
            if (d.wasit) {
              setWasitStates((prev) => ({
                ...prev,
                [d.currentMatchId]: {
                  status: d.wasit.status || 'standby',
                  participants: d.wasit.participants || [],
                },
              }))
            }
            // Sync timer
            if (d.timer) {
              setTimerStates((prev) => ({
                ...prev,
                [d.currentMatchId]: {
                  status: d.timer.status || 'standby',
                  splits: d.timer.splits || [],
                },
              }))

              if (d.timer.isRunning && d.timer.startTime) {
                const now = performance.now()
                startTimeRef.current = now - (d.timer.elapsedMs || 0)
                setElapsedMs(d.timer.elapsedMs || 0)
                setIsRunning(true)
                setIsPaused(false)
              } else if (d.timer.isPaused) {
                setIsRunning(false)
                setIsPaused(true)
                setElapsedMs(d.timer.elapsedMs || 0)
              } else if (d.timer.splits && d.timer.splits.length > 0) {
                const last = d.timer.splits[d.timer.splits.length - 1]
                setElapsedMs(last?.elapsedMs || 0)
              }
            }
          }
        }
      } catch (e) {
        console.warn('Initial plasma state fetch error:', e)
      }
    }

    fetchSharedState()

    // B. WebSocket Channel Subscription
    const channel = getSyncChannel()

    const handleTimerSync = ({ payload }: { payload: RealtimeTimerPayload }) => {
      if (!payload || payload.senderId === CLIENT_ID) return

      if (payload.action === 'MATCH_SWITCH' && typeof payload.matchIdx === 'number') {
        setCurrentMatchIdx(payload.matchIdx)
      } else if (payload.action === 'START') {
        if (typeof payload.matchIdx === 'number') setCurrentMatchIdx(payload.matchIdx)
        startTimeRef.current = performance.now() - (payload.elapsedMs || 0)
        setElapsedMs(payload.elapsedMs || 0)
        setIsRunning(true)
        setIsPaused(false)
        if (payload.matchId) {
          setTimerStates((prev) => ({
            ...prev,
            [payload.matchId!]: {
              status: 'active',
              splits: prev[payload.matchId!]?.splits || [],
            },
          }))
        }
      } else if (payload.action === 'SPLIT' && payload.splits) {
        if (payload.matchId) {
          setTimerStates((prev) => ({
            ...prev,
            [payload.matchId!]: {
              status: prev[payload.matchId!]?.status || 'active',
              splits: payload.splits!,
            },
          }))
        }
        if (payload.isRunning === false) {
          setIsRunning(false)
          setIsPaused(false)
        }
      } else if (payload.action === 'PAUSE') {
        setIsRunning(false)
        setIsPaused(true)
        if (typeof payload.elapsedMs === 'number') setElapsedMs(payload.elapsedMs)
      } else if (payload.action === 'RESUME') {
        const ms = payload.elapsedMs || 0
        startTimeRef.current = performance.now() - ms
        setIsRunning(true)
        setIsPaused(false)
      } else if (payload.action === 'RESET') {
        setIsRunning(false)
        setIsPaused(false)
        setElapsedMs(0)
        if (payload.matchId) {
          setTimerStates((prev) => ({
            ...prev,
            [payload.matchId!]: {
              ...prev[payload.matchId!],
              splits: [],
            },
          }))
        }
      } else if (payload.action === 'STATUS_CHANGE' && payload.matchId && payload.status) {
        setTimerStates((prev) => ({
          ...prev,
          [payload.matchId!]: {
            status: payload.status!,
            splits: payload.splits || prev[payload.matchId!]?.splits || [],
          },
        }))
      } else if (payload.action === 'FULL_SYNC') {
        if (typeof payload.matchIdx === 'number') setCurrentMatchIdx(payload.matchIdx)
        if (payload.matchId) {
          setTimerStates((prev) => ({
            ...prev,
            [payload.matchId!]: {
              status: payload.status || 'standby',
              splits: payload.splits || [],
            },
          }))
        }
        if (payload.isRunning) {
          startTimeRef.current = performance.now() - (payload.elapsedMs || 0)
          setElapsedMs(payload.elapsedMs || 0)
          setIsRunning(true)
          setIsPaused(false)
        } else if (payload.isPaused) {
          setIsRunning(false)
          setIsPaused(true)
          setElapsedMs(payload.elapsedMs || 0)
        }
      }
    }

    const handleWasitSync = ({ payload }: { payload: RealtimeWasitPayload }) => {
      if (!payload || payload.senderId === CLIENT_ID) return

      if (payload.action === 'MATCH_SWITCH' && typeof payload.matchIdx === 'number') {
        setCurrentMatchIdx(payload.matchIdx)
      } else if (payload.action === 'REORDER' || payload.action === 'DNF') {
        if (payload.matchId && payload.participants) {
          setWasitStates((prev) => ({
            ...prev,
            [payload.matchId!]: {
              status: prev[payload.matchId!]?.status || 'active',
              participants: payload.participants as WasitParticipant[],
            },
          }))
        }
      } else if (payload.action === 'STATUS_CHANGE' && payload.matchId && payload.status) {
        setWasitStates((prev) => ({
          ...prev,
          [payload.matchId!]: {
            status: payload.status!,
            participants: (payload.participants as WasitParticipant[]) || prev[payload.matchId!]?.participants || [],
          },
        }))
      } else if (payload.action === 'FULL_SYNC') {
        if (typeof payload.matchIdx === 'number') setCurrentMatchIdx(payload.matchIdx)
        if (payload.matchId && payload.participants) {
          setWasitStates((prev) => ({
            ...prev,
            [payload.matchId!]: {
              status: payload.status || 'standby',
              participants: payload.participants as WasitParticipant[],
            },
          }))
        }
      }
    }

    channel.on('broadcast', { event: 'timer-sync' }, handleTimerSync)
    channel.on('broadcast', { event: 'wasit-sync' }, handleWasitSync)

    // Request fresh state from active phones
    broadcastTimerEvent({ action: 'REQUEST_SYNC' })
    broadcastWasitEvent({ action: 'REQUEST_SYNC' })
    setIsConnected(true)

    // C. What-If Heartbeat Polling: sync every 1.5s as foolproof backup
    const heartbeatTimer = setInterval(async () => {
      try {
        const res = await fetch('/api/plasma/state', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (json && json.ok && json.data) {
          const d = json.data
          // Only update if server has newer state
          if (d.version !== lastVersionRef.current) {
            lastVersionRef.current = d.version

            if (typeof d.currentMatchIdx === 'number') {
              setCurrentMatchIdx(d.currentMatchIdx)
            }
            if (d.currentMatchId && d.wasit?.participants) {
              setWasitStates((prev) => ({
                ...prev,
                [d.currentMatchId]: {
                  status: d.wasit.status || 'standby',
                  participants: d.wasit.participants,
                },
              }))
            }
            if (d.currentMatchId && d.timer?.splits) {
              setTimerStates((prev) => ({
                ...prev,
                [d.currentMatchId]: {
                  status: d.timer.status || 'standby',
                  splits: d.timer.splits,
                },
              }))
            }
          }
        }
      } catch {
        // Polling error ignored silently
      }
    }, 1500)

    return () => {
      clearInterval(heartbeatTimer)
    }
  }, [])

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  // Hotkey F for Fullscreen, Arrows for Match switch
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFullscreen()
      } else if (e.key === 'ArrowRight') {
        setCurrentMatchIdx((prev) => Math.min(matches.length - 1, prev + 1))
      } else if (e.key === 'ArrowLeft') {
        setCurrentMatchIdx((prev) => Math.max(0, prev - 1))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [matches.length, toggleFullscreen])

  const participantCount = currentMatch?.participants?.length || 7
  const rawParticipants = currentWasit.participants.length > 0 ? currentWasit.participants : currentMatch?.participants || []

  // Urutkan peserta: Yang DNF selalu ditaruh paling bawah di layar Plasma!
  const sortedParticipants = [...rawParticipants].sort((a, b) => {
    const aDnf = a.status === 'dnf'
    const bDnf = b.status === 'dnf'
    if (aDnf && !bDnf) return 1
    if (!aDnf && bDnf) return -1
    return 0
  })

  // Global Arena Status Badge
  const isArenaActive = isRunning || currentWasit.status === 'active' || currentTimer.status === 'active'
  const isArenaFinal = currentWasit.status === 'final' && currentTimer.status === 'final'

  return (
    <div className="h-screen w-screen bg-[#070b14] text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans overflow-hidden select-none">
      {/* =========================================================================
          TOP BROADCAST BAR (CLEAN, 100% BEBAS DARI DATA SAMPAH)
      ========================================================================= */}
      <header className="bg-slate-900/95 border-b border-slate-800/80 px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 shadow-2xl">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center font-black text-xl sm:text-2xl shadow-[0_0_20px_rgba(251,191,36,0.5)] shrink-0">
            🏆
          </div>
          <div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="font-display font-black text-xl sm:text-2xl md:text-3xl lg:text-4xl text-white tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {currentMatch?.title || `MATCH ${currentMatchIdx + 1}`}
              </span>
              <span className="text-xs sm:text-sm md:text-base bg-amber-400/20 text-amber-300 font-black px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg border border-amber-400/40 shadow-inner">
                Match {currentMatchIdx + 1} / {matches.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Status Badge Arena */}
          {isArenaActive && (
            <div className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs sm:text-sm font-black uppercase tracking-wider animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              <span>ARENA BERJALAN</span>
            </div>
          )}
          {isArenaFinal && (
            <div className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-black uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>FINAL & SELESAI</span>
            </div>
          )}
        </div>
      </header>

      {/* =========================================================================
          DUAL SPLIT SCREEN: LEFT = WASIT, RIGHT = TIMER (100% FIT NO SCROLL)
      ========================================================================= */}
      <main className="flex-1 p-2 sm:p-3 grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 overflow-hidden min-h-0">
        {/* =======================================================================
            PANEL KIRI: WASIT DISPLAY (URUTAN JUARA / NOMOR DADA GEDE BANGET)
        ======================================================================= */}
        <section className="bg-slate-900/80 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 flex flex-col shadow-2xl relative overflow-hidden backdrop-blur-md min-h-0">
          {/* Header Panel Wasit */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl">🏃</span>
              <h2 className="font-display font-black text-xs sm:text-sm md:text-base text-white uppercase tracking-wider">
                URUTAN POSISI ARENA
              </h2>
            </div>

            {currentWasit.status === 'active' && (
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full animate-pulse">
                Sedang Dinilai
              </span>
            )}
            {currentWasit.status === 'final' && (
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                Terkunci Final
              </span>
            )}
          </div>

          {/* List Peserta (100% Fit Vertikal, Tanpa Scroll, Smooth Layout Slide) */}
          <div className="flex-1 min-h-0 flex flex-col gap-1 sm:gap-1.5 pt-1.5 overflow-hidden">
            <AnimatePresence mode="popLayout">
              {sortedParticipants.map((p, idx) => {
                const position = idx + 1
                const isDnf = p.status === 'dnf'

                let rankBadge = (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 max-h-[90%] rounded-lg sm:rounded-xl font-black text-xs sm:text-sm flex items-center justify-center bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                    {position}
                  </div>
                )

                if (isDnf) {
                  rankBadge = (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 max-h-[90%] rounded-lg sm:rounded-xl font-black text-[10px] sm:text-xs flex items-center justify-center bg-red-600 text-white border border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)] shrink-0">
                      DNF
                    </div>
                  )
                } else if (position === 1) {
                  rankBadge = (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 max-h-[90%] rounded-lg sm:rounded-xl font-black text-xs sm:text-sm flex items-center justify-center bg-gradient-to-tr from-yellow-400 to-amber-300 text-slate-950 shadow-[0_0_15px_rgba(250,204,21,0.5)] shrink-0 ring-2 ring-yellow-400/60">
                      1
                    </div>
                  )
                } else if (position === 2) {
                  rankBadge = (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 max-h-[90%] rounded-lg sm:rounded-xl font-black text-xs sm:text-sm flex items-center justify-center bg-gradient-to-tr from-slate-200 to-white text-slate-900 shadow-md shrink-0">
                      2
                    </div>
                  )
                } else if (position === 3) {
                  rankBadge = (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 max-h-[90%] rounded-lg sm:rounded-xl font-black text-xs sm:text-sm flex items-center justify-center bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-md shrink-0">
                      3
                    </div>
                  )
                }

                return (
                  <motion.div
                    key={p.bib_number}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{
                      layout: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
                      opacity: { duration: 0.2 },
                    }}
                    className={`flex-1 min-h-0 flex items-center justify-between px-3 sm:px-4 py-1 rounded-xl sm:rounded-2xl border transition-colors ${
                      isDnf
                        ? 'bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                        : position === 1
                        ? 'bg-gradient-to-r from-yellow-500/15 via-amber-500/10 to-slate-800/80 border-yellow-500/50 shadow-sm'
                        : 'bg-slate-800/70 border-slate-700/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {rankBadge}

                      {/* NOMOR DADA GEDE BANGET + NAMA JELAS */}
                      <div className="min-w-0 flex-1 flex items-baseline gap-2.5">
                        <span
                          className={`font-mono font-black text-2xl sm:text-3xl lg:text-4xl xl:text-5xl tracking-wider leading-none shrink-0 ${
                            isDnf ? 'text-red-300' : 'text-amber-300'
                          }`}
                        >
                          {p.bib_number}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-200 truncate uppercase tracking-wide">
                          {p.name}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isDnf ? (
                        <span className="text-[10px] sm:text-xs font-black text-white uppercase bg-red-600 px-2.5 py-0.5 rounded-lg border border-red-400 shadow-sm">
                          DNF (MOGOK)
                        </span>
                      ) : (
                        <span className="text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase bg-slate-950/60 px-2.5 py-0.5 rounded-lg border border-slate-800">
                          Posisi #{position}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </section>

        {/* =======================================================================
            PANEL KANAN: TIMER DISPLAY (STOPWATCH RESMI & URUTAN SPLIT LAP)
        ======================================================================= */}
        <section className="bg-slate-900/80 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 flex flex-col shadow-2xl relative overflow-hidden backdrop-blur-md min-h-0">
          {/* Header Panel Timer */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl">⏱️</span>
              <h2 className="font-display font-black text-xs sm:text-sm md:text-base text-white uppercase tracking-wider">
                STOPWATCH RESMI
              </h2>
            </div>

            {isRunning && (
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full animate-pulse">
                Berjalan
              </span>
            )}
            {isPaused && (
              <span className="text-[11px] font-black uppercase tracking-wider text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-0.5 rounded-full">
                Dijeda
              </span>
            )}
            {currentTimer.status === 'final' && !isRunning && !isPaused && (
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                Final & Selesai
              </span>
            )}
          </div>

          {/* STOPWATCH MASTER NEON DISPLAY (COMPACT & ROCK-SOLID) */}
          <div className="my-1.5 shrink-0">
            <div className="bg-slate-950/90 border-2 border-slate-800 rounded-2xl py-2 sm:py-2.5 px-4 text-center shadow-inner relative overflow-hidden">
              <div className="font-mono font-black text-4xl sm:text-5xl lg:text-6xl xl:text-7xl text-amber-300 tracking-wider tabular-nums leading-none select-none drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                {formatTime(elapsedMs)}
              </div>
            </div>
          </div>

          {/* Urutan Waktu Finish Slots (100% Fit Vertikal Mengisi Seluruh Ruang) */}
          <div className="flex-1 min-h-0 flex flex-col gap-1 sm:gap-1.5 overflow-hidden">
            {Array.from({ length: participantCount }).map((_, idx) => {
              const position = idx + 1
              const splitRecord = currentTimer.splits[idx]
              const isFilled = !!splitRecord
              const isNextSlot = currentTimer.splits.length === idx && isRunning

              return (
                <div
                  key={position}
                  className={`flex-1 min-h-0 flex items-center justify-between px-3 sm:px-4 py-1 rounded-xl sm:rounded-2xl border transition-colors ${
                    isFilled
                      ? 'bg-slate-800/90 border-emerald-500/50 shadow-sm'
                      : isNextSlot
                      ? 'bg-slate-800/50 border-amber-400 ring-2 ring-amber-400/30 animate-pulse'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                        position === 1 && isFilled
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
                      #{position}
                    </span>
                    <div className="text-xs sm:text-sm font-bold text-slate-300">
                      Posisi {position}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={`font-mono font-black text-sm sm:text-base md:text-lg px-2.5 sm:px-3 py-0.5 rounded-lg sm:rounded-xl border tabular-nums ${
                        isFilled
                          ? 'bg-slate-950 text-emerald-400 border-emerald-500/40 tracking-wider shadow-[0_0_10px_rgba(52,211,153,0.2)]'
                          : isNextSlot
                          ? 'bg-slate-950/60 text-amber-300 border-amber-500/40 animate-pulse'
                          : 'bg-slate-950/40 text-slate-600 border-slate-800'
                      }`}
                    >
                      {isFilled ? splitRecord.timer : '--.--.--'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
