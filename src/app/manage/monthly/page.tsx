"use client";
// @ts-nocheck

import { useCallback, useEffect, useState } from 'react'
import { CalendarRange, RefreshCw } from 'lucide-react'
import { getMonthlyTargetReportAction } from '@/app/_actions/staff-targets'

const BRAND = '#2E6AB3'

const fmt = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })

const toISODate = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function presetRange(id) {
  const now = new Date()
  const today = toISODate(now)
  if (id === 'today') return { from: today, to: today }
  if (id === 'week') {
    const s = new Date(now); s.setDate(s.getDate() - 6)
    return { from: toISODate(s), to: today }
  }
  if (id === 'days30') {
    const s = new Date(now); s.setDate(s.getDate() - 29)
    return { from: toISODate(s), to: today }
  }
  if (id === 'month') {
    return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
  }
  if (id === 'year') {
    return { from: `${now.getFullYear()}-01-01`, to: today }
  }
  return { from: today, to: today }
}

const PRESETS = [
  { id: 'today', label: 'ມື້ນີ້' },
  { id: 'week', label: '7 ວັນ' },
  { id: 'days30', label: '30 ວັນ' },
  { id: 'month', label: 'ເດືອນນີ້' },
  { id: 'year', label: 'ປີນີ້' },
]

