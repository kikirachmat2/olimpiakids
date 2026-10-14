'use client'

import React, { useState, useEffect } from 'react'
import { Participant, RaceEvent, RaceResult } from '@/types/database'
import {
  createRaceEvent,
  startRace,
  finishRace,
  recordFinish,
  getActiveRace,
  getParticipants,
  getRaceResults,
} from '@/lib/queries'
import { useToast } from './Toast'
import {
  Play,
  Square,
  PlusCircle,
  Flag,
  Clock,
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

interface RaceControlProps {
  initialActiveRace?: RaceEvent | null
  initialParticipants?: Participant[]
  onRaceUpdated?: () => void
}

export default function RaceControl({
  initialActiveRace = null,
  initialParticipants = [],
  onRaceUpdated,
}: RaceControlProps) {
  const [activeRace, setActiveRace] = useState<RaceEvent | null>(initialActiveRace)
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants)
  const [results, setResults] = useState<RaceResult[]>([])
  const [newRaceName, setNewRaceName] = useState('')
  const [elapsedTime, setElapsedTime] = useState('00.00s')

  // Loading states
  const [creatingRace, setCreatingRace] = useState(false)
  const [startingRace, setStartingRace] = useState(false)
  const [finishingRace, setFinishingRace] = useState(false)
  const [recordingId, setRecordingId] = useState<number | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  const { showToast } = useToast()

  // Sinkronisasi data awal jika parent kirim props baru
  useEffect(() => {
    if (initialActiveRace !== undefined) {
      setActiveRace(initialActiveRace)
    }
  }, [initialActiveRace])

  useEffect(() => {
    if (initialParticipants?.length) {
      setParticipants(initialParticipants)
    }
  }, [initialParticipants])

  // Muat data hasil lomba untuk sesi lomba aktif
  const loadRaceData = async () => {
    setLoadingData(true)
    const [raceRes, partRes] = await Promise.all([
      getActiveRace(),
      getParticipants(),
    ])

    if (raceRes.data) {
      setActiveRace(raceRes.data)
      const resultsRes = await getRaceResults(raceRes.data.id)
      if (resultsRes.data) {
        setResults(resultsRes.data)
      }
    } else {
      setActiveRace(null)
      setResults([])
    }

    if (partRes.data) {
      setParticipants(partRes.data)
    }
    setLoadingData(false)
  }

  useEffect(() => {
    if (activeRace?.id) {
      getRaceResults(activeRace.id).then((res) => {
        if (res.data) setResults(res.data)
      })
    } else {
      setResults([])
    }
  }, [activeRace?.id])

  // Stopwatch timer lokal untuk race yang sedang running
  useEffect(() => {
    if (!activeRace || activeRace.status !== 'running' || !activeRace.start_time) {
      if (activeRace?.status === 'idle') setElapsedTime('00.00s')
      return
    }

    const startTs = new Date(activeRace.start_time).getTime()
    const timer = setInterval(() => {
      const now = Date.now()
      const diffMs = Math.max(0, now - startTs)
      const sec = (diffMs / 1000).toFixed(2)
      setElapsedTime(`${sec}s`)
    }, 50)

    return () => clearInterval(timer)
  }, [activeRace?.status, activeRace?.start_time])

  // 1. Buat Race Baru
  const handleCreateRace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRaceName.trim()) {
      showToast('Masukkan nama babak lomba (misal: Heat 1)', 'error')
      return
    }

    setCreatingRace(true)
    const { data, error } = await createRaceEvent(newRaceName)
    setCreatingRace(false)

    if (error || !data) {
      showToast(error || 'Gagal membuat sesi lomba', 'error')
      return
    }

    showToast(`Babak "${data.name}" berhasil dibuat!`, 'success')
    setNewRaceName('')
    setActiveRace(data)
    setResults([])
    if (onRaceUpdated) onRaceUpdated()
  }

  // 2. Mulai Lomba
  const handleStartRace = async () => {
    if (!activeRace) return

    setStartingRace(true)
    const { data, error } = await startRace(activeRace.id)
    setStartingRace(false)

    if (error || !data) {
      showToast(error || 'Gagal memulai lomba', 'error')
      return
    }

    showToast(`Lomba "${data.name}" DIMULAI! Waktu berjalan...`, 'success')
    setActiveRace(data)
    if (onRaceUpdated) onRaceUpdated()
  }

  // 3. Akhiri Lomba
  const handleFinishRace = async () => {
    if (!activeRace) return
    const confirmed = window.confirm(
      `Yakin ingin mengakhiri sesi "${activeRace.name}"?\nStatus akan ditutup dan tidak dapat mencatat finish lagi.`
    )
    if (!confirmed) return

    setFinishingRace(true)
    const { data, error } = await finishRace(activeRace.id)
    setFinishingRace(false)

    if (error || !data) {
      showToast(error || 'Gagal mengakhiri lomba', 'error')
      return
    }

    showToast(`Lomba "${data.name}" telah SELESAI!`, 'success')
    setActiveRace(data)
    if (onRaceUpdated) onRaceUpdated()
  }

  // 4. Catat Finish Peserta
  const handleRecordFinish = async (participantId: number, name: string) => {
    if (!activeRace || activeRace.status !== 'running') {
      showToast('Lomba harus berstatus "Berjalan" untuk mencatat finish!', 'error')
      return
    }

    setRecordingId(participantId)
    const { data, error } = await recordFinish(participantId, activeRace.id)
    setRecordingId(null)

    if (error || !data) {
      showToast(error || 'Gagal mencatat finish', 'error')
      return
    }

    const durationSec = ((data.duration_ms || 0) / 1000).toFixed(2)
    showToast(`🏁 ${name} FINISH! Waktu: ${durationSec} detik`, 'success')
    setResults((prev) => [...prev, data])
    if (onRaceUpdated) onRaceUpdated()
  }

  // Cek apakah peserta sudah finish
  const getParticipantResult = (participantId: number) => {
    return results.find((r) => r.participant_id === participantId)
  }

  return (
    <div className="space-y-6">
      {/* SECTION 1 & STATUS INFO */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
              <Flag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-zinc-100">
                  {activeRace ? activeRace.name : 'Belum Ada Sesi Lomba'}
                </h2>
                {activeRace && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      activeRace.status === 'running'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse'
                        : activeRace.status === 'finished'
                        ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {activeRace.status === 'running'
                      ? '● SEDANG BERJALAN'
                      : activeRace.status === 'finished'
                      ? '✓ SELESAI'
                      : 'STANDBY (SIAP)'}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-400 mt-1">
                Panel juri untuk mengontrol start dan pencatatan finish bayi secara langsung
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadRaceData}
              disabled={loadingData}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 ${loadingData ? 'animate-spin' : ''}`} />
            </button>

            {/* Stopwatch Waktu Lomba */}
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl">
              <Clock className="w-5 h-5 text-amber-400" />
              <span className="font-mono text-2xl font-bold tracking-tight text-white">
                {elapsedTime}
              </span>
            </div>
          </div>
        </div>

        {/* Form Buat Race Baru */}
        {(!activeRace || activeRace.status === 'finished') && (
          <form onSubmit={handleCreateRace} className="mt-5 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newRaceName}
              onChange={(e) => setNewRaceName(e.target.value)}
              placeholder="Nama Babak Baru (Contoh: Heat 1, Heat 2, Babak Final)"
              disabled={creatingRace}
              className="flex-1 bg-zinc-800/80 border border-zinc-700/80 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            <button
              type="submit"
              disabled={creatingRace}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-6 py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {creatingRace ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <PlusCircle className="w-5 h-5" />
              )}
              <span>Buat Sesi Lomba</span>
            </button>
          </form>
        )}
      </div>

      {/* SECTION 2: TOMBOL KONTROL UTAMA (START / FINISH) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tombol Mulai */}
        <button
          onClick={handleStartRace}
          disabled={!activeRace || activeRace.status !== 'idle' || startingRace}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xl py-5 px-6 rounded-2xl shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-3 transition duration-150 disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer active:scale-95"
        >
          {startingRace ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : (
            <Play className="w-7 h-7 fill-white" />
          )}
          <span>🚦 MULAI LOMBA</span>
        </button>

        {/* Tombol Akhiri */}
        <button
          onClick={handleFinishRace}
          disabled={!activeRace || activeRace.status !== 'running' || finishingRace}
          className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xl py-5 px-6 rounded-2xl shadow-xl shadow-rose-950/50 flex items-center justify-center gap-3 transition duration-150 disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer active:scale-95"
        >
          {finishingRace ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : (
            <Square className="w-7 h-7 fill-white" />
          )}
          <span>🏁 AKHIRI LOMBA</span>
        </button>
      </div>

      {/* SECTION 3: GRID TOMBOL PESERTA UNTUK TAP FINISH */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-zinc-100">Tap Finish Peserta</h3>
            <p className="text-sm text-zinc-400">
              {activeRace?.status === 'running'
                ? 'Klik tombol nama bayi saat merangkak menyentuh garis finish!'
                : 'Tombol hanya aktif saat status lomba "Sedang Berjalan".'}
            </p>
          </div>
          <span className="text-sm font-semibold bg-zinc-800 px-3 py-1.5 rounded-lg text-zinc-300">
            {results.length} / {participants.length} Selesai
          </span>
        </div>

        {participants.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-zinc-800 rounded-xl text-zinc-400 flex flex-col items-center justify-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <p>Belum ada peserta terdaftar. Silakan tambahkan peserta terlebih dahulu.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {participants.map((p) => {
              const res = getParticipantResult(p.id)
              const isFinished = !!res
              const isRunning = activeRace?.status === 'running'
              const isRecording = recordingId === p.id

              let finishText = ''
              if (res?.duration_ms) {
                finishText = `${(res.duration_ms / 1000).toFixed(2)}s`
              }

              return (
                <button
                  key={p.id}
                  onClick={() => handleRecordFinish(p.id, p.name)}
                  disabled={!isRunning || isFinished || isRecording}
                  className={`relative p-5 rounded-2xl border text-left transition-all duration-150 flex flex-col justify-between min-h-[120px] select-none ${
                    isFinished
                      ? 'bg-zinc-950/80 border-emerald-500/40 opacity-75 cursor-default'
                      : isRunning
                      ? 'bg-gradient-to-br from-zinc-800 to-zinc-850 hover:from-amber-600/30 hover:to-zinc-800 border-zinc-700 hover:border-amber-500 active:scale-95 shadow-lg shadow-black/40 cursor-pointer ring-offset-zinc-900 hover:ring-2 hover:ring-amber-500/40'
                      : 'bg-zinc-850 border-zinc-800/80 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md ${
                        isFinished
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      BIB #{p.bib_number}
                    </span>

                    {isRecording ? (
                      <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                    ) : isFinished ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : null}
                  </div>

                  <div className="mt-2">
                    <p className="font-bold text-lg text-white leading-tight line-clamp-1">
                      {p.name}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {p.age_months ? `${p.age_months} Bulan` : 'Usia N/A'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                    {isFinished ? (
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        ✅ Selesai: {finishText}
                      </span>
                    ) : isRunning ? (
                      <span className="text-amber-400 font-bold tracking-wide">
                        👉 KLIK FINISH
                      </span>
                    ) : (
                      <span className="text-zinc-500">Menunggu start</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
