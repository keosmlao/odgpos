"use client";
// @ts-nocheck

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bell, PackageMinus, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import {
  deleteMinimumStockAction,
  listMinimumStockAction,
  notifyMinimumStockAction,
  upsertMinimumStockAction,
} from '@/app/_actions/minimum-stock'
import { searchProductsAction } from '@/app/_actions/products'

const BRAND = '#2E6AB3'
const WH = '1105'
const LOC = '110501'
const fmt = (n) => (Number(n) || 0).toLocaleString()

export default function MinimumStockPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [lowOnly, setLowOnly] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState({})

  // add form
  const [searchText, setSearchText] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [newMin, setNewMin] = useState('')
  const searchTimer = useRef(null)

  const load = useCallback(async (low) => {
    setLoading(true)
    setError('')
    try {
      const data = await listMinimumStockAction('', { lowOnly: low, includeInactive: true, wh_code: WH, location_code: LOC })
      setRows(Array.isArray(data) ? data : [])
      setDrafts({})
    } catch (exc) {
      console.error(exc)
      setError('ດຶງຂໍ້ມູນບໍ່ສຳເລັດ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(lowOnly) }, [lowOnly, load])

  const runSearch = (text) => {
    setSearchText(text)
    setSelected(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!text.trim()) { setResults([]); return }
    searchTimer.current = setTimeout(async () => {
      try {
        const found = await searchProductsAction(text.trim(), { include_stock: false })
        setResults(Array.isArray(found) ? found.slice(0, 8) : [])
      } catch { setResults([]) }
    }, 300)
  }

  const showNotice = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 3000) }

  const addRule = async () => {
    if (!selected) return
    const minQty = Number(String(newMin).replace(/,/g, ''))
    if (!isFinite(minQty) || minQty < 0) { setError('ໃສ່ຈຳນວນຂັ້ນຕ່ຳ'); return }
    setSaving(true)
    setError('')
    try {
      await upsertMinimumStockAction({ ic_code: selected.item_code || selected.ic_code, wh_code: WH, location_code: LOC, min_qty: minQty, active: true })
      setSearchText(''); setResults([]); setSelected(null); setNewMin('')
      showNotice('ເພີ່ມແລ້ວ ✓')
      await load(lowOnly)
    } catch (exc) {
      console.error(exc)
      setError('ບັນທຶກບໍ່ສຳເລັດ')
    } finally {
      setSaving(false)
    }
  }

  const saveRow = async (row, minQtyValue = undefined, active = undefined) => {
    setSaving(true)
    setError('')
    try {
      await upsertMinimumStockAction({
        ic_code: row.ic_code, wh_code: row.wh_code || WH, location_code: row.location_code || LOC,
        min_qty: Number(String(minQtyValue ?? row.min_qty).replace(/,/g, '')) || 0,
        note: row.note || '', active: active ?? row.active,
      })
      showNotice('ບັນທຶກແລ້ວ ✓')
      await load(lowOnly)
    } catch (exc) {
      console.error(exc)
      setError('ບັນທຶກບໍ່ສຳເລັດ')
    } finally {
      setSaving(false)
    }
  }

  const removeRow = async (row) => {
    setSaving(true)
    try {
      await deleteMinimumStockAction(row.id)
      await load(lowOnly)
    } catch (exc) {
      console.error(exc)
      setError('ລຶບບໍ່ສຳເລັດ')
    } finally {
      setSaving(false)
    }
  }

  const sendNotify = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await notifyMinimumStockAction({ wh_code: WH, location_code: LOC })
      showNotice(res?.items ? `ສົ່ງແຈ້ງເຕືອນແລ້ວ (${res.items} ລາຍການ → ${res.sent} ຄົນ)` : 'ບໍ່ມີລາຍການຕ່ຳກວ່າຂັ້ນຕ່ຳ')
    } catch (exc) {
      console.error(exc)
      setError(String(exc?.message || 'ສົ່ງແຈ້ງເຕືອນບໍ່ສຳເລັດ'))
    } finally {
      setSaving(false)
    }
  }

  const lowCount = rows.filter((r) => r.active && Number(r.balance_qty || 0) <= Number(r.min_qty || 0)).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: BRAND }}>
              <PackageMinus size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">Minimum Stock</h1>
              <p className="mt-1 text-sm text-slate-500">ກຳນົດຈຳນວນຂັ້ນຕ່ຳຕໍ່ສິນຄ້າ ສາງ {WH} — ຕ່ຳກວ່າກຳນົດຈະຂຶ້ນໃນ "ຕ້ອງເຕີມ Stock" ແລະແຈ້ງ LINE ໄດ້</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-bold text-slate-600">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              ສະເພາະຕ່ຳກວ່າຂັ້ນຕ່ຳ
            </label>
            <button
              onClick={sendNotify}
              disabled={saving}
              className="flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: BRAND }}
            >
              <Bell size={15} />
              ແຈ້ງເຕືອນ LINE
            </button>
            <button
              onClick={() => load(lowOnly)}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{notice}</div>}

      {/* Add rule */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-black text-slate-800">ເພີ່ມສິນຄ້າ</h2>
        <div className="flex flex-wrap items-start gap-2">
          <div className="relative min-w-[280px] flex-1">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              value={selected ? `${selected.item_code || selected.ic_code} - ${selected.item_name}` : searchText}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="ຄົ້ນຫາລະຫັດ / ຊື່ສິນຄ້າ..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-[13px] text-slate-700 outline-none focus:border-[#2E6AB3]"
            />
            {!selected && results.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {results.map((r) => (
                  <button
                    key={r.item_code || r.ic_code}
                    onClick={() => { setSelected(r); setResults([]) }}
                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-slate-50"
                  >
                    <span className="font-semibold text-slate-800">{r.item_name}</span>
                    <span className="ml-2 text-[11px] text-slate-400">{r.item_code || r.ic_code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            value={newMin}
            onChange={(e) => setNewMin(e.target.value)}
            placeholder="ຈຳນວນຂັ້ນຕ່ຳ"
            inputMode="numeric"
            className="h-10 w-36 rounded-xl border border-slate-200 bg-white px-3 text-right text-[13px] tabular-nums text-slate-800 outline-none focus:border-[#2E6AB3]"
          />
          <button
            onClick={addRule}
            disabled={!selected || saving}
            className="flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: BRAND }}
          >
            <Plus size={15} />
            ເພີ່ມ
          </button>
        </div>
      </section>

      {/* Rules table */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-800">ລາຍການທັງໝົດ ({fmt(rows.length)})</h2>
          {lowCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600">
              <AlertTriangle size={11} /> ຕ່ຳກວ່າຂັ້ນຕ່ຳ {fmt(lowCount)} ລາຍການ
            </span>
          )}
        </div>
        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
        ) : !rows.length ? (
          <div className="py-12 text-center text-sm text-slate-400">ຍັງບໍ່ມີລາຍການ — ເພີ່ມສິນຄ້າດ້ານເທິງ</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 pr-3">ສິນຄ້າ</th>
                  <th className="py-2.5 pr-3 text-right">ຄົງເຫຼືອ</th>
                  <th className="py-2.5 pr-3 text-right">ຂັ້ນຕ່ຳ</th>
                  <th className="py-2.5 pr-3 text-center">ເປີດໃຊ້</th>
                  <th className="py-2.5 text-right">ຈັດການ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const low = r.active && Number(r.balance_qty || 0) <= Number(r.min_qty || 0)
                  const draft = drafts[r.id]
                  return (
                    <tr key={r.id} className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${low ? 'bg-rose-50/40' : ''}`}>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          {low && <AlertTriangle size={12} className="text-rose-500" />}
                          {r.item_name || r.ic_code}
                        </div>
                        <div className="text-[11px] text-slate-400">{r.ic_code}</div>
                      </td>
                      <td className={`py-2.5 pr-3 text-right font-bold tabular-nums ${low ? 'text-rose-600' : 'text-slate-900'}`}>
                        {fmt(r.balance_qty)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <input
                          value={draft ?? String(r.min_qty ?? '')}
                          onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveRow(r, e.currentTarget.value) }}
                          inputMode="numeric"
                          className="h-8 w-24 rounded-lg border border-slate-200 bg-white px-2 text-right text-[13px] tabular-nums text-slate-800 outline-none focus:border-[#2E6AB3]"
                        />
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!r.active}
                          onChange={(e) => saveRow(r, drafts[r.id], e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => saveRow(r, drafts[r.id])}
                            disabled={saving || drafts[r.id] == null}
                            className="h-8 rounded-lg px-2.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                            style={{ backgroundColor: BRAND }}
                          >
                            ບັນທຶກ
                          </button>
                          <button
                            onClick={() => removeRow(r)}
                            disabled={saving}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
