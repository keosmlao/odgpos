"use client";
// @ts-nocheck

import { useEffect, useMemo, useState } from 'react'
import { Bell, Save, Trash2, Users } from 'lucide-react'
import Select from 'react-select'
import {
  getLineRecipientsAction,
  getStaffLineUsersAction,
  createLineRecipientAction,
  updateLineRecipientAction,
  deleteLineRecipientAction,
} from '@/app/_actions/line'

const emptyForm = { staff_code: '', name: '', line_user_id: '', active: true, notify_customer: false }

const LineRecipients = () => {
  const [recipients, setRecipients] = useState([])
  const [staffOptions, setStaffOptions] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchRecipients = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getLineRecipientsAction()
      const data = res?.data || res || []
      setRecipients(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err?.message || 'ດຶງຂໍ້ມູນບໍ່ສຳເລັດ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecipients()
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      const res = await getStaffLineUsersAction()
      const data = res?.data || res || []
      setStaffOptions(Array.isArray(data) ? data : [])
    } catch {
      setStaffOptions([])
    }
  }

  const staffSelectOptions = useMemo(
    () =>
      staffOptions.map((s) => ({
        value: s.code,
        label: `${s.code} - ${s.name_1 || s.name || ''}${s.line_id ? ` (LINE: ${s.line_id})` : ''}`,
        name: s.name_1 || s.name || '',
        line_id: s.line_id || '',
      })),
    [staffOptions],
  )

  const selectedStaffOption = useMemo(
    () => staffSelectOptions.find((opt) => String(opt.value) === String(form.staff_code)) || null,
    [staffSelectOptions, form.staff_code],
  )

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.staff_code || !form.line_user_id.trim()) {
      setError('ກະລຸນາເລືອກພະນັກງານ ແລະ Line User ID')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editingId) {
        await updateLineRecipientAction(editingId, { ...form, recipient_type: 'staff' })
      } else {
        await createLineRecipientAction({ ...form, recipient_type: 'staff' })
      }
      setForm(emptyForm)
      setEditingId(null)
      fetchRecipients()
    } catch (err) {
      setError(err?.message || 'ບັນທຶກບໍ່ສຳເລັດ')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (r) => {
    setEditingId(r.id)
    setForm({
      staff_code: r.staff_code || '',
      name: r.name || '',
      line_user_id: r.line_user_id || '',
      active: !!r.active,
      notify_customer: !!r.notify_customer,
    })
  }

  const handleDelete = async (id) => {
    setSaving(true)
    setError('')
    try {
      await deleteLineRecipientAction(id)
      if (editingId === id) { setEditingId(null); setForm(emptyForm) }
      fetchRecipients()
    } catch (err) {
      setError(err?.message || 'ລຶບບໍ່ສຳເລັດ')
    } finally {
      setSaving(false)
    }
  }

  const activeCount = recipients.filter((r) => r.active).length

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Notifications</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">LINE ແຈ້ງເຕືອນ</h1>
        <p className="mt-1 text-sm text-slate-500">ກຳນົດຜູ້ຮັບແຈ້ງເຕືອນ ແລະ ຄວບຄຸມການສົ່ງໄປຫາລູກຄ້າ</p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {recipients.length} ຜູ້ຮັບ
          </span>
          <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            {activeCount} active
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900">
            {editingId ? 'ແກ້ໄຂຜູ້ຮັບ' : 'ເພີ່ມຜູ້ຮັບໃໝ່'}
          </h2>

          <div className="mt-4 grid gap-4">
            {/* Staff select */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ພະນັກງານ</label>
              <div className="mt-1.5">
                <Select
                  classNamePrefix="pos-select"
                  options={staffSelectOptions}
                  value={selectedStaffOption}
                  onChange={(opt) => {
                    const chosen = opt || null
                    setForm((prev) => ({
                      ...prev,
                      staff_code: chosen?.value || '',
                      name: chosen?.name || prev.name,
                      line_user_id: chosen?.line_id || prev.line_user_id,
                    }))
                  }}
                  isClearable
                  placeholder="ຄົ້ນຫາພະນັກງານ..."
                  styles={{
                    control: (base) => ({ ...base, minHeight: 40, borderRadius: 8, borderColor: '#e2e8f0', fontSize: 13 }),
                    menu: (base) => ({ ...base, borderRadius: 8, fontSize: 13 }),
                  }}
                />
              </div>
            </div>

            {/* Line User ID */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Line User ID</label>
              <input
                value={form.line_user_id}
                onChange={(e) => handleChange('line_user_id', e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>

            {/* Toggles */}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => handleChange('active', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                ເປີດໃຊ້ງານ
              </label>
              <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={form.notify_customer}
                  onChange={(e) => handleChange('notify_customer', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                ແຈ້ງເຕືອນລູກຄ້າ
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <Save size={15} />
            {editingId ? 'ບັນທຶກ' : 'ເພີ່ມຜູ້ຮັບ'}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setForm(emptyForm) }}
              className="mt-2 w-full text-center text-[12px] font-medium text-slate-400 hover:text-slate-600"
            >
              ຍົກເລີກການແກ້ໄຂ
            </button>
          )}
        </form>

        {/* Recipients list */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">ລາຍການຜູ້ຮັບ</h2>
            </div>
            <span className="text-[11px] font-medium text-slate-400">{recipients.length} ຄົນ</span>
          </div>

          {loading && <div className="py-8 text-center text-sm text-slate-400">ກຳລັງໂຫຼດ...</div>}

          {!loading && recipients.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
              ຍັງບໍ່ມີຜູ້ຮັບ
            </div>
          )}

          {!loading && recipients.length > 0 && (
            <div className="space-y-1.5">
              {recipients.map((r) => (
                <div
                  key={r.id}
                  className={`group flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer hover:bg-slate-50 ${
                    editingId === r.id ? 'border-blue-300 bg-blue-50/50' : 'border-slate-100'
                  }`}
                  onClick={() => startEdit(r)}
                >
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900 truncate">{r.name}</div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {r.staff_code || '-'} · {r.line_user_id ? `${r.line_user_id.slice(0, 12)}...` : '-'}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${r.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {r.notify_customer && (
                      <Bell size={12} className="text-blue-500" />
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(r.id) }}
                    className="p-1.5 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LineRecipients
