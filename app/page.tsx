import CloudsBackground from '@/components/CloudsBackground'
import LiveLeaderboard from '@/components/LiveLeaderboard'

export const metadata = {
  title: '🏆 Leaderboard Live - Lomba Merangkak Bayi Olimpiakids',
  description: 'Papan skor pertandingan lomba merangkak bayi realtime Olimpiakids.',
}

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-gradient-to-b from-sky-400 via-sky-300 to-sky-200 text-sky-950 font-sans overflow-x-hidden selection:bg-amber-400 selection:text-sky-950">
      {/* Background Animasi Awan & Bintang Mengambang */}
      <CloudsBackground />

      {/* Konten Utama Papan Skor Live */}
      <LiveLeaderboard />
    </main>
  )
}
