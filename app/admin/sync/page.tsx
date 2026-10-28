'use client'

import React, { useState } from 'react'
import { FileSpreadsheet, CheckCircle2, Copy, ShieldCheck, Zap } from 'lucide-react'
import { useToast } from '@/components/Toast'

export default function SyncAdminPage() {
  const [copied, setCopied] = useState(false)
  const { showToast } = useToast()

  const copyPath = () => {
    navigator.clipboard.writeText('google-apps-script/Code.gs')
    setCopied(true)
    showToast('Lokasi file disalin ke clipboard!', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Google Sheets Sync</h1>
        <p className="text-zinc-400 mt-1">
          Sinkronisasi dua arah/satu arah dari Google Sheets sebagai remote control panel langsung ke database Supabase.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Card 1 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Otomatisasi Realtime</h3>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
            Setiap cell di Google Sheets yang diedit oleh panitia langsung diteruskan ke Supabase PostgREST API melalui trigger <code className="text-amber-400">onEdit</code>.
          </p>
        </div>

        {/* Status Card 2 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Aman & Terisolasi</h3>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
            Menggunakan <code className="text-blue-400">service_role</code> secret key di Google Cloud backend untuk melakukan operasi upsert (merge-duplicates) secara aman.
          </p>
        </div>

        {/* Status Card 3 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">3 Tab Spreadsheet</h3>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
            Mendukung sinkronisasi terpisah untuk tab <span className="font-mono text-zinc-200">PESERTA</span>, <span className="font-mono text-zinc-200">RACE_EVENT</span>, dan <span className="font-mono text-zinc-200">HASIL</span>.
          </p>
        </div>
      </div>

      {/* Panduan Langkah Cepat */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-zinc-800 pb-4">
          Langkah Pemasangan Google Apps Script
        </h2>

        <div className="space-y-5 text-sm text-zinc-300">
          <div className="flex items-start gap-4">
            <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <div>
              <p className="font-semibold text-white">Salin Script Code.gs</p>
              <p className="text-zinc-400 mt-1">
                File script telah dibuat di folder project:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 font-mono text-amber-400 text-xs">
                  google-apps-script/Code.gs
                </code>
                <button
                  onClick={copyPath}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer text-zinc-200"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Tersalin' : 'Salin Path'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <div>
              <p className="font-semibold text-white">Buka Apps Script di Google Sheets</p>
              <p className="text-zinc-400 mt-1">
                Di Google Sheets, klik menu <strong>Extensions</strong> → <strong>Apps Script</strong>, lalu paste isi kode dari <code className="text-amber-400 font-mono">Code.gs</code>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <div>
              <p className="font-semibold text-white">Isi Kredensial Supabase</p>
              <p className="text-zinc-400 mt-1">
                Ganti <code className="text-amber-400 font-mono">SUPABASE_URL</code> dan <code className="text-amber-400 font-mono">SUPABASE_SERVICE_KEY</code> dengan kredensial dari Supabase Dashboard (Settings → API).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
              4
            </span>
            <div>
              <p className="font-semibold text-white">Jalankan Fungsi `pasangTriggerOtomatis`</p>
              <p className="text-zinc-400 mt-1">
                Pilih fungsi <code className="text-emerald-400 font-mono">pasangTriggerOtomatis</code> di dropdown editor Google Apps Script lalu klik <strong>Run</strong> sekali untuk mengaktifkan trigger sinkronisasi otomatis.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <span>Panduan dokumentasi lengkap tersedia di <code className="text-zinc-400 font-mono">google-apps-script/README.md</code></span>
        </div>
      </div>
    </div>
  )
}
