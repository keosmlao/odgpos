"use client";
// @ts-nocheck

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Award,
  Banknote,
  BarChart3,
  ChevronRight,
  CreditCard,
  PiggyBank,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { backOfficeModuleItems } from '@/components/back-office-nav'
import { getSalesReportAction } from '@/app/_actions/sales-report'

const BRAND = '#2E6AB3'
const SERIES_1 = '#2a78d6'
const SERIES_2 = '#1baf7a'

const fmt = (n) => (Number(n) || 0).toLocaleString()
const fmtCompact = (n) => {
  const v = Number(n) || 0
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`
  return String(v)
}

const toISODate = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const fmtDayLabel = (iso) => {
  const [, m, d] = String(iso).split('-')
  return `${Number(d)}/${Number(m)}`
}

const DeltaBadge = ({ delta }) => {
  if (delta == null) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">—</span>
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
        delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      }`}
    >
      {delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

const StatTile = ({ icon: Icon, label, value, sub = '', delta = undefined, iconBg = 'bg-slate-100', iconColor = 'text-slate-600', loading = false }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center gap-2.5">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon size={17} className={iconColor} strokeWidth={2.2} />
      </div>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {delta !== undefined && <DeltaBadge delta={delta} />}
    </div>
    {loading ? (
      <div className="mt-3 h-8 w-28 animate-pulse rounded-lg bg-slate-100" />
    ) : (
      <div className="mt-3 text-2xl font-black tracking-tight text-slate-900">{value}</div>
    )}
    {sub && !loading && <div className="mt-1 text-xs font-medium text-slate-400">{sub}</div>}
  </div>
)

const WeekBarChart = ({ data }) => {
  const max = Math.max(...data.map((b) => b.total), 1)
  const peakIdx = data.reduce((best, b, i) => (b.total > data[best].total ? i : best), 0)
  if (!data.length || data.every((b) => !b.total)) {
    return <div className="flex h-44 items-center justify-center text-sm text-slate-400">ບໍ່ມີຂໍ້ມູນໃນ 7 ວັນຜ່ານມາ</div>
  }
  return (
    <div>
      <div className="flex h-44 items-end gap-1.5 border-b border-slate-200 pb-px">
        {data.map((b, i) => {
          const h = Math.max((b.total / max) * 100, b.total > 0 ? 2 : 0.5)
          return (
            <div key={b.day} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              {i === peakIdx && b.total > 0 && (
                <div className="mb-1 text-[10px] font-bold text-slate-500">{fmtCompact(b.total)}</div>
              )}
              <div
                className="w-full max-w-[44px] transition-opacity group-hover:opacity-80"
                style={{ height: `${h}%`, backgroundColor: SERIES_1, borderRadius: '4px 4px 0 0' }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-center opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                <div className="text-[11px] font-bold text-white">{fmt(b.total)} ₭</div>
                <div className="text-[10px] text-slate-300">{b.day} · {fmt(b.bills)} ບິນ</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((b) => (
          <div key={b.day} className="flex-1 text-center text-[10px] font-medium text-slate-400">{fmtDayLabel(b.day)}</div>
        ))}
      </div>
    </div>
  )
}

const PaymentSplit = ({ cash, transfer, total }) => {
  const other = Math.max(total - cash - transfer, 0)
  const denom = Math.max(cash + transfer + other, 1)
  return (
    <div className="space-y-3">
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100">
        {cash > 0 && <div style={{ width: `${(cash / denom) * 100}%`, backgroundColor: SERIES_1 }} className="rounded-full" />}
        {transfer > 0 && <div style={{ width: `${(transfer / denom) * 100}%`, backgroundColor: SERIES_2 }} className="rounded-full" />}
        {other > 0 && <div style={{ width: `${(other / denom) * 100}%` }} className="rounded-full bg-slate-300" />}
      </div>
      <div className="space-y-1.5">
        {[
          { label: 'ເງິນສົດ', value: cash, color: SERIES_1 },
          { label: 'ເງິນໂອນ', value: transfer, color: SERIES_2 },
          { label: 'ອື່ນໆ / ບໍ່ລະບຸ', value: other, color: '#cbd5e1' },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-xs font-medium text-slate-500">{s.label}</span>
            <span className="ml-auto text-xs font-bold tabular-nums text-slate-800">{fmt(s.value)} ₭</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const RankBadge = ({ rank }) => (
  <div
    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-black ${
      rank === 1 ? 'bg-[#2E6AB3] text-white' : rank === 2 ? 'bg-[#2E6AB3]/70 text-white' : rank === 3 ? 'bg-[#2E6AB3]/40 text-white' : 'bg-slate-100 text-slate-500'
    }`}
  >
    {rank}
  </div>
)

const PanelCard = ({ icon: Icon, title, action = null, children }) => (
  <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-3.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-[#2E6AB3]" strokeWidth={2.2} />
        <h3 className="text-sm font-black text-slate-800">{title}</h3>
      </div>
      {action}
    </div>
    <div className="min-h-0 flex-1">{children}</div>
  </div>
)

export default function Management() {
  const [currentUser, setCurrentUser] = useState(null)
  const [today, setToday] = useState(null)
  const [week, setWeek] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      setCurrentUser(JSON.parse(localStorage.getItem('pos_user') || 'null'))
    } catch {
      setCurrentUser(null)
    }

    const now = new Date()
    const iso = toISODate(now)
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - 6)
    Promise.all([
      getSalesReportAction({ from: iso, to: iso }),
      getSalesReportAction({ from: toISODate(weekStart), to: iso }),
    ])
      .then(([t, w]) => {
        setToday(t)
        setWeek(w)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const currentUserName = currentUser?.name_1 || currentUser?.fullname_lo || currentUser?.username || 'Team Admin'
  const s = today?.summary
  const prev = today?.prev
  const pct = (cur, base) => (Number(base) > 0 ? ((Number(cur) - Number(base)) / Number(base)) * 100 : null)

  // Pad the week series so the chart always shows 7 slots even on quiet days.
  const weekDays = (() => {
    const out = []
    const byDay = new Map((week?.byDay || []).map((d) => [d.day, d]))
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = toISODate(d)
      out.push(byDay.get(iso) || { day: iso, total: 0, bills: 0 })
    }
    return out
  })()

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <section
        className="relative overflow-hidden rounded-3xl p-5 shadow-md sm:p-6"
        style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #1f4f8c 100%)` }}
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Dashboard · {toISODate(new Date())}</p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight text-white sm:text-2xl">ສະບາຍດີ, {currentUserName}</h1>
          </div>
          <Link
            href="/manage/sales"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-[#2E6AB3] shadow-md transition-transform hover:scale-[1.02]"
          >
            <BarChart3 size={15} strokeWidth={2.4} />
            ເບິ່ງລາຍງານເຕັມ
            <ArrowRight size={14} strokeWidth={2.4} />
          </Link>
        </div>
      </section>

      {/* KPI tiles */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Wallet}
          label="ຍອດຂາຍມື້ນີ້"
          value={`${fmt(s?.total_all)} ₭`}
          sub={prev ? `ວານນີ້: ${fmt(prev.total_all)} ₭` : ''}
          delta={pct(s?.total_all, prev?.total_all)}
          iconBg="bg-blue-50" iconColor="text-[#2E6AB3]"
          loading={loading}
        />
        <StatTile
          icon={ReceiptText}
          label="ຈຳນວນບິນ"
          value={fmt(s?.count_bills)}
          sub={`ສະເລ່ຍ ${fmt(s?.avg_bill)} ₭/ບິນ`}
          delta={pct(s?.count_bills, prev?.count_bills)}
          iconBg="bg-violet-50" iconColor="text-violet-600"
          loading={loading}
        />
        <StatTile
          icon={PiggyBank}
          label="ກຳໄລເບື້ອງຕົ້ນ"
          value={`${fmt(s?.total_profit)} ₭`}
          sub={`margin ≈ ${s?.margin_pct ?? 0}%`}
          iconBg="bg-teal-50" iconColor="text-teal-600"
          loading={loading}
        />
        <StatTile
          icon={Banknote}
          label="ສົດ / ໂອນ"
          value={`${fmtCompact(s?.total_cash)} / ${fmtCompact(s?.total_transfer)} ₭`}
          sub={`ສ່ວນຫຼຸດ ${fmt(s?.total_discount)} ₭`}
          iconBg="bg-emerald-50" iconColor="text-emerald-600"
          loading={loading}
        />
      </section>

      {/* Week chart + payment split */}
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800">ຍອດຂາຍ 7 ວັນຜ່ານມາ</h3>
            <span className="text-[11px] font-semibold text-slate-400">ລວມ {fmt(week?.summary?.total_all)} ₭</span>
          </div>
          {loading ? <div className="h-44 animate-pulse rounded-xl bg-slate-100" /> : <WeekBarChart data={weekDays} />}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-black text-slate-800">ການຊຳລະມື້ນີ້</h3>
          {loading ? (
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <PaymentSplit cash={s?.total_cash || 0} transfer={s?.total_transfer || 0} total={s?.total_all || 0} />
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ລູກຄ້າ</div>
              <div className="mt-1 text-lg font-black text-slate-900">{fmt(s?.count_customers)}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ບິນສະມາຊິກ</div>
              <div className="mt-1 text-lg font-black text-slate-900">{fmt(s?.member_bills)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Top products / staff / recent bills */}
      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <PanelCard icon={Award} title="ສິນຄ້າຂາຍດີມື້ນີ້">
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ) : !today?.topProducts?.length ? (
            <div className="py-8 text-center text-sm text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>
          ) : (
            <div className="space-y-1">
              {today.topProducts.slice(0, 5).map((p, i) => (
                <div key={p.item_code || i} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-slate-50">
                  <RankBadge rank={i + 1} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-slate-800">{p.item_name}</p>
                    <p className="text-[10px] text-slate-400">{fmt(p.qty)} {p.unit || 'ຊິ້ນ'}</p>
                  </div>
                  <div className="text-[12px] font-bold tabular-nums text-slate-900">{fmt(p.total)} ₭</div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard icon={Users} title="ພະນັກງານຂາຍມື້ນີ້">
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ) : !today?.byStaff?.length ? (
            <div className="py-8 text-center text-sm text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>
          ) : (
            <div className="space-y-1">
              {today.byStaff.slice(0, 5).map((st, i) => (
                <div key={st.staff_code || i} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-slate-50">
                  <RankBadge rank={i + 1} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-slate-800">{st.staff_name || st.staff_code}</p>
                    <p className="text-[10px] text-slate-400">{fmt(st.bills)} ບິນ</p>
                  </div>
                  <div className="text-[12px] font-bold tabular-nums text-slate-900">{fmt(st.total)} ₭</div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard
          icon={ReceiptText}
          title="ບິນລ່າສຸດ"
          action={
            <Link href="/manage/sales" className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2E6AB3] hover:underline">
              ທັງໝົດ <ChevronRight size={12} />
            </Link>
          }
        >
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ) : !today?.recentBills?.length ? (
            <div className="py-8 text-center text-sm text-slate-400">ຍັງບໍ່ມີບິນມື້ນີ້</div>
          ) : (
            <div className="space-y-1">
              {today.recentBills.slice(0, 5).map((b) => (
                <div key={b.doc_no} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-slate-50">
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${b.payment_type === 'transfer' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {b.payment_type === 'transfer' ? <CreditCard size={12} /> : <Banknote size={12} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-slate-800">{b.doc_no}</p>
                    <p className="text-[10px] text-slate-400">{b.doc_time || ''} · {fmt(b.item_count)} ລາຍການ</p>
                  </div>
                  <div className="text-[12px] font-bold tabular-nums text-slate-900">{fmt(b.total)} ₭</div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </section>

      {/* Compact module shortcuts */}
      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Modules</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {backOfficeModuleItems
            .filter((item) => item.to !== '/manage' && item.enabled)
            .map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.title}
                  href={item.to}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.bg}`}>
                    <Icon size={17} className={item.color} strokeWidth={2.1} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-slate-900">{item.title}</div>
                    <div className="truncate text-[11px] text-slate-500">{item.desc}</div>
                  </div>
                  <ChevronRight size={15} className="shrink-0 text-slate-300 transition-colors group-hover:text-[#2E6AB3]" />
                </Link>
              )
            })}
        </div>
      </section>
    </div>
  )
}
