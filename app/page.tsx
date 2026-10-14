import CloudsBackground from '@/components/CloudsBackground'
import LiveLeaderboard from '@/components/LiveLeaderboard'

export const metadata = {
  title: 'LEADERBOARD BABY CRAWLING - OLIMPIAKIDS',
  description: 'Papan Skor Pertandingan Lomba Merangkak Bayi Olimpiakids Realtime',
}

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-gradient-to-b from-sky-300 via-sky-200 to-sky-100 text-slate-800 overflow-x-hidden selection:bg-amber-400 selection:text-slate-900 flex flex-col justify-between">
      {/* Background Animasi Awan & Bintang Mengambang Lembut */}
      <CloudsBackground />

      {/* Konten Utama Papan Skor Clean Leaderboard */}
      <div className="flex-1 flex flex-col justify-center">
        <LiveLeaderboard />
      </div>
    </main>
  )
}
