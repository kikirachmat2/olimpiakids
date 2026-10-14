'use client'

import React, { useState } from 'react'
import { addParticipant } from '@/lib/queries'
import { useToast } from './Toast'
import { UserPlus, Loader2 } from 'lucide-react'

interface ParticipantFormProps {
  onSuccess?: () => void
}

export default function ParticipantForm({ onSuccess }: ParticipantFormProps) {
  const [name, setName] = useState('')
  const [bibNumber, setBibNumber] = useState('')
  const [ageMonths, setAgeMonths] = useState('')
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !bibNumber.trim()) {
      showToast('Nama bayi dan Nomor BIB wajib diisi!', 'error')
      return
    }

    setLoading(true)

    const parsedAge = ageMonths ? parseInt(ageMonths, 10) : null
    const { error } = await addParticipant({
      name: name.trim(),
      bib_number: bibNumber.trim(),
      age_months: parsedAge && !isNaN(parsedAge) ? parsedAge : null,
    })

    setLoading(false)

    if (error) {
      showToast(error, 'error')
      return
    }

    showToast(`Peserta "${name}" (BIB: ${bibNumber}) berhasil ditambahkan!`, 'success')
    setName('')
    setBibNumber('')
    setAgeMonths('')

    if (onSuccess) {
      onSuccess()
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl text-white">
      <div className="flex items-center gap-3 mb-5 border-b border-zinc-800 pb-4">
        <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
          <UserPlus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Daftarkan Peserta Bayi</h2>
          <p className="text-sm text-zinc-400">Masukkan identitas bayi dan nomor punggung BIB</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Nama Lengkap Bayi <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Muhammad Kenzo"
            disabled={loading}
            className="w-full bg-zinc-800/80 border border-zinc-700/80 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Nomor BIB (Punggung) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={bibNumber}
              onChange={(e) => setBibNumber(e.target.value)}
              placeholder="Contoh: 01 atau B-05"
              disabled={loading}
              className="w-full bg-zinc-800/80 border border-zinc-700/80 rounded-xl px-4 py-3 text-white font-mono placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition uppercase"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Usia (Bulan)
            </label>
            <input
              type="number"
              min="1"
              max="36"
              value={ageMonths}
              onChange={(e) => setAgeMonths(e.target.value)}
              placeholder="Contoh: 10"
              disabled={loading}
              className="w-full bg-zinc-800/80 border border-zinc-700/80 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3.5 px-6 rounded-xl transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-base cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Menyimpan Peserta...</span>
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              <span>Tambah Peserta</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
