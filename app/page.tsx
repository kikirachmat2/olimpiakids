import CloudsBackground from '@/components/CloudsBackground'
import LiveLeaderboard from '@/components/LiveLeaderboard'
import FullscreenButton from '@/components/FullscreenButton'

export const metadata = {
  title: 'LEADERBOARD BABY CRAWLING - OLIMPIAKIDS',
  description: 'Papan Skor Pertandingan Lomba Merangkak Bayi Olimpiakids Realtime',
}

export default function HomePage() {
  return (
    <main className="relative min-h-screen lg:h-screen lg:max-h-screen bg-gradient-to-b from-sky-400 via-sky-300 to-sky-200 text-slate-800 overflow-x-hidden lg:overflow-hidden selection:bg-amber-400 selection:text-slate-900 flex flex-col justify-start lg:justify-center py-2 sm:py-3 lg:py-2">
      {/* Tombol Fullscreen di Kanan Atas */}
      <FullscreenButton />

      {/* Background Animasi Awan & Bintang Prototype */}
      <CloudsBackground />

      {/* Konten Utama Papan Skor Live */}
      <LiveLeaderboard />
    </main>
  )
}
