'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'
import {
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  MoveRight,
  ShieldAlert,
  Settings,
  GripVertical,
} from 'lucide-react'
import { DEFAULT_MATCHES, WasitMatch, WasitParticipant } from '@/lib/wasitDefaults'

type MatchStatus = 'standby' | 'active' | 'final'

interface MatchState {
  status: MatchStatus
  participants: WasitParticipant[]
  lockedAt?: string
}

interface PendingSubmission {
  matchId: number
  matchTitle: string
  results: Array<{
    position: number
    bib_number: string
    name: string
    status: string
  }>
  refereePin: string
  webhookUrl?: string
  timestamp: string
}

interface ParticipantCardProps {
  participant: WasitParticipant
  index: number
  isMatchActive: boolean
  onToggleDnf: (bib: string) => void
  onOpenMoveModal: (p: WasitParticipant) => void
}

function ParticipantCard({
  participant: p,
  index,
  isMatchActive,
  onToggleDnf,
  onOpenMoveModal,
}: ParticipantCardProps) {
  const dragControls = useDragControls()
  const isDnf = p.status === 'dnf'
  const isTop1 = index === 0 && !isDnf
  const isTop2 = index === 1 && !isDnf
  const isTop3 = index === 2 && !isDnf

  // Clean, modern Rank Badge (NO MEDALS / EMOJIS)
  let rankBadge = (
    <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 font-display font-black text-sm flex items-center justify-center shrink-0 border border-slate-700">
      {index + 1}
    </div>
  )

  let cardBorder = 'border-slate-700/80'
  let cardBg = 'bg-slate-800/90'

  if (isTop1) {
    cardBg = 'bg-slate-800/95'
    cardBorder = 'border-amber-400'
    rankBadge = (
      <div className="w-9 h-9 rounded-xl bg-amber-400 text-amber-950 font-display font-black text-base flex items-center justify-center shrink-0 shadow-sm">
        1
      </div>
    )
  } else if (isTop2) {
    cardBg = 'bg-slate-800/95'
    cardBorder = 'border-slate-300/80'
    rankBadge = (
      <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-900 font-display font-black text-base flex items-center justify-center shrink-0 shadow-sm">
        2
      </div>
    )
  } else if (isTop3) {
    cardBg = 'bg-slate-800/95'
    cardBorder = 'border-amber-600/80'
    rankBadge = (
      <div className="w-9 h-9 rounded-xl bg-amber-600 text-white font-display font-black text-base flex items-center justify-center shrink-0 shadow-sm">
        3
      </div>
    )
  } else if (isDnf) {
    cardBg = 'bg-red-950/20'
    cardBorder = 'border-red-900/40 opacity-70'
    rankBadge = (
      <div className="w-9 h-9 rounded-xl bg-red-900/50 text-red-300 font-display font-black text-[11px] flex items-center justify-center shrink-0 border border-red-700/50">
        DNF
      </div>
    )
  }

  return (
    <Reorder.Item
      value={p}
      id={p.bib_number}
      dragListener={false}
      dragControls={dragControls}
      className={`relative rounded-2xl border p-2.5 flex items-center justify-between gap-2.5 transition-colors select-none ${cardBg} ${cardBorder}`}
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 15px 30px -5px rgba(0, 0, 0, 0.7)',
        borderColor: '#f59e0b',
        zIndex: 50,
      }}
    >
      {/* Rank Badge - also allows touch drag start */}
      <div
        onPointerDown={(e) => {
          if (isMatchActive) dragControls.start(e)
        }}
        className={isMatchActive ? 'cursor-grab active:cursor-grabbing touch-none select-none' : ''}
      >
        {rankBadge}
      </div>

      {/* Child Information (Full name visible, wrap gracefully) */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/30">
            {p.bib_number}
          </span>
          {isDnf && (
            <span className="text-[10px] bg-red-500/20 text-red-400 font-black px-1.5 py-0.5 rounded border border-red-500/30 uppercase">
              Mogok / DNF
            </span>
          )}
        </div>
        <div className="font-display font-bold text-sm text-white mt-1 leading-snug break-words">
          {p.name}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isMatchActive ? (
          <>
            {/* DNF Button */}
            <button
              onClick={() => onToggleDnf(p.bib_number)}
              className={`px-2 py-1.5 rounded-xl text-[11px] font-black border transition-all ${
                isDnf
                  ? 'bg-red-500 text-white border-red-400'
                  : 'bg-slate-700/60 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border-slate-600'
              }`}
              title={isDnf ? 'Batal DNF' : 'Tandai DNF (Mogok)'}
            >
              DNF
            </button>

            {/* Pindah Match Button */}
            <button
              onClick={() => onOpenMoveModal(p)}
              className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 transition-all"
              title="Pindahkan ke Match lain"
            >
              <MoveRight className="w-4 h-4" />
            </button>

            {/* Drag Handle */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-yellow-400 active:text-amber-950 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-300 transition-colors touch-none shadow-sm"
              title="Tahan dan geser posisi anak"
            >
              <GripVertical className="w-5 h-5" />
            </div>
          </>
        ) : (
          <div className="text-right px-2">
            <span className="text-[11px] font-bold text-slate-400">
              {p.status === 'dnf' ? 'DNF' : `Peringkat ${index + 1}`}
            </span>
          </div>
        )}
      </div>
    </Reorder.Item>
  )
}

