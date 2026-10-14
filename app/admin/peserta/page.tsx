'use client'

import React, { useState, useEffect } from 'react'
import ParticipantForm from '@/components/ParticipantForm'
import ParticipantList from '@/components/ParticipantList'
import { getParticipants } from '@/lib/queries'
import { Participant } from '@/types/database'

export default function PesertaAdminPage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)

  const fetchParticipants = async () => {
    setLoading(true)
    const { data } = await getParticipants()
    if (data) {
      setParticipants(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchParticipants()
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Manajemen Peserta</h1>
        <p className="text-zinc-400 mt-1">
          Daftarkan identitas peserta bayi dan kelola nomor punggung BIB sebelum perlombaan dimulai.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Formulir Pendaftaran */}
        <div className="lg:col-span-5">
          <ParticipantForm onSuccess={fetchParticipants} />
        </div>

        {/* Tabel Daftar Peserta */}
        <div className="lg:col-span-7">
          <ParticipantList
            participants={participants}
            loading={loading}
            onRefresh={fetchParticipants}
          />
        </div>
      </div>
    </div>
  )
}
