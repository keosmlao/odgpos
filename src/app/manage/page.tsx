"use client";
// @ts-nocheck

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  HelpCircle,
  LayoutDashboard,
  Lock,
  Store,
} from 'lucide-react'
import { backOfficeModuleItems } from '@/components/back-office-nav'

const ActionLink = ({ href, icon: Icon, title, desc }) => (
  <Link
    href={href}
    className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
  >
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
        <Icon size={17} strokeWidth={2.1} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <div className="mt-0.5 truncate text-[11px] text-slate-500">{desc}</div>
      </div>
    </div>
  </Link>
)

const StatCard = ({ value, label, note }) => (
  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
    <div className="text-3xl font-black tracking-tight text-slate-900">{value}</div>
    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
    <div className="mt-3 text-sm text-slate-500">{note}</div>
  </div>
)

const ModuleCard = ({ item }) => {
  const Icon = item.icon

  if (!item.enabled) {
    return (
      <div className="flex h-full flex-col rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.bg}`}>
            <Icon size={22} className={item.color} strokeWidth={2.1} />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            <Lock size={10} />
            Soon
          </span>
        </div>

        <div className="mt-5 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.eyebrow}</div>
          <h3 className="mt-2 text-lg font-bold tracking-tight text-slate-500">{item.title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">{item.desc}</p>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4 text-sm font-semibold text-slate-400">
          ຈະເພີ່ມໃນຮອບຕໍ່ໄປ
        </div>
      </div>
    )
  }

  return (
    <Link
      href={item.to}
      className="group flex h-full flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.bg}`}>
          <Icon size={22} className={item.color} strokeWidth={2.1} />
        </div>
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Ready
        </span>
      </div>

      <div className="mt-5 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.eyebrow}</div>
        <h3 className="mt-2 text-lg font-bold tracking-tight text-slate-900">{item.title}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-500">{item.desc}</p>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-sm font-semibold text-slate-700">ເຂົ້າໄປຈັດການ</span>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 transition-colors group-hover:bg-slate-900 group-hover:text-white">
          <ChevronRight size={18} strokeWidth={2.2} />
        </div>
      </div>
    </Link>
  )
}

export default function Management() {
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    try {
      setCurrentUser(JSON.parse(localStorage.getItem('pos_user') || 'null'))
    } catch {
      setCurrentUser(null)
    }
  }, [])

  const landingItems = backOfficeModuleItems.filter((item) => item.to !== '/manage')
  const enabledCount = landingItems.filter((item) => item.enabled).length
  const disabledCount = landingItems.filter((item) => !item.enabled).length
  const currentUserName = currentUser?.name_1 || currentUser?.fullname_lo || currentUser?.username || 'Team Admin'
  const currentUserCode = currentUser?.code || currentUser?.employee_code || '--'

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <LayoutDashboard size={22} strokeWidth={2.1} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">ໜ້າຈັດການ</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  ໃຊ້ສ່ວນນີ້ເປັນຈຸດເລີ່ມຂອງ backend. sidebar ດ້ານຊ້າຍແມ່ນ menu ຫຼັກ ແລະ card ຂ້າງລຸ່ມແມ່ນ shortcut ສຳລັບ module ທີ່ໃຊ້ບ່ອຍ.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{currentUserName}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">User #{currentUserCode}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{enabledCount} modules ພ້ອມໃຊ້</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[460px]">
            <ActionLink href="/pos" icon={Store} title="ກັບໄປ POS" desc="ກັບໄປຫນ້າຂາຍຫຼັກ" />
            <ActionLink href="/help" icon={HelpCircle} title="ເບິ່ງຄູ່ມື" desc="ເປີດຄູ່ມືໃຊ້ງານ" />
            <ActionLink href="/settings/line" icon={ArrowUpRight} title="LINE Settings" desc="ເຂົ້າຫາການແຈ້ງເຕືອນ" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatCard value={enabledCount} label="Ready Modules" note="module ທີ່ເຂົ້າໃຊ້ໄດ້ທັນທີ" />
          <StatCard value={disabledCount} label="Pipeline" note="module ທີ່ຈະເພີ່ມໃນຮອບຕໍ່ໄປ" />
          <StatCard value="24/7" label="Support" note="ຄູ່ມື ແລະ help ພ້ອມໃຫ້ເຂົ້າເບິ່ງ" />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Modules</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">ເລືອກສ່ວນທີ່ຕ້ອງການຈັດການ</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              shortcut ຂ້າງລຸ່ມນີ້ເປັນທາງລັດ. ການນຳທາງຫຼັກຈະຢູ່ໃນ sidebar ທີ່ໃຊ້ຮ່ວມກັນກັບທຸກໜ້າ backend.
            </p>
          </div>

          <Link
            href="/pos"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft size={16} strokeWidth={2.2} />
            ກັບໄປໜ້າ POS
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {landingItems.map((item) => (
            <ModuleCard key={item.title} item={item} />
          ))}
        </div>
      </section>
    </div>
  )
}
