"use client";
// @ts-nocheck

import { Target } from 'lucide-react'
import StaffTargetsPanel from '@/components/StaffTargetsPanel'

const BRAND = '#2E6AB3'

export default function StaffTargetsPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: BRAND }}>
            <Target size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">ກຳນົດເປົ້າຂາຍ</h1>
            <p className="mt-1 text-sm text-slate-500">
              ຕັ້ງເປົ້າຂາຍພະນັກງານແຕ່ລະເດືອນ (ຫົວໜ່ວຍເງິນບາດ ฿) — ຕິດຕາມຜົນໄດ້ທີ່ໜ້າສະຫຼຸບຍອດຂາຍປະຈຳເດືອນ
            </p>
          </div>
        </div>
      </section>

      <StaffTargetsPanel />
    </div>
  )
}
