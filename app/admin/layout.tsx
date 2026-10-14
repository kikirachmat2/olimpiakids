'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ToastProvider } from '@/components/Toast'
import { Users, Gauge, Trophy, Baby, ExternalLink } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const navItems = [
    {
      name: 'Peserta',
      href: '/admin/peserta',
      icon: Users,
    },
    {
      name: 'Kontrol Lomba',
      href: '/admin/kontrol',
      icon: Gauge,
    },
    {
      name: 'Leaderboard (Publik)',
      href: '/',
      icon: Trophy,
      external: true,
    },
  ]

  return (
    <ToastProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row font-sans selection:bg-amber-500 selection:text-zinc-950">
        {/* SIDEBAR NAVIGASI KIRI */}
        <aside className="w-full md:w-72 bg-zinc-900 border-r border-zinc-800 p-6 flex flex-col justify-between shrink-0">
          <div>
            {/* Logo / Brand Header */}
            <div className="flex items-center gap-3 pb-6 border-b border-zinc-800 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-zinc-950 shadow-lg shadow-amber-500/20">
                <Baby className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="font-extrabold text-lg tracking-tight text-white">Lomba Bayi</h1>
                <span className="text-xs uppercase tracking-wider font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  Panel Panitia
                </span>
              </div>
            </div>

            {/* Menu Navigasi */}
            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    className={`flex items-center justify-between px-4 py-3.5 rounded-xl font-medium text-base transition-all duration-150 ${
                      isActive
                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </div>
                    {item.external && <ExternalLink className="w-4 h-4 opacity-70" />}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Footer Sidebar */}
          <div className="pt-6 border-t border-zinc-800 text-xs text-zinc-500">
            <p className="font-semibold text-zinc-400">Olimpiakids Race v1.0</p>
            <p className="mt-0.5">Sistem Pencatatan Waktu & Skoring Realtime</p>
          </div>
        </aside>

        {/* KONTEN UTAMA */}
        <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </ToastProvider>
  )
}
