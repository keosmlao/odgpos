"use client";
import { useEffect, useState } from "react";
import { Wrench, Users, User, X, CreditCard, QrCode, ChevronUp } from "lucide-react";

type Member = {
  id?: string;
  code?: string;
  name?: string;
  phone?: string;
  discount?: number;
  points?: number;
} | null;

type Props = {
  cashierName: string;
  salesName: string;
  salesCode: string;
  selectedMember: Member;
  hasMember: boolean;
  subtotal: number;
  promoDiscount: number;
  memberDiscount: number;
  discount: number;
  total: number;
  onOpenSalesPicker: () => void;
  onOpenCustomerPicker: () => void;
  onClearCustomer: () => void;
  onCash: () => void;
  onTransfer: () => void;
  disabled: boolean;
  thbRateInput: string;
  onThbRateChange: (raw: string) => void;
};

const fmt = (n: number) => (Number(n) || 0).toLocaleString();

function ChipRow({
  icon: Icon, label, value, placeholder, onClick, required, badge, onClear,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  label: string;
  value?: string;
  placeholder?: string;
  onClick?: () => void;
  required?: boolean;
  badge?: string | null;
  onClear?: () => void;
}) {
  const hasValue = !!value;
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-3 min-h-14 px-3.5 rounded-2xl border bg-white text-left transition-all ${
        required ? "border-amber-300 bg-amber-50/60 shadow-sm" : "border-slate-200 hover:border-indigo-300 hover:shadow-sm"
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${hasValue ? "bg-indigo-50 text-indigo-700" : "bg-slate-50 text-slate-400"}`}>
        <Icon size={14} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className={`text-[13px] font-semibold truncate ${hasValue ? "text-slate-800" : "text-slate-400 italic"}`}>
          {value || placeholder || '—'}
        </div>
      </div>
      {badge ? (
        <span className="text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5">
          {badge}
        </span>
      ) : null}
      {hasValue && onClear ? (
        <span
          role="button"
          aria-label="Clear"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
        >
          <X size={12} />
        </span>
      ) : null}
    </button>
  );
}

function TotalsRow({ label, value, hint, negative = false }: { label: string; value: string | number; hint?: string; negative?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <div className="text-[12px] text-slate-400 font-medium">{label}{hint ? <span className="text-slate-500 ml-1">· {hint}</span> : null}</div>
      <div className={`text-[13px] font-bold tabular-nums ${negative ? "text-rose-400" : "text-slate-200"}`}>
        {typeof value === "number" ? fmt(value) : value}
      </div>
    </div>
  );
}

function PanelBody(props: Props) {
  const {
    cashierName, salesName, salesCode, selectedMember, hasMember,
    subtotal, promoDiscount, memberDiscount, total,
    onOpenSalesPicker, onOpenCustomerPicker, onClearCustomer,
    onCash, onTransfer, disabled, thbRateInput, onThbRateChange,
  } = props;
  const memberPct = hasMember && selectedMember?.discount ? `${selectedMember.discount}%` : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between px-1">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-600">Checkout</p><h2 className="text-[17px] font-black text-slate-900">ສະຫຼຸບການຂາຍ</h2></div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100">ພ້ອມຂາຍ</span>
      </div>
      {/* Identity */}
      <section className="space-y-2">
        <ChipRow icon={User} label="Cashier" value={cashierName} />
        <ChipRow
          icon={Wrench}
          label="ພະນັກງານຂາຍ"
          value={salesCode ? salesName : ''}
          placeholder="ເລືອກພະນັກງານຂາຍ"
          required={!salesCode}
          onClick={onOpenSalesPicker}
        />
        <ChipRow
          icon={Users}
          label="ລູກຄ້າ"
          value={selectedMember?.name || ''}
          placeholder="ລູກຄ້າທົ່ວໄປ"
          badge={memberPct}
          onClick={onOpenCustomerPicker}
          onClear={hasMember ? onClearCustomer : undefined}
        />
      </section>

      {/* THB rate */}
      <section className="rounded-2xl bg-white border border-slate-200 px-3.5 py-3 flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">THB / ₭ Rate</div>
        <input
          type="text"
          value={thbRateInput ? fmt(Number(thbRateInput)) : ''}
          onChange={(e) => onThbRateChange(e.target.value)}
          placeholder="0"
          className="h-7 w-24 rounded-md border border-slate-200 bg-slate-50 px-2 text-right text-[12px] font-bold tabular-nums text-slate-700 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none"
        />
      </section>

      {/* Totals */}
      <section className="rounded-3xl bg-slate-950 text-white p-5 space-y-1 shadow-xl shadow-slate-950/10">
        <TotalsRow label="Subtotal" value={subtotal} />
        {promoDiscount > 0 ? <TotalsRow label="Promo" value={-promoDiscount} hint="auto" negative /> : null}
        {memberDiscount > 0 ? <TotalsRow label="Member" value={-memberDiscount} hint={`${selectedMember?.discount ?? 0}%`} negative /> : null}
        <div className="my-2 h-px bg-slate-100" />
        <div className="flex items-baseline justify-between">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">ລວມທັງໝົດ</div>
          <div className="text-3xl font-black tabular-nums text-white tracking-tight">
            {fmt(total)} <span className="text-[13px] text-indigo-300 font-bold">₭</span>
          </div>
        </div>
      </section>

      {/* Payment CTAs */}
      <section className="grid grid-cols-2 gap-2">
        <button
          onClick={onCash}
          disabled={disabled}
          className="h-16 rounded-2xl bg-white border border-slate-200 text-slate-900 font-bold flex flex-col items-center justify-center gap-0.5 hover:border-slate-400 hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-1.5">
            <CreditCard size={16} strokeWidth={2.5} />
            <span className="text-[14px]">Cash</span>
          </div>
          <span className="text-[10px] font-bold opacity-60">F9</span>
        </button>
        <button
          onClick={onTransfer}
          disabled={disabled}
          className="h-16 rounded-2xl bg-indigo-600 text-white font-bold flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <div className="flex items-center gap-1.5">
            <QrCode size={16} strokeWidth={2.5} />
            <span className="text-[14px]">QR&nbsp;Pay</span>
          </div>
          <span className="text-[10px] font-bold opacity-60">F10</span>
        </button>
      </section>
    </div>
  );
}

export default function PayPanel(props: Props) {
  const { total, disabled, onCash, onTransfer } = props;
  const [expanded, setExpanded] = useState(false);

  // Keyboard shortcuts F9/F10
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "F9" && !disabled) { e.preventDefault(); onCash(); }
      if (e.key === "F10" && !disabled) { e.preventDefault(); onTransfer(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [disabled, onCash, onTransfer]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-[370px] shrink-0 border-l border-slate-200/80 bg-slate-50 overflow-y-auto">
        <PanelBody {...props} />
      </aside>

      {/* Tablet / mobile bottom drawer */}
      <div className="lg:hidden">
        {/* Backdrop when expanded */}
        {expanded ? (
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 animate-in fade-in duration-150"
            onClick={() => setExpanded(false)}
          />
        ) : null}

        {/* Mini bar (always visible on small screens) */}
        <div
          className={`fixed left-0 right-0 bottom-0 z-50 bg-white border-t border-slate-200 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] transition-transform duration-200 ${
            expanded ? "translate-y-0" : "translate-y-0"
          }`}
        >
          {/* Pull handle / collapsed summary */}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full px-4 py-2 flex items-center gap-3 border-b border-slate-100"
          >
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </button>

          {/* Expanded body */}
          <div
            className={`overflow-hidden transition-[max-height] duration-300 ${
              expanded ? "max-h-[80vh] overflow-y-auto" : "max-h-0"
            }`}
          >
            <PanelBody {...props} />
          </div>

          {/* Always-visible mini summary + CTAs */}
          {!expanded ? (
            <div className="px-4 py-2.5 flex items-center gap-3">
              <button
                onClick={() => setExpanded(true)}
                className="flex-1 flex items-center gap-2 text-left"
              >
                <ChevronUp size={16} className="text-slate-400" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</div>
                  <div className="text-[16px] font-black tabular-nums text-slate-900 leading-tight">
                    {fmt(total)} <span className="text-[11px] text-slate-400 font-bold">₭</span>
                  </div>
                </div>
              </button>
              <button
                onClick={onCash}
                disabled={disabled}
                className="h-11 px-4 rounded-xl bg-slate-900 text-white text-[13px] font-bold flex items-center gap-1.5 disabled:opacity-40"
              >
                <CreditCard size={14} /> Cash
              </button>
              <button
                onClick={onTransfer}
                disabled={disabled}
                className="h-11 px-4 rounded-xl bg-blue-600 text-white text-[13px] font-bold flex items-center gap-1.5 disabled:opacity-40"
              >
                <QrCode size={14} /> QR
              </button>
            </div>
          ) : null}
        </div>

        {/* Spacer so content above isn't covered */}
        <div className="h-[72px]" aria-hidden />
      </div>
    </>
  );
}
