"use client";

import { useState, type ReactNode } from 'react'
import BackOfficeSidebar from '@/components/BackOfficeSidebar'

export default function BackOfficeShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 font-['Noto_Sans_Lao'] text-slate-900">
      {/* Sidebar */}
      <aside
        className={`hidden xl:flex xl:flex-col xl:fixed xl:inset-y-0 border-r border-slate-200 bg-white py-4 px-2 z-30 transition-[width] duration-200 ease-in-out ${
          collapsed ? 'xl:w-[60px]' : 'xl:w-[232px]'
        }`}
      >
        <BackOfficeSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </aside>

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
