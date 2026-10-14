'use client'

import React, { useState } from 'react'
import { Participant } from '@/types/database'
import { deleteParticipant } from '@/lib/queries'
import { useToast } from './Toast'
import { Trash2, Search, Users, Baby, Loader2 } from 'lucide-react'

interface ParticipantListProps {
  participants: Participant[]
  loading?: boolean
  onRefresh?: () => void
}

export default function ParticipantList({
  participants,
  loading = false,
  onRefresh,
}: ParticipantListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const { showToast } = useToast()

  const handleDelete = async (participant: Participant) => {
    const confirmed = window.confirm(
      `Yakin ingin menghapus peserta "${participant.name}" (BIB: ${participant.bib_number})?\nSemua riwayat hasil lombanya juga akan terhapus.`
    )
    if (!confirmed) return

    setDeletingId(participant.id)
    const { error } = await deleteParticipant(participant.id)
    setDeletingId(null)

    if (error) {
      showToast(error, 'error')
      return
    }

    showToast(`Peserta "${participant.name}" berhasil dihapus.`, 'success')
    if (onRefresh) {
      onRefresh()
    }
  }

  const filtered = participants.filter((p) => {
    const q = searchTerm.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.bib_number.toLowerCase().includes(q)
  })

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Daftar Peserta Bayi</h2>
            <p className="text-sm text-zinc-400">Total: {participants.length} bayi terdaftar</p>
          </div>
        </div>

        {/* Kotak Pencarian */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari nama / nomor BIB..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-800/80 border border-zinc-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-sm font-medium">Memuat data peserta...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-14 text-center border-2 border-dashed border-zinc-800 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-500">
            <Baby className="w-6 h-6" />
          </div>
          <p className="text-base font-semibold text-zinc-300">
            {searchTerm ? 'Peserta tidak ditemukan' : 'Belum ada peserta terdaftar'}
          </p>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `Tidak ada hasil pencarian untuk kata kunci "${searchTerm}"`
              : 'Gunakan formulir pendaftaran untuk menambahkan bayi ke dalam perlombaan.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-800/70 border-b border-zinc-800 text-xs font-semibold uppercase text-zinc-400 tracking-wider">
                <th className="py-3 px-4">BIB</th>
                <th className="py-3 px-4">Nama Bayi</th>
                <th className="py-3 px-4">Umur</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-sm">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-800/40 transition">
                  <td className="py-3.5 px-4">
                    <span className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-bold rounded-lg text-sm">
                      #{item.bib_number}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-zinc-200">
                    {item.name}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-400">
                    {item.age_months !== null ? `${item.age_months} Bulan` : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition disabled:opacity-50 cursor-pointer"
                      title="Hapus Peserta"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
