"use client";

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronsLeft, ChevronsRight, Lock, LogOut, ShoppingBag, Store } from 'lucide-react'
import { backOfficeNavGroups, backOfficeNavItems } from '@/components/back-office-nav'
import { getCurrentUserAction, logoutAction } from '@/app/_actions/auth'

const BRAND = '#2E6AB3'

export default function BackOfficeSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

  const [currentUser, setCurrentUser] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    let cached: Record<string, string> | null = null
    try {
      cached = JSON.parse(localStorage.getItem('pos_user') || 'null')
    } catch {
      cached = null
    }
    setCurrentUser(cached)
    // localStorage is only a cache — the session cookie is the source of truth.
    getCurrentUserAction()
      .then((user) => {
        if (user) {
          setCurrentUser(user as unknown as Record<string, string>)
          try { localStorage.setItem('pos_user', JSON.stringify(user)) } catch { /* ignore */ }
        }
      })
      .catch(() => { /* keep cached value */ })
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
    if (item.to === '/settings') return pathname === '/settings'
    return pathname === item.to || pathname.startsWith(`${item.to}/`)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={`flex items-center ${collapsed ? 'flex-col gap-2 pb-3' : 'justify-between px-2 pb-4'}`}>
        <Link href="/manage" className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: BRAND }}
          >
            <ShoppingBag size={17} strokeWidth={2.4} />
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-black tracking-tight text-slate-900">ODIEN</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Back Office</div>
            </div>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          title={collapsed ? 'ຂະຫຍາຍ' : 'ຍຸບ'}
        >
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-4 overflow-y-auto">
        {backOfficeNavGroups.map((group) => {
          const items = backOfficeNavItems.filter((item) => item.group === group)
          if (!items.length) return null
          return (
            <div key={group}>
              {!collapsed && (
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {group}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item)

                  if (!item.enabled) {
                    return (
                      <div
                        key={item.title}
                        className={`flex items-center rounded-lg opacity-40 ${collapsed ? 'justify-center py-2.5' : 'gap-2.5 px-2 py-2'}`}
                        title={collapsed ? item.title : undefined}
                      >
                        <Icon size={16} className="shrink-0 text-slate-400" />
                        {!collapsed && <span className="flex-1 truncate text-[13px] text-slate-400">{item.title}</span>}
                        {!collapsed && <Lock size={11} className="shrink-0 text-slate-300" />}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={item.title}
                      href={item.to}
                      title={collapsed ? item.title : undefined}
                      className={`group relative flex items-center rounded-lg transition-colors ${
                        collapsed ? 'justify-center py-2.5' : 'gap-2.5 px-2 py-2'
                      } ${
                        active
                          ? 'bg-[#2E6AB3]/10 text-[#2E6AB3]'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {active && !collapsed && (
                        <span
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
                          style={{ backgroundColor: BRAND }}
                        />
                      )}
                      <Icon size={16} className={`shrink-0 ${active ? 'text-[#2E6AB3]' : item.color}`} />
                      {!collapsed && (
                        <span className={`flex-1 truncate text-[13px] ${active ? 'font-bold' : 'font-medium'}`}>
                          {item.title}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="my-2 border-t border-slate-200" />

      {/* User + Actions */}
      <div className={collapsed ? 'flex flex-col items-center gap-2' : 'space-y-2 px-2'}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
              style={{ backgroundColor: BRAND }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-semibold text-slate-800">{userName}</div>
              <div className="text-[11px] text-slate-400">#{userCode}</div>
            </div>
          </div>
        ) : (
          <div title={`${userName} #${userCode}`}>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black text-white"
              style={{ backgroundColor: BRAND }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {!collapsed ? (
          <div className="flex flex-col gap-1.5">
            <Link
              href="/pos"
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Store size={14} />
              ກັບໄປ POS
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-[13px] font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              <Store size={15} />
            </Link>
            <button
              onClick={handleLogout}
              title="ອອກຈາກລະບົບ"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
