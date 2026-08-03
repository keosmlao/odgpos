"use client";
// @ts-nocheck

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Banknote, Bell, RefreshCw } from 'lucide-react'
import { getFxRatesAction, setFxRateAction } from '@/app/_actions/fx'

const BRAND = '#2E6AB3'
const fmt = (n) => (Number(n) || 0).toLocaleString()

export default function SettingsPage() {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [rateDraft, setRateDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getFxRatesAction(10)
      setRates(Array.isArray(rows) ? rows : [])
    } catch (exc) {
      console.error(exc)
      setError('ດຶງຂໍ້ມູນເລດບໍ່ສຳເລັດ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const saveRate = async () => {
    const rate = Number(String(rateDraft).replace(/,/g, ''))
    if (!isFinite(rate) || rate <= 0) { setError('ໃສ່ເລດເປັນຕົວເລກທີ່ຖືກຕ້ອງ'); return }
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await setFxRateAction(rate)
      setRateDraft('')
      setSaved(true)
      await load()
      setTimeout(() => setSaved(false), 3000)
    } catch (exc) {
      console.error(exc)
      setError('ບັນທຶກເລດບໍ່ສຳເລັດ')
    } finally {
      setSaving(false)
    }
  }

  const current = rates[0]

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Settings</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">ຕັ້ງຄ່າລະບົບ</h1>
        <p className="mt-1 text-sm text-slate-500">ເລດແລກປ່ຽນ ₭/฿ ແລະ ການແຈ້ງເຕືອນ</p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {/* FX rate */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Banknote size={17} className="text-[#2E6AB3]" />
            <h2 className="text-sm font-black text-slate-800">ເລດແລກປ່ຽນ ₭ ຕໍ່ ฿</h2>
          </div>

          <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ເລດປະຈຸບັນ</div>
            <div className="mt-0.5 text-2xl font-black tabular-nums text-slate-900">
              {current ? `${fmt(current.rate)} ₭/฿` : loading ? '...' : 'ຍັງບໍ່ມີ'}
            </div>
            {current && <div className="mt-0.5 text-[11px] text-slate-400">ອັບເດດ {String(current.created_at).slice(0, 16)} · {current.doc_no || '-'}</div>}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={rateDraft}
              onChange={(e) => setRateDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveRate() }}
              placeholder="ເຊັ່ນ 520"
              inputMode="decimal"
              className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm tabular-nums text-slate-800 outline-none focus:border-[#2E6AB3]"
            />
            <button
              onClick={saveRate}
              disabled={saving || !rateDraft.trim()}
              className="h-10 rounded-xl px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: BRAND }}
            >
              {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກເລດ'}
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          {saved && <div className="mt-2 text-[13px] font-semibold text-emerald-600">ບັນທຶກເລດແລ້ວ ✓</div>}

          <div className="mt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">ປະຫວັດ 10 ຄັ້ງຫຼ້າສຸດ</div>
            <div className="space-y-1">
              {rates.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 text-[13px]">
                  <span className="tabular-nums font-bold text-slate-800">{fmt(r.rate)} ₭/฿</span>
                  <span className="text-[11px] text-slate-400">{String(r.created_at).slice(0, 16)} · {r.doc_no || '-'}</span>
                </div>
              ))}
              {!loading && !rates.length && <div className="py-4 text-center text-sm text-slate-400">ຍັງບໍ່ມີປະຫວັດ</div>}
            </div>
          </div>
        </section>

        {/* Links */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-black text-slate-800">ການຕັ້ງຄ່າອື່ນໆ</h2>
          <Link
            href="/settings/line"
            className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
              <Bell size={16} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-bold text-slate-800">LINE ແຈ້ງເຕືອນ</div>
              <div className="text-[11px] text-slate-400">ຈັດການຜູ້ຮັບແຈ້ງເຕືອນ</div>
            </div>
            <ArrowRight size={15} className="text-slate-300" />
          </Link>
        </section>
      </div>
    </div>
  )
}
