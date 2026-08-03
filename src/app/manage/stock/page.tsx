"use client";
// @ts-nocheck

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Download,
  MoonStar,
  PackagePlus,
  PackageX,
  RefreshCw,
  Scale,
  Search,
} from 'lucide-react'
import { getStockOnHandAction, getStockRecommendationsAction, getStockReportAction } from '@/app/_actions/stock-report'

const BRAND = '#0F766E'
const SERIES_IN = '#14B8A6'  // stock in  (teal)
const SERIES_OUT = '#F97316' // stock out (orange)

const fmt = (n) => (Number(n) || 0).toLocaleString()
const fmtQty = (n) => {
  const v = Number(n) || 0
  return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
const fmtCompact = (n) => {
  const v = Number(n) || 0
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`
  return fmtQty(v)
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
  { id: 'week', label: '7 ວັນ' },
  { id: 'month', label: 'ເດືອນນີ້' },
  { id: 'lastMonth', label: 'ເດືອນກ່ອນ' },
]

/** Known SML document types; anything else renders as a generic flag label. */
const FLAG_LABELS = {
  44: 'ຂາຍ POS',
  12: 'ຊື້ເຂົ້າ',
  70: 'ໂອນເຂົ້າສາງ',
  72: 'ໂອນອອກສາງ',
  16: 'ສົ່ງຄືນຜູ້ສະໜອງ',
  48: 'ປັບປຸງສາງ (ເພີ່ມ)',
}
const flagLabel = (f) => FLAG_LABELS[f.trans_flag] || `ເອກະສານປະເພດ ${f.trans_flag}`

/* ---------- UI pieces ---------- */

const StatTile = ({ icon: Icon, label, value, sub = '', iconBg = 'bg-slate-100', iconColor = 'text-slate-600' }) => (
  <div className="stock-stat-card rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex items-center gap-2">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon size={14} className={iconColor} strokeWidth={2.2} />
      </div>
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
    </div>
    <div className="mt-1.5 text-lg font-black tracking-[-0.02em] text-slate-950">{value}</div>
    {sub && <div className="mt-0.5 text-[11px] font-medium text-slate-400">{sub}</div>}
  </div>
)

/** Paired in/out bars per day, shared scale, legend + per-day hover tooltip. */
const InOutBarChart = ({ data, maxBars = 31 }) => {
  const bars = data.slice(-maxBars)
  const max = Math.max(...bars.flatMap((b) => [b.qty_in, b.qty_out]), 1)

  if (!bars.length || bars.every((b) => !b.qty_in && !b.qty_out)) {
    return <div className="flex h-32 items-center justify-center text-sm text-slate-400">ບໍ່ມີຂໍ້ມູນໃນຊ່ວງນີ້</div>
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-4">
        {[
          { label: 'ຮັບເຂົ້າ', color: SERIES_IN },
          { label: 'ຈ່າຍອອກ', color: SERIES_OUT },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-xs font-medium text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="flex h-32 items-end gap-[3px] border-b border-slate-200 pb-px">
        {bars.map((b, i) => {
          const hIn = Math.max((b.qty_in / max) * 100, b.qty_in > 0 ? 2 : 0.5)
          const hOut = Math.max((b.qty_out / max) * 100, b.qty_out > 0 ? 2 : 0.5)
          return (
            <div key={i} className="group relative flex h-full flex-1 items-end justify-center gap-[2px]">
              <div
                className="w-full max-w-[16px] transition-opacity group-hover:opacity-80"
                style={{ height: `${hIn}%`, backgroundColor: SERIES_IN, borderRadius: '4px 4px 0 0' }}
              />
              <div
                className="w-full max-w-[16px] transition-opacity group-hover:opacity-80"
                style={{ height: `${hOut}%`, backgroundColor: SERIES_OUT, borderRadius: '4px 4px 0 0' }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-center opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                <div className="text-[11px] font-bold text-white">ເຂົ້າ {fmtQty(b.qty_in)} · ອອກ {fmtQty(b.qty_out)}</div>
                <div className="text-[10px] text-slate-300">{b.day}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 truncate text-center text-[10px] font-medium text-slate-400">
            {bars.length > 16 && i % 2 === 1 ? '' : fmtDayLabel(b.day)}
          </div>
        ))}
      </div>
    </div>
  )
}

const REC_TABS = [
  { id: 'moves', label: 'ການເຄື່ອນໄຫວ', icon: RefreshCw, color: 'text-teal-700', bg: 'bg-teal-50' },
  { id: 'restock', label: 'ຕ້ອງເຕີມ Stock', icon: PackagePlus, color: 'text-rose-600', bg: 'bg-rose-50' },
  { id: 'overstock', label: 'ບໍ່ຄວນ Stock ເພີ່ມ', icon: PackageX, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'dead', label: 'ບໍ່ມີການເຄື່ອນໄຫວ', icon: MoonStar, color: 'text-slate-600', bg: 'bg-slate-100' },
]

/* ---------- Page ---------- */

export default function StockReportPage() {
  const [preset, setPreset] = useState('week')
  const [range, setRange] = useState(() => presetRange('week'))
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [itemQuery, setItemQuery] = useState('')
  const [recTab, setRecTab] = useState('moves')
  const [mainTab, setMainTab] = useState('movement')
  const [onHand, setOnHand] = useState(null)
  const [onHandQuery, setOnHandQuery] = useState('')
  const [onHandLimit, setOnHandLimit] = useState(100)

  const [recsData, setRecsData] = useState(null)
  const [recsLoading, setRecsLoading] = useState(true)

  useEffect(() => {
    getStockOnHandAction().then(setOnHand).catch(() => setOnHand(null))
    // Recommendations use fixed 30/90-day windows — load once, not per range change.
    getStockRecommendationsAction()
      .then(setRecsData)
      .catch(() => setRecsData(null))
      .finally(() => setRecsLoading(false))
  }, [])

  const load = useCallback(async (r) => {
    setLoading(true)
    setError('')
    try {
      const data = await getStockReportAction(r)
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
  const s = report?.summary
  const recs = recsData

  const filteredItems = useMemo(() => {
    const list = report?.items || []
    const query = itemQuery.trim().toLowerCase()
    if (!query) return list
    return list.filter(
      (it) => it.item_code.toLowerCase().includes(query) || it.item_name.toLowerCase().includes(query),
    )
  }, [report, itemQuery])

  const exportCsv = () => {
    if (!report?.items?.length) return
    const header = ['item_code', 'item_name', 'unit', 'qty_in', 'qty_out', 'net', 'docs', 'balance_qty']
    const lines = [header.join(',')]
    for (const it of report.items) {
      lines.push(header.map((k) => {
        const v = it[k] == null ? '' : String(it[k])
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
      }).join(','))
    }
    const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stock_movement_${range.from}_${range.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const recCount = (id) => (recs ? recs[id]?.length || 0 : 0)

  const filteredOnHand = useMemo(() => {
    const list = onHand?.items || []
    const query = onHandQuery.trim().toLowerCase()
    if (!query) return list
    return list.filter(
      (it) => it.ic_code.toLowerCase().includes(query) || it.item_name.toLowerCase().includes(query),
    )
  }, [onHand, onHandQuery])

  const exportOnHandCsv = () => {
    if (!onHand?.items?.length) return
    const header = ['ic_code', 'item_name', 'unit', 'balance_qty', 'avg_cost', 'stock_value']
    const lines = [header.join(',')]
    for (const it of onHand.items) {
      lines.push(header.map((k) => {
        const v = it[k] == null ? '' : String(it[k])
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
      }).join(','))
    }
    const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stock_on_hand_${toISODate(new Date())}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="stock-redesign">
      {/* Header */}
      <section className="stock-hero rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="stock-hero-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: BRAND }}>
              <Boxes size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="stock-eyebrow mb-1 text-[10px] font-black uppercase tracking-[0.2em]">Inventory intelligence</div>
              <h1 className="text-lg font-black tracking-tight text-white">ການເຄື່ອນໄຫວ Stock</h1>
              <p className="mt-1 text-sm text-slate-300">
                ຮັບເຂົ້າ-ຈ່າຍອອກ ສາງ 1105 ({range.from}{singleDay ? '' : ` → ${range.to}`})
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mainTab === 'movement' && (
              <>
                <button
                  onClick={() => load(range)}
                  disabled={loading}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                  ໂຫຼດໃໝ່
                </button>
                <button
                  onClick={exportCsv}
                  disabled={!report?.items?.length}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: BRAND }}
                >
                  <Download size={15} />
                  Export CSV
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main tabs */}
        <div className="stock-main-tabs mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
          {[
            { id: 'movement', label: 'ການເຄື່ອນໄຫວ', icon: RefreshCw },
            { id: 'onhand', label: 'Stock ຄົງເຫຼືອທັງໝົດ', icon: Boxes },
          ].map((t) => {
            const Icon = t.icon
            const active = mainTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setMainTab(t.id)}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold transition-colors ${
                  active ? 'text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                style={active ? { backgroundColor: BRAND } : undefined}
              >
                <Icon size={15} />
                {t.label}
                {t.id === 'onhand' && onHand && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${active ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-600'}`}>
                    {fmt(onHand.summary.sku_count)}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Period filter row */}
        {mainTab === 'movement' && (
        <div className="stock-period mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPreset(p.id)}
              className={`h-8 rounded-lg px-3 text-[12px] font-bold transition-colors ${
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
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-700 outline-none focus:border-[#2E6AB3]"
            />
            <span className="text-xs text-slate-400">ຫາ</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => setCustom('to', e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-700 outline-none focus:border-[#2E6AB3]"
            />
          </div>
        </div>
        )}
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
      )}

      {mainTab === 'movement' && (<>
      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <StatTile
          icon={ArrowDownToLine} label="ຮັບເຂົ້າ" value={fmtQty(s?.total_in)}
          sub="ຈຳນວນສິນຄ້າຮັບເຂົ້າສາງ" iconBg="bg-emerald-50" iconColor="text-emerald-600"
        />
        <StatTile
          icon={ArrowUpFromLine} label="ຈ່າຍອອກ" value={fmtQty(s?.total_out)}
          sub="ຈຳນວນສິນຄ້າອອກຈາກສາງ" iconBg="bg-blue-50" iconColor="text-blue-600"
        />
        <StatTile
          icon={Scale} label="ສຸດທິ" value={`${(s?.net || 0) >= 0 ? '+' : ''}${fmtQty(s?.net)}`}
          sub="ຮັບເຂົ້າ - ຈ່າຍອອກ" iconBg="bg-violet-50" iconColor="text-violet-600"
        />
        <StatTile
          icon={Boxes} label="ລາຍການເຄື່ອນໄຫວ" value={fmt(s?.items_moved)}
          sub={`${fmt(s?.docs)} ເອກະສານ`} iconBg="bg-amber-50" iconColor="text-amber-600"
        />
      </section>

      {/* Chart + doc type breakdown */}
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="stock-panel rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">ເຄື່ອນໄຫວລາຍວັນ</h2>
          <p className="mb-4 mt-0.5 text-xs text-slate-400">ຈຳນວນ (ທຸກຫົວໜ່ວຍລວມກັນ) ຕໍ່ວັນ</p>
          <InOutBarChart data={report?.byDay || []} />
        </div>
        <div className="stock-panel rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-900">ແຍກຕາມປະເພດເອກະສານ</h2>
          {!report?.byFlag?.length && <div className="py-8 text-center text-sm text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>}
          <div className="space-y-2">
            {(report?.byFlag || []).slice(0, 8).map((f) => (
              <div key={`${f.trans_flag}-${f.direction}`} className="flex items-center gap-2.5 rounded-xl border border-slate-100 px-3 py-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: f.direction === 'in' ? SERIES_IN : SERIES_OUT }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-slate-800">{flagLabel(f)}</div>
                  <div className="text-[11px] text-slate-400">{fmt(f.docs)} ເອກະສານ · {f.direction === 'in' ? 'ເຂົ້າ' : 'ອອກ'}</div>
                </div>
                <div className="text-sm font-bold tabular-nums text-slate-900">{fmtCompact(f.qty)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recommendations */}
      <section style={{ order: 4 }} className="stock-panel stock-recommendations rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {REC_TABS.map((t) => {
            const Icon = t.icon
            const active = recTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setRecTab(t.id)}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold transition-colors ${
                  active ? 'text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                style={active ? { backgroundColor: BRAND } : undefined}
              >
                <Icon size={15} />
                {t.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${active ? 'bg-white/20 text-white' : `${t.bg} ${t.color}`}`}>
                  {t.id === 'moves' ? fmt(report?.items?.length || 0) : fmt(recCount(t.id))}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            {recTab === 'moves' && `ຮັບເຂົ້າ-ຈ່າຍອອກຕໍ່ລາຍການ ໃນຊ່ວງທີ່ເລືອກ (ສູງສຸດ 300 ລາຍການ, ຮຽງຕາມຈ່າຍອອກ)`}
            {recTab === 'restock' && `ສິນຄ້າຂາຍດີແຕ່ຄົງເຫຼືອຈະໝົດພາຍໃນ 7 ວັນ (ຫຼືຕ່ຳກວ່າ minimum stock) — ຄິດຈາກຍອດອອກ 30 ວັນຫຼ້າສຸດ, ແນະນຳສັ່ງໃຫ້ພໍ 30 ວັນ`}
            {recTab === 'overstock' && `ສິນຄ້າໝູນວຽນຊ້າ: stock ທີ່ມີພໍຂາຍໄດ້ເກີນ 90 ວັນ — ບໍ່ຄວນສັ່ງເພີ່ມ`}
            {recTab === 'dead' && `ສິນຄ້າມີ stock ແຕ່ບໍ່ມີການຈ່າຍອອກເລີຍໃນ 90 ວັນຫຼ້າສຸດ`}
          </p>
          {recTab === 'moves' && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                placeholder="ຄົ້ນຫາລະຫັດ / ຊື່ສິນຄ້າ..."
                className="h-8 w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-[12px] text-slate-700 outline-none focus:border-[#2E6AB3]"
              />
            </div>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          {(recTab === 'moves' ? loading : recsLoading) && (
            <div className="py-6 text-center text-sm text-slate-400">ກຳລັງໂຫຼດ...</div>
          )}

          {!loading && recTab === 'moves' && (
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3 font-semibold">ສິນຄ້າ</th>
                  <th className="pb-2 pr-3 font-semibold">ຫົວໜ່ວຍ</th>
                  <th className="pb-2 pr-3 text-right font-semibold">ຮັບເຂົ້າ</th>
                  <th className="pb-2 pr-3 text-right font-semibold">ຈ່າຍອອກ</th>
                  <th className="pb-2 pr-3 text-right font-semibold">ສຸດທິ</th>
                  <th className="pb-2 pr-3 text-right font-semibold">ເອກະສານ</th>
                  <th className="pb-2 text-right font-semibold">ຄົງເຫຼືອ</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it) => (
                  <tr key={it.item_code} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="py-1.5 pr-3">
                      <div className="font-semibold text-slate-800">{it.item_name}</div>
                      <div className="text-[11px] text-slate-400">{it.item_code}</div>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-500">{it.unit}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-emerald-700">{it.qty_in ? fmtQty(it.qty_in) : '—'}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-blue-700">{it.qty_out ? fmtQty(it.qty_out) : '—'}</td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums font-bold ${it.net >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                      {it.net >= 0 ? '+' : ''}{fmtQty(it.net)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">{fmt(it.docs)}</td>
                    <td className="py-1.5 text-right tabular-nums font-bold text-slate-900">
                      {it.balance_qty == null ? '—' : fmtQty(it.balance_qty)}
                    </td>
                  </tr>
                ))}
                {!filteredItems.length && (
                  <tr><td colSpan={7} className="py-6 text-center text-sm text-slate-400">ບໍ່ພົບລາຍການ</td></tr>
                )}
              </tbody>
            </table>
          )}

          {!recsLoading && recTab === 'restock' && (
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3 font-semibold">ສິນຄ້າ</th>
                  <th className="pb-2 pr-3 text-right font-semibold">ຄົງເຫຼືອ</th>
                  <th className="pb-2 pr-3 text-right font-semibold">ອອກ 30 ວັນ</th>
                  <th className="pb-2 pr-3 text-right font-semibold">ພໍໃຊ້ (ວັນ)</th>
                  <th className="pb-2 text-right font-semibold">ແນະນຳສັ່ງ</th>
                </tr>
              </thead>
              <tbody>
                {(recs?.restock || []).map((r) => (
                  <tr key={r.ic_code} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="py-1.5 pr-3">
                      <div className="font-semibold text-slate-800">{r.item_name}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        {r.ic_code}
                        {r.below_min && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                            <AlertTriangle size={9} /> ຕ່ຳກວ່າ min ({fmtQty(r.min_qty)})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 pr-3 text-right font-bold tabular-nums text-slate-900">{fmtQty(r.balance_qty)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-600">{fmtQty(r.out_30d)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-rose-600">{r.days_left}</td>
                    <td className="py-1.5 text-right font-black tabular-nums text-emerald-700">+{fmtQty(r.suggest_qty)}</td>
                  </tr>
                ))}
                {!recs?.restock?.length && (
                  <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-400">ບໍ່ມີສິນຄ້າຕ້ອງເຕີມໃນຕອນນີ້ 🎉</td></tr>
                )}
              </tbody>
            </table>
          )}

          {!recsLoading && recTab === 'overstock' && (
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3 font-semibold">ສິນຄ້າ</th>
                  <th className="pb-2 pr-3 text-right font-semibold">ຄົງເຫຼືອ</th>
                  <th className="pb-2 pr-3 text-right font-semibold">ອອກ 90 ວັນ</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Stock ພໍ (ວັນ)</th>
                  <th className="pb-2 text-right font-semibold">ມູນຄ່າຈົມ (₭)</th>
                </tr>
              </thead>
              <tbody>
                {(recs?.overstock || []).map((r) => (
                  <tr key={r.ic_code} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="py-1.5 pr-3">
                      <div className="font-semibold text-slate-800">{r.item_name}</div>
                      <div className="text-[11px] text-slate-400">{r.ic_code}</div>
                    </td>
                    <td className="py-1.5 pr-3 text-right font-bold tabular-nums text-slate-900">{fmtQty(r.balance_qty)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-600">{fmtQty(r.out_90d)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-amber-600">{fmt(r.days_of_stock)}</td>
                    <td className="py-1.5 text-right font-bold tabular-nums text-slate-900">{fmt(r.stock_value)}</td>
                  </tr>
                ))}
                {!recs?.overstock?.length && (
                  <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-400">ບໍ່ມີສິນຄ້າ stock ເກີນ</td></tr>
                )}
              </tbody>
            </table>
          )}

          {!recsLoading && recTab === 'dead' && (
            <table className="w-full min-w-[560px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3 font-semibold">ສິນຄ້າ</th>
                  <th className="pb-2 pr-3 text-right font-semibold">ຄົງເຫຼືອ</th>
                  <th className="pb-2 pr-3 text-right font-semibold">ຈ່າຍອອກຫຼ້າສຸດ</th>
                  <th className="pb-2 text-right font-semibold">ມູນຄ່າຈົມ (₭)</th>
                </tr>
              </thead>
              <tbody>
                {(recs?.dead || []).map((r) => (
                  <tr key={r.ic_code} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="py-1.5 pr-3">
                      <div className="font-semibold text-slate-800">{r.item_name}</div>
                      <div className="text-[11px] text-slate-400">{r.ic_code}</div>
                    </td>
                    <td className="py-1.5 pr-3 text-right font-bold tabular-nums text-slate-900">{fmtQty(r.balance_qty)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">{r.last_move || 'ເກີນ 1 ປີ'}</td>
                    <td className="py-1.5 text-right font-bold tabular-nums text-slate-900">{fmt(r.stock_value)}</td>
                  </tr>
                ))}
                {!recs?.dead?.length && (
                  <tr><td colSpan={4} className="py-6 text-center text-sm text-slate-400">ບໍ່ມີສິນຄ້າຄ້າງ stock</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      </>)}

      {/* All stock on hand */}
      {mainTab === 'onhand' && (
      <section className="stock-panel rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Stock ຄົງເຫຼືອທັງໝົດ</h2>
            <p className="mt-0.5 text-xs text-slate-400">ສິນຄ້າທີ່ມີຄົງເຫຼືອໃນສາງ 1105 ທັງສາງ, ຮຽງຕາມມູນຄ່າ</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={onHandQuery}
                onChange={(e) => setOnHandQuery(e.target.value)}
                placeholder="ຄົ້ນຫາລະຫັດ / ຊື່ສິນຄ້າ..."
                className="h-8 w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-[12px] text-slate-700 outline-none focus:border-[#2E6AB3]"
              />
            </div>
            <button
              onClick={exportOnHandCsv}
              disabled={!onHand?.items?.length}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              <Download size={14} />
              CSV
            </button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          {[
            { label: 'ລາຍການ (SKU)', value: fmt(onHand?.summary?.sku_count) },
            { label: 'ຈຳນວນລວມ', value: fmtQty(onHand?.summary?.total_qty) },
            { label: 'ມູນຄ່າລວມ (₭)', value: fmt(onHand?.summary?.total_value) },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</div>
              <div className="mt-0.5 text-lg font-black tabular-nums text-slate-900">{c.value}</div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="pb-2 pr-3 font-semibold">ສິນຄ້າ</th>
                <th className="pb-2 pr-3 font-semibold">ຫົວໜ່ວຍ</th>
                <th className="pb-2 pr-3 text-right font-semibold">ຄົງເຫຼືອ</th>
                <th className="pb-2 pr-3 text-right font-semibold">ຕົ້ນທຶນ/ໜ່ວຍ</th>
                <th className="pb-2 text-right font-semibold">ມູນຄ່າ (₭)</th>
              </tr>
            </thead>
            <tbody>
              {!onHand && (
                <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
              )}
              {onHand && filteredOnHand.slice(0, onHandLimit).map((it) => (
                <tr key={it.ic_code} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="py-1.5 pr-3">
                    <div className="font-semibold text-slate-800">{it.item_name}</div>
                    <div className="text-[11px] text-slate-400">{it.ic_code}</div>
                  </td>
                  <td className="py-1.5 pr-3 text-slate-500">{it.unit}</td>
                  <td className={`py-1.5 pr-3 text-right tabular-nums font-bold ${it.balance_qty < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {fmtQty(it.balance_qty)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">{fmt(Math.round(it.avg_cost))}</td>
                  <td className="py-1.5 text-right tabular-nums font-bold text-slate-900">{fmt(it.stock_value)}</td>
                </tr>
              ))}
              {onHand && !filteredOnHand.length && (
                <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-400">ບໍ່ພົບລາຍການ</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {onHand && filteredOnHand.length > onHandLimit && (
          <button
            onClick={() => setOnHandLimit((n) => n + 200)}
            className="mt-3 h-9 w-full rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            ສະແດງເພີ່ມ ({fmt(filteredOnHand.length - onHandLimit)} ລາຍການ)
          </button>
        )}
      </section>
      )}
    </div>
  )
}
