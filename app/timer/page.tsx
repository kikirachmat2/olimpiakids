'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Clock,
  ShieldAlert,
} from 'lucide-react'
import { DEFAULT_MATCHES, WasitMatch } from '@/lib/wasitDefaults'
import {
  getSyncChannel,
  broadcastTimerEvent,
  CLIENT_ID,
  RealtimeTimerPayload,
} from '@/lib/realtimeSync'

type MatchStatus = 'standby' | 'active' | 'final'

interface MatchTimerState {
  status: MatchStatus
  splits: Array<{
    position: number
    timer: string
    elapsedMs: number
  }>
  lockedAt?: string
}

interface PendingTimerSubmission {
  matchId: number
  matchTitle: string
  splits: Array<{
    position: number
    timer: string
    elapsedMs: number
  }>
  participants?: Array<{
    bib_number: string
    name: string
  }>
  pin: string
  webhookUrl?: string
  timestamp: string
}

// Format ms ke format MM:SS.CC (Centidetik)
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
  // 1. STATE AUTHENTICATION (PIN)
  const [pinInput, setPinInput] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState<'referee' | 'supervisor'>('referee')
  const [pinError, setPinError] = useState('')

  // 2. STATE DATA MATCHES
  const [matches, setMatches] = useState<WasitMatch[]>(DEFAULT_MATCHES)
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0)
  const [isLoadingMatches, setIsLoadingMatches] = useState(false)

  // 3. STATE TIMER PER MATCH (disimpan di LocalStorage)
  const [timerStates, setTimerStates] = useState<Record<number, MatchTimerState>>({})

  // 4. STOPWATCH RUNTIME STATE
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  // Stopwatch references
  const startTimeRef = useRef<number>(0)
  const pausedTimeRef = useRef<number>(0)
  const animFrameRef = useRef<number | null>(null)

  // 5. OFFLINE QUEUE & STATUS KONEKSI
  const [isOnline, setIsOnline] = useState(true)
  const [pendingQueue, setPendingQueue] = useState<PendingTimerSubmission[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isFlushingRef = useRef(false)

  // 6. MODALS
  const [confirmModal, setConfirmModal] = useState<{
    type: 'open_lock' | 'lock_final' | 'reset_timer'
    matchId: number
  } | null>(null)
  const [emergencyModal, setEmergencyModal] = useState<number | null>(null)
  const [emergencyPin, setEmergencyPin] = useState('')
  const [emergencyError, setEmergencyError] = useState('')

  // Settings Webhook
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [customWebhookUrl, setCustomWebhookUrl] = useState('')
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Web Audio Context untuk Tactile Feedback Suara
  const playBeep = useCallback((freq = 600, duration = 0.08, type: OscillatorType = 'sine') => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {
      // Audio not permitted or not supported
    }
  }, [])

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type })
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev))
    }, 3500)
  }

  // Cek Status Online/Offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    setIsOnline(navigator.onLine)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Cek Session Auth
  useEffect(() => {
    try {
      const savedAuth = sessionStorage.getItem('olimpiakids_timer_auth')
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth)
        if (parsed.isAuthenticated) {
          setIsAuthenticated(true)
          setUserRole(parsed.role || 'referee')
        }
      }
    } catch {
      // Ignore
    }
  }, [])

  // Load Saved Webhook & Offline Queue
  useEffect(() => {
    try {
      const savedWebhook = localStorage.getItem('olimpiakids_custom_webhook')
      if (savedWebhook) setCustomWebhookUrl(savedWebhook)

      const savedQueue = localStorage.getItem('olimpiakids_timer_pending')
      if (savedQueue) setPendingQueue(JSON.parse(savedQueue))

      const savedStates = localStorage.getItem('olimpiakids_timer_states')
      if (savedStates) setTimerStates(JSON.parse(savedStates))
    } catch {
      // Ignore
    }
  }, [])

  // Simpan timerStates ke LocalStorage
  const updateTimerState = useCallback((matchId: number, updater: (prev: MatchTimerState) => MatchTimerState) => {
    setTimerStates((prevAll) => {
      const current = prevAll[matchId] || {
        status: 'standby',
        splits: [],
      }
      const updated = updater(current)
      const newAll = { ...prevAll, [matchId]: updated }
      try {
        localStorage.setItem('olimpiakids_timer_states', JSON.stringify(newAll))
      } catch {
        // Ignore
      }
      return newAll
    })
  }, [])

  // Tarik Data Matches dari API
  const loadMatchesFromApi = useCallback(async (isManualRefresh = false) => {
    setIsLoadingMatches(true)
    try {
      const res = await fetch(`/api/wasit/matches${isManualRefresh ? '?refresh=true' : ''}`)
      if (res.ok) {
        const data = await res.json()
        if (data.ok && Array.isArray(data.matches) && data.matches.length > 0) {
          setMatches(data.matches)
          if (isManualRefresh) {
            showToast('Data Match berhasil diperbarui dari Sheets!', 'success')
          }
        }
      }
    } catch (err) {
      console.error('Gagal mengambil match live:', err)
      if (isManualRefresh) {
        showToast('Gagal menarik data dari server. Memakai data cache.', 'error')
      }
    } finally {
      setIsLoadingMatches(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadMatchesFromApi()
    }
  }, [isAuthenticated, loadMatchesFromApi])

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

  // Match yang sedang dipilih
  const currentMatch = matches[currentMatchIdx] || matches[0]
  const currentMatchState = timerStates[currentMatch?.id] || {
    status: 'standby',
    splits: [],
  }

  // Saat berpindah match: sinkronkan tampilan stopwatch dengan status match tersebut
  useEffect(() => {
    if (!isRunning && !isPaused) {
      if (currentMatchState.splits.length === 0) {
        setElapsedMs(0)
      } else {
        const lastSplit = currentMatchState.splits[currentMatchState.splits.length - 1]
        if (lastSplit) {
          setElapsedMs(lastSplit.elapsedMs)
        }
      }
    }
  }, [currentMatchIdx, currentMatchState.splits, isRunning, isPaused])

  // Realtime Broadcast Listener untuk Mirroring antar perangkat (HP <-> Laptop/Plasma)
  useEffect(() => {
    const channel = getSyncChannel()

    const handleTimerSync = ({ payload }: { payload: RealtimeTimerPayload }) => {
      if (!payload || payload.senderId === CLIENT_ID) return

      if (payload.action === 'MATCH_SWITCH' && typeof payload.matchIdx === 'number') {
        setCurrentMatchIdx(payload.matchIdx)
      } else if (payload.action === 'START') {
        if (typeof payload.matchIdx === 'number' && payload.matchIdx !== currentMatchIdx) {
          setCurrentMatchIdx(payload.matchIdx)
        }
        startTimeRef.current = performance.now() - (payload.elapsedMs || 0)
        pausedTimeRef.current = 0
        setElapsedMs(payload.elapsedMs || 0)
        setIsRunning(true)
        setIsPaused(false)
      } else if (payload.action === 'SPLIT' && payload.splits) {
        if (payload.matchId) {
          updateTimerState(payload.matchId, (prev) => ({
            ...prev,
            splits: payload.splits!,
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
          updateTimerState(payload.matchId, (prev) => ({
            ...prev,
            splits: [],
          }))
        }
      } else if (payload.action === 'STATUS_CHANGE' && payload.matchId && payload.status) {
        updateTimerState(payload.matchId, (prev) => ({
          ...prev,
          status: payload.status!,
          splits: payload.splits || prev.splits,
        }))
      } else if (payload.action === 'REQUEST_SYNC') {
        broadcastTimerEvent({
          action: 'FULL_SYNC',
          matchId: currentMatch?.id,
          matchIdx: currentMatchIdx,
          isRunning,
          isPaused,
          elapsedMs,
          status: currentMatchState.status,
          splits: currentMatchState.splits,
        })
      } else if (payload.action === 'FULL_SYNC') {
        if (typeof payload.matchIdx === 'number') setCurrentMatchIdx(payload.matchIdx)
        if (payload.matchId && payload.splits) {
          updateTimerState(payload.matchId, (prev) => ({
            ...prev,
            status: payload.status || prev.status,
            splits: payload.splits!,
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

    channel.on('broadcast', { event: 'timer-sync' }, handleTimerSync)
  }, [currentMatchIdx, currentMatch, currentMatchState, isRunning, isPaused, elapsedMs, updateTimerState])

  const participantCount = currentMatch?.participants?.length || 7
  const isMatchLocked = currentMatchState.status === 'final'
  const isMatchActive = currentMatchState.status === 'active'
  const isMatchStandby = currentMatchState.status === 'standby'

  // Cek apakah ada match yang sedang RUNNING
  let activeRunningMatchId: number | null = null
  for (const [idStr, state] of Object.entries(timerStates)) {
    if (state.status === 'active') {
      activeRunningMatchId = Number(idStr)
      break
    }
  }

  // Tombol navigasi match di-disable jika stopwatch sedang berjalan
  const isNavDisabled = isRunning || (activeRunningMatchId !== null && activeRunningMatchId === currentMatch?.id)

  // =========================================================================
  // STOPWATCH CONTROLS
  // =========================================================================

  // START
  const handleStartTimer = () => {
    if (!isMatchActive) {
      // Buka gembok match dulu
      setConfirmModal({ type: 'open_lock', matchId: currentMatch.id })
      return
    }
    playBeep(880, 0.15, 'triangle') // Beep high start
    const now = performance.now()
    startTimeRef.current = now
    pausedTimeRef.current = 0
    setElapsedMs(0)
    setIsRunning(true)
    setIsPaused(false)

    broadcastTimerEvent({
      action: 'START',
      matchId: currentMatch.id,
      matchIdx: currentMatchIdx,
      startTime: Date.now(),
      elapsedMs: 0,
      isRunning: true,
    })
  }

  // SPLIT
  const handleSplit = () => {
    if (!isRunning) return
    const currentMs = elapsedMs
    const formatted = formatTime(currentMs)
    playBeep(1200, 0.08, 'sine') // Split chime

    const nextPos = currentMatchState.splits.length + 1
    const newSplits = [
      ...currentMatchState.splits,
      { position: nextPos, timer: formatted, elapsedMs: currentMs },
    ]

    updateTimerState(currentMatch.id, (prev) => ({
      ...prev,
      splits: newSplits,
    }))

    const isFinished = newSplits.length >= participantCount

    // Broadcast split ke Plasma / Desktop
    broadcastTimerEvent({
      action: 'SPLIT',
      matchId: currentMatch.id,
      matchIdx: currentMatchIdx,
      splits: newSplits,
      isRunning: !isFinished,
    })

    // JIKA SPLIT SUDAH SAMPAI SLOT TERAKHIR: OTOMATIS FINISH & STOP!
    if (isFinished) {
      setIsRunning(false)
      setIsPaused(false)
      playBeep(523.25, 0.4, 'sine') // Final long tone
      showToast(`🏁 Seluruh ${participantCount} peserta selesai! Stopwatch otomatis finish.`, 'success')
    }
  }

  // PAUSE
  const handlePause = () => {
    if (!isRunning) return
    setIsRunning(false)
    setIsPaused(true)
    pausedTimeRef.current = performance.now()
    playBeep(440, 0.1, 'sawtooth')

    broadcastTimerEvent({
      action: 'PAUSE',
      matchId: currentMatch.id,
      matchIdx: currentMatchIdx,
      elapsedMs,
    })
  }

  // RESUME
  const handleResume = () => {
    if (isRunning || !isPaused) return
    playBeep(880, 0.1, 'triangle')
    const pauseDuration = performance.now() - pausedTimeRef.current
    startTimeRef.current += pauseDuration
    setIsRunning(true)
    setIsPaused(false)

    broadcastTimerEvent({
      action: 'RESUME',
      matchId: currentMatch.id,
      matchIdx: currentMatchIdx,
      elapsedMs,
      startTime: Date.now() - elapsedMs,
    })
  }

  // RESET
  const handleReset = () => {
    setConfirmModal({ type: 'reset_timer', matchId: currentMatch.id })
  }

  const confirmReset = () => {
    setIsRunning(false)
    setIsPaused(false)
    setElapsedMs(0)
    updateTimerState(currentMatch.id, (prev) => ({
      ...prev,
      splits: [],
    }))
    setConfirmModal(null)
    playBeep(350, 0.15, 'sawtooth')
    showToast('Stopwatch di-reset ke 00:00.00 dan slot dikosongkan.', 'info')

    broadcastTimerEvent({
      action: 'RESET',
      matchId: currentMatch.id,
      matchIdx: currentMatchIdx,
    })
  }

  // =========================================================================
  // SUBMIT KE GOOGLE SHEETS
  // =========================================================================

  const flushPendingQueue = useCallback(async () => {
    if (isFlushingRef.current) return
    if (!navigator.onLine) {
      showToast('Koneksi internet terputus. Mengirim saat online.', 'error')
      return
    }

    try {
      const savedQueue = localStorage.getItem('olimpiakids_timer_pending')
      if (!savedQueue) return
      const queue: PendingTimerSubmission[] = JSON.parse(savedQueue)
      if (queue.length === 0) return

      isFlushingRef.current = true
      showToast(`Mengirim ${queue.length} hasil timer tersimpan...`, 'info')

      const remainingQueue: PendingTimerSubmission[] = []

      for (const item of queue) {
        try {
          const res = await fetch('/api/timer/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              matchId: item.matchId,
              matchTitle: item.matchTitle,
              splits: item.splits,
              participants: item.participants || [],
              pin: item.pin,
              webhookUrl: item.webhookUrl || customWebhookUrl,
            }),
          })

          if (!res.ok) {
            remainingQueue.push(item)
          }
        } catch {
          remainingQueue.push(item)
        }
      }

      setPendingQueue(remainingQueue)
      localStorage.setItem('olimpiakids_timer_pending', JSON.stringify(remainingQueue))

      if (remainingQueue.length === 0) {
        showToast('Semua data timer lokal berhasil terkirim ke Google Sheets!', 'success')
      } else {
        showToast(`${remainingQueue.length} data timer masih tertunda karena jaringan.`, 'error')
      }
    } finally {
      isFlushingRef.current = false
    }
  }, [customWebhookUrl])

  // Kirim data saat tombol Kunci & Kirim ditekan
  const handleFinalSubmit = async () => {
    if (currentMatchState.splits.length === 0) {
      showToast('Belum ada waktu split yang dicatat!', 'error')
      return
    }

    setIsSubmitting(true)
    const pin = userRole === 'supervisor' ? '9999' : '1234'
    const submissionData: PendingTimerSubmission = {
      matchId: currentMatch.id,
      matchTitle: currentMatch.title,
      splits: currentMatchState.splits,
      participants: currentMatch.participants?.map((p) => ({
        bib_number: p.bib_number,
        name: p.name,
      })) || [],
      pin,
      webhookUrl: customWebhookUrl || undefined,
      timestamp: new Date().toISOString(),
    }

    // Update status match menjadi FINAL
    updateTimerState(currentMatch.id, (prev) => ({
      ...prev,
      status: 'final',
      lockedAt: new Date().toISOString(),
    }))

    broadcastTimerEvent({
      action: 'STATUS_CHANGE',
      matchId: currentMatch.id,
      matchIdx: currentMatchIdx,
      status: 'final',
      splits: currentMatchState.splits,
    })

    // Coba kirim online
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/timer/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId: submissionData.matchId,
            matchTitle: submissionData.matchTitle,
            splits: submissionData.splits,
            participants: submissionData.participants,
            pin,
            webhookUrl: customWebhookUrl || undefined,
          }),
        })

        const data = await res.json()
        if (res.ok && data.ok) {
          showToast(`✅ Catatan waktu ${currentMatch.title} berhasil dikirim ke Google Sheets!`, 'success')
          setConfirmModal(null)
          setIsSubmitting(false)
          return
        }
      } catch (err) {
        console.error('Gagal kirim online, simpan offline:', err)
      }
    }

    // Jika offline / gagal, simpan ke antrean lokal
    const newQueue = [...pendingQueue, submissionData]
    setPendingQueue(newQueue)
    localStorage.setItem('olimpiakids_timer_pending', JSON.stringify(newQueue))
    showToast(`⚠️ Hasil timer ${currentMatch.title} disimpan di HP (offline). Akan otomatis terkirim saat online.`, 'info')
    setConfirmModal(null)
    setIsSubmitting(false)
  }

  // Buka Gembok Match
  const handleOpenLock = (matchId: number) => {
    updateTimerState(matchId, (prev) => ({
      ...prev,
      status: 'active',
    }))
    broadcastTimerEvent({
      action: 'STATUS_CHANGE',
      matchId,
      matchIdx: currentMatchIdx,
      status: 'active',
    })
    setConfirmModal(null)
    showToast(`Gembok ${currentMatch?.title} dibuka! Siap memulai timer.`, 'success')
  }

  // Buka Darurat (Supervisor)
  const handleEmergencyUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (emergencyPin === '9999') {
      if (emergencyModal) {
        updateTimerState(emergencyModal, (prev) => ({
          ...prev,
          status: 'active',
        }))
        broadcastTimerEvent({
          action: 'STATUS_CHANGE',
          matchId: emergencyModal,
          matchIdx: currentMatchIdx,
          status: 'active',
        })
        showToast('Mode Darurat: Gembok match berhasil dibuka ulang!', 'success')
      }
      setEmergencyModal(null)
      setEmergencyPin('')
      setEmergencyError('')
    } else {
      setEmergencyError('PIN Supervisor salah!')
    }
  }

  // =========================================================================
  // LOGIN SCREEN
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-yellow-400 selection:text-blue-950">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 shadow-2xl backdrop-blur-md text-center"
        >
          <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>

          <h1 className="font-display font-black text-2xl text-white tracking-wide uppercase">
            TIMER OLIMPIAKIDS
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Panel Khusus Timekeeper & Stopwatch Meja Juri
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (pinInput === '1234') {
                setIsAuthenticated(true)
                setUserRole('referee')
                sessionStorage.setItem('olimpiakids_timer_auth', JSON.stringify({ isAuthenticated: true, role: 'referee' }))
                setPinError('')
                showToast('Login Petugas Timer Berhasil!', 'success')
              } else if (pinInput === '9999') {
                setIsAuthenticated(true)
                setUserRole('supervisor')
                sessionStorage.setItem('olimpiakids_timer_auth', JSON.stringify({ isAuthenticated: true, role: 'supervisor' }))
                setPinError('')
                showToast('Login Supervisor Aktif! Mode Darurat Tersedia.', 'success')
              } else {
                setPinError('PIN salah! Hubungi Supervisor jika lupa PIN.')
              }
            }}
            className="mt-6 space-y-4"
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-300 text-left mb-1.5 uppercase tracking-wider">
                Masukkan 4 Digit PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                className="w-full text-center tracking-[1em] text-2xl font-black py-3 rounded-2xl bg-slate-900 border border-slate-700 text-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-slate-600"
                autoFocus
              />
            </div>

            {pinError && (
              <p className="text-xs font-bold text-red-400 flex items-center justify-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {pinError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-amber-950 font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all"
            >
              Masuk Meja Timer
            </button>
          </form>

          <div className="mt-5 text-[10px] text-slate-500 font-medium">
            Olimpiakids Trans TV • Sistem Multi-Lap Split Stopwatch
          </div>
        </motion.div>
      </div>
    )
  }

  // =========================================================================
  // LAYOUT UTAMA: DASHBOARD /TIMER
  // =========================================================================

  const allSplitsFilled = currentMatchState.splits.length >= participantCount

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-yellow-400 selection:text-blue-950 pb-4">
      {/* 1. TOP HEADER & NAVBAR */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 py-2.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            <div>
              <div className="font-display font-black text-sm text-white tracking-wide uppercase leading-none">
                TIMER OLIMPIAKIDS
              </div>
              <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                <span>{isOnline ? 'Online' : 'Offline'}</span>
                {userRole === 'supervisor' && (
                  <span className="ml-1 bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded font-black text-[9px]">
                    SUPERVISOR
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => loadMatchesFromApi(true)}
              disabled={isLoadingMatches || isRunning}
              className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl border border-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-all disabled:opacity-40"
              title="Tarik data terbaru dari Google Sheets"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMatches ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              disabled={isRunning}
              className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl border border-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-all relative disabled:opacity-40"
              title="Pengaturan Webhook Google Sheets"
            >
              <Settings className="w-3.5 h-3.5" />
              {customWebhookUrl && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-1 right-1" />
              )}
            </button>

            <button
              onClick={() => {
                sessionStorage.removeItem('olimpiakids_timer_auth')
                setIsAuthenticated(false)
              }}
              disabled={isRunning}
              className="text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2.5 py-2 rounded-xl font-bold border border-red-500/30 transition-all disabled:opacity-40"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* PENDING SUBMISSION BANNER */}
      {pendingQueue.length > 0 && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/40 px-3 py-1.5 text-center text-[11px] font-bold text-yellow-300 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 truncate">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
            <span className="truncate">{pendingQueue.length} hasil timer tersimpan di HP.</span>
          </div>
          <button
            onClick={flushPendingQueue}
            className="shrink-0 bg-yellow-400 hover:bg-yellow-300 text-amber-950 font-black px-2 py-0.5 rounded text-[10px] active:scale-95 transition-all"
          >
            Kirim Sekarang
          </button>
        </div>
      )}

      {/* 2. MATCH SELECTOR CAROUSEL (PALING ATAS) */}
      <div className="w-full max-w-md mx-auto px-3 pt-2.5">
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-2.5 flex items-center justify-between shadow-sm">
          <button
            onClick={() => {
              const nextIdx = Math.max(0, currentMatchIdx - 1)
              setCurrentMatchIdx(nextIdx)
              broadcastTimerEvent({
                action: 'MATCH_SWITCH',
                matchIdx: nextIdx,
                matchId: matches[nextIdx]?.id,
              })
            }}
            disabled={currentMatchIdx === 0 || isNavDisabled}
            className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-white transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center px-2 flex-1 min-w-0">
            <div className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider truncate">
              {currentMatch?.title || `MATCH ${currentMatchIdx + 1}`}
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <span className="text-xs font-black text-slate-300">
                Match {currentMatchIdx + 1} dari {matches.length}
              </span>
              <span>•</span>
              <span className="text-xs text-slate-400 font-bold">
                {participantCount} Peserta
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              const nextIdx = Math.min(matches.length - 1, currentMatchIdx + 1)
              setCurrentMatchIdx(nextIdx)
              broadcastTimerEvent({
                action: 'MATCH_SWITCH',
                matchIdx: nextIdx,
                matchId: matches[nextIdx]?.id,
              })
            }}
            disabled={currentMatchIdx === matches.length - 1 || isNavDisabled}
            className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-white transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* STATUS GEMBOK MATCH */}
        <div className="mt-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            {isMatchActive && (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                TIMING AKTIF
              </span>
            )}
            {isMatchStandby && (
              <span className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-400 border border-slate-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                <Lock className="w-3 h-3" />
                STANDBY (TERKUNCI)
              </span>
            )}
            {isMatchLocked && (
              <span className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3 text-amber-400" />
                FINAL & SELESAI
              </span>
            )}
          </div>

          {/* EMERGENCY UNLOCK UNTUK SUPERVISOR */}
          {isMatchLocked && (
            <button
              onClick={() => setEmergencyModal(currentMatch.id)}
              className="text-[10px] text-amber-400/80 hover:text-amber-300 underline font-bold"
            >
              Buka Darurat
            </button>
          )}
        </div>
      </div>

      {/* 3. STOPWATCH MASTER DISPLAY (BAWAH SELECTOR) */}
      <div className="w-full max-w-md mx-auto px-3 my-2">
        <div className="bg-slate-950/80 border-2 border-slate-800 rounded-3xl p-4 text-center shadow-inner relative overflow-hidden">
          {isRunning && (
            <div className="absolute top-2 right-3 flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              RUNNING
            </div>
          )}
          {isPaused && (
            <div className="absolute top-2 right-3 flex items-center gap-1 text-[10px] text-yellow-400 font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              PAUSED
            </div>
          )}

          <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-1">
            ⏱️ STOPWATCH MASTER
          </div>
          
          <div className="font-mono font-black text-5xl md:text-6xl text-yellow-400 tracking-tight leading-none drop-shadow-md select-none">
            {formatTime(elapsedMs)}
          </div>

          <div className="text-[10px] font-mono text-slate-500 tracking-widest mt-1.5 uppercase">
            MENIT : DETIK . CENTIDETIK
          </div>
        </div>
      </div>

      {/* 4. URUTAN PESERTA DARI MATCH: HANYA NOMOR & TAB KOSONG */}
      <main className="flex-1 w-full max-w-md mx-auto px-3 overflow-y-auto">
        <div className="text-[11px] text-slate-400 font-bold flex items-center justify-between px-1 mb-2">
          <span>URUTAN WAKTU FINISH ({participantCount} SLOT):</span>
          <span className="text-yellow-400 font-semibold">
            {currentMatchState.splits.length} / {participantCount} Selesai
          </span>
        </div>

        <div className="space-y-1.5">
          {Array.from({ length: participantCount }).map((_, idx) => {
            const position = idx + 1
            const splitRecord = currentMatchState.splits[idx]
            const isFilled = !!splitRecord
            const isNextSlot = currentMatchState.splits.length === idx && isRunning

            return (
              <motion.div
                key={position}
                layout
                className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                  isFilled
                    ? 'bg-slate-800/90 border-emerald-500/50 shadow-sm'
                    : isNextSlot
                    ? 'bg-slate-800/50 border-yellow-500/60 ring-2 ring-yellow-400/30 animate-pulse'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500'
                }`}
              >
                {/* NOMOR POSISI */}
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

                {/* TAB WAKTU */}
                <div className="flex items-center gap-2">
                  <div
                    className={`font-mono font-black text-base px-3 py-1 rounded-xl border ${
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
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">
                      Split #{position}
                    </span>
                  )}
                  {!isFilled && isNextSlot && (
                    <span className="text-[10px] text-yellow-400 font-bold uppercase animate-pulse">
                      Berikutnya
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </main>

      {/* 5. AREA TOMBOL DINAMIS PALING BAWAH (STATE MACHINE) */}
      <footer className="w-full max-w-md mx-auto px-3 pt-2">
        {/* KONDISI A: MATCH BELUM AKTIF / MASIH TERKUNCI */}
        {isMatchStandby && !isMatchLocked && (
          <button
            onClick={() => setConfirmModal({ type: 'open_lock', matchId: currentMatch.id })}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Unlock className="w-5 h-5" />
            <span>BUKA GEMBOK UNTUK MEMULAI TIMER</span>
          </button>
        )}

        {/* KONDISI B: MATCH SUDAH FINAL */}
        {isMatchLocked && (
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl py-3 px-4 text-center">
            <div className="font-display font-black text-xs text-amber-400 uppercase flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>HASIL TIMER TELAH FINAL</span>
            </div>
          </div>
        )}

        {/* KONDISI C: MATCH SEDANG AKTIF (OPERASI STOPWATCH) */}
        {isMatchActive && (
          <div className="space-y-2">
            {/* STATE 1: BELUM MULAI (STOPWATCH IDLE DI 00:00.00) */}
            {!isRunning && !isPaused && !allSplitsFilled && (
              <button
                onClick={handleStartTimer}
                className="w-full h-18 py-4.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-lg uppercase tracking-wider shadow-xl flex items-center justify-center gap-2.5 active:scale-95 transition-all"
              >
                <Play className="w-7 h-7 fill-white" />
                <span>START TIMER</span>
              </button>
            )}

            {/* STATE 2: STOPWATCH SEDANG BERJALAN */}
            {isRunning && !allSplitsFilled && (
              <div className="flex gap-2.5">
                {/* TOMBOL SPLIT (65% LEBAR, UTAMA) */}
                <button
                  onClick={handleSplit}
                  className="flex-[65] h-18 py-4.5 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-amber-950 font-black text-lg uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all select-none"
                >
                  <Zap className="w-6 h-6 fill-amber-950" />
                  <span>SPLIT #{currentMatchState.splits.length + 1}</span>
                </button>

                {/* TOMBOL PAUSE (35% LEBAR) */}
                <button
                  onClick={handlePause}
                  className="flex-[35] h-18 py-4.5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Pause className="w-5 h-5 fill-slate-200" />
                  <span>PAUSE</span>
                </button>
              </div>
            )}

            {/* STATE 3: STOPWATCH DI-PAUSE */}
            {!isRunning && isPaused && !allSplitsFilled && (
              <div className="flex gap-2.5">
                {/* TOMBOL RESET (35% LEBAR) */}
                <button
                  onClick={handleReset}
                  className="flex-[35] h-18 py-4.5 rounded-2xl bg-red-600/90 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>RESET</span>
                </button>

                {/* TOMBOL RESUME (65% LEBAR) */}
                <button
                  onClick={handleResume}
                  className="flex-[65] h-18 py-4.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-base uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Play className="w-6 h-6 fill-white" />
                  <span>RESUME TIMER</span>
                </button>
              </div>
            )}

            {/* STATE 4: SELURUH SLOT TERISI (OTOMATIS FINISH) */}
            {allSplitsFilled && (
              <div className="space-y-2">
                <button
                  onClick={() => setConfirmModal({ type: 'lock_final', matchId: currentMatch.id })}
                  disabled={isSubmitting}
                  className="w-full h-18 py-4 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-amber-950 font-black text-base uppercase tracking-wider shadow-2xl flex items-center justify-center gap-2.5 active:scale-95 transition-all disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-950" />
                      <span>MENYIMPAN KE GOOGLE SHEETS...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-6 h-6 text-amber-950" />
                      <span>KUNCI & KIRIM HASIL KE SHEETS</span>
                    </>
                  )}
                </button>

                <div className="flex justify-between items-center px-1">
                  <button
                    onClick={handleReset}
                    className="text-[11px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Ulang Timer</span>
                  </button>
                  <span className="text-[11px] text-emerald-400 font-bold">
                    ✓ {participantCount} Split Lengkap
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </footer>

      {/* ===================================================================== */}
      {/* 6. MODAL KONFIRMASI (BUKA GEMBOK / RESET / KUNCI FINAL) */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-3xl p-5 shadow-2xl text-center"
            >
              {confirmModal.type === 'open_lock' && (
                <>
                  <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Unlock className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-black text-lg text-white uppercase">
                    Buka Kunci Match {confirmModal.matchId}?
                  </h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Sesi pencatatan waktu untuk match ini akan diaktifkan. Tombol START siap ditekan saat balapan dimulai.
                  </p>
                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => setConfirmModal(null)}
                      className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold text-xs"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => handleOpenLock(confirmModal.matchId)}
                      className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs"
                    >
                      Buka Sekarang
                    </button>
                  </div>
                </>
              )}

              {confirmModal.type === 'reset_timer' && (
                <>
                  <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <RotateCcw className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-black text-lg text-white uppercase">
                    Reset Timer Match {confirmModal.matchId}?
                  </h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Stopwatch akan kembali ke <b>00:00.00</b> dan seluruh catatan waktu split yang sudah terekam akan dikosongkan.
                  </p>
                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => setConfirmModal(null)}
                      className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold text-xs"
                    >
                      Batal
                    </button>
                    <button
                      onClick={confirmReset}
                      className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs"
                    >
                      Ya, Reset
                    </button>
                  </div>
                </>
              )}

              {confirmModal.type === 'lock_final' && (
                <>
                  <div className="w-12 h-12 bg-yellow-500/20 text-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-black text-lg text-white uppercase">
                    Kunci & Kirim Hasil Timer?
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Rekap catatan waktu finish:
                  </p>

                  <div className="my-3 bg-slate-900/80 border border-slate-700 rounded-2xl p-3 text-left text-xs space-y-1.5 max-h-40 overflow-y-auto">
                    {currentMatchState.splits.map((sp) => (
                      <div key={sp.position} className="flex items-center justify-between font-mono">
                        <span className="font-bold text-slate-300">Posisi #{sp.position}</span>
                        <span className="text-emerald-400 font-black">{sp.timer}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-400 mb-4">
                    Data akan disimpan ke Google Sheets tab <b>TIMER</b> dan disandingkan dengan urutan wasit.
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmModal(null)}
                      className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold text-xs"
                    >
                      Periksa Ulang
                    </button>
                    <button
                      onClick={handleFinalSubmit}
                      disabled={isSubmitting}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-amber-950 font-black text-xs"
                    >
                      {isSubmitting ? 'Mengirim...' : 'Kirim Sekarang'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 7. MODAL BUKA DARURAT (SUPERVISOR PIN) */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {emergencyModal !== null && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-3xl p-5 shadow-2xl text-center"
            >
              <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-lg text-white uppercase">
                Buka Kunci Darurat
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Match {emergencyModal} telah berstatus <b>FINAL</b>. Masukkan PIN Supervisor (9999) untuk membuka kembali timer jika perlu diulang.
              </p>

              <form onSubmit={handleEmergencyUnlock} className="mt-4 space-y-3">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={emergencyPin}
                  onChange={(e) => setEmergencyPin(e.target.value)}
                  placeholder="PIN SUPERVISOR"
                  className="w-full text-center tracking-[0.5em] text-lg font-black py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-xs"
                  autoFocus
                />

                {emergencyError && (
                  <p className="text-xs font-bold text-red-400">{emergencyError}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmergencyModal(null)
                      setEmergencyPin('')
                      setEmergencyError('')
                    }}
                    className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
                  >
                    Buka Paksa
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 8. MODAL PENGATURAN WEBHOOK */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-3xl p-5 shadow-2xl text-center"
            >
              <div className="w-12 h-12 bg-slate-700 text-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Settings className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-lg text-white uppercase">
                Pengaturan Webhook Timer
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                URL Google Apps Script Web App tempat data timer dikirim.
              </p>

              <div className="mt-4 text-left">
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">
                  Webhook URL (Opsional)
                </label>
                <input
                  type="url"
                  value={customWebhookUrl}
                  onChange={(e) => setCustomWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                />
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('olimpiakids_custom_webhook', customWebhookUrl.trim())
                    setShowSettingsModal(false)
                    showToast('Pengaturan Webhook berhasil disimpan!', 'success')
                  }}
                  className="flex-1 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-amber-950 font-black text-xs"
                >
                  Simpan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 max-w-[90vw] ${
              toastMessage.type === 'success'
                ? 'bg-emerald-500 text-emerald-950'
                : toastMessage.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-slate-800 text-yellow-400 border border-yellow-400/40'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