const RankBadge = ({ rank }) => (
  <div
    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
      rank === 1 ? 'bg-[#2E6AB3] text-white' : rank === 2 ? 'bg-[#2E6AB3]/15 text-[#2E6AB3]' : 'bg-slate-100 text-slate-500'
    }`}
  >
    {rank}
  </div>
)

/** Small % bar: green >= 100, amber >= 80, red below. */
const PctBar = ({ pct }) => {
  const color = pct >= 100 ? '#1baf7a' : pct >= 80 ? '#e8a530' : '#e15b64'
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-[12px] font-black tabular-nums" style={{ color }}>{fmt(pct)}%</span>
      <div className="h-1.5 w-24 rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(pct, 2), 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

const AchBar = ({ pct }) => (
  <div className="flex flex-col items-center gap-1">
    <span className={`text-[12px] font-black tabular-nums ${pct >= 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
      {(Number(pct) || 0).toFixed(1)}%
    </span>
    <div className="h-1.5 w-28 rounded-full bg-slate-100">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(Math.max(pct, 2), 100)}%`, backgroundColor: pct >= 100 ? '#1baf7a' : '#e15b64' }}
      />
    </div>
  </div>
)

export default function MonthlySalesTargetPage() {
  const [preset, setPreset] = useState('month')
  const [range, setRange] = useState(() => presetRange('month'))
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (r) => {
    setLoading(true)
    setError('')
    try {
      const data = await getMonthlyTargetReportAction(r)
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

  const t = report?.totals
  const avgBill = t?.bills > 0 ? t.actual_thb / t.bills : 0

  return (
    <div className="space-y-5">
      {/* Header + summary chips */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: BRAND }}>
              <CalendarRange size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">ສະຫຼຸບຍອດຂາຍປະຈຳເດືອນ (ບາດ)</h1>
              <p className="mt-1 text-sm text-slate-500">
                {report?.from} → {report?.to} · ໜ້າຮ້ານ ຂົວຫຼວງ · ເລດ {report?.rate ? `${fmt(report.rate)} ₭/฿` : '—'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 sm:grid-cols-5">
            {[
              { label: 'ຍອດຂາຍຈິງ (ບາດ)', value: fmt(t?.actual_thb), color: 'text-[#2E6AB3]' },
              { label: 'ເປົ້າຂາຍ (ບາດ)', value: fmt(t?.target_thb), color: 'text-slate-900' },
              { label: 'ບັນລຸ', value: `${(t?.ach_pct || 0).toFixed(1)}%`, color: (t?.ach_pct || 0) >= 100 ? 'text-emerald-600' : 'text-rose-600' },
              { label: 'ບິນ', value: fmt(t?.bills), color: 'text-slate-900' },
              { label: 'ສະເລ່ຍ/ບິນ', value: fmt(avgBill), color: 'text-slate-900' },
            ].map((c) => (
              <div key={c.label} className="text-right sm:text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</div>
                <div className={`mt-0.5 text-lg font-black tabular-nums ${c.color}`}>{c.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2">
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">ຈາກວັນທີ</div>
              <input
                type="date"
                value={range.from}
                max={range.to}
                onChange={(e) => setCustom('from', e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-700 outline-none focus:border-[#2E6AB3]"
              />
            </div>
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">ຫາວັນທີ</div>
              <input
                type="date"
                value={range.to}
                min={range.from}
                onChange={(e) => setCustom('to', e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-700 outline-none focus:border-[#2E6AB3]"
              />
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-end gap-2">
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
            <button
              onClick={() => load(range)}
              disabled={loading}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
      )}

      {/* Per-staff table */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black text-slate-800">ສະຫຼຸບຍອດຂາຍຈິງ ລາຍເດືອນ (ບາດ)</h2>
          <span className="text-[11px] font-medium text-slate-400">
            ເຫຼືອ {fmt(report?.days_left)} ວັນໃນເດືອນ · ຕັ້ງເປົ້າໄດ້ທີ່ໜ້າ "ກຳນົດເປົ້າຂາຍ"
          </span>
        </div>

        {loading ? (
          <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
        ) : !report?.rows?.length ? (
          <div className="py-12 text-center text-sm text-slate-400">
            ບໍ່ມີເປົ້າ ຫຼື ຍອດຂາຍໃນຊ່ວງນີ້ — ຕັ້ງເປົ້າກ່ອນທີ່ໜ້າ "ກຳນົດເປົ້າຂາຍ"
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 pr-2 w-10">#</th>
                  <th className="py-2.5 pr-3">ພະນັກງານ</th>
                  <th className="py-2.5 pr-3 text-right">ເປົ້າ</th>
                  <th className="py-2.5 pr-3 text-right">ຍອດຂາຍ</th>
                  <th className="py-2.5 pr-3 text-center">Ach%</th>
                  <th className="py-2.5 pr-3 text-center">Days</th>
                  <th className="py-2.5 pr-3 text-right">Req/Day</th>
                  <th className="py-2.5 pr-3 text-right">YTD Target</th>
                  <th className="py-2.5 pr-3 text-right">YTD Actual</th>
                  <th className="py-2.5 text-right">YTD%</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, i) => (
                  <tr key={r.staff_code} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                    <td className="py-3 pr-2"><RankBadge rank={i + 1} /></td>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-800">{r.staff_name}</div>
                      <div className="text-[11px] text-slate-400">{r.staff_code} · ພະນັກງານຂາຍ</div>
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums text-slate-700">{fmt(r.target_thb)}</td>
                    <td className="py-3 pr-3 text-right font-black tabular-nums text-[#2E6AB3]">{fmt(r.actual_thb)}</td>
                    <td className="py-3 pr-3"><AchBar pct={r.ach_pct} /></td>
                    <td className="py-3 pr-3 text-center tabular-nums text-slate-600">{fmt(report.days_left)}</td>
                    <td className="py-3 pr-3 text-right font-bold tabular-nums text-[#2E6AB3]">{fmt(r.req_per_day)}</td>
                    <td className="py-3 pr-3 text-right tabular-nums text-slate-700">{fmt(r.ytd_target_thb)}</td>
                    <td className="py-3 pr-3 text-right tabular-nums text-slate-700">{fmt(r.ytd_actual_thb)}</td>
                    <td className="py-3"><PctBar pct={r.ytd_pct} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50/70 font-bold">
                  <td className="py-3 pr-2" />
                  <td className="py-3 pr-3 text-slate-800">ລວມທັງໝົດ</td>
                  <td className="py-3 pr-3 text-right tabular-nums text-slate-900">{fmt(t?.target_thb)}</td>
                  <td className="py-3 pr-3 text-right font-black tabular-nums text-[#2E6AB3]">{fmt(t?.actual_thb)}</td>
                  <td className="py-3 pr-3 text-center">
                    <span className={`text-[12px] font-black tabular-nums ${(t?.ach_pct || 0) >= 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {(t?.ach_pct || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-center tabular-nums text-slate-600">{fmt(report?.days_left)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums text-slate-900">{fmt(t?.req_per_day)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums text-slate-900">{fmt(t?.ytd_target_thb)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums text-slate-900">{fmt(t?.ytd_actual_thb)}</td>
                  <td className="py-3 text-right">
                    <span className="text-[12px] font-black tabular-nums text-slate-800">{fmt(t?.ytd_pct)}%</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
