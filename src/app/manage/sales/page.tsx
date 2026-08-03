"use client";
// @ts-nocheck

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Award,
  Banknote,
  BarChart3,
  ClipboardCheck,
  Coins,
  CreditCard,
  Download,
  Percent,
  PiggyBank,
  ReceiptText,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'
import { getSalesReportAction } from '@/app/_actions/sales-report'
import { listDailyClosuresAction } from '@/app/_actions/daily-summary'

const BRAND = '#2E6AB3'
const SERIES_1 = '#2a78d6' // cash / primary
const SERIES_2 = '#1baf7a' // transfer

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

function presetRange(id) {
  const now = new Date()
  const today = toISODate(now)
  if (id === 'today') return { from: today, to: today }
  if (id === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1)
    const iso = toISODate(y)
    return { from: iso, to: iso }
  }
  if (id === 'week') {
    const s = new Date(now); s.setDate(s.getDate() - 6)
    return { from: toISODate(s), to: today }
  }
  if (id === 'month') {
    return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
  }
  if (id === 'lastMonth') {
    return {
      from: toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: toISODate(new Date(now.getFullYear(), now.getMonth(), 0)),
    }
  }
  return { from: today, to: today }
}

const PRESETS = [
  { id: 'today', label: 'ມື້ນີ້' },
  { id: 'yesterday', label: 'ວານນີ້' },
  { id: 'week', label: '7 ວັນ' },
  { id: 'month', label: 'ເດືອນນີ້' },
  { id: 'lastMonth', label: 'ເດືອນກ່ອນ' },
]

/* ---------- UI pieces ---------- */

/** delta: % change vs previous period (null = no comparison data). */
const StatTile = ({ icon: Icon, label, value, sub = '', delta = undefined, iconBg = 'bg-slate-100', iconColor = 'text-slate-600' }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center gap-2.5">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon size={17} className={iconColor} strokeWidth={2.2} />
      </div>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {delta !== undefined && (
        delta === null ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">—</span>
        ) : (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )
      )}
    </div>
    <div className="mt-3 text-2xl font-black tracking-tight text-slate-900">{value}</div>
    {sub && <div className="mt-1 text-xs font-medium text-slate-400">{sub}</div>}
  </div>
)

