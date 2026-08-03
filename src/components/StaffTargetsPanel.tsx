"use client";
// @ts-nocheck

import { useCallback, useEffect, useState } from 'react'
import { Award } from 'lucide-react'
import {
  deleteStaffTargetAction,
  getStaffTargetsAction,
  upsertStaffTargetAction,
} from '@/app/_actions/staff-targets'

const BRAND = '#2E6AB3'
const SERIES_1 = '#2a78d6'
const SERIES_2 = '#1baf7a'

const fmt = (n) => (Number(n) || 0).toLocaleString()
const fmtThb = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Monthly per-staff sales targets in THB (฿); actual ₭ sales convert at the fx rate. */
const StaffTargetsPanel = () => {
  const [month, setMonth] = useState(currentMonth)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState({})
  const [savingCode, setSavingCode] = useState('')
  const [addCode, setAddCode] = useState('')
  const [rateDraft, setRateDraft] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async (m, rateOverride = undefined) => {
    setLoading(true)
    setError('')
    try {
      const res = await getStaffTargetsAction(m, rateOverride || undefined)
      setData(res)
      setDrafts({})
      setRateDraft(res?.rate ? String(res.rate) : '')
    } catch (exc) {
      console.error(exc)
      setError('ດຶງຂໍ້ມູນເປົ້າຂາຍບໍ່ສຳເລັດ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(month) }, [month, load])

  const applyRate = () => {
    const r = Number(String(rateDraft).replace(/,/g, ''))
    if (isFinite(r) && r > 0) load(month, r)
  }

  const saveTarget = async (staffCode, value) => {
    const target = Number(String(value ?? '').replace(/,/g, ''))
    if (!isFinite(target) || target < 0) return
    setSavingCode(staffCode)
    setError('')
    try {
      await upsertStaffTargetAction({ staff_code: staffCode, month, target_amount: target })
      await load(month, Number(rateDraft) || undefined)
    } catch (exc) {
      console.error(exc)
      setError('ບັນທຶກເປົ້າບໍ່ສຳເລັດ')
    } finally {
      setSavingCode('')
    }
  }

  const removeTarget = async (staffCode) => {
    setSavingCode(staffCode)
    try {
      await deleteStaffTargetAction(staffCode, month)
      await load(month, Number(rateDraft) || undefined)
    } catch (exc) {
      console.error(exc)
      setError('ລຶບເປົ້າບໍ່ສຳເລັດ')
    } finally {
      setSavingCode('')
    }
  }

  const rows = data?.rows || []
  const rate = data?.rate
  const listedCodes = new Set(rows.map((r) => r.staff_code))
  const addOptions = (data?.staffOptions || []).filter((s) => !listedCodes.has(s.code))
  const totalTarget = rows.reduce((s, r) => s + r.target_amount, 0)
  const totalActualThb = rows.reduce((s, r) => s + r.actual_thb, 0)
  const totalActualLak = rows.reduce((s, r) => s + r.actual_amount, 0)

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award size={17} className="text-[#2E6AB3]" />
          <h3 className="text-sm font-black text-slate-800">ເປົ້າຂາຍພະນັກງານປະຈຳເດືອນ (฿)</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-700 outline-none focus:border-[#2E6AB3]"
          />
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5">
            <span className="text-[11px] font-semibold text-slate-400">ເລດ ₭/฿</span>
            <input
              value={rateDraft}
              onChange={(e) => setRateDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyRate() }}
              onBlur={applyRate}
              placeholder="520"
              inputMode="decimal"
              className="h-9 w-16 bg-transparent text-right text-[13px] font-bold tabular-nums text-slate-800 outline-none"
            />
          </div>
          <select
            value={addCode}
            onChange={(e) => setAddCode(e.target.value)}
            className="h-9 max-w-[220px] rounded-xl border border-slate-200 bg-white px-2 text-[13px] font-medium text-slate-700 outline-none focus:border-[#2E6AB3]"
          >
            <option value="">+ ເພີ່ມພະນັກງານ...</option>
            {addOptions.map((s) => (
              <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
            ))}
          </select>
          <button
            onClick={() => { if (addCode) { saveTarget(addCode, 0); setAddCode('') } }}
            disabled={!addCode || !!savingCode}
            className="h-9 rounded-xl px-3.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: BRAND }}
          >
            ເພີ່ມ
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</div>
      )}
      {!rate && !loading && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
          ຍັງບໍ່ມີເລດ ₭/฿ ໃນລະບົບ — ໃສ່ເລດໃນຊ່ອງດ້ານເທິງເພື່ອຄິດ % ບັນລຸ
        </div>
      )}

      {/* Month totals */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'ເປົ້າລວມ (฿)', value: fmtThb(totalTarget) },
          { label: 'ຍອດຂາຍຈິງ (฿)', value: rate ? fmtThb(totalActualThb) : '—' },
          { label: 'ຍອດຂາຍຈິງ (₭)', value: fmt(totalActualLak) },
          { label: 'ບັນລຸ', value: totalTarget > 0 && rate ? `${Math.round((totalActualThb / totalTarget) * 100)}%` : '—' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</div>
            <div className="mt-0.5 text-lg font-black tabular-nums text-slate-900">{c.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : !rows.length ? (
        <div className="py-10 text-center text-sm text-slate-400">ຍັງບໍ່ມີເປົ້າ ຫຼື ຍອດຂາຍໃນເດືອນນີ້ — ເພີ່ມພະນັກງານດ້ານເທິງ</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 pr-3">ພະນັກງານ</th>
                <th className="py-2.5 pr-3 text-right">ເປົ້າ (฿)</th>
                <th className="py-2.5 pr-3 text-right">ຍອດຈິງ (฿)</th>
                <th className="py-2.5 pr-3 text-right">ຍອດຈິງ (₭)</th>
                <th className="py-2.5 pr-3 text-center">ບິນ</th>
                <th className="py-2.5 pr-3 w-[200px]">ຄວາມຄືບໜ້າ</th>
                <th className="py-2.5 text-right">ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const draft = drafts[r.staff_code]
                const hasTarget = r.target_amount > 0
                const pctCapped = Math.min(r.pct, 100)
                const achieved = hasTarget && r.pct >= 100
                return (
                  <tr key={r.staff_code} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-800">{r.staff_name}</div>
                      <div className="text-[11px] text-slate-400">#{r.staff_code}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <input
                        value={draft ?? (r.target_amount ? String(r.target_amount) : '')}
                        onChange={(e) => setDrafts((p) => ({ ...p, [r.staff_code]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveTarget(r.staff_code, e.currentTarget.value) }}
                        placeholder="0"
                        inputMode="numeric"
                        className="h-8 w-28 rounded-lg border border-slate-200 bg-white px-2 text-right text-[13px] tabular-nums text-slate-800 outline-none focus:border-[#2E6AB3]"
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-slate-900">
                      {rate ? fmtThb(r.actual_thb) : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-500">{fmt(r.actual_amount)}</td>
                    <td className="py-2.5 pr-3 text-center tabular-nums text-slate-500">{fmt(r.bills)}</td>
                    <td className="py-2.5 pr-3">
                      {hasTarget && rate ? (
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.max(pctCapped, 2)}%`, backgroundColor: achieved ? SERIES_2 : SERIES_1 }}
                            />
                          </div>
                          <span className={`w-14 text-right text-[12px] font-black tabular-nums ${achieved ? 'text-emerald-600' : 'text-slate-700'}`}>
                            {r.pct}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-slate-400">{hasTarget ? 'ບໍ່ມີເລດ' : 'ບໍ່ໄດ້ຕັ້ງເປົ້າ'}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => saveTarget(r.staff_code, draft ?? r.target_amount)}
                          disabled={savingCode === r.staff_code || draft == null}
                          className="h-8 rounded-lg px-2.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                          style={{ backgroundColor: BRAND }}
                        >
                          ບັນທຶກ
                        </button>
                        {hasTarget && (
                          <button
                            onClick={() => removeTarget(r.staff_code)}
                            disabled={savingCode === r.staff_code}
                            className="h-8 rounded-lg border border-slate-200 px-2.5 text-[12px] font-bold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                          >
                            ລຶບເປົ້າ
                          </button>
                        )}
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
  )
}

export default StaffTargetsPanel
