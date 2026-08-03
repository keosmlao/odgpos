"use client";
// @ts-nocheck

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Link2, RefreshCw, Search, Wrench } from 'lucide-react'
import { getSparePartsAction } from '@/app/_actions/spare-parts'

const BRAND = '#0F766E'
const fmt = (n) => (Number(n) || 0).toLocaleString()
const fmtQty = (n) => {
  const v = Number(n) || 0
  return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function SparePartsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [inStockOnly, setInStockOnly] = useState(true)
  const [page, setPage] = useState(1)
  const searchTimer = useRef(null)

  const load = useCallback(async (q, stockOnly, p) => {
    setLoading(true)
    setError('')
    try {
      const res = await getSparePartsAction(q, { in_stock_only: stockOnly, page: p, per_page: 50 })
      setData(res)
    } catch (exc) {
      console.error(exc)
      setError('ດຶງຂໍ້ມູນບໍ່ສຳເລັດ — ລອງໃໝ່ອີກຄັ້ງ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(query, inStockOnly, page) }, [inStockOnly, page, load]) // eslint-disable-line

  const onSearch = (text) => {
    setQuery(text)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setPage(1); load(text, inStockOnly, 1) }, 350)
  }

  const totalPages = data ? Math.max(Math.ceil(data.total / data.per_page), 1) : 1

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: BRAND }}>
              <Wrench size={17} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900">ລາຍການສິນຄ້າອາໄຫຼ່</h1>
              <p className="mt-0.5 text-[13px] text-slate-500">
                ຍອດຄົງເຫຼືອສາງ 1105, ລາຄາຂາຍ ແລະ ໃຊ້ກັບສິນຄ້າຕົວໃດ {data ? `· ${fmt(data.total)} ລາຍການ` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="ຄົ້ນຫາລະຫັດ / ຊື່ / ບາໂຄດ..."
                className="h-8 w-64 rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-[12px] text-slate-700 outline-none focus:border-teal-500"
              />
            </div>
            <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-bold text-slate-600">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => { setInStockOnly(e.target.checked); setPage(1) }}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              ມີຄົງເຫຼືອເທົ່ານັ້ນ
            </label>
            <button
              onClick={() => load(query, inStockOnly, page)}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

      {/* Table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="pb-2 pr-3 font-semibold">ສິນຄ້າອາໄຫຼ່</th>
                <th className="pb-2 pr-3 font-semibold">ໃຊ້ກັບສິນຄ້າ</th>
                <th className="pb-2 pr-3 text-right font-semibold">ຄົງເຫຼືອ</th>
                <th className="pb-2 pr-3 text-right font-semibold">ລາຄາຂາຍ (₭)</th>
                <th className="pb-2 text-right font-semibold">ມູນຄ່າ stock (₭)</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
              )}
              {!loading && (data?.items || []).map((it) => (
                <tr key={it.ic_code} className="border-b border-slate-50 align-top hover:bg-slate-50/60">
                  <td className="py-2 pr-3">
                    <div className="font-semibold text-slate-800">{it.item_name}</div>
                    <div className="text-[11px] text-slate-400">
                      {it.ic_code}{it.brand ? ` · ${it.brand}` : ''}{it.group_name ? ` · ${it.group_name}` : ''}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    {it.used_with?.length ? (
                      <div className="space-y-0.5">
                        {it.used_with.slice(0, 4).map((u) => (
                          <div key={u.code} className="flex items-start gap-1 text-[11.5px] text-slate-600">
                            <Link2 size={10} className="mt-0.5 shrink-0 text-teal-500" />
                            <span>{u.name} <span className="text-slate-400">({u.code})</span></span>
                          </div>
                        ))}
                        {it.used_with.length > 4 && (
                          <div className="text-[11px] text-slate-400">+ ອີກ {it.used_with.length - 4} ລຸ້ນ</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-300">— ຍັງບໍ່ໄດ້ຜູກ</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums font-bold text-slate-900">
                    {fmtQty(it.balance_qty)} <span className="text-[10px] font-medium text-slate-400">{it.unit}</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold text-slate-800">
                    {it.sale_price ? fmt(it.sale_price) : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{fmt(it.stock_value)}</td>
                </tr>
              ))}
              {!loading && !data?.items?.length && (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">ບໍ່ພົບລາຍການ</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[11px] text-slate-400">
              ໜ້າ {data.page}/{fmt(totalPages)} · ທັງໝົດ {fmt(data.total)} ລາຍການ
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={loading || page <= 1}
                className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={13} /> ກ່ອນໜ້າ
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={loading || page >= totalPages}
                className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                ຕໍ່ໄປ <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
