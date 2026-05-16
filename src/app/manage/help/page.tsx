"use client";
// @ts-nocheck
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, HelpCircle, PencilLine } from 'lucide-react'
import { getHelpAction, saveHelpAction } from '@/app/_actions/help'

const FALLBACK_HELP = {
  title: 'ສູນຊ່ວຍເຫຼືອ POS',
  subtitle: 'ຄູ່ມືການໃຊ້ງານພື້ນຖານ ແລະ ຄຳແນະນຳດ່ວນ',
  sections: [
    {
      id: 'pos',
      title: 'ຂັ້ນຕອນຂາຍ (POS)',
      items: [
        'ເຂົ້າລະບົບດ້ວຍບັນຊີຂອງທ່ານ',
        'ເລືອກພະນັກງານຂາຍ ແລະ ລູກຄ້າ (ຖ້າມີ)',
      ],
    },
  ],
  contact: {
    label: 'ຕິດຕໍ່ຜູ້ດູແລລະບົບ',
    phone: '',
    line: '',
  },
}

const normalizeHelp = (payload) => {
  if (!payload || !Array.isArray(payload.sections)) {
    return FALLBACK_HELP
  }
  return {
    ...FALLBACK_HELP,
    ...payload,
    contact: { ...FALLBACK_HELP.contact, ...(payload.contact || {}) },
  }
}

const buildSection = (section, index) => ({
  id: section.id || `section-${index + 1}`,
  title: section.title || '',
  itemsText: Array.isArray(section.items) ? section.items.join('\n') : '',
})

