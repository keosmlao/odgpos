"use client";

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Menu, ShoppingBag, X } from 'lucide-react'
import BackOfficeSidebar from '@/components/BackOfficeSidebar'

export default function BackOfficeShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 font-['Noto_Sans_Lao'] text-slate-900">
      {/* Desktop sidebar */}
      <aside
        className={`hidden xl:flex xl:flex-col xl:fixed xl:inset-y-0 border-r border-slate-200 bg-white py-4 px-2 z-30 transition-[width] duration-200 ease-in-out ${
          collapsed ? 'xl:w-[60px]' : 'xl:w-[232px]'
        }`}
      >
        <BackOfficeSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur xl:hidden">
        <Link href="/manage" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2E6AB3] text-white">
            <ShoppingBag size={15} strokeWidth={2.4} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-black tracking-tight text-slate-900">ODIEN</div>
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Back Office</div>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
          aria-label="ເປີດເມນູ"
        >
          <Menu size={18} />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[264px] flex-col bg-white px-2 py-4 shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="ປິດເມນູ"
            >
              <X size={16} />
            </button>
            <div
              className="flex min-h-0 flex-1 flex-col"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('a')) setMobileOpen(false)
              }}
            >
              <BackOfficeSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main
        className={`min-h-screen transition-[margin] duration-200 ease-in-out ${
          collapsed ? 'xl:ml-[60px]' : 'xl:ml-[232px]'
        }`}
      >
        <div className="px-4 py-5 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
