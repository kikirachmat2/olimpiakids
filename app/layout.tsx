import type { Metadata } from 'next'
import { Nunito, Fredoka, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-nunito',
})

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-fredoka',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'LEADERBOARD BABY CRAWLING - OLIMPIAKIDS',
  description: 'Papan Skor Pertandingan Lomba Merangkak Bayi Olimpiakids Realtime',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="id"
      className={`${nunito.variable} ${fredoka.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans selection:bg-amber-400 selection:text-slate-900 bg-sky-100 text-slate-800">
        {children}
      </body>
    </html>
  )
}
