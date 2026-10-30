'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Radio,
  Trophy,
  Zap,
} from 'lucide-react'
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
  const [isConnected, setIsConnected] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Timer states
  const [timerStates, setTimerStates] = useState<Record<number, MatchTimerState>>({})
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  // Wasit states
  const [wasitStates, setWasitStates] = useState<Record<number, MatchWasitState>>({})

  // Stopwatch references
  const startTimeRef = useRef<number>(0)
  const animFrameRef = useRef<number | null>(null)

  const currentMatch = matches[currentMatchIdx] || matches[0]
  const currentTimer = timerStates[currentMatch?.id] || { status: 'standby', splits: [] }
  const currentWasit = wasitStates[currentMatch?.id] || {
    status: 'standby',
    participants: currentMatch?.participants || [],
  }

  // Load matches initial
  useEffect(() => {
    fetch('/api/wasit/matches')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.matches && data.matches.length > 0) {
          setMatches(data.matches)
        }
      })
      .catch((e) => console.warn('Gagal muat matches dari API:', e))
  }, [])

  // Stopwatch RAF Loop
  useEffect(() => {
    if (isRunning) {
      const loop = () => {
        const now = performance.now()
        setElapsedMs(now - startTimeRef.current)
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

  // Sync Timer display when match changes and stopwatch is not running
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

  // Realtime Supabase Broadcast Channel connection
  useEffect(() => {
    const channel = getSyncChannel()

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)
        // Minta status terbaru ke HP controller
        broadcastTimerEvent({ action: 'REQUEST_SYNC' })
        broadcastWasitEvent({ action: 'REQUEST_SYNC' })
      }
    })

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
  }, [])

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  // Keyboard Hotkeys
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
  const wasitParticipants = currentWasit.participants.length > 0 ? currentWasit.participants : currentMatch?.participants || []

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-yellow-400 selection:text-slate-950 font-sans overflow-hidden">
      {/* 1. TOP BROADCAST BAR */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-400 text-slate-950 flex items-center justify-center font-black text-lg shadow-sm">
            🏆
          </div>
          <div>
            <div className="font-display font-black text-sm sm:text-base text-white tracking-wide uppercase leading-none">
              PLASMA DISPLAY • OLIMPIAKIDS
            </div>
            <div className="text-[11px] text-slate-400 font-bold flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{isConnected ? 'LIVE SYNC MIRROR' : 'CONNECTING...'}</span>
              </span>
              <span>•</span>
              <span className="text-yellow-400 font-bold uppercase">
                {currentMatch?.title || `MATCH ${currentMatchIdx + 1}`}
              </span>
              <span>•</span>
              <span className="text-slate-300">
                Match {currentMatchIdx + 1} dari {matches.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Match Global */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300">
            <Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>KONTROL: HP WASIT & TIMER</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white rounded-xl border border-slate-700 text-xs flex items-center gap-1.5 transition-all"
            title="Toggle Fullscreen (Hotkey: F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden md:inline font-bold">Fullscreen</span>
          </button>
        </div>
      </header>

      {/* 2. DUAL SPLIT SCREEN: LEFT = WASIT, RIGHT = TIMER */}
      <main className="flex-1 p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 overflow-hidden">
        {/* =========================================================================
            PANEL KIRI: WASIT DISPLAY (URUTAN JUARA / POSISI PESERTA)
        ========================================================================= */}
        <section className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-3.5 sm:p-4.5 flex flex-col justify-between shadow-2xl relative overflow-hidden backdrop-blur-md">
          {/* Header Panel Wasit */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏃</span>
              <div>
                <h2 className="font-display font-black text-sm sm:text-base text-white uppercase tracking-wide leading-none">
                  WASIT OLIMPIAKIDS
                </h2>
                <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                  Posisi Juara Arena Merangkak
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentWasit.status === 'active' && (
                <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  SEDANG DINILAI
                </span>
              )}
              {currentWasit.status === 'final' && (
                <span className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  FINAL
                </span>
              )}
              {currentWasit.status === 'standby' && (
                <span className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-400 border border-slate-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  STANDBY
                </span>
              )}
            </div>
          </div>

          {/* List Peserta (View Only, Nomor Dada GEDE BANGET) */}
          <div className="flex-1 my-3 overflow-y-auto space-y-2 pr-1">
            <AnimatePresence>
              {wasitParticipants.map((p, idx) => {
                const position = idx + 1
                const isDnf = p.status === 'dnf'

                let rankBadge = (
                  <div className="w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                    {position}
                  </div>
                )

                if (isDnf) {
                  rankBadge = (
                    <div className="w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center bg-red-950 text-red-300 border border-red-500/60 shrink-0">
                      DNF
                    </div>
                  )
                } else if (position === 1) {
                  rankBadge = (
                    <div className="w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center bg-gradient-to-tr from-yellow-500 to-amber-300 text-amber-950 shadow-md shrink-0 ring-2 ring-yellow-400/50">
                      1
                    </div>
                  )
                } else if (position === 2) {
                  rankBadge = (
                    <div className="w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center bg-gradient-to-tr from-slate-200 to-white text-slate-900 shadow-md shrink-0">
                      2
                    </div>
                  )
                } else if (position === 3) {
                  rankBadge = (
                    <div className="w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-md shrink-0">
                      3
                    </div>
                  )
                }

                return (
                  <motion.div
                    key={p.bib_number}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      position === 1 && !isDnf
                        ? 'bg-yellow-500/10 border-yellow-500/40 shadow-sm'
                        : isDnf
                        ? 'bg-red-950/30 border-red-500/50 shadow-sm'
                        : 'bg-slate-800/70 border-slate-700/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {rankBadge}

                      {/* NOMOR DADA JAUH LEBIH BESAR DARIPADA NAMA */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-3xl sm:text-4xl text-yellow-400 tracking-wider leading-none">
                            {p.bib_number}
                          </span>
                          {isDnf && (
                            <span className="text-[10px] bg-red-500/30 text-red-300 font-black px-2 py-0.5 rounded-md border border-red-500/50 uppercase">
                              DNF
                            </span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-300 truncate mt-1 uppercase tracking-wide">
                          {p.name}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isDnf ? (
                        <span className="text-[11px] font-black text-red-300 uppercase bg-red-950/70 px-2 py-0.5 rounded border border-red-500/50">
                          DNF
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400 uppercase">
                          Posisi #{position}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>

          {/* Footer Status Wasit */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-bold shrink-0">
            <span>{wasitParticipants.length} Peserta Arena</span>
            <span className="text-yellow-400">Posisi 1 = Juara 1 Match</span>
          </div>
        </section>

        {/* =========================================================================
            PANEL KANAN: TIMER DISPLAY (STOPWATCH MASTER & URUTAN WAKTU FINISH)
        ========================================================================= */}
        <section className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-3.5 sm:p-4.5 flex flex-col justify-between shadow-2xl relative overflow-hidden backdrop-blur-md">
          {/* Header Panel Timer */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">⏱️</span>
              <div>
                <h2 className="font-display font-black text-sm sm:text-base text-white uppercase tracking-wide leading-none">
                  TIMER OLIMPIAKIDS
                </h2>
                <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                  Master Stopwatch & Split Finisher
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  RUNNING
                </span>
              )}
              {isPaused && (
                <span className="inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                  PAUSED
                </span>
              )}
              {!isRunning && !isPaused && currentTimer.status === 'final' && (
                <span className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  FINAL
                </span>
              )}
            </div>
          </div>

          {/* STOPWATCH MASTER GEDE BANGET */}
          <div className="my-3 shrink-0">
            <div className="bg-slate-950/90 border-2 border-slate-800 rounded-3xl p-4 text-center shadow-inner relative overflow-hidden">
              <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-1 flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-yellow-400" />
                <span>STOPWATCH MASTER</span>
              </div>

              <div className="font-mono font-black text-5xl sm:text-6xl md:text-7xl text-yellow-400 tracking-tight leading-none drop-shadow-lg select-none">
                {formatTime(elapsedMs)}
              </div>

              <div className="text-[10px] font-mono text-slate-500 tracking-widest mt-2 uppercase">
                MENIT : DETIK . CENTIDETIK
              </div>
            </div>
          </div>

          {/* Urutan Waktu Finish Slots */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            <div className="text-[11px] text-slate-400 font-bold flex items-center justify-between px-1 mb-1">
              <span>URUTAN WAKTU FINISH ({participantCount} SLOT):</span>
              <span className="text-yellow-400 font-semibold">
                {currentTimer.splits.length} / {participantCount} Selesai
              </span>
            </div>

            {Array.from({ length: participantCount }).map((_, idx) => {
              const position = idx + 1
              const splitRecord = currentTimer.splits[idx]
              const isFilled = !!splitRecord
              const isNextSlot = currentTimer.splits.length === idx && isRunning

              return (
                <div
                  key={position}
                  className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                    isFilled
                      ? 'bg-slate-800/90 border-emerald-500/50 shadow-sm'
                      : isNextSlot
                      ? 'bg-slate-800/50 border-yellow-500/60 ring-2 ring-yellow-400/30 animate-pulse'
                      : 'bg-slate-900/60 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                        position === 1 && isFilled
                          ? 'bg-yellow-400 text-amber-950 font-black'
                          : position === 2 && isFilled
                          ? 'bg-slate-200 text-slate-900 font-black'
                          : position === 3 && isFilled
                          ? 'bg-amber-600 text-white font-black'
                          : isFilled
                          ? 'bg-slate-700 text-white'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                    >
                      #{position}
                    </span>
                    <div className="text-xs font-bold text-slate-300">
                      Posisi {position}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={`font-mono font-black text-base sm:text-lg px-3 py-1 rounded-xl border ${
                        isFilled
                          ? 'bg-slate-950 text-emerald-400 border-emerald-500/40 tracking-wider'
                          : isNextSlot
                          ? 'bg-slate-950/60 text-yellow-400/80 border-yellow-500/40 animate-pulse'
                          : 'bg-slate-950/40 text-slate-600 border-slate-800'
                      }`}
                    >
                      {isFilled ? splitRecord.timer : '--.--.--'}
                    </div>
                    {isFilled && (
                      <span className="text-[10px] text-emerald-400 font-bold uppercase hidden sm:inline">
                        Split #{position}
                      </span>
                    )}
                    {!isFilled && isNextSlot && (
                      <span className="text-[10px] text-yellow-400 font-bold uppercase animate-pulse hidden sm:inline">
                        Berikutnya
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer Status Timer */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-bold shrink-0">
            <span>Sinkronisasi Otomatis</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              Realtime WebSocket
            </span>
          </div>
        </section>
      </main>
    </div>
  )
}

