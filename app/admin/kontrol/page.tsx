'use client'

import React, { useState, useEffect } from 'react'
import RaceControl from '@/components/RaceControl'
import { getActiveRace, getParticipants } from '@/lib/queries'
import { RaceEvent, Participant } from '@/types/database'
import { Loader2 } from 'lucide-react'

export default function KontrolAdminPage() {
  const [activeRace, setActiveRace] = useState<RaceEvent | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = React.useCallback(async () => {
    const [raceRes, partRes] = await Promise.all([
      getActiveRace(),
      getParticipants(),
    ])

    setActiveRace(raceRes.data || null)
    if (partRes.data) {
      setParticipants(partRes.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="w-9 h-9 animate-spin text-amber-500" />
        <p className="font-medium text-base">Menghubungkan ke sistem lomba...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Kontrol Perlombaan</h1>
        <p className="text-zinc-400 mt-1">
          Kontrol langsung jalannya balapan: buat babak, mulai stopwatch, dan catat waktu finish per peserta.
        </p>
      </div>

      <RaceControl
        initialActiveRace={activeRace}
        initialParticipants={participants}
        onRaceUpdated={loadData}
      />
    </div>
  )
}
