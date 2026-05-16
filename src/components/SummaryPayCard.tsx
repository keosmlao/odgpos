"use client";
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  QrCode,
  Pause,
  RotateCcw,
  X,
  ClipboardList,
  Monitor,
  LogOut,
  Search,
  Package,
  ChevronRight,
  Wallet,
  CheckCircle2,
  Printer
} from 'lucide-react';

// --- Utility Functions ---
const toNumber = (value) => {
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPrice = (price) => toNumber(price).toLocaleString();

// --- Sub-Component: ActionButton ---
const ActionButton = ({ icon, label, onClick, disabled, badge, variant = 'default', active = false }) => {
  const themes = {
    default: active
      ? 'bg-blue-600 text-white shadow-blue-200'
      : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 border-slate-100',
    danger: 'hover:bg-rose-50 hover:text-rose-500 text-slate-600 border-slate-100',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative w-full lg:w-auto flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 border transition-all active:scale-90 disabled:opacity-30 ${themes[variant]}`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-white/20' : 'bg-slate-50'}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider leading-none">{label}</span>
      {badge > 0 && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white ring-2 ring-white animate-bounce">
          {badge}
        </span>
      )}
    </button>
  );
};

// --- Main Component ---
const SummaryPayCard = ({
  subtotal = 0,
  discount = 0,
  promoDiscount = 0,
  memberDiscount = 0,
  total = 0,
  onCash,
  onTransfer,
  disabled = false,
  searchTerm = '',
  onSearchTermChange,
  onClearSearch,
  searchResults = [],
  isSearching = false,
  onAddSearchItem,
  onHold,
  heldCount = 0,
  onRecall,
  onCancel,
  onDaily,
  onPickupOrders,
  pickupCount = 0,
  onLineSettings,
  onDisplay,
  isDisplayOpen = false,
  onLogout,
  onReprint,
  hasItems = false,
  selectedMember = null,
  hasMember = false,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const discountPercent = hasMember ? (selectedMember?.discount || 0) : 0;
  const hasPromoDiscount = promoDiscount > 0;
  const hasMemberDiscount = memberDiscount > 0;

  // ຄຸ້ມຄອງ Keyboard Shortcuts (F9, F10)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F9') {
        e.preventDefault();
        if (!disabled && total > 0) onCash?.();
      }
      if (e.key === 'F10') {
        e.preventDefault();
        if (!disabled && total > 0) onTransfer?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, total, onCash, onTransfer]);

  return (
    <div className="pos-summary flex w-full flex-col gap-5 rounded-[2.5rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-200/50">

      {/* 1. Price Display Card */}
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-100 bg-slate-50/50">
        <div className="px-6 py-8 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ຍອດລວມທີ່ຕ້ອງຊຳລະ</p>
          <div className="mt-2 flex items-baseline justify-center gap-1.5">
            <span className="text-5xl font-black tracking-tighter text-slate-900">
              {formatPrice(total)}
            </span>
            <span className="text-xl font-bold text-blue-600 font-mono">₭</span>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white/50 px-6 py-4 space-y-2">
          <div className="flex flex-col gap-1 text-xs font-bold text-slate-400">
            <span>ລາຄາລວມ: {formatPrice(subtotal)} ₭</span>
            {hasPromoDiscount && (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={12} /> ໂປຣໂມຊັນ 1 ແຖມ 1: -{formatPrice(promoDiscount)} ₭
              </span>
            )}
            {hasMemberDiscount && (
              <span className="flex items-center gap-1 text-blue-600">
                <CheckCircle2 size={12} /> ສ່ວນຫຼຸດ {discountPercent}%: -{formatPrice(memberDiscount)} ₭
              </span>
            )}
            {!hasPromoDiscount && !hasMemberDiscount && discount > 0 && (
              <span className="flex items-center gap-1 text-blue-600">
                <CheckCircle2 size={12} /> ສ່ວນຫຼຸດ: -{formatPrice(discount)} ₭
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Payment Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onCash?.()}
          disabled={disabled || total <= 0}
          className="group relative h-16 w-full overflow-hidden rounded-[1.5rem] bg-slate-900 text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-40 disabled:grayscale shadow-lg shadow-slate-200"
        >
          <div className="relative z-10 flex items-center justify-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 group-hover:bg-blue-600 transition-colors">
              <Wallet size={22} />
            </div>
            <div className="text-left">
              <div className="text-[9px] font-medium opacity-50 uppercase tracking-[0.2em]">Cash</div>
              <div className="text-base font-black tracking-wide">ຈ່າຍສົດ (F9)</div>
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
        </button>
        <button
          onClick={() => onTransfer?.()}
          disabled={disabled || total <= 0}
          className="group relative h-16 w-full overflow-hidden rounded-[1.5rem] bg-blue-600 text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:grayscale shadow-lg shadow-blue-200"
        >
          <div className="relative z-10 flex items-center justify-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 group-hover:bg-white/25 transition-colors">
              <QrCode size={22} />
            </div>
            <div className="text-left">
              <div className="text-[9px] font-medium opacity-70 uppercase tracking-[0.2em]">QR Pay</div>
              <div className="text-base font-black tracking-wide">ໂອນເງິນ (F10)</div>
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
        </button>
      </div>

      {/* 3. Actions Grid */}
      <div className="rounded-[2rem] bg-slate-50 p-2 shadow-inner border border-slate-100">
        <div className="pos-summary-actions grid grid-cols-4 gap-2">
          <ActionButton onClick={() => setIsSearchOpen(true)} icon={<Search size={18} />} label="ຄົ້ນຫາ" />
          <ActionButton onClick={onHold} icon={<Pause size={18} />} label="ພັກບິນ" disabled={!hasItems} />
          <ActionButton onClick={onRecall} icon={<RotateCcw size={18} />} label="ບິນພັກ" badge={heldCount} />
          <ActionButton onClick={onCancel} icon={<X size={18} />} label="ຍົກເລີກ" variant="danger" disabled={!hasItems} />

          <ActionButton onClick={onDaily} icon={<ClipboardList size={18} />} label="ລາຍວັນ" />
          {onReprint && (
            <ActionButton onClick={onReprint} icon={<Printer size={18} />} label="ພິມຊ້ຳ" />
          )}
          {onPickupOrders && (
            <ActionButton onClick={onPickupOrders} icon={<Package size={18} />} label="ຮັບອໍເດີ" badge={pickupCount} />
          )}
          {onLineSettings && (
            <ActionButton onClick={onLineSettings} icon={<ClipboardList size={18} />} label="Line ແຈ້ງເຕືອນ" />
          )}
          <ActionButton onClick={onDisplay} icon={<Monitor size={18} />} label="ຈໍສະແດງ" active={isDisplayOpen} />

          <div className="col-span-2">
            <button
              onClick={onLogout}
              className="flex h-full w-full items-center justify-center gap-2 rounded-2xl bg-white border border-slate-100 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </div>

      {/* --- SEARCH MODAL --- */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-[2.5rem] bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">ຄົ້ນຫາສິນຄ້າ</h3>
              <button onClick={() => setIsSearchOpen(false)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-rose-100 hover:text-rose-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => onSearchTermChange?.(e.target.value)}
                placeholder="ພິມຊື່ສິນຄ້າ ຫຼື ລະຫັດ Barcode..."
                className="w-full rounded-2xl border-none bg-slate-100 py-4 pl-12 pr-4 text-lg font-medium focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button onClick={onClearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-600">
                  CLEAR
                </button>
              )}
            </div>

            <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-slate-100 bg-white">
              {isSearching ? (
                <div className="p-10 text-center text-slate-400 font-medium">ກຳລັງຄົ້ນຫາ...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-10 text-center text-slate-400 font-medium">ບໍ່ພົບລາຍການສິນຄ້າ</div>
              ) : (
                searchResults.map((product, idx) => (
                  <button
                    key={product.id || idx}
                    onClick={() => { onAddSearchItem?.(product); setIsSearchOpen(false); }}
                    className="flex w-full items-center justify-between border-b border-slate-50 p-4 transition-colors hover:bg-blue-50 last:border-0"
                  >
                    <div className="text-left">
                      <div className="font-bold text-slate-900">{product.name}</div>
                      <div className="text-xs font-mono text-slate-400">ID: {product.id}</div>
                    </div>
                    <div className="text-lg font-black text-blue-600">{formatPrice(product.price)} ₭</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryPayCard;