export default function WasitPage() {
  // 1. STATE AUTHENTICATION (PIN)
  const [pinInput, setPinInput] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState<'referee' | 'supervisor'>('referee')
  const [pinError, setPinError] = useState('')

  // 2. STATE MATCH & CAROUSEL
  const [matches, setMatches] = useState<WasitMatch[]>(DEFAULT_MATCHES)
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0)
  const [matchStates, setMatchStates] = useState<Record<number, MatchState>>({})
  const [isLoadingMatches, setIsLoadingMatches] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  // 3. STATE MODAL & TOAST
  const [confirmModal, setConfirmModal] = useState<{
    type: 'open_lock' | 'final_lock'
    matchId: number
  } | null>(null)
  const [emergencyModal, setEmergencyModal] = useState<number | null>(null)
  const [emergencyPin, setEmergencyPin] = useState('')
  const [emergencyError, setEmergencyError] = useState('')
  const [moveModal, setMoveModal] = useState<{
    participant: WasitParticipant
    fromMatchId: number
  } | null>(null)
  const [targetMatchId, setTargetMatchId] = useState<number>(1)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [customWebhookUrl, setCustomWebhookUrl] = useState('')
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([])
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Fungsi simpan antrean offline
  const saveToPendingQueue = useCallback((payload: PendingSubmission) => {
    try {
      const raw = localStorage.getItem('olimpiakids_pending_submissions')
      const queue: PendingSubmission[] = raw ? JSON.parse(raw) : []
      // Hapus jika sudah ada matchId yang sama
      const filtered = queue.filter((item) => item.matchId !== payload.matchId)
      filtered.push(payload)
      localStorage.setItem('olimpiakids_pending_submissions', JSON.stringify(filtered))
      setPendingSubmissions(filtered)
    } catch (e) {
      console.error('Gagal menyimpan ke pending queue:', e)
    }
  }, [])

  // Fungsi flush antrean offline ke server (dengan lock guard agar tidak double-fire)
  const isFlushingRef = React.useRef(false)
  const flushPendingQueue = useCallback(async () => {
    if (isFlushingRef.current) return
    isFlushingRef.current = true

    try {
      const raw = localStorage.getItem('olimpiakids_pending_submissions')
      if (!raw) return
      let queue: PendingSubmission[] = []
      try {
        queue = JSON.parse(raw)
      } catch {
        return
      }
      if (!queue.length) return

      const remaining: PendingSubmission[] = []
      let successCount = 0

      for (const item of queue) {
        try {
          const res = await fetch('/api/wasit/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          })
          const data = await res.json()
          if (data.ok) {
            successCount++
          } else {
            remaining.push(item)
          }
        } catch {
          remaining.push(item)
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem('olimpiakids_pending_submissions', JSON.stringify(remaining))
        setPendingSubmissions(remaining)
      } else {
        localStorage.removeItem('olimpiakids_pending_submissions')
        setPendingSubmissions([])
      }

      if (successCount > 0) {
        showToast(`✅ ${successCount} hasil match offline berhasil disinkronkan ke Sheets!`, 'success')
      }
    } finally {
      isFlushingRef.current = false
    }
  }, [showToast])

  // 4. CEK SESSION AUTH & STORAGE LOCAL
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => {
      setIsOnline(true)
      flushPendingQueue()
    }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const savedAuth = sessionStorage.getItem('olimpiakids_wasit_auth')
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth)
        if (parsed.isAuthenticated) {
          setIsAuthenticated(true)
          setUserRole(parsed.role)
        }
      } catch (e) {
        console.error(e)
      }
    }

    // Load state match dari localStorage (Offline First)
    const savedStates = localStorage.getItem('olimpiakids_wasit_states')
    if (savedStates) {
      try {
        setMatchStates(JSON.parse(savedStates))
      } catch (e) {
        console.error(e)
      }
    }

    const savedWebhook = localStorage.getItem('olimpiakids_apps_script_url')
    if (savedWebhook) {
      setCustomWebhookUrl(savedWebhook)
    } else {
      setCustomWebhookUrl('https://script.google.com/macros/s/AKfycbzW7iHQryhHG5Qw7-m3Kx-OGZ1RcykxdzCeQJIRE3slHSm-dirgVWSj5P_7WZQRJT0QCA/exec')
    }

    const rawQueue = localStorage.getItem('olimpiakids_pending_submissions')
    if (rawQueue) {
      try {
        setPendingSubmissions(JSON.parse(rawQueue))
      } catch (e) {
        console.error(e)
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [flushPendingQueue])

  // 5. FETCH DATA MATCHES LIVE DARI API (SHEET)
  const loadMatchesFromApi = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsLoadingMatches(true)
    try {
      const res = await fetch(`/api/wasit/matches${isRefresh ? '?refresh=true' : ''}`)
      const data = await res.json()
      if (data.ok && Array.isArray(data.matches)) {
        setMatches(data.matches)

        // Inisialisasi matchStates jika belum ada
        setMatchStates((prev) => {
          const next = { ...prev }
          data.matches.forEach((m: WasitMatch) => {
            const allScoredInSheet = m.participants.length > 0 && m.participants.every(p => p.urutan !== null && p.urutan !== '')
            if (!next[m.id]) {
              next[m.id] = {
                status: allScoredInSheet ? 'final' : 'standby',
                participants: m.participants,
              }
            } else if (isRefresh && next[m.id].status === 'standby') {
              next[m.id] = {
                ...next[m.id],
                participants: m.participants,
              }
            }
          })
          localStorage.setItem('olimpiakids_wasit_states', JSON.stringify(next))
          return next
        })

        if (isRefresh) {
          flushPendingQueue()
          showToast('Data Match berhasil diperbarui dari Sheets!', 'success')
        }
      }
    } catch (err) {
      console.error('Gagal memuat matches:', err)
      if (isRefresh) showToast('Gagal memuat data terbaru, menggunakan data lokal.', 'error')
    } finally {
      setIsLoadingMatches(false)
    }
  }, [showToast, flushPendingQueue])

  useEffect(() => {
    loadMatchesFromApi()
  }, [loadMatchesFromApi])

  // Simpan setiap perubahan state match ke localStorage
  const updateMatchState = useCallback((matchId: number, updater: (prev: MatchState) => MatchState) => {
    setMatchStates((prev) => {
      const current = prev[matchId] || {
        status: 'standby',
        participants: matches.find((m) => m.id === matchId)?.participants || [],
      }
      const updated = updater(current)
      const next = { ...prev, [matchId]: updated }
      localStorage.setItem('olimpiakids_wasit_states', JSON.stringify(next))
      return next
    })
  }, [matches])

  // DATA MATCH YANG SEDANG DILIHAT WASIT
  const currentMatch = matches[currentMatchIdx] || matches[0]
  const currentMatchState: MatchState = matchStates[currentMatch?.id] || {
    status: 'standby',
    participants: currentMatch?.participants || [],
  }

  // Cek apakah ada match yang sedang UNLOCKED / ACTIVE saat ini
  let activeRunningMatch: { id: number; title: string } | null = null
  for (const [idStr, state] of Object.entries(matchStates)) {
    if (state.status === 'active') {
      const id = Number(idStr)
      const matchInfo = matches.find((m) => m.id === id)
      activeRunningMatch = { id, title: matchInfo?.title || `Match ${id}` }
      break
    }
  }

  // 6. HANDLER PIN LOGIN
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput === '1234') {
      setIsAuthenticated(true)
      setUserRole('referee')
      sessionStorage.setItem('olimpiakids_wasit_auth', JSON.stringify({ isAuthenticated: true, role: 'referee' }))
      setPinError('')
      showToast('Login Wasit Berhasil! Selamat bertugas.', 'success')
    } else if (pinInput === '9999') {
      setIsAuthenticated(true)
      setUserRole('supervisor')
      sessionStorage.setItem('olimpiakids_wasit_auth', JSON.stringify({ isAuthenticated: true, role: 'supervisor' }))
      setPinError('')
      showToast('Login Supervisor Aktif! Mode Darurat Tersedia.', 'success')
    } else {
      setPinError('PIN salah! Hubungi Admin / Produser jika lupa PIN.')
    }
  }

  // 7. REORDER PESERTA (DRAG & DROP)
  const handleReorder = (newOrder: WasitParticipant[]) => {
    if (currentMatchState.status !== 'active') return

    updateMatchState(currentMatch.id, (prev) => {
      const updatedItems = newOrder.map((p, idx) => ({
        ...p,
        position: idx + 1,
      }))
      return { ...prev, participants: updatedItems }
    })
  }

  // 8. TOGGLE DNF (DID NOT FINISH / NANGIS / MOGOK)
  const toggleDnf = (bibNumber: string) => {
    if (currentMatchState.status !== 'active') return

    updateMatchState(currentMatch.id, (prev) => {
      const items = [...prev.participants]
      const targetIdx = items.findIndex((p) => p.bib_number === bibNumber)
      if (targetIdx === -1) return prev

      const item = items[targetIdx]
      const isNowDnf = item.status !== 'dnf'
      item.status = isNowDnf ? 'dnf' : 'registered'

      // Jika DNF, geser ke paling bawah
      if (isNowDnf) {
        items.splice(targetIdx, 1)
        items.push(item)
      }

      const updatedItems = items.map((p, idx) => ({
        ...p,
        position: idx + 1,
      }))

      return { ...prev, participants: updatedItems }
    })
  }

  // 9. PINDAH PESERTA KE MATCH LAIN
  const handleMoveParticipant = () => {
    if (!moveModal) return
    const { participant, fromMatchId } = moveModal

    // Hapus dari match asal
    updateMatchState(fromMatchId, (prev) => {
      const remaining = prev.participants.filter((p) => p.bib_number !== participant.bib_number)
      return {
        ...prev,
        participants: remaining.map((p, idx) => ({ ...p, position: idx + 1 })),
      }
    })

    // Tambah ke match tujuan
    updateMatchState(targetMatchId, (prev) => {
      const exists = prev.participants.some((p) => p.bib_number === participant.bib_number)
      if (exists) return prev
      const updated = [...prev.participants, { ...participant, position: prev.participants.length + 1 }]
      return { ...prev, participants: updated }
    })

    showToast(`Peserta [${participant.bib_number}] dipindahkan ke Match ${targetMatchId}`, 'success')
    setMoveModal(null)
  }

  // 10. BUKA KUNCI MATCH (START MATCH)
  const handleOpenLock = (matchId: number) => {
    if (activeRunningMatch && activeRunningMatch.id !== matchId) {
      showToast(`Selesaikan & kunci ${activeRunningMatch.title} terlebih dahulu!`, 'error')
      setConfirmModal(null)
      return
    }

    updateMatchState(matchId, (prev) => ({
      ...prev,
      status: 'active',
    }))
    setConfirmModal(null)
    showToast(`Match ${matchId} AKTIF! Silakan atur urutan finish anak.`, 'success')
  }

  // 11. KUNCI FINAL & KIRIM HASIL KE GOOGLE SHEETS
  const handleFinalLock = async (matchId: number) => {
    setIsSubmitting(true)
    const matchObj = matches.find((m) => m.id === matchId)
    const state = matchStates[matchId] || { participants: [] }

    const payload: PendingSubmission = {
      matchId,
      matchTitle: matchObj?.title || `MATCH ${matchId}`,
      results: state.participants.map((p, idx) => ({
        position: idx + 1,
        bib_number: p.bib_number,
        name: p.name,
        status: p.status || 'finished',
      })),
      refereePin: userRole === 'supervisor' ? '9999' : '1234',
      webhookUrl: customWebhookUrl || undefined,
      timestamp: new Date().toISOString(),
    }

    // Kirim ke API submit (yang akan forward ke Google Sheets)
    try {
      const res = await fetch('/api/wasit/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (data.ok) {
        showToast(`✅ Hasil ${payload.matchTitle} BERHASIL DIKUNCI & TERKIRIM!`, 'success')
      } else {
        saveToPendingQueue(payload)
        showToast(`⚠️ Server sibuk: Hasil disimpan di HP dan akan dicoba kirim ulang otomatis.`, 'info')
      }
    } catch {
      saveToPendingQueue(payload)
      showToast('⚠️ Offline: Hasil disimpan di HP dan akan otomatis dikirim saat online.', 'info')
    } finally {
      // Tandai match sebagai FINAL
      updateMatchState(matchId, (prev) => ({
        ...prev,
        status: 'final',
        lockedAt: new Date().toISOString(),
      }))
      setIsSubmitting(false)
      setConfirmModal(null)

      // Geser otomatis ke match berikutnya jika belum match terakhir
      if (currentMatchIdx < matches.length - 1) {
        setTimeout(() => {
          setCurrentMatchIdx((prev) => prev + 1)
        }, 800)
      }
    }
  }

  // 12. BUKA KUNCI DARURAT OLEH SUPERVISOR (MASTER PIN 9999)
  const handleEmergencyUnlock = () => {
    if (emergencyPin !== '9999') {
      setEmergencyError('Master PIN salah! Hanya Supervisor yang berwenang.')
      return
    }

    if (emergencyModal !== null) {
      updateMatchState(emergencyModal, (prev) => ({
        ...prev,
        status: 'active',
      }))
      showToast(`Kunci darurat Match ${emergencyModal} berhasil dibuka!`, 'success')
      setEmergencyModal(null)
      setEmergencyPin('')
      setEmergencyError('')
    }
  }

  // =========================================================================
  // RENDER: SCREEN LOGIN PIN JIKA BELUM AUTH
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">👶</span>
          </div>

          <h1 className="font-display font-black text-2xl text-white tracking-wide uppercase">
            WASIT OLIMPIAKIDS
          </h1>
          <p className="text-xs text-blue-200 mt-1 mb-6">
            Panel Pengatur Urutan Finish Wasit Tunggal
          </p>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
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
            </div>

            {pinError && (
              <p className="text-xs font-bold text-red-400 animate-shake">
                {pinError}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-b from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-amber-950 font-display font-black text-base py-3.5 px-6 rounded-2xl shadow-[0_4px_0_rgba(180,83,9,1)] active:translate-y-1 active:shadow-none transition-all"
            >
              MASUK KE DASHBOARD WASIT
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-blue-300/70">
            PIN Default Wasit: <code className="text-yellow-300 font-bold">1234</code> | Supervisor: <code className="text-yellow-300 font-bold">9999</code>
          </div>
        </motion.div>
      </div>
    )
  }

  // =========================================================================
  // RENDER: DASHBOARD UTAMA WASIT (MOBILE FIRST CAROUSEL)
  // =========================================================================
  const isMatchLocked = currentMatchState.status === 'final'
  const isMatchActive = currentMatchState.status === 'active'
  const isMatchStandby = currentMatchState.status === 'standby'

  // Tombol navigasi match di-disable jika match saat ini sedang active/berjalan
  const isNavDisabled = activeRunningMatch !== null && activeRunningMatch.id === currentMatch.id

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-yellow-400 selection:text-blue-950">
      {/* 1. TOP HEADER & NAVBAR */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 py-2.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍼</span>
            <div>
              <div className="font-display font-black text-sm text-white tracking-wide uppercase leading-none">
                WASIT OLIMPIAKIDS
              </div>
              <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                <span>{isOnline ? 'Online' : 'Offline (Tersimpan Lokal)'}</span>
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
              disabled={isLoadingMatches}
              className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl border border-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-all"
              title="Tarik data terbaru dari Google Sheets"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMatches ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl border border-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-all relative"
              title="Pengaturan Webhook Google Sheets"
            >
              <Settings className="w-3.5 h-3.5" />
              {customWebhookUrl && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-1 right-1" />
              )}
            </button>

            <button
              onClick={() => {
                sessionStorage.removeItem('olimpiakids_wasit_auth')
                setIsAuthenticated(false)
              }}
              className="text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2.5 py-2 rounded-xl font-bold border border-red-500/30 transition-all"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* PENDING SUBMISSION / OFFLINE QUEUE BANNER */}
      {pendingSubmissions.length > 0 && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/40 px-3 py-1.5 text-center text-[11px] font-bold text-yellow-300 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 truncate">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
            <span className="truncate">{pendingSubmissions.length} hasil match tersimpan di HP (menunggu kirim).</span>
          </div>
          <button
            onClick={flushPendingQueue}
            className="shrink-0 bg-yellow-400 hover:bg-yellow-300 text-amber-950 font-black px-2 py-0.5 rounded text-[10px] active:scale-95 transition-all"
          >
            Kirim Sekarang
          </button>
        </div>
      )}

      {/* 2. WARNING BANNER JIKA ADA MATCH SEDANG BERJALAN & WASIT MENCOBA SWIPE */}
      {isNavDisabled && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 px-3 py-1.5 text-center text-[11px] font-bold text-amber-300 flex items-center justify-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Match ini sedang dinilai! Kunci match terlebih dahulu untuk membuka match lain.</span>
        </div>
      )}

      {/* 3. CAROUSEL SELECTOR: MATCH 1 DARI 12 */}
      <div className="w-full max-w-md mx-auto px-3 pt-3">
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-2.5 flex items-center justify-between shadow-sm">
          <button
            onClick={() => setCurrentMatchIdx((prev) => Math.max(0, prev - 1))}
            disabled={currentMatchIdx === 0 || isNavDisabled}
            className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-white transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center px-2 flex-1 min-w-0">
            <div className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider">
              {currentMatch?.title || `MATCH ${currentMatchIdx + 1}`}
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <span className="text-xs font-black text-slate-300">
                Match {currentMatchIdx + 1} dari {matches.length}
              </span>
              <span>•</span>
              <span className="text-xs text-slate-400">
                {currentMatchState.participants.length} Bayi
              </span>
            </div>
          </div>

          <button
            onClick={() => setCurrentMatchIdx((prev) => Math.min(matches.length - 1, prev + 1))}
            disabled={currentMatchIdx === matches.length - 1 || isNavDisabled}
            className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-white transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* STATUS GEMBOK MATCH */}
        <div className="mt-2.5 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            {isMatchActive && (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                SEDANG DINILAI
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

          {/* EMERGENCY UNLOCK UNTUK SUPERVISOR JIKA SUDAH FINAL */}
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

      {/* 4. LIST PESERTA (DRAG & DROP REORDER) */}
      <main className="flex-1 w-full max-w-md mx-auto px-3 py-3 overflow-y-auto">
        {isMatchActive && (
          <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between px-1 mb-2.5">
            <span>Tahan & geser ikon <b className="text-white font-bold">⠿</b> untuk atur urutan</span>
            <span className="text-yellow-400 font-bold">Posisi 1 = Juara 1</span>
          </div>
        )}

        <Reorder.Group
          axis="y"
          values={currentMatchState.participants}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {currentMatchState.participants.map((p, index) => (
            <ParticipantCard
              key={p.bib_number}
              participant={p}
              index={index}
              isMatchActive={isMatchActive}
              onToggleDnf={toggleDnf}
              onOpenMoveModal={(participant) => {
                const firstAvailable = matches.find(
                  (m) => m.id !== currentMatch.id && matchStates[m.id]?.status !== 'final'
                )
                if (firstAvailable) setTargetMatchId(firstAvailable.id)
                setMoveModal({ participant, fromMatchId: currentMatch.id })
              }}
            />
          ))}
        </Reorder.Group>
      </main>

      {/* 5. STICKY BOTTOM ACTION BAR */}
      <footer className="sticky bottom-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3">
        <div className="max-w-md mx-auto">
          {/* JIKA MATCH STANDBY: TAMPILKAN TOMBOL BUKA GEMBOK */}
          {isMatchStandby && (
            <button
              onClick={() => setConfirmModal({ type: 'open_lock', matchId: currentMatch.id })}
              className="w-full bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white font-display font-black text-sm py-3.5 px-6 rounded-2xl shadow-[0_4px_0_rgba(29,78,216,1)] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 transition-all"
            >
              <Unlock className="w-5 h-5 text-yellow-300" />
              <span>BUKA GEMBOK & NILAI MATCH INI</span>
            </button>
          )}

          {/* JIKA MATCH ACTIVE: TAMPILKAN TOMBOL KUNCI FINAL */}
          {isMatchActive && (
            <button
              onClick={() => setConfirmModal({ type: 'final_lock', matchId: currentMatch.id })}
              disabled={isSubmitting}
              className="w-full bg-gradient-to-b from-yellow-400 via-amber-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-amber-950 font-display font-black text-base py-3.5 px-6 rounded-2xl shadow-[0_4px_0_rgba(180,83,9,1)] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 transition-all"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>MENGIRIM KE GOOGLE SHEETS...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>KUNCI & KIRIM HASIL FINAL</span>
                </>
              )}
            </button>
          )}

          {/* JIKA MATCH FINAL / TERKUNCI */}
          {isMatchLocked && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3 text-center">
              <div className="font-display font-black text-xs text-amber-400 uppercase flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>HASIL MATCH INI TELAH DIKUNCI & FINAL</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Data sudah terkirim ke Google Sheets. Beralihlah ke match berikutnya.
              </p>
            </div>
          )}
        </div>
      </footer>

      {/* ===================================================================== */}
      {/* 6. MODAL KONFIRMASI (BUKA GEMBOK / KUNCI FINAL) */}
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
              {confirmModal.type === 'open_lock' ? (
                <>
                  <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Unlock className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-black text-lg text-white uppercase">
                    Buka Kunci Match {confirmModal.matchId}?
                  </h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Halaman match lain akan <b>dikunci sementara</b> sampai Anda menyelesaikan dan mengunci match ini, agar Anda fokus pada balapan.
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
              ) : (
                <>
                  <div className="w-12 h-12 bg-yellow-500/20 text-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-black text-lg text-white uppercase">
                    Kunci Hasil Final Match {confirmModal.matchId}?
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Pastikan urutan finish sudah benar:
                  </p>

                  {/* Summary 3 Besar (NO MEDAL ICONS) */}
                  <div className="my-3 bg-slate-900/80 border border-slate-700 rounded-2xl p-3 text-left text-xs space-y-1.5">
                    <div className="flex items-center gap-2 text-white font-bold truncate">
                      <span className="w-5 h-5 rounded-md bg-yellow-400 text-amber-950 font-black text-xs flex items-center justify-center shrink-0">1</span>
                      <span className="truncate">
                        [{currentMatchState.participants[0]?.bib_number}] {currentMatchState.participants[0]?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200 font-bold truncate">
                      <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-900 font-black text-xs flex items-center justify-center shrink-0">2</span>
                      <span className="truncate">
                        [{currentMatchState.participants[1]?.bib_number}] {currentMatchState.participants[1]?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300 font-bold truncate">
                      <span className="w-5 h-5 rounded-md bg-amber-600 text-white font-black text-xs flex items-center justify-center shrink-0">3</span>
                      <span className="truncate">
                        [{currentMatchState.participants[2]?.bib_number}] {currentMatchState.participants[2]?.name}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-400 font-bold leading-tight">
                    ⚠️ Setelah dikunci, hasil ini bersifat FINAL dan akan langsung dikirim ke Google Sheets.
                  </p>

                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => setConfirmModal(null)}
                      className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold text-xs"
                    >
                      Koreksi Dulu
                    </button>
                    <button
                      onClick={() => handleFinalLock(confirmModal.matchId)}
                      disabled={isSubmitting}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-amber-950 font-black text-xs shadow-md"
                    >
                      {isSubmitting ? 'Mengirim...' : 'Yakin, Kunci Final!'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 7. MODAL BUKA KUNCI DARURAT OLEH SUPERVISOR (PIN 9999) */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {emergencyModal !== null && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-800 border-2 border-amber-500/60 rounded-3xl p-5 shadow-2xl text-center"
            >
              <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-lg text-white uppercase">
                Buka Kunci Darurat (Supervisor)
              </h3>
              <p className="text-xs text-slate-300 mt-1 mb-4">
                Masukkan Master PIN Supervisor untuk membuka kembali Match {emergencyModal}.
              </p>

              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={emergencyPin}
                onChange={(e) => setEmergencyPin(e.target.value)}
                placeholder="Master PIN (4 Digit)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-center text-xl font-black tracking-widest text-white focus:outline-none focus:border-amber-400 mb-2"
                autoFocus
              />

              {emergencyError && (
                <p className="text-xs font-bold text-red-400 mb-2">
                  {emergencyError}
                </p>
              )}

              <div className="flex gap-2 mt-4">
                <button
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
                  onClick={handleEmergencyUnlock}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-xs"
                >
                  Buka Kunci
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 8. MODAL PINDAH PESERTA KE MATCH LAIN */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {moveModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-3xl p-5 shadow-2xl text-center"
            >
              <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MoveRight className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-lg text-white uppercase">
                Pindahkan Peserta
              </h3>
              <p className="text-xs text-slate-300 mt-1 mb-4">
                Pindahkan <b>[{moveModal.participant.bib_number}] {moveModal.participant.name}</b> ke match lain:
              </p>

              <div className="text-left mb-4">
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  PILIH MATCH TUJUAN:
                </label>
                <select
                  value={targetMatchId}
                  onChange={(e) => setTargetMatchId(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-yellow-400"
                >
                  {matches.map((m) => {
                    const isCurrent = m.id === moveModal.fromMatchId
                    const isFinal = matchStates[m.id]?.status === 'final'
                    const isDisabled = isCurrent || isFinal
                    return (
                      <option key={m.id} value={m.id} disabled={isDisabled}>
                        {m.title} {isCurrent ? '(Match Saat Ini)' : isFinal ? '(Sudah Final / Selesai)' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setMoveModal(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  onClick={handleMoveParticipant}
                  className="flex-1 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-amber-950 font-black text-xs shadow-md"
                >
                  Konfirmasi Pindah
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 8.5. MODAL SETTINGS WEBHOOK GOOGLE SHEETS */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-3xl p-5 shadow-2xl"
            >
              <div className="w-12 h-12 bg-yellow-400/20 text-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Settings className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-lg text-white uppercase text-center">
                Pengaturan Google Sheets
              </h3>
              <p className="text-xs text-slate-300 mt-1 mb-4 text-center">
                Hubungkan tombol Kunci Final langsung ke spreadsheet Anda secara realtime.
              </p>

              <div className="space-y-3 mb-4 text-left">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    URL WEB APP APPS SCRIPT:
                  </label>
                  <input
                    type="url"
                    value={customWebhookUrl}
                    onChange={(e) => setCustomWebhookUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-yellow-400"
                  />
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 text-[11px] text-slate-400 space-y-1">
                  <p className="font-bold text-yellow-400">💡 Cara Pasang Web App (Cukup Sekali):</p>
                  <p>1. Di Google Sheet, klik menu <b>Extensions → Apps Script</b>.</p>
                  <p>2. Paste isi kode <b>Code.gs</b> lalu klik <b>Deploy → New Deployment</b>.</p>
                  <p>3. Pilih tipe <b>Web app</b> (Who has access: <b>Anyone</b>) lalu copy URL yang didapat ke kotak di atas.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    const cleaned = customWebhookUrl.trim()
                    if (cleaned) {
                      localStorage.setItem('olimpiakids_apps_script_url', cleaned)
                      showToast('URL Webhook berhasil disimpan!', 'success')
                    } else {
                      localStorage.removeItem('olimpiakids_apps_script_url')
                      showToast('URL Webhook dikosongkan (menggunakan env default).', 'info')
                    }
                    setShowSettingsModal(false)
                  }}
                  className="flex-1 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-amber-950 font-black text-xs shadow-md"
                >
                  Simpan URL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 9. TOAST NOTIFIKASI MELAYANG */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-2xl border text-xs font-black flex items-center gap-2 select-none ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-400'
                : toast.type === 'error'
                ? 'bg-red-600 text-white border-red-400'
                : 'bg-blue-600 text-white border-blue-400'
            }`}
          >
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