const ManageHelp = () => {
  const [title, setTitle] = useState(FALLBACK_HELP.title)
  const [subtitle, setSubtitle] = useState(FALLBACK_HELP.subtitle)
  const [sections, setSections] = useState([buildSection(FALLBACK_HELP.sections[0], 0)])
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [newSectionItems, setNewSectionItems] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)

  const buildPayload = (sectionsOverride) => {
    const sourceSections = sectionsOverride || sections
    return {
      title: title.trim() || FALLBACK_HELP.title,
      subtitle: subtitle.trim() || FALLBACK_HELP.subtitle,
      sections: sourceSections.map((section, index) => ({
        id: section.id || `section-${index + 1}`,
        title: section.title.trim() || `Section ${index + 1}`,
        items: section.itemsText
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
      })),
      contact: { ...FALLBACK_HELP.contact },
    }
  }

  const persistHelp = async (sectionsOverride) => {
    setIsSaving(true)
    setStatus('')
    const payload = buildPayload(sectionsOverride)
    try {
      const response = await saveHelpAction(payload)
      setStatus('ບັນທຶກສຳເລັດ')
      const savedAt = response?.updated_at ? new Date(response.updated_at) : new Date()
      if (!Number.isNaN(savedAt.getTime())) {
        setLastSavedAt(savedAt.toLocaleString())
      }
    } catch (error) {
      setStatus('ບັນທຶກບໍ່ສຳເລັດ')
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    getHelpAction()
      .then((data) => {
        if (!isMounted) return
        const normalized = normalizeHelp(data)
        setTitle(normalized.title || FALLBACK_HELP.title)
        setSubtitle(normalized.subtitle || FALLBACK_HELP.subtitle)
        setSections(
          normalized.sections.length
            ? normalized.sections.map((section, index) => buildSection(section, index))
            : [buildSection(FALLBACK_HELP.sections[0], 0)]
        )
      })
      .catch(() => {
        setStatus('ບໍ່ສາມາດໂຫຼດຂໍ້ມູນໄດ້')
      })
    return () => {
      isMounted = false
    }
  }, [])

  const updateSectionInline = (index, patch) => {
    const next = sections.map((section, idx) => (idx === index ? { ...section, ...patch } : section))
    setSections(next)
    return next
  }

  const addSection = (titleValue, itemsValue) => {
    const next = [
      ...sections,
      {
        id: `section-${Date.now()}`,
        title: titleValue || '',
        itemsText: itemsValue || '',
      },
    ]
    setSections(next)
    return next
  }

  const removeSection = (index) => {
    const next = sections.filter((_, idx) => idx !== index)
    setSections(next)
    return next
  }

  const handleAddSection = async () => {
    const nextTitle = newSectionTitle.trim()
    const nextItems = newSectionItems.trim()
    let nextSections = sections
    if (editingIndex !== null) {
      nextSections = updateSectionInline(editingIndex, { title: nextTitle, itemsText: nextItems })
    } else {
      nextSections = addSection(nextTitle, nextItems)
    }
    await persistHelp(nextSections)
    setNewSectionTitle('')
    setNewSectionItems('')
    setIsAddOpen(false)
    setEditingIndex(null)
  }

  const handleDeleteSection = async (index) => {
    const nextSections = removeSection(index)
    await persistHelp(nextSections)
  }

  const handleCloseModal = () => {
    setIsAddOpen(false)
    setNewSectionTitle('')
    setNewSectionItems('')
    setEditingIndex(null)
  }

  const handleOpenAddModal = () => {
    setNewSectionTitle('')
    setNewSectionItems('')
    setEditingIndex(null)
    setIsAddOpen(true)
  }

  const handleOpenEditModal = (index) => {
    const section = sections[index]
    if (!section) return
    setNewSectionTitle(section.title || '')
    setNewSectionItems(section.itemsText || '')
    setEditingIndex(index)
    setIsAddOpen(true)
  }

  return (
    <div className="min-h-screen bg-slate-50 font-['Noto_Sans_Lao'] pb-16">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100">
        <div className="w-full px-4 h-14 flex items-center gap-3">
          <Link
            href="/manage"
            className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-colors flex items-center justify-center"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="w-9 h-9 bg-orange-600 rounded-xl flex items-center justify-center text-white">
            <HelpCircle size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900">ຈັດການ Help</h1>
            <p className="text-[10px] text-slate-400">ກຳນົດຫົວຂໍ້ ແລະ ເນື້ອໃນ</p>
          </div>
        </div>
      </header>

      <div className="w-full px-4 py-3 space-y-3">
        <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
          <div className="grid gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">ຫົວຂໍ້</label>
              <input
                value={title} readOnly
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#2E6AB3] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">ຄຳອະທິບາຍ</label>
              <input readOnly
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#2E6AB3] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-xs font-bold text-slate-800">ລາຍການຫົວຂໍ້</h2>
            <button
              onClick={handleOpenAddModal}
              className="text-[10px] font-bold text-blue-600 flex items-center gap-1"
            >
              <Plus size={12} />
              ເພີ່ມ
            </button>
          </div>
          <div className="space-y-1.5">
            {sections.length === 0 && (
              <div className="py-4 text-center text-slate-400 text-[10px] font-semibold">
                ຍັງບໍ່ມີຫົວຂໍ້
              </div>
            )}
            {sections.map((section, index) => {
              const items = section.itemsText
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean)
              const preview = items.slice(0, 1).join('')
              const extraCount = items.length > 1 ? items.length - 1 : 0
              return (
                <div key={section.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                  <span className="text-[10px] text-slate-400 font-bold w-4">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{section.title || '-'}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {preview || '-'}
                      {extraCount > 0 && (
                        <span className="ml-1 text-[9px] font-bold text-blue-600">+{extraCount}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(index)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600"
                    >
                      <PencilLine size={12} />
                    </button>
                    {sections.length > 1 && (
                      <button
                        onClick={() => handleDeleteSection(index)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {(status || lastSavedAt) && (
          <div className="text-[10px] font-semibold text-slate-500 text-center">
            {status}
            {lastSavedAt ? ` • ເວລາບັນທຶກ: ${lastSavedAt}` : ''}
          </div>
        )}
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl border border-slate-100">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">
                  {editingIndex !== null ? 'ແກ້ໄຂຫົວຂໍ້' : 'ເພີ່ມຫົວຂໍ້'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                >
                  ປິດ
                </button>
              </div>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">ຫົວຂໍ້</label>
                <input
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#2E6AB3] focus:outline-none"
                  placeholder="ໃສ່ຫົວຂໍ້..."
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">ເນື້ອໃນ (ແຍກບັນທັດ)</label>
                <textarea
                  rows={3}
                  value={newSectionItems}
                  onChange={(e) => setNewSectionItems(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-[#2E6AB3] focus:outline-none"
                  placeholder="ເພີ່ມເນື້ອໃນ..."
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={handleCloseModal}
                className="rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700"
              >
                ຍົກເລີກ
              </button>
              <button
                onClick={handleAddSection}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-[10px] font-bold text-white shadow-md"
              >
                {editingIndex !== null ? 'ບັນທຶກ' : 'ເພີ່ມ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManageHelp
