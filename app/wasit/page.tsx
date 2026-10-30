'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'
import {
  Lock,
  Unlock,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  MoveRight,
  ShieldAlert,
  Settings,
  GripVertical,
  LogOut,
  Users,
  Clock,
  Send,
  Edit3,
} from 'lucide-react'
import { DEFAULT_MATCHES, WasitMatch, WasitParticipant } from '@/lib/wasitDefaults'
import {
  getSyncChannel,
  broadcastSessionEvent,
  broadcastWasitEvent,
  CLIENT_ID,
  RealtimeSessionPayload,
} from '@/lib/realtimeSync'
import {
  ActiveMatchSession,
  INITIAL_MATCH_SESSION,
  getActiveSession,
  saveActiveSession,
} from '@/lib/sessionStore'

interface WasitReorderCardProps {
  participant: WasitParticipant
  index: number
  isFinal: boolean
  currentTimerVal: string
  onToggleDnf: (bib: string) => void
  onManualTimeChange: (bib: string, val: string) => void
}

function WasitReorderCard({
  participant: p,
  index: idx,
  isFinal,
  currentTimerVal,
  onToggleDnf,
  onManualTimeChange,
}: WasitReorderCardProps) {
  const dragControls = useDragControls()
  const position = idx + 1
  const isDnf = p.status === 'dnf'

  return (
    <Reorder.Item
      value={p}
      dragListener={false}
      dragControls={dragControls}
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.7), 0 8px 10px -6px rgb(251 191 36 / 0.35)',
        zIndex: 50,
      }}
      className={`px-2.5 py-2.5 rounded-2xl border transition-colors flex items-center justify-between gap-2 ${
        isDnf
          ? 'bg-red-950/35 border-red-500/60'
          : position === 1
          ? 'bg-slate-900 border-amber-400/70 shadow-sm'
          : 'bg-slate-900/80 border-slate-800'
      }`}
    >
      {/* Left: Grip Handle + Rank Badge + Bib & Name */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div
          onPointerDown={(e) => {
            if (!isFinal) {
              e.preventDefault()
              dragControls.start(e)
            }
          }}
          style={{ touchAction: 'none' }}
          className={`p-2 rounded-xl border transition-colors shrink-0 select-none ${
            isFinal
              ? 'text-slate-700 border-transparent cursor-not-allowed'
              : 'text-amber-400 bg-slate-800/90 border-slate-700 hover:bg-slate-700 active:bg-amber-400 active:text-slate-950 cursor-grab active:cursor-grabbing'
          }`}
          title="Tahan & geser untuk mengubah urutan"
        >
          <GripVertical className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>

        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-mono font-black text-xs flex items-center justify-center shrink-0 ${
            isDnf
              ? 'bg-red-600 text-white'
              : position === 1
              ? 'bg-yellow-400 text-slate-950'
              : position === 2
              ? 'bg-slate-200 text-slate-950'
              : position === 3
              ? 'bg-amber-600 text-white'
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}
        >
          {isDnf ? 'DNF' : `#${position}`}
        </div>

        {/* Nomor Dada + Nama */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <span
              className={`font-mono font-black text-xl sm:text-2xl leading-none shrink-0 ${
                isDnf ? 'text-red-300' : 'text-amber-300'
              }`}
            >
              {p.bib_number}
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-200 truncate uppercase">
              {p.name}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Inline Time Input + DNF Button */}
      <div className="flex items-center gap-1.5 shrink-0">
        {!isDnf && (
          <input
            type="text"
            value={currentTimerVal}
            onChange={(e) => onManualTimeChange(p.bib_number, e.target.value)}
            disabled={isFinal}
            placeholder="00:00.00"
            className="w-20 sm:w-24 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-1.5 py-1.5 text-center font-mono font-black text-xs sm:text-sm text-amber-300 tracking-wider focus:outline-none"
          />
        )}

        <button
          onClick={() => onToggleDnf(p.bib_number)}
          disabled={isFinal}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-black border transition-all ${
            isDnf
              ? 'bg-red-600 text-white border-red-400'
              : 'bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border-slate-700'
          }`}
          title={isDnf ? 'Batal DNF' : 'Tandai DNF'}
        >
          DNF
        </button>
      </div>
    </Reorder.Item>
  )
}

export default function WasitPage() {
  // 1. AUTH STATE
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [isSupervisor, setIsSupervisor] = useState(false)

  // 2. VIEW MODE: 'MATCH_LIST' | 'MATCH_DETAIL'
  const [viewMode, setViewMode] = useState<'MATCH_LIST' | 'MATCH_DETAIL'>('MATCH_LIST')

  // 3. MATCHES DATA
  const [matches, setMatches] = useState<WasitMatch[]>(DEFAULT_MATCHES)
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0)

  // 4. ACTIVE MATCH SESSION (GEMBOK, TIMER, & WASIT)
  const [session, setSession] = useState<ActiveMatchSession>(INITIAL_MATCH_SESSION)
  const [participants, setParticipants] = useState<WasitParticipant[]>([])
  const [manualTimes, setManualTimes] = useState<Record<string, string>>({}) // bib -> 'MM:SS.CC'

  // 5. STATUS MATCHES TRACKER (matchId -> 'LOCKED' | 'UNLOCKED' | 'FINAL')
  const [matchStatuses, setMatchStatuses] = useState<Record<number, 'LOCKED' | 'UNLOCKED' | 'FINAL'>>({})

  // 6. MODALS
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)
  const [selectedChildToMove, setSelectedChildToMove] = useState<{ matchId: number; participant: WasitParticipant } | null>(null)
  const [targetMatchId, setTargetMatchId] = useState<number>(1)
  const [moveError, setMoveError] = useState('')

  const [emergencyModal, setEmergencyModal] = useState<'UNLOCK' | 'RESET_MATCH' | 'RESET_DB' | null>(null)
  const [emergencyPin, setEmergencyPin] = useState('')
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [emergencyError, setEmergencyError] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const currentMatch = matches[currentMatchIdx] || matches[0]

  // =========================================================================
  // LOAD MATCHES & SESSION INITIAL
  // =========================================================================
  const loadMatchesFromApi = useCallback(async () => {
    try {
      const res = await fetch('/api/wasit/matches?refresh=true')
      if (res.ok) {
        const json = await res.json()
        if (json.matches && Array.isArray(json.matches)) {
          setMatches(json.matches)
          // Inisialisasi matchStatuses dari data Google Sheets (jika peserta match sudah punya urutan)
          setMatchStatuses((prev) => {
            const next = { ...prev }
            json.matches.forEach((m: WasitMatch) => {
              const hasSheetUrutan = m.participants?.some((p) => p.urutan !== null && p.urutan !== undefined && String(p.urutan).trim() !== '')
              if (hasSheetUrutan && !next[m.id]) {
                next[m.id] = 'FINAL'
              }
            })
            return next
          })
        }
      }
    } catch {}
  }, [])

  const reorderDebounceRef = useRef<NodeJS.Timeout | null>(null)

  const loadSessionFromDb = useCallback(async () => {
    try {
      const s = await getActiveSession()
      if (s) {
        const safeSession: ActiveMatchSession = {
          ...s,
          participants: s.participants || [],
          splits: s.splits || [],
          dnfList: s.dnfList || [],
        }
        setSession(safeSession)
        if (s.matchStatuses) {
          setMatchStatuses((prev) => ({ ...prev, ...s.matchStatuses }))
        }
        if (s.matchId) {
          const idx = matches.findIndex((m) => m.id === s.matchId)
          if (idx !== -1) setCurrentMatchIdx(idx)
        }
        if (s.participants && s.participants.length > 0) {
          setParticipants(s.participants)
        }
      }
    } catch {}
  }, [matches])

  useEffect(() => {
    loadMatchesFromApi()
    loadSessionFromDb()
  }, [loadMatchesFromApi, loadSessionFromDb])

  // Sync participants whenever currentMatch changes
  useEffect(() => {
    if (currentMatch && (!participants || participants.length === 0)) {
      setParticipants(currentMatch.participants || [])
    }
  }, [currentMatchIdx, currentMatch, participants])

  // =========================================================================
  // REALTIME WEBSOCKET SUBSCRIPTION + BACKGROUND POLLING
  // =========================================================================
  useEffect(() => {
    const channel = getSyncChannel()

    const handleSessionSync = ({ payload }: { payload: RealtimeSessionPayload }) => {
      if (!payload || payload.senderId === CLIENT_ID) return
      if (payload.session) {
        setSession((prev) => ({
          ...prev,
          ...payload.session,
          // Jangan timpa urutan participants yang sedang diatur wasit jika sinyal datang dari Timer
          participants:
            payload.action === 'START_TIMER' ||
            payload.action === 'SPLIT_TIMER' ||
            payload.action === 'RESET_TIMER'
              ? prev.participants
              : payload.session.participants || prev.participants,
        }))
      }
    }

    channel.on('broadcast', { event: 'session-sync' }, handleSessionSync)

    // Backup polling tiap 1.5 detik saat match sedang UNLOCKED / RUNNING agar split dari Timer anti-lewat
    const interval = setInterval(async () => {
      try {
        const s = await getActiveSession()
        if (s && s.matchId === currentMatch?.id) {
          setSession((prev) => ({
            ...prev,
            status: s.status,
            splits: s.splits || [],
            elapsedMs: s.elapsedMs || 0,
            startTime: s.startTime,
            matchStatuses: s.matchStatuses || prev.matchStatuses,
          }))
        }
      } catch {}
    }, 1500)

    return () => clearInterval(interval)
  }, [currentMatch?.id])

  // =========================================================================
  // AUTH PIN SUBMIT
  // =========================================================================
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput === '1234') {
      setIsAuthenticated(true)
      setIsSupervisor(false)
      setPinError('')
      setViewMode('MATCH_LIST')
    } else if (pinInput === '9999') {
      setIsAuthenticated(true)
      setIsSupervisor(true)
      setPinError('')
      setViewMode('MATCH_LIST')
    } else {
      setPinError('PIN salah! Hubungi Supervisor.')
    }
  }

  // =========================================================================
  // PILIH MATCH DARI LIST
  // =========================================================================
  const selectMatch = (idx: number) => {
    const target = matches[idx]
    if (!target) return

    // Cegah pindah match jika ada match lain yang sedang RUNNING
    if (
      session.matchId !== target.id &&
      (session.status === 'RUNNING' || session.status === 'UNLOCKED')
    ) {
      showToast(
        'error',
        `Match ${session.matchId} masih terbuka/berjalan! Kunci balik atau selesaikan Match ${session.matchId} dulu.`
      )
      return
    }

    setCurrentMatchIdx(idx)
    setManualTimes({})

    if (session.matchId === target.id && session.participants && session.participants.length > 0) {
      setParticipants(session.participants)
    } else {
      setParticipants(target.participants || [])
    }

    // Catatan penting: JANGAN timpa session global di Supabase jika match sebelumnya LOCKED_FINAL,
    // supaya layar Plasma tetap menampilkan hasil match sebelumnya sampai Wasit klik BUKA GEMBOK!
    setViewMode('MATCH_DETAIL')
  }

  // =========================================================================
  // BUKA GEMBOK MATCH (WASIT ADALAH MASTER)
  // =========================================================================
  const handleUnlockMatch = async () => {
    const nextStatuses = { ...matchStatuses, [currentMatch.id]: 'UNLOCKED' as const }
    const resetParticipants: WasitParticipant[] = (
      participants.length > 0 ? participants : currentMatch.participants || []
    ).map((p, i) => ({
      ...p,
      position: i + 1,
      status: p.status === 'dnf' ? 'dnf' : 'registered',
    }))
    const updated: ActiveMatchSession = {
      ...session,
      matchId: currentMatch.id,
      matchTitle: currentMatch.title,
      status: 'UNLOCKED',
      participants: resetParticipants,
      splits: [],
      results: [],
      elapsedMs: 0,
      startTime: null,
      dnfList: resetParticipants.filter((p) => p.status === 'dnf').map((p) => p.bib_number),
      matchStatuses: nextStatuses,
      updatedAt: new Date().toISOString(),
    }
    setParticipants(resetParticipants)
    setManualTimes({})
    setSession(updated)
    setMatchStatuses(nextStatuses)
    await saveActiveSession(updated)
    broadcastSessionEvent({ action: 'UNLOCK_MATCH', session: updated })
    showToast('success', `🔓 Gembok ${currentMatch.title} dibuka! Timer & Plasma aktif.`)
  }

  const handleLockMatchBack = async () => {
    const nextStatuses = { ...matchStatuses, [currentMatch.id]: 'LOCKED' as const }
    const updated: ActiveMatchSession = {
      ...session,
      matchId: currentMatch.id,
      matchTitle: currentMatch.title,
      status: 'LOCKED',
      matchStatuses: nextStatuses,
      updatedAt: new Date().toISOString(),
    }
    setSession(updated)
    setMatchStatuses(nextStatuses)
    await saveActiveSession(updated)
    broadcastSessionEvent({ action: 'LOCK_MATCH', session: updated })
    showToast('success', `🔒 ${currentMatch.title} dikembalikan ke status TERGEMBOK.`)
  }

  // =========================================================================
  // REORDER PARTICIPANTS (URUTAN WASIT - DEBOUNCED SYNC)
  // =========================================================================
  const handleReorder = (newOrder: WasitParticipant[]) => {
    // Pastikan yang DNF tetap berada di urutan paling bawah
    const nonDnf = newOrder.filter((p) => p.status !== 'dnf')
    const dnfOnly = newOrder.filter((p) => p.status === 'dnf')
    const normalizedOrder = [...nonDnf, ...dnfOnly]

    setParticipants(normalizedOrder)

    if (session.matchId === currentMatch.id) {
      const updated: ActiveMatchSession = {
        ...session,
        participants: normalizedOrder,
        updatedAt: new Date().toISOString(),
      }
      setSession(updated)

      if (reorderDebounceRef.current) clearTimeout(reorderDebounceRef.current)
      reorderDebounceRef.current = setTimeout(() => {
        saveActiveSession(updated)
        broadcastSessionEvent({ action: 'REORDER_WASIT', session: updated })
      }, 120)
    }
  }

  // =========================================================================
  // TOGGLE DNF (MOGOK) - OTOMATIS HENTIKAN STOPWATCH JIKA SISA ANAK HABIS
  // =========================================================================
  const handleToggleDnf = (bib: string) => {
    const cloned = [...participants]
    const idx = cloned.findIndex((p) => p.bib_number === bib)
    if (idx === -1) return

    const isCurrentDnf = cloned[idx].status === 'dnf'
    cloned[idx] = {
      ...cloned[idx],
      status: isCurrentDnf ? 'registered' : 'dnf',
    }

    // Sortir: DNF selalu dilempar ke paling bawah
    cloned.sort((a, b) => {
      const aDnf = a.status === 'dnf'
      const bDnf = b.status === 'dnf'
      if (aDnf && !bDnf) return 1
      if (!aDnf && bDnf) return -1
      return 0
    })

    setParticipants(cloned)

    const dnfBibs = cloned.filter((p) => p.status === 'dnf').map((p) => p.bib_number)
    const activeFinishersCount = cloned.filter((p) => p.status !== 'dnf').length
    const currentSplits = session.matchId === currentMatch.id ? session.splits || [] : []

    // Jika stopwatch sedang RUNNING dan jumlah split sudah mencapai jumlah finisher non-DNF,
    // otomatis hentikan stopwatch (TIMER_COMPLETED)!
    let nextStatus = session.matchId === currentMatch.id ? session.status : 'LOCKED'
    let nextElapsed = session.matchId === currentMatch.id ? session.elapsedMs : 0
    if (
      session.matchId === currentMatch.id &&
      session.status === 'RUNNING' &&
      activeFinishersCount > 0 &&
      currentSplits.length >= activeFinishersCount
    ) {
      nextStatus = 'TIMER_COMPLETED'
      nextElapsed = currentSplits[currentSplits.length - 1]?.elapsedMs || session.elapsedMs
    }

    if (session.matchId === currentMatch.id) {
      const updated: ActiveMatchSession = {
        ...session,
        status: nextStatus,
        elapsedMs: nextElapsed,
        participants: cloned,
        dnfList: dnfBibs,
        updatedAt: new Date().toISOString(),
      }
      setSession(updated)
      saveActiveSession(updated)
      broadcastSessionEvent({ action: 'DNF_WASIT', session: updated })
    }

    showToast(isCurrentDnf ? 'success' : 'error', `${bib} ${isCurrentDnf ? 'Batal DNF' : 'Ditandai DNF'}`)
  }

  // =========================================================================
  // MANUAL TIME EDIT (WASIT BISA ISI & KOREKSI WAKTU MANUAL)
  // =========================================================================
  const handleManualTimeChange = (bib: string, val: string) => {
    setManualTimes((prev) => ({
      ...prev,
      [bib]: val,
    }))
  }

  // =========================================================================
  // KUNCI & KIRIM HASIL KE LEADERBOARD (ATOMIC LOCK)
  // =========================================================================
  const handleFinalLock = async () => {
    if (participants.length === 0) return
    setIsSubmitting(true)

    try {
      const activeSplits = session.matchId === currentMatch.id ? session.splits || [] : []
      let finisherIdx = 0

      // Gabungkan urutan wasit + catatan waktu (dari split urutan posisi atau edit manual wasit)
      const mergedResults = participants.map((p) => {
        const isDnf = p.status === 'dnf'
        if (isDnf) {
          return {
            position: 9999,
            bib_number: p.bib_number,
            name: p.name,
            status: 'dnf',
            timer: 'DNF',
          }
        }
        const posNumber = finisherIdx + 1
        const customTime =
          manualTimes[p.bib_number] !== undefined ? manualTimes[p.bib_number].trim() : ''
        const splitTime = activeSplits[finisherIdx]?.timer || ''
        const finalTimer = customTime || splitTime || '--.--.--'
        finisherIdx++

        return {
          position: posNumber,
          bib_number: p.bib_number,
          name: p.name,
          status: 'finished',
          timer: finalTimer,
        }
      })

      const res = await fetch('/api/wasit/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: currentMatch.id,
          matchTitle: currentMatch.title,
          results: mergedResults,
          splits: activeSplits,
          refereePin: isSupervisor ? '9999' : '1234',
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Gagal mengunci hasil match')
      }

      const nextStatuses = { ...matchStatuses, [currentMatch.id]: 'FINAL' as const }
      const lockedSession: ActiveMatchSession = {
        ...session,
        matchId: currentMatch.id,
        matchTitle: currentMatch.title,
        status: 'LOCKED_FINAL',
        participants: participants,
        results: mergedResults,
        splits: mergedResults
          .filter((r) => r.status !== 'dnf')
          .map((r, i) => ({
            position: i + 1,
            timer: r.timer,
            elapsedMs: activeSplits[i]?.elapsedMs || 0,
            manualEdited: manualTimes[r.bib_number] !== undefined,
          })),
        matchStatuses: nextStatuses,
        updatedAt: new Date().toISOString(),
        lockedAt: new Date().toISOString(),
      }
      setSession(lockedSession)
      setMatchStatuses(nextStatuses)
      broadcastSessionEvent({ action: 'LOCK_FINAL', session: lockedSession })

      showToast('success', `${currentMatch.title} berhasil dikunci & dikirim!`)
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Terjadi kegagalan saat mengunci hasil.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // =========================================================================
  // EMERGENCY OVERRIDE & RESET
  // =========================================================================
  const executeEmergencyAction = async () => {
    if (emergencyPin !== '9999') {
      setEmergencyError('PIN Supervisor salah! Butuh PIN 9999.')
      return
    }

    if (emergencyModal === 'RESET_DB' && resetConfirmText !== 'RESET') {
      setEmergencyError('Ketik "RESET" dengan huruf besar untuk konfirmasi!')
      return
    }

    if (emergencyModal === 'UNLOCK') {
      const nextStatuses = { ...matchStatuses, [currentMatch.id]: 'UNLOCKED' as const }
      const unlockedSession: ActiveMatchSession = {
        ...session,
        matchId: currentMatch.id,
        matchTitle: currentMatch.title,
        status: 'UNLOCKED',
        participants,
        matchStatuses: nextStatuses,
        updatedAt: new Date().toISOString(),
      }
      setSession(unlockedSession)
      setMatchStatuses(nextStatuses)
      await saveActiveSession(unlockedSession)
      broadcastSessionEvent({ action: 'UNLOCK_MATCH', session: unlockedSession })
      showToast('success', `Gembok ${currentMatch.title} dibuka ulang.`)
    } else if (emergencyModal === 'RESET_MATCH') {
      await fetch('/api/wasit/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: currentMatch.id,
          action: 'RESET_MATCH',
          results: currentMatch.participants,
          refereePin: '9999',
        }),
      })
      const nextStatuses = { ...matchStatuses, [currentMatch.id]: 'LOCKED' as const }
      const resetSession: ActiveMatchSession = {
        ...INITIAL_MATCH_SESSION,
        matchId: currentMatch.id,
        matchTitle: currentMatch.title,
        status: 'LOCKED',
        participants: currentMatch.participants || [],
        matchStatuses: nextStatuses,
      }
      setSession(resetSession)
      setParticipants(currentMatch.participants || [])
      setManualTimes({})
      setMatchStatuses(nextStatuses)
      await saveActiveSession(resetSession)
      broadcastSessionEvent({ action: 'SESSION_SYNC', session: resetSession })
      showToast('success', `Match ${currentMatch.id} berhasil direset.`)
    } else if (emergencyModal === 'RESET_DB') {
      await fetch('/api/wasit/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESET_DATABASE',
          refereePin: '9999',
        }),
      }).catch(() => {})
      const cleanSession: ActiveMatchSession = {
        ...INITIAL_MATCH_SESSION,
        matchId: 1,
        matchTitle: matches[0]?.title || 'MATCH 1 (051 B - 057 B)',
        status: 'LOCKED',
        participants: matches[0]?.participants || [],
        matchStatuses: {},
        updatedAt: new Date().toISOString(),
      }
      setCurrentMatchIdx(0)
      setParticipants(matches[0]?.participants || [])
      setManualTimes({})
      setMatchStatuses({})
      setSession(cleanSession)
      await saveActiveSession(cleanSession)
      broadcastSessionEvent({ action: 'SESSION_SYNC', session: cleanSession })
      showToast('success', 'Seluruh database berhasil direset bersih!')
    }

    setEmergencyModal(null)
    setEmergencyPin('')
    setResetConfirmText('')
    setEmergencyError('')
  }

  // =========================================================================
  // PINDAH PESERTA (MAKS 10 PER MATCH)
  // =========================================================================
  const [sourceMoveMatchId, setSourceMoveMatchId] = useState<number>(1)

  const openMoveModal = (p?: WasitParticipant, fromMatchId?: number) => {
    const srcId = fromMatchId || currentMatch?.id || 1
    const srcMatch = matches.find((m) => m.id === srcId) || currentMatch || matches[0]
    const firstChild = p || srcMatch?.participants?.[0] || null
    setSourceMoveMatchId(srcId)
    setSelectedChildToMove(firstChild ? { matchId: srcId, participant: firstChild } : null)
    setTargetMatchId(srcId === 12 ? 1 : srcId + 1)
    setMoveError('')
    setIsMoveModalOpen(true)
  }

  const handleConfirmMove = async () => {
    if (!selectedChildToMove) return

    const targetMatch = matches.find((m) => m.id === targetMatchId)
    if (!targetMatch) return

    // Validasi aturan: Maksimal 10 anak per match!
    if (targetMatch.participants && targetMatch.participants.length >= 10) {
      setMoveError(`❌ Match ${targetMatchId} sudah penuh (${targetMatch.participants.length}/10 anak)! Maksimal 10 peserta per match.`)
      return
    }

    // Pindahkan
    const updatedMatches = matches.map((m) => {
      if (m.id === selectedChildToMove.matchId) {
        return {
          ...m,
          participants: m.participants.filter((p) => p.bib_number !== selectedChildToMove.participant.bib_number),
        }
      }
      if (m.id === targetMatchId) {
        return {
          ...m,
          participants: [...m.participants, { ...selectedChildToMove.participant, position: m.participants.length + 1 }],
        }
      }
      return m
    })

    setMatches(updatedMatches)

    // Update current participants jika match aktif yang dipengaruhi
    const activeM = updatedMatches.find((m) => m.id === currentMatch.id)
    if (activeM) setParticipants(activeM.participants)

    // Simpan ke Supabase race_events 998 via API
    await fetch('/api/wasit/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matches: updatedMatches }),
    })

    setIsMoveModalOpen(false)
    setSelectedChildToMove(null)
    showToast('success', `Anak ${selectedChildToMove.participant.bib_number} berhasil dipindahkan ke Match ${targetMatchId}!`)
  }

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // =========================================================================
  // RENDER: SCREEN LOGIN JIKA BELUM AUTH
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg text-slate-950 font-black text-2xl">
            👑
          </div>
          <h1 className="font-display font-black text-2xl text-white tracking-wide uppercase">
            WASIT MASTER ARENA
          </h1>
          <p className="text-xs text-blue-200 mt-1 mb-6">
            Pusat Kendali Match, Gembok, & Validasi Hasil
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
              MASUK KE PANEL WASIT
            </button>
          </form>
          <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-blue-300/70">
            PIN Wasit: <code className="text-yellow-300 font-bold">1234</code> | Supervisor: <code className="text-yellow-300 font-bold">9999</code>
          </div>
        </motion.div>
      </div>
    )
  }

  // =========================================================================
  // VIEW 1: MATCH LIST VIEW (LIST MATCH 1 - 12 MEMANJANG KE BAWAH)
  // =========================================================================
  if (viewMode === 'MATCH_LIST') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">👑</span>
              <div>
                <h1 className="font-display font-black text-base sm:text-lg text-white uppercase tracking-wider leading-none">
                  WASIT MASTER
                </h1>
                <span className="text-[10px] text-amber-400 font-bold">
                  {isSupervisor ? 'SUPERVISOR MODE' : 'PANEL JURI ARENA'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openMoveModal(undefined, currentMatch?.id || 1)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-300 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 shadow-sm"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Atur Peserta</span>
              </button>

              {isSupervisor && (
                <button
                  onClick={() => setEmergencyModal('RESET_DB')}
                  className="p-2 bg-slate-800 hover:bg-red-500/20 text-red-400 rounded-xl border border-slate-700"
                  title="Reset Seluruh Database"
                >
                  <ShieldAlert className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => setIsAuthenticated(false)}
                className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl border border-slate-700"
                title="Keluar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Content: List Match 1 - 12 */}
        <main className="flex-1 max-w-xl w-full mx-auto p-3 sm:p-4 space-y-2.5">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              PILIH MATCH UNTUK DIKONTROL:
            </span>
            <span className="text-xs font-bold text-amber-400">12 Match Tersedia</span>
          </div>

          <div className="space-y-2.5">
            {matches.map((m, idx) => {
              const isMatchCurrentSession = session.matchId === m.id
              const isFinal = matchStatuses[m.id] === 'FINAL' || (isMatchCurrentSession && session.status === 'LOCKED_FINAL')
              const isUnlocked = isMatchCurrentSession && (session.status === 'UNLOCKED' || session.status === 'RUNNING' || session.status === 'TIMER_COMPLETED')

              let statusBadge = (
                <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Tergembok</span>
                </span>
              )

              if (isFinal) {
                statusBadge = (
                  <span className="text-[11px] font-black text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-500/40 flex items-center gap-1">
                    <span>👑</span>
                    <span>Selesai (Final)</span>
                  </span>
                )
              } else if (isUnlocked) {
                statusBadge = (
                  <span className="text-[11px] font-black text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/50 flex items-center gap-1 animate-pulse">
                    <Unlock className="w-3 h-3 text-emerald-400" />
                    <span>Sedang Terbuka</span>
                  </span>
                )
              }

              return (
                <motion.div
                  key={m.id}
                  onClick={() => selectMatch(idx)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 shadow-md ${
                    isUnlocked
                      ? 'bg-gradient-to-r from-emerald-950/40 to-slate-900 border-emerald-500/60 ring-2 ring-emerald-500/20'
                      : isFinal
                      ? 'bg-slate-900/90 border-amber-500/30'
                      : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono font-black text-lg shrink-0 shadow-inner ${
                        isUnlocked
                          ? 'bg-emerald-500 text-slate-950'
                          : isFinal
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {m.id}
                    </div>

                    <div className="min-w-0">
                      <div className="font-display font-black text-sm sm:text-base text-white tracking-wide uppercase truncate">
                        {m.title}
                      </div>
                      <div className="text-xs text-slate-400 font-bold mt-0.5">
                        {m.participants ? m.participants.length : 0} Peserta Terdaftar
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {statusBadge}
                    <MoveRight className="w-4 h-4 text-slate-500" />
                  </div>
                </motion.div>
              )
            })}
          </div>
        </main>

        {/* MODAL: PINDAH PESERTA DI MATCH LIST VIEW */}
        <AnimatePresence>
          {isMoveModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-display font-black text-base text-white uppercase flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>Pindahkan Peserta Antar Match</span>
                  </h3>
                  <button
                    onClick={() => setIsMoveModalOpen(false)}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                </div>

                {/* Pilih Match Asal */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Pilih Match Asal:</label>
                  <select
                    value={sourceMoveMatchId}
                    onChange={(e) => {
                      const mId = Number(e.target.value)
                      setSourceMoveMatchId(mId)
                      const mObj = matches.find((item) => item.id === mId)
                      const firstP = mObj?.participants?.[0] || null
                      setSelectedChildToMove(firstP ? { matchId: mId, participant: firstP } : null)
                      if (targetMatchId === mId) {
                        setTargetMatchId(mId === 12 ? 1 : mId + 1)
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    {matches.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} ({m.participants?.length || 0} peserta)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pilih Anak yang Mau Dipindah */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Pilih Peserta:</label>
                  <select
                    value={selectedChildToMove?.participant.bib_number || ''}
                    onChange={(e) => {
                      const bib = e.target.value
                      const srcM = matches.find((item) => item.id === sourceMoveMatchId)
                      const p = (srcM?.participants || []).find((item) => item.bib_number === bib)
                      if (p) setSelectedChildToMove({ matchId: sourceMoveMatchId, participant: p })
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    {(matches.find((item) => item.id === sourceMoveMatchId)?.participants || []).map((p) => (
                      <option key={p.bib_number} value={p.bib_number}>
                        {p.bib_number} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pilih Match Tujuan */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Pindah ke Match Tujuan:</label>
                  <select
                    value={targetMatchId}
                    onChange={(e) => setTargetMatchId(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    {matches.map((m) => {
                      const count = m.participants ? m.participants.length : 0
                      const isFull = count >= 10
                      return (
                        <option key={m.id} value={m.id} disabled={m.id === sourceMoveMatchId}>
                          {m.title} ({count}/10 peserta) {isFull ? '— PENUH' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>

                {moveError && (
                  <div className="p-2.5 bg-red-950/40 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold">
                    {moveError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsMoveModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleConfirmMove}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black shadow-md"
                  >
                    Konfirmasi Pindah
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: EMERGENCY RESET DB DI MATCH LIST VIEW */}
        <AnimatePresence>
          {emergencyModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4"
              >
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-black text-base text-white uppercase">
                    Reset Seluruh Database
                  </h3>
                  <p className="text-xs text-slate-400">
                    Aksi sensitif ini membutuhkan otorisasi Master PIN Supervisor (9999).
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-red-400 mb-1 block">
                    Ketik &quot;RESET&quot; untuk konfirmasi:
                  </label>
                  <input
                    type="text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="RESET"
                    className="w-full bg-slate-950 border border-red-500/50 rounded-xl px-3 py-2 text-center text-sm font-black text-red-300"
                  />
                </div>

                <div>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={emergencyPin}
                    onChange={(e) => setEmergencyPin(e.target.value)}
                    placeholder="Master PIN (4 Digit)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-lg font-black tracking-widest text-white"
                    autoFocus
                  />
                </div>

                {emergencyError && (
                  <p className="text-xs font-bold text-red-400 text-center">{emergencyError}</p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      setEmergencyModal(null)
                      setEmergencyPin('')
                      setEmergencyError('')
                    }}
                    className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Batal
                  </button>
                  <button
                    onClick={executeEmergencyAction}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black shadow-lg"
                  >
                    Eksekusi
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Global Toast */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black shadow-2xl flex items-center gap-2 ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                  : 'bg-red-500 text-white shadow-red-500/20'
              }`}
            >
              <span>{toastMessage.type === 'success' ? '✅' : '⚠️'}</span>
              <span>{toastMessage.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // =========================================================================
  // VIEW 2: MATCH DETAIL VIEW (GEMBOK, ATUR URUTAN, MANUAL EDIT, & KUNCI)
  // =========================================================================
  const isCurrentSessionMatch = session.matchId === currentMatch.id
  const statusUpper = isCurrentSessionMatch
    ? (session.status || 'LOCKED').toUpperCase()
    : matchStatuses[currentMatch.id] === 'FINAL'
    ? 'LOCKED_FINAL'
    : 'LOCKED'
  const isLocked = statusUpper === 'LOCKED'
  const isFinal = statusUpper === 'LOCKED_FINAL'
  const isUnlockedOrActive =
    statusUpper === 'UNLOCKED' || statusUpper === 'RUNNING' || statusUpper === 'TIMER_COMPLETED'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 py-2.5">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setViewMode('MATCH_LIST')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 text-amber-400" />
            <span>Daftar Match</span>
          </button>

          <div className="text-center">
            <h1 className="font-display font-black text-sm sm:text-base text-white tracking-wide uppercase">
              {currentMatch.title}
            </h1>
            <span className="text-[10px] text-amber-400 font-bold">
              {participants.length} / 10 Peserta
            </span>
          </div>

          <button
            onClick={() => openMoveModal(participants[0])}
            disabled={participants.length === 0}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl border border-slate-700"
            title="Pindah Peserta"
          >
            <Users className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-xl w-full mx-auto p-3 sm:p-4 space-y-3">
        {/* GEMBOK BANNER (MASTER CONTROL WASIT) */}
        <div
          className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
            isLocked
              ? 'bg-slate-900/95 border-amber-500/60 shadow-lg'
              : isFinal
              ? 'bg-amber-950/20 border-amber-400/50'
              : 'bg-emerald-950/20 border-emerald-500/50'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                  isLocked ? 'bg-amber-400 text-slate-950' : isFinal ? 'bg-amber-400 text-slate-950' : 'bg-emerald-400 text-slate-950'
                }`}
              >
                {isLocked ? <Lock className="w-4 h-4" /> : isFinal ? '👑' : <Unlock className="w-4 h-4" />}
              </div>
              <div>
                <div className="font-display font-black text-xs sm:text-sm text-white uppercase tracking-wider">
                  {isLocked
                    ? 'TERGEMBOK'
                    : isFinal
                    ? 'HASIL TERKUNCI'
                    : statusUpper === 'RUNNING'
                    ? 'STOPWATCH BERJALAN'
                    : statusUpper === 'TIMER_COMPLETED'
                    ? 'STOPWATCH SELESAI'
                    : 'GEMBOK TERBUKA'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {isLocked
                    ? 'Buka gembok untuk mengaktifkan Timer & Plasma'
                    : isFinal
                    ? 'Tersimpan di Plasma & Leaderboard'
                    : 'Timer & Plasma aktif'}
                </div>
              </div>
            </div>

            {/* Tombol Gembok Action */}
            {isLocked && (
              <button
                onClick={handleUnlockMatch}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-display font-black text-xs rounded-xl shadow-md active:scale-95 transition-all shrink-0"
              >
                BUKA GEMBOK
              </button>
            )}

            {isUnlockedOrActive && (
              <button
                onClick={handleLockMatchBack}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 shrink-0"
              >
                Kunci Balik
              </button>
            )}

            {isFinal && (
              <button
                onClick={() => setEmergencyModal('UNLOCK')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl border border-slate-700 shrink-0"
              >
                Buka Ulang
              </button>
            )}
          </div>
        </div>

        {/* LIST PESERTA & URUTAN POSISI */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              URUTAN POSISI
            </span>
            <span className="text-[11px] font-bold text-amber-400/90 flex items-center gap-1">
              <GripVertical className="w-3.5 h-3.5" />
              <span>Geser Grip</span>
            </span>
          </div>

          <Reorder.Group
            axis="y"
            values={participants}
            onReorder={handleReorder}
            className="space-y-1.5"
          >
            {(() => {
              let finisherCounter = 0
              return participants.map((p, idx) => {
                const isDnf = p.status === 'dnf'
                const finisherIdx = isDnf ? -1 : finisherCounter++
                const currentTimerVal =
                  manualTimes[p.bib_number] !== undefined
                    ? manualTimes[p.bib_number]
                    : !isDnf && isCurrentSessionMatch
                    ? session.splits?.[finisherIdx]?.timer || ''
                    : ''
                return (
                  <WasitReorderCard
                    key={p.bib_number}
                    participant={p}
                    index={idx}
                    isFinal={isFinal}
                    currentTimerVal={currentTimerVal}
                    onToggleDnf={handleToggleDnf}
                    onManualTimeChange={handleManualTimeChange}
                  />
                )
              })
            })()}
          </Reorder.Group>
        </div>
      </main>

      {/* STICKY BOTTOM ACTION BAR */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 shadow-2xl">
        <div className="max-w-xl mx-auto flex items-center gap-2.5">
          {/* Tombol Kunci Hasil Utama */}
          <button
            onClick={handleFinalLock}
            disabled={isSubmitting || isLocked || isFinal}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 disabled:opacity-40 text-slate-950 font-display font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4 text-slate-950" />
            )}
            <span>
              {isFinal ? 'HASIL TELAH DIKUNCI' : 'KUNCI & KIRIM HASIL KE LEADERBOARD'}
            </span>
          </button>

          {/* Reset Match Button */}
          <button
            onClick={() => setEmergencyModal('RESET_MATCH')}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700"
            title="Reset Match Ini"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* MODAL: PINDAH PESERTA (MAKS 10 PER MATCH) */}
      <AnimatePresence>
        {isMoveModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-display font-black text-base text-white uppercase flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>Pindahkan Peserta Antar Match</span>
                </h3>
                <button
                  onClick={() => setIsMoveModalOpen(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Pilih Anak yang Mau Dipindah */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Pilih Peserta:</label>
                <select
                  value={selectedChildToMove?.participant.bib_number || ''}
                  onChange={(e) => {
                    const bib = e.target.value
                    // cari di match saat ini
                    const p = (currentMatch?.participants || []).find((item) => item.bib_number === bib)
                    if (p) setSelectedChildToMove({ matchId: currentMatch.id, participant: p })
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                >
                  {(currentMatch?.participants || []).map((p) => (
                    <option key={p.bib_number} value={p.bib_number}>
                      {p.bib_number} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pilih Match Tujuan */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Pindah ke Match Tujuan:</label>
                <select
                  value={targetMatchId}
                  onChange={(e) => setTargetMatchId(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                >
                  {matches.map((m) => {
                    const count = m.participants ? m.participants.length : 0
                    const isFull = count >= 10
                    return (
                      <option key={m.id} value={m.id} disabled={m.id === currentMatch.id}>
                        {m.title} ({count}/10 peserta) {isFull ? '— PENUH' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>

              {moveError && (
                <div className="p-2.5 bg-red-950/40 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold">
                  {moveError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsMoveModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmMove}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black shadow-md"
                >
                  Konfirmasi Pindah
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EMERGENCY OVERRIDE & RESET PIN */}
      <AnimatePresence>
        {emergencyModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="font-display font-black text-base text-white uppercase">
                  {emergencyModal === 'UNLOCK'
                    ? 'Buka Ulang Kunci Match'
                    : emergencyModal === 'RESET_MATCH'
                    ? 'Reset Match Ini'
                    : 'Reset Seluruh Database'}
                </h3>
                <p className="text-xs text-slate-400">
                  Aksi sensitif ini membutuhkan otorisasi Master PIN Supervisor.
                </p>
              </div>

              {emergencyModal === 'RESET_DB' && (
                <div>
                  <label className="text-[11px] font-bold text-red-400 mb-1 block">
                    Ketik "RESET" untuk konfirmasi:
                  </label>
                  <input
                    type="text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="RESET"
                    className="w-full bg-slate-950 border border-red-500/50 rounded-xl px-3 py-2 text-center text-sm font-black text-red-300"
                  />
                </div>
              )}

              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={emergencyPin}
                  onChange={(e) => setEmergencyPin(e.target.value)}
                  placeholder="Master PIN (4 Digit)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-lg font-black tracking-widest text-white"
                  autoFocus
                />
              </div>

              {emergencyError && (
                <p className="text-xs font-bold text-red-400 text-center">{emergencyError}</p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    setEmergencyModal(null)
                    setEmergencyPin('')
                    setEmergencyError('')
                  }}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  onClick={executeEmergencyAction}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black shadow-lg"
                >
                  Eksekusi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black shadow-2xl flex items-center gap-2 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                : 'bg-red-500 text-white shadow-red-500/20'
            }`}
          >
            <span>{toastMessage.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
