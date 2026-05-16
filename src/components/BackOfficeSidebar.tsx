"use client";

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronsLeft, ChevronsRight, Lock, LogOut, Store } from 'lucide-react'
import { backOfficeNavItems } from '@/components/back-office-nav'
import { logoutAction } from '@/app/_actions/auth'

export default function BackOfficeSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

  const [currentUser, setCurrentUser] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    try {
      setCurrentUser(JSON.parse(localStorage.getItem('pos_user') || 'null'))
    } catch {
      setCurrentUser(null)
    }
  }, [])

  const userName = currentUser?.name_1 || currentUser?.fullname_lo || currentUser?.username || 'Admin'
  const userCode = currentUser?.code || currentUser?.employee_code || '--'

  const handleLogout = async () => {
    await logoutAction()
    localStorage.removeItem('pos_user')
    router.push('/login')
  }

  const isActive = (item: { enabled?: boolean; to?: string }) => {
    if (!item.enabled || !item.to || item.to === '#') return false
    if (item.to === '/manage') return pathname === '/manage'
    return pathname === item.to || pathname.startsWith(`${item.to}/`)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Brand + Toggle */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between px-2'} pb-4 mb-1`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Store size={16} className="text-slate-400 shrink-0" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">Back Office</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title={collapsed ? 'ຂະຫຍາຍ' : 'ຍຸບ'}
        >
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
        {backOfficeNavItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item)

          if (!item.enabled) {
            return (
              <div
                key={item.title}
                className={`flex items-center rounded-lg opacity-40 ${collapsed ? 'justify-center py-2.5' : 'gap-2.5 px-2 py-2'}`}
                title={collapsed ? item.title : undefined}
              >
                <Icon size={16} className="text-slate-400 shrink-0" />
                {!collapsed && <span className="text-[13px] text-slate-400 truncate flex-1">{item.title}</span>}
                {!collapsed && <Lock size={11} className="text-slate-300 shrink-0" />}
              </div>
            )
          }

          return (
            <Link
              key={item.title}
              href={item.to}
              title={collapsed ? item.title : undefined}
              className={`group flex items-center rounded-lg transition-colors ${
                collapsed ? 'justify-center py-2.5' : 'gap-2.5 px-2 py-2'
              } ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon size={16} className={`shrink-0 ${active ? 'text-slate-300' : item.color}`} />
              {!collapsed && <span className="text-[13px] font-medium truncate flex-1">{item.title}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="my-2 border-t border-slate-200" />

      {/* User + Actions */}
      <div className={collapsed ? 'flex flex-col items-center gap-2' : 'px-2 space-y-2'}>
        {!collapsed ? (
          <div>
            <div className="text-[13px] font-semibold text-slate-800 truncate">{userName}</div>
            <div className="text-[11px] text-slate-400">#{userCode}</div>
          </div>
        ) : (
          <div title={`${userName} #${userCode}`}>
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600">
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {!collapsed ? (
          <div className="flex flex-col gap-1.5">
            <Link
              href="/pos"
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft size={14} />
              ກັບໄປ POS
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            >
              <LogOut size={14} />
              ອອກຈາກລະບົບ
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Link
              href="/pos"
              title="ກັບໄປ POS"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft size={15} />
            </Link>
            <button
              onClick={handleLogout}
              title="ອອກຈາກລະບົບ"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
