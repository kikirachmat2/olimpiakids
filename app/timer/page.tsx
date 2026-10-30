'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Play,
  RotateCcw,
  Zap,
  Clock,
  ShieldAlert,
  LogOut,
} from 'lucide-react'
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
  saveActiveSession,
} from '@/lib/sessionStore'

function formatTime(ms: number): string {
  if (ms < 0) ms = 0
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((ms % 1000) / 10)

  const pad = (n: number) => (n < 10 ? '0' + n : String(n))
  return `${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`
}

export default function TimerPage() {
  // 1. AUTH STATE
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')

  // 2. ACTIVE MATCH SESSION DARI WASIT MASTER
  const [session, setSession] = useState<ActiveMatchSession>(INITIAL_MATCH_SESSION)

  // 3. STOPWATCH RUNTIME
  const [elapsedMs, setElapsedMs] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // 4. CONFIRMATION RESET MODAL
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)

  // =========================================================================
  // LOAD ACTIVE SESSION & SYNC DARI SUPABASE
  // =========================================================================
  const loadSession = useCallback(async () => {
    try {
      const s = await getActiveSession()
      if (s) {
        setSession(s)
        if (s.status === 'RUNNING' && s.startTime) {
          startTimeRef.current = s.startTime
        } else if (s.elapsedMs) {
          setElapsedMs(s.elapsedMs)
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  // =========================================================================
  // STOPWATCH ANIMATION LOOP (60FPS ACCURATE TIMESTAMP)
  // =========================================================================
  useEffect(() => {
    if (session.status === 'RUNNING' && startTimeRef.current) {
      const tick = () => {
        const now = Date.now()
        const diff = Math.max(0, now - (startTimeRef.current || now))
        setElapsedMs(diff)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      animFrameRef.current = requestAnimationFrame(tick)
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      if (session.status !== 'RUNNING') {
        setElapsedMs(session.elapsedMs || 0)
      }
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [session.status, session.startTime, session.elapsedMs])

  // =========================================================================
  // REALTIME WEBSOCKET SUBSCRIPTION
  // =========================================================================
  useEffect(() => {
    const channel = getSyncChannel()

    const handleSessionSync = ({ payload }: { payload: RealtimeSessionPayload }) => {
      if (!payload || payload.senderId === CLIENT_ID) return
      if (payload.session) {
        setSession(payload.session)
        if (payload.session.status === 'RUNNING' && payload.session.startTime) {
          startTimeRef.current = payload.session.startTime
        } else if (payload.session.status === 'UNLOCKED') {
          startTimeRef.current = null
          setElapsedMs(0)
        } else if (payload.session.status === 'LOCKED') {
          startTimeRef.current = null
          setElapsedMs(0)
        }
      }
    }

    channel.on('broadcast', { event: 'session-sync' }, handleSessionSync)
  }, [])

  // =========================================================================
  // AUTH PIN SUBMIT
  // =========================================================================
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput === '1234' || pinInput === '9999') {
      setIsAuthenticated(true)
      setPinError('')
    } else {
      setPinError('PIN salah! Hubungi Supervisor.')
    }
  }

  // =========================================================================
  // ACTIONS: START STOPWATCH (HANYA TIMER YANG START)
  // =========================================================================
  const handleStart = async () => {
    if (session.status !== 'UNLOCKED') return
    const now = Date.now()
    startTimeRef.current = now

    const updated: ActiveMatchSession = {
      ...session,
      status: 'RUNNING',
      startTime: now,
      elapsedMs: 0,
      splits: [],
      updatedAt: new Date().toISOString(),
    }
    setSession(updated)
    await saveActiveSession(updated)
    broadcastSessionEvent({ action: 'START_TIMER', session: updated })
  }

  // =========================================================================
  // ACTIONS: SPLIT STOPWATCH (OTOMATIS BERHENTI DI SPLIT TERAKHIR)
  // =========================================================================
  const handleSplit = async () => {
    if (session.status !== 'RUNNING' || !startTimeRef.current) return

    const now = Date.now()
    const currentElapsed = Math.max(0, now - startTimeRef.current)
    const formatted = formatTime(currentElapsed)

    const nextSplits = [
      ...session.splits,
      {
        position: session.splits.length + 1,
        timer: formatted,
        elapsedMs: currentElapsed,
      },
    ]

    // Hitung sisa anak yang harus finish (Total Peserta dikurangi yang DNF)
    const activeFinishersCount = session.participants.filter(
      (p) => !session.dnfList.includes(p.bib_number) && p.status !== 'dnf'
    ).length
    const targetCount = activeFinishersCount > 0 ? activeFinishersCount : session.participants.length

    // Cek apakah ini split terakhir!
    const isCompleted = nextSplits.length >= targetCount

    const updated: ActiveMatchSession = {
      ...session,
      status: isCompleted ? 'TIMER_COMPLETED' : 'RUNNING',
      splits: nextSplits,
      elapsedMs: currentElapsed,
      updatedAt: new Date().toISOString(),
    }

    if (isCompleted) {
      startTimeRef.current = null
    }

    setSession(updated)
    setElapsedMs(currentElapsed)
    await saveActiveSession(updated)
    broadcastSessionEvent({ action: 'SPLIT_TIMER', session: updated })
  }

  // =========================================================================
  // ACTIONS: RESET TIMER (FALSE START / ULANG DARI AWAL)
  // =========================================================================
  const handleReset = async () => {
    startTimeRef.current = null
    setElapsedMs(0)

    const updated: ActiveMatchSession = {
      ...session,
      status: 'UNLOCKED',
      startTime: null,
      elapsedMs: 0,
      splits: [],
      updatedAt: new Date().toISOString(),
    }
    setSession(updated)
    setIsResetConfirmOpen(false)
    await saveActiveSession(updated)
    broadcastSessionEvent({ action: 'RESET_TIMER', session: updated })
  }

  // =========================================================================
  // RENDER: LOGIN VIEW
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950 flex flex-col items-center justify-center p-4 selection:bg-amber-400 selection:text-slate-950">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg text-slate-950 font-black text-2xl">
            ⏱️
          </div>
          <h1 className="font-display font-black text-2xl text-white tracking-wide uppercase">
            MEJA TIMEKEEPER
          </h1>
          <p className="text-xs text-blue-200 mt-1 mb-6">
            Panel Stopwatch Resmi Olimpiakids
          </p>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Masukkan 4 Digit PIN"
              className="w-full bg-white/20 border-2 border-white/30 rounded-2xl px-4 py-3 text-center text-2xl font-black tracking-[0.5em] text-white placeholder:text-blue-300/50 placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 transition-all"
              autoFocus
            />
            {pinError && <p className="text-xs font-bold text-red-400">{pinError}</p>}
            <button
              type="submit"
              className="w-full bg-gradient-to-b from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-amber-950 font-display font-black text-base py-3.5 px-6 rounded-2xl shadow-[0_4px_0_rgba(180,83,9,1)] active:translate-y-1 active:shadow-none transition-all"
            >
              MASUK KE MEJA TIMER
            </button>
          </form>
          <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-blue-300/70">
            PIN Petugas Timer: <code className="text-yellow-300 font-bold">1234</code>
          </div>
        </motion.div>
      </div>
    )
  }

  // =========================================================================
  // VIEW: TERKUNCI (KOSONG SELAMA WASIT BELUM BUKA GEMBOK)
  // =========================================================================
  const isMatchLocked = session.status === 'LOCKED'
  const isMatchFinal = session.status === 'LOCKED_FINAL'

  if (isMatchLocked || isMatchFinal) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans p-4">
        {/* Header Minimal */}
        <header className="max-w-md w-full mx-auto flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⏱️</span>
            <div>
              <h1 className="font-display font-black text-base text-white uppercase tracking-wider">
                MEJA TIMEKEEPER
              </h1>
              <span className="text-[10px] text-amber-400 font-bold">
                STOPWATCH SLAVE MODE
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl border border-slate-700"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Locked Card Message */}
        <main className="max-w-md w-full mx-auto my-auto py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-300 flex items-center justify-center mx-auto text-2xl animate-pulse">
              <Lock className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-mono font-black text-amber-400 uppercase tracking-widest bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/30">
                {session.matchTitle || 'MATCH 1'}
              </span>
              <h2 className="font-display font-black text-xl sm:text-2xl text-white tracking-wide uppercase mt-3">
                {isMatchFinal ? 'MATCH TELAH SELESAI' : 'MEJA TIMER TERKUNCI'}
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {isMatchFinal
                  ? 'Hasil match ini telah dikunci oleh Wasit. Menunggu Wasit memilih dan membuka gembok Match berikutnya.'
                  : 'Timer tidak dapat digunakan sebelum Wasit Master memilih match dan membuka gemboknya.'}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Menunggu Sinyal Buka Gembok Wasit...</span>
            </div>
          </motion.div>
        </main>

        <footer className="text-center text-[11px] text-slate-600 pb-2">
          Sistem Olimpiakids • Dual-Sync Realtime Active
        </footer>
      </div>
    )
  }

  // =========================================================================
  // VIEW: UNLOCKED & ACTIVE (STOPWATCH SIAP DIGUNAKAN)
  // =========================================================================
  const isRunning = session.status === 'RUNNING'
  const isCompleted = session.status === 'TIMER_COMPLETED'
  const activeFinishersTarget = session.participants.filter(
    (p) => !session.dnfList.includes(p.bib_number) && p.status !== 'dnf'
  ).length
  const targetCount = activeFinishersTarget > 0 ? activeFinishersTarget : session.participants.length

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans p-3 sm:p-4">
      {/* Top Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">⏱️</span>
          <div>
            <h1 className="font-display font-black text-base text-white uppercase tracking-wider leading-none">
              {session.matchTitle}
            </h1>
            <span className="text-[10px] text-emerald-400 font-bold">
              GEMBOK TERBUKA • SIAP TANDING
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsResetConfirmOpen(true)}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1 shadow-sm"
          title="Reset Stopwatch"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          <span>Reset</span>
        </button>
      </header>

      {/* Main Stopwatch Section */}
      <main className="max-w-md w-full mx-auto flex-1 flex flex-col justify-between py-3 space-y-3 min-h-0">
        {/* BIG NEON STOPWATCH DISPLAY */}
        <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-4 sm:p-5 text-center shadow-2xl relative overflow-hidden shrink-0">
          <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-center gap-1.5">
            {isRunning && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            <span>
              {isRunning
                ? 'STOPWATCH BERJALAN'
                : isCompleted
                ? 'STOPWATCH BERHENTI (SELESAI)'
                : 'SIAP MULAI (STANDBY)'}
            </span>
          </div>

          <div className="font-mono font-black text-6xl sm:text-7xl text-amber-300 tracking-wider tabular-nums leading-none select-none drop-shadow-[0_0_20px_rgba(251,191,36,0.4)] my-2">
            {formatTime(elapsedMs)}
          </div>

          <div className="text-xs font-bold text-slate-400">
            {session.splits.length} / {targetCount} Anak Selesai Merangkak
          </div>
        </div>

        {/* PRIMARY ACTION BUTTONS */}
        <div className="space-y-2 shrink-0">
          {session.status === 'UNLOCKED' && (
            <button
              onClick={handleStart}
              className="w-full py-5 bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 hover:to-green-300 active:scale-95 text-slate-950 font-display font-black text-xl rounded-2xl shadow-[0_6px_0_rgba(5,150,105,1)] flex items-center justify-center gap-2.5 transition-all"
            >
              <Play className="w-6 h-6 fill-current" />
              <span>START (PLUIT DIBUNYIKAN)</span>
            </button>
          )}

          {session.status === 'RUNNING' && (
            <button
              onClick={handleSplit}
              className="w-full py-6 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 hover:from-amber-300 hover:to-yellow-200 active:scale-95 text-slate-950 font-display font-black text-2xl rounded-2xl shadow-[0_6px_0_rgba(180,83,9,1)] flex items-center justify-center gap-3 transition-all"
            >
              <Zap className="w-7 h-7 fill-current text-slate-950 animate-bounce" />
              <span>CATAT SPLIT #{session.splits.length + 1}</span>
            </button>
          )}

          {session.status === 'TIMER_COMPLETED' && (
            <div className="p-4 bg-emerald-950/40 border-2 border-emerald-500/60 rounded-2xl text-center space-y-1">
              <div className="font-display font-black text-base text-emerald-400 uppercase flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-5 h-5" />
                <span>SEMUA ANAK FINISH! STOPWATCH BERHENTI</span>
              </div>
              <p className="text-xs text-slate-300">
                Waktu telah terhubung ke Wasit. Menunggu Wasit Mengunci Hasil.
              </p>
            </div>
          )}
        </div>

        {/* LIST SPLIT TERCATAT */}
        <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-black uppercase tracking-wider text-slate-400 shrink-0">
            <span>DAFTAR SPLIT WAKTU:</span>
            <span>{session.splits.length} Tercatat</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pt-2 pr-1 custom-scrollbar">
            {session.splits.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 font-bold">
                Belum ada split. Tekan tombol SPLIT saat bayi menyentuh garis finish.
              </div>
            ) : (
              session.splits.map((s) => (
                <div
                  key={s.position}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 text-xs font-black flex items-center justify-center border border-amber-400/30">
                      #{s.position}
                    </span>
                    <span className="text-xs font-bold text-slate-300">Finisher {s.position}</span>
                  </div>
                  <span className="text-sm font-black text-emerald-400 tracking-wider">
                    {s.timer}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* MODAL RESET CONFIRMATION */}
      <AnimatePresence>
        {isResetConfirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 text-center"
            >
              <div className="w-12 h-12 bg-amber-400/10 text-amber-300 rounded-2xl flex items-center justify-center mx-auto">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-base text-white uppercase">
                Ulang Stopwatch Match Ini?
              </h3>
              <p className="text-xs text-slate-400">
                Waktu yang berjalan dan catatan split akan direset ke 00:00.00 untuk mengulang lomba (false start).
              </p>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black shadow-lg"
                >
                  Ya, Ulang Timer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
