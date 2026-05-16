"use client";
// @ts-nocheck

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Settings, ShoppingBag, AlertTriangle, HelpCircle, ArrowLeft, ChevronDown } from 'lucide-react'
import { getHelpAction } from '@/app/_actions/help'

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
        'ຄົ້ນຫາສິນຄ້າດ້ວຍບາໂຄດ ຫຼື ຊື່',
        'ກວດສອບລາຄາ/ຈຳນວນ ແລະ ກົດຊຳລະເງິນ',
        'ກວດສອບບິນ ແລະ ສົ່ງ/ພິມໃຫ້ລູກຄ້າ',
      ],
    },
    {
      id: 'manage',
      title: 'ຫນ້າຈັດການ',
      items: [
        'ຈັດການຜູ້ຮັບ LINE ແຈ້ງເຕືອນ',
        'ຕັ້ງຄ່າໂປຣໂມຊັນ (ຊື້ 1 ແຖມ 1 / ຂອງແຖມ)',
        'ເພີ່ມ ຫຼື ແກ້ໄຂຮູບພາບສິນຄ້າ',
      ],
    },
    {
      id: 'shop',
      title: 'ຮ້ານອອນໄລນ໌',
      items: [
        'ແບ່ງປັນລິ້ງໜ້າຮ້ານໃຫ້ລູກຄ້າ',
        'ຕິດຕາມອໍເດີທີ່ໜ້າຕິດຕາມຄຳສັ່ງຊື້',
        'ອັບເດດສະຖານະອໍເດີຕາມການຈັດສົ່ງ',
      ],
    },
    {
      id: 'support',
      title: 'ການແກ້ໄຂບັນຫາ',
      items: [
        'ກວດສອບອິນເຕີເນັດ ແລະ ລອງໂຫຼດໃໝ່',
        'ຖ້າລະບົບຊ້າ ກະລຸນາລອງປິດ-ເປີດແອັບ',
        'ຕິດຕໍ່ຜູ້ດູແລລະບົບຖ້າພົບຂໍ້ຜິດພາດ',
      ],
    },
  ],
  contact: {
    label: 'ຕິດຕໍ່ຜູ້ດູແລລະບົບ',
    phone: '',
    line: '',
  },
}

const sectionMeta = {
  pos: {
    icon: BookOpen,
    accent: 'from-sky-500 to-cyan-400',
    bg: 'bg-sky-50',
    text: 'text-sky-600',
  },
  manage: {
    icon: Settings,
    accent: 'from-indigo-500 to-blue-500',
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
  },
  shop: {
    icon: ShoppingBag,
    accent: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
  support: {
    icon: AlertTriangle,
    accent: 'from-rose-500 to-orange-500',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
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
    sections: payload.sections.map((section) => ({
      ...section,
      items: Array.isArray(section.items) ? section.items : [],
    })),
  }
}

const Help = () => {
  const [helpData, setHelpData] = useState(FALLBACK_HELP)
  const [isLoading, setIsLoading] = useState(true)
  const [isRemote, setIsRemote] = useState(false)
  const [expandedSection, setExpandedSection] = useState(null)

  const toggleSection = (id) => {
    setExpandedSection(expandedSection === id ? null : id)
  }

  useEffect(() => {
    let isMounted = true
    getHelpAction()
      .then((data) => {
        if (!isMounted) return
        const normalized = normalizeHelp(data)
        setHelpData(normalized)
        setIsRemote(true)
      })
      .catch(() => {
        if (isMounted) setHelpData(FALLBACK_HELP)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 font-['Noto_Sans_Lao'] pb-16">
      <div className="relative overflow-hidden bg-gradient-to-r from-[#2E6AB3] via-[#2E6AB3] to-[#2E6AB3]">
        <div className="absolute inset-0 bg-white/10 blur-2xl pointer-events-none"></div>
        <div className="absolute -right-20 top-0 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-[#2E6AB3]/30 blur-2xl"></div>
        <div className="max-w-screen-md mx-auto px-4 py-6 relative">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
                <HelpCircle size={24} className="text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-black text-white tracking-tight">{helpData.title}</h1>
                <p className="text-[10px] text-white/80 font-semibold mt-0.5">{helpData.subtitle}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-white/30"
              >
                <ArrowLeft size={12} />
                ກັບໄປໜ້າຫຼັກ
              </Link>
              {isRemote && (
                <span className="text-[9px] uppercase tracking-widest text-white/70 font-semibold">
                  synced
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-md mx-auto px-4 py-4">
        {isLoading && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs font-semibold text-slate-500">
            ກຳລັງໂຫຼດ...
          </div>
        )}

        {!isLoading && (
          <div className="space-y-2">
            {helpData.sections.map((section) => {
              const meta = sectionMeta[section.id] || sectionMeta.pos
              const Icon = meta.icon
              const isExpanded = expandedSection === section.id

              return (
                <div
                  key={section.id}
                  className="relative overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm"
                >
                  <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${meta.accent}`}></div>

                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-200"
                  >
                    <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={16} className={meta.text} strokeWidth={2.4} />
                    </div>
                    <span className="flex-1 text-sm font-bold text-slate-900">{section.title}</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform duration-300 flex-shrink-0 ${
                        isExpanded ? 'rotate-180 text-slate-600' : ''
                      }`}
                    />
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <ul className="px-4 pb-3 pt-1 space-y-1.5 border-t border-slate-50">
                      {section.items.map((item, index) => (
                        <li key={`${section.id}-${index}`} className="flex items-start gap-2 text-xs text-slate-600">
                          <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${meta.bg} flex-shrink-0`}></span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Help