/** Vertical bar chart: single series, hover tooltip per bar, direct label on the peak. */
const BarChart = ({ data, maxBars = 31 }) => {
  const bars = data.slice(-maxBars)
  const max = Math.max(...bars.map((b) => b.value), 1)
  const peakIdx = bars.reduce((best, b, i) => (b.value > bars[best].value ? i : best), 0)

  if (!bars.length || bars.every((b) => !b.value)) {
    return <div className="flex h-48 items-center justify-center text-sm text-slate-400">ບໍ່ມີຂໍ້ມູນໃນຊ່ວງນີ້</div>
  }

  return (
    <div>
      <div className="flex h-48 items-end gap-[3px] border-b border-slate-200 pb-px">
        {bars.map((b, i) => {
          const h = Math.max((b.value / max) * 100, b.value > 0 ? 2 : 0.5)
          return (
            <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              {i === peakIdx && b.value > 0 && (
                <div className="mb-1 hidden text-[10px] font-bold text-slate-500 sm:block">{fmtCompact(b.value)}</div>
              )}
              <div
                className="w-full max-w-[34px] rounded-t transition-opacity group-hover:opacity-80"
                style={{ height: `${h}%`, backgroundColor: SERIES_1, borderRadius: '4px 4px 0 0' }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-center opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                <div className="text-[11px] font-bold text-white">{fmt(b.value)} ₭</div>
                <div className="text-[10px] text-slate-300">{b.tooltip}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 truncate text-center text-[10px] font-medium text-slate-400">
            {bars.length > 16 && i % 2 === 1 ? '' : b.label}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Cash vs transfer split: stacked horizontal bar, 2px gaps, legend + direct labels. */
const PaymentSplit = ({ cash, transfer, total }) => {
  const other = Math.max(total - cash - transfer, 0)
  const denom = Math.max(cash + transfer + other, 1)
  const seg = (v) => `${(v / denom) * 100}%`
  return (
    <div className="space-y-3">
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100">
        {cash > 0 && <div style={{ width: seg(cash), backgroundColor: SERIES_1 }} className="rounded-full" />}
        {transfer > 0 && <div style={{ width: seg(transfer), backgroundColor: SERIES_2 }} className="rounded-full" />}
        {other > 0 && <div style={{ width: seg(other) }} className="rounded-full bg-slate-300" />}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
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
    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
      rank === 1 ? 'bg-[#2E6AB3] text-white' : rank === 2 ? 'bg-[#2E6AB3]/70 text-white' : rank === 3 ? 'bg-[#2E6AB3]/40 text-white' : 'bg-slate-100 text-slate-500'
    }`}
  >
    {rank}
  </div>
)

/* ---------- Page ---------- */

export default function SalesReportPage() {
  const [preset, setPreset] = useState('today')
  const [range, setRange] = useState(() => presetRange('today'))
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [closures, setClosures] = useState([])

  useEffect(() => {
    listDailyClosuresAction(8).then(setClosures).catch(() => setClosures([]))
  }, [])

  const load = useCallback(async (r) => {
    setLoading(true)
    setError('')
    try {
      const data = await getSalesReportAction(r)
      setReport(data)
    } catch (exc) {
      console.error(exc)
      setError('ດຶງຂໍ້ມູນບໍ່ສຳເລັດ — ລອງໃໝ່ອີກຄັ້ງ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(range) }, [range, load])

  const selectPreset = (id) => {
    setPreset(id)
    setRange(presetRange(id))
  }

  const setCustom = (key, value) => {
    if (!value) return
    setPreset('custom')
    setRange((prev) => ({ ...prev, [key]: value }))
  }

  const singleDay = range.from === range.to
  const chartData = useMemo(() => {
    if (!report) return []
    if (singleDay) {
      return report.byHour.map((h) => ({ label: `${h.hour}h`, value: h.total, tooltip: `${h.hour}:00 · ${h.bills} ບິນ` }))
    }
    return report.byDay.map((d) => ({ label: fmtDayLabel(d.day), value: d.total, tooltip: `${d.day} · ${d.bills} ບິນ` }))
  }, [report, singleDay])

  const exportCsv = () => {
    if (!report?.recentBills?.length) return
    const header = ['doc_no', 'doc_date', 'doc_time', 'cust_code', 'customer_name', 'staff_code', 'payment_type', 'item_count', 'total']
    const lines = [header.join(',')]
    for (const b of report.recentBills) {
      lines.push(header.map((k) => {
        const v = b[k] == null ? '' : String(b[k])
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
      }).join(','))
    }
    const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales_${range.from}_${range.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const s = report?.summary
  const prev = report?.prev
  const pct = (cur, base) => (Number(base) > 0 ? ((Number(cur) - Number(base)) / Number(base)) * 100 : null)

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: BRAND }}>
              <BarChart3 size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">ສະຫຼຸບຍອດຂາຍ</h1>
              <p className="mt-1 text-sm text-slate-500">ຕິດຕາມການເຄື່ອນໄຫວການຂາຍ POS ({range.from}{singleDay ? '' : ` → ${range.to}`})</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => load(range)}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              ໂຫຼດໃໝ່
            </button>
            <button
              onClick={exportCsv}
              disabled={!report?.recentBills?.length}
              className="flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: BRAND }}
            >
              <Download size={15} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Period filter row */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPreset(p.id)}
              className={`h-9 rounded-xl px-3.5 text-[13px] font-bold transition-colors ${
                preset === p.id ? 'text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              style={preset === p.id ? { backgroundColor: BRAND } : undefined}
            >
              {p.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => setCustom('from', e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-700 outline-none focus:border-[#2E6AB3]"
            />
            <span className="text-xs text-slate-400">ຫາ</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => setCustom('to', e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-700 outline-none focus:border-[#2E6AB3]"
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>
      )}

      {/* Stat tiles */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Wallet}
          label="ຍອດຂາຍລວມ"
          value={`${fmt(s?.total_all)} ₭`}
          sub={prev ? `ໄລຍະກ່ອນ (${prev.from} → ${prev.to}): ${fmt(prev.total_all)} ₭` : `${fmt(s?.count_bills)} ບິນ`}
          delta={pct(s?.total_all, prev?.total_all)}
          iconBg="bg-blue-50" iconColor="text-[#2E6AB3]"
        />
        <StatTile
          icon={ReceiptText}
          label="ຈຳນວນບິນ"
          value={fmt(s?.count_bills)}
          sub={prev ? `ໄລຍະກ່ອນ: ${fmt(prev.count_bills)} ບິນ` : ''}
          delta={pct(s?.count_bills, prev?.count_bills)}
          iconBg="bg-violet-50" iconColor="text-violet-600"
        />
        <StatTile
          icon={Banknote}
          label="ເງິນສົດ"
          value={`${fmt(s?.total_cash)} ₭`}
          iconBg="bg-emerald-50" iconColor="text-emerald-600"
        />
        <StatTile
          icon={CreditCard}
          label="ເງິນໂອນ"
          value={`${fmt(s?.total_transfer)} ₭`}
          iconBg="bg-amber-50" iconColor="text-amber-600"
        />
      </section>

      {/* Profit / cost / members / discount */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={PiggyBank}
          label="ກຳໄລເບື້ອງຕົ້ນ"
          value={`${fmt(s?.total_profit)} ₭`}
          sub={`margin ≈ ${s?.margin_pct ?? 0}% (ຈາກຕົ້ນທຶນສະເລ່ຍ)`}
          iconBg="bg-teal-50" iconColor="text-teal-600"
        />
        <StatTile
          icon={Coins}
          label="ຕົ້ນທຶນສິນຄ້າ"
          value={`${fmt(s?.total_cost)} ₭`}
          sub="ຄິດຈາກ average cost ຕອນຂາຍ"
          iconBg="bg-slate-100" iconColor="text-slate-600"
        />
        <StatTile
          icon={UserRound}
          label="ຍອດຂາຍສະມາຊິກ"
          value={`${fmt(s?.member_total)} ₭`}
          sub={`${fmt(s?.member_bills)} ບິນ (${s?.count_bills > 0 ? Math.round((s.member_bills / s.count_bills) * 100) : 0}% ຂອງບິນທັງໝົດ)`}
          iconBg="bg-sky-50" iconColor="text-sky-600"
        />
        <StatTile
          icon={Percent}
          label="ສ່ວນຫຼຸດລວມ"
          value={`${fmt(s?.total_discount)} ₭`}
          iconBg="bg-rose-50" iconColor="text-rose-500"
        />
      </section>

      {/* Chart + payment split */}
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800">{singleDay ? 'ຍອດຂາຍຕາມຊົ່ວໂມງ' : 'ຍອດຂາຍຕາມວັນ'}</h3>
            <span className="text-[11px] font-semibold text-slate-400">ໜ່ວຍ: ກີບ (₭)</span>
          </div>
          {loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <BarChart data={chartData} />
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-black text-slate-800">ແບ່ງຕາມການຊຳລະ</h3>
            {loading ? (
              <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <PaymentSplit cash={s?.total_cash || 0} transfer={s?.total_transfer || 0} total={s?.total_all || 0} />
            )}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-800">ຍອດເປັນເງິນບາດ (THB)</h3>
            {loading ? (
              <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <div className="space-y-2.5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ຍອດຂາຍທຽບເປັນບາດ</div>
                  <div className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">
                    {report?.baht?.total_all_thb != null ? `฿ ${fmt(report.baht.total_all_thb)}` : '—'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {report?.baht?.rate
                      ? `ອັດຕາຫຼ້າສຸດ ${fmt(report.baht.rate)} ₭/฿`
                      : 'ຍັງບໍ່ມີອັດຕາແລກປ່ຽນໃນລະບົບ (ຈະມີເມື່ອຮັບບາດຄັ້ງທຳອິດ)'}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">ຮັບເປັນເງິນບາດແທ້</div>
                    <div className="text-[10px] text-slate-400">{fmt(report?.baht?.thb_bills)} ບິນ</div>
                  </div>
                  <div className="text-base font-black tabular-nums text-slate-900">฿ {fmt(report?.baht?.thb_received)}</div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardCheck size={16} className="text-[#2E6AB3]" strokeWidth={2.2} />
              <h3 className="text-sm font-black text-slate-800">ປະຫວັດປິດຮອບຫຼ້າສຸດ</h3>
            </div>
            {!closures.length ? (
              <div className="py-6 text-center text-sm text-slate-400">ຍັງບໍ່ມີການປິດຮອບ</div>
            ) : (
              <div className="space-y-2">
                {closures.map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-slate-700">
                        {new Date(c.created_at).toLocaleString('lo-LA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {c.staff ? ` · ${c.staff}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400">{fmt(c.count_bills)} ບິນ{c.recipient ? ` · ຮັບ: ${c.recipient}` : ''}</p>
                    </div>
                    <div className="text-[12px] font-bold tabular-nums text-slate-900">{fmt(c.total_all)} ₭</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Top products + staff */}
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Award size={17} className="text-[#2E6AB3]" />
            <h3 className="text-sm font-black text-slate-800">ສິນຄ້າຂາຍດີ Top 10</h3>
          </div>
          {loading ? (
            <div className="h-56 animate-pulse rounded-xl bg-slate-100" />
          ) : !report?.topProducts?.length ? (
            <div className="py-10 text-center text-sm text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>
          ) : (
            <div className="space-y-1.5">
              {report.topProducts.map((p, i) => (
                <div key={p.item_code || i} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50">
                  <RankBadge rank={i + 1} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">{p.item_name}</p>
                    <p className="text-[11px] text-slate-400">ຂາຍ {fmt(p.qty)} {p.unit || 'ຊິ້ນ'}</p>
                  </div>
                  <div className="text-right text-[13px] font-bold tabular-nums text-slate-900">{fmt(p.total)} ₭</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users size={17} className="text-[#2E6AB3]" />
            <h3 className="text-sm font-black text-slate-800">ຍອດຂາຍຕາມພະນັກງານ</h3>
          </div>
          {loading ? (
            <div className="h-56 animate-pulse rounded-xl bg-slate-100" />
          ) : !report?.byStaff?.length ? (
            <div className="py-10 text-center text-sm text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>
          ) : (
            <div className="space-y-1.5">
              {report.byStaff.map((st, i) => {
                const max = report.byStaff[0]?.total || 1
                return (
                  <div key={st.staff_code || i} className="rounded-xl px-2 py-2 transition-colors hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <RankBadge rank={i + 1} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-800">{st.staff_name || st.staff_code}</p>
                        <p className="text-[11px] text-slate-400">#{st.staff_code} · {fmt(st.bills)} ບິນ</p>
                      </div>
                      <div className="text-right text-[13px] font-bold tabular-nums text-slate-900">{fmt(st.total)} ₭</div>
                    </div>
                    <div className="ml-10 mt-1.5 h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${Math.max((st.total / max) * 100, 2)}%`, backgroundColor: SERIES_1 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Recent bills */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800">ບິນລ່າສຸດ</h3>
          <span className="text-[11px] font-semibold text-slate-400">{report?.recentBills?.length || 0} ລາຍການ (ສູງສຸດ 100)</span>
        </div>
        {loading ? (
          <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
        ) : !report?.recentBills?.length ? (
          <div className="py-10 text-center text-sm text-slate-400">ບໍ່ມີບິນໃນຊ່ວງນີ້</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 pr-3">ເລກບິນ</th>
                  <th className="py-2.5 pr-3">ວັນທີ / ເວລາ</th>
                  <th className="py-2.5 pr-3">ລູກຄ້າ</th>
                  <th className="py-2.5 pr-3">ພະນັກງານ</th>
                  <th className="py-2.5 pr-3 text-center">ລາຍການ</th>
                  <th className="py-2.5 pr-3">ຊຳລະ</th>
                  <th className="py-2.5 text-right">ຍອດ (₭)</th>
                </tr>
              </thead>
              <tbody>
                {report.recentBills.map((b) => (
                  <tr key={b.doc_no} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                    <td className="py-2.5 pr-3 font-bold text-slate-800">{b.doc_no}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate-500">{b.doc_date} {b.doc_time || ''}</td>
                    <td className="max-w-[180px] truncate py-2.5 pr-3 text-slate-700">{b.customer_name || b.cust_code || '-'}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{b.staff_code || '-'}</td>
                    <td className="py-2.5 pr-3 text-center tabular-nums text-slate-600">{fmt(b.item_count)}</td>
                    <td className="py-2.5 pr-3">
                      {b.payment_type === 'cash' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          <Banknote size={11} /> ສົດ
                        </span>
                      ) : b.payment_type === 'transfer' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                          <CreditCard size={11} /> ໂອນ
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-black tabular-nums text-slate-900">{fmt(b.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
