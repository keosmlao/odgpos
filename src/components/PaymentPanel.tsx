"use client";
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { X, QrCode, Banknote, CheckCircle2, ArrowLeft, Loader2, CreditCard, Calculator } from 'lucide-react';
import OnePayQR from '@/components/OnePayQR';

const formatPrice = (price) => (Number(price) || 0).toLocaleString();

// --- Compact Components ---

const CurrencyInput = ({ value, onChange, currency, symbol, label, size = 'normal', autoFocus = false }) => {
  const sizeClasses = {
    large: 'h-12 text-2xl',
    normal: 'h-11 text-xl',
    small: 'h-10 text-base'
  };

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value ? formatPrice(value) : ''}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="0"
          autoFocus={autoFocus}
          className={`
            w-full ${sizeClasses[size]} px-4 pr-16
            bg-white/80 border border-slate-200 rounded-2xl
            text-slate-900 font-black text-right tracking-tight
            placeholder:text-slate-300
            focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
            transition-all duration-200 outline-none
          `}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <span className="text-base font-black text-slate-400">{symbol}</span>
          <span className="text-[10px] font-black text-slate-400 uppercase">{currency}</span>
        </div>
      </div>
    </div>
  );
};

const RateInput = ({ label, value, onChange, symbol }) => (
  <div className="flex items-center gap-2 p-2 bg-white/80 rounded-xl border border-slate-100">
    <span className="text-[10px] font-black text-slate-500 whitespace-nowrap uppercase tracking-wider">{label}</span>
    <input
      type="text"
      value={value ? formatPrice(value) : ''}
      onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
      className="flex-1 h-7 px-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-700 text-right focus:border-emerald-500 outline-none transition-colors"
    />
    <span className="text-[10px] font-black text-slate-400">= 1{symbol}</span>
  </div>
);

const QuickAmountButton = ({ label, value, onClick, variant = 'default' }) => {
  const variants = {
    primary: 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700',
    default: 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500 hover:text-emerald-600'
  };

  return (
    <button
      onClick={() => onClick(value)}
      className={`
        h-9 px-3 rounded-xl text-xs font-black
        border transition-all duration-150
        active:scale-95 ${variants[variant]}
      `}
    >
      {label}
    </button>
  );
};

const PaymentMethodTab = ({ active, icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className={`
      flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl
      text-xs font-black uppercase tracking-[0.2em]
      transition-all duration-200
      ${active
        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 scale-[1.01]'
        : 'bg-white text-slate-500 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
      }
    `}
  >
    <Icon size={16} strokeWidth={2.5} />
    <span>{label}</span>
  </button>
);

const SummaryRow = ({ label, value, highlight = false }) => (
  <div className={`flex justify-between items-center py-1.5 ${highlight ? 'text-emerald-500' : 'text-slate-300'}`}>
    <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
    <span className={`font-black ${highlight ? 'text-sm' : 'text-xs'}`}>{value}</span>
  </div>
);

// --- Main Payment Modal ---

const PaymentModal = ({
  isOpen,
  onClose,
  total,
  orderId,
  onConfirm,
  onPaymentSuccess,
  onAmountChange,
  onForeignAmountChange,
  receivedAmount = '',
  paymentType = 'cash',
  onPaymentTypeChange,
  isPaying = false,
}) => {
  const [activeTab, setActiveTab] = useState(paymentType === 'transfer' ? 'qr' : 'cash');
  const [kipAmount, setKipAmount] = useState('');
  const [thbAmount, setThbAmount] = useState('');
  const [showRates, setShowRates] = useState(false);
  const [rates, setRates] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('pos_fx_rates') || 'null');
      if (stored && typeof stored === 'object') {
        return {
          thb: Number(stored.thb) || 520,
        };
      }
    } catch {}
    return { thb: 520 };
  });

  useEffect(() => {
    if (isOpen) {
      if (onAmountChange) onAmountChange('');
      setActiveTab(paymentType === 'transfer' ? 'qr' : 'cash');
      setKipAmount(receivedAmount ? String(receivedAmount) : '');
      setThbAmount('');
      setShowRates(false);
      try {
        const stored = JSON.parse(localStorage.getItem('pos_fx_rates') || 'null');
        if (stored && typeof stored === 'object') {
          setRates((prev) => ({
            ...prev,
            thb: Number(stored.thb) || prev.thb,
          }));
        }
      } catch {}
    }
  }, [isOpen, onAmountChange, paymentType]);

  const numericKip = Number(kipAmount) || 0;
  const numericThb = Number(thbAmount) || 0;
  const totalReceivedKip = numericKip + (numericThb * (Number(rates.thb) || 0));
  const change = Math.max(0, totalReceivedKip - total);
  const canConfirm = totalReceivedKip >= total;

  useEffect(() => {
    if (onAmountChange) {
      onAmountChange(totalReceivedKip ? String(Math.round(totalReceivedKip)) : '');
    }
  }, [totalReceivedKip, onAmountChange]);

  useEffect(() => {
    if (onForeignAmountChange) {
      onForeignAmountChange({
        thbAmount: numericThb,
        thbRate: Number(rates.thb) || 0,
        totalReceivedKip,
      });
    }
  }, [numericThb, rates.thb, totalReceivedKip, onForeignAmountChange]);

  useEffect(() => {
    localStorage.setItem('pos_fx_rates', JSON.stringify(rates));
  }, [rates]);

  const handleConfirm = () => {
    if (isPaying) return;
    onConfirm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-gradient-to-br from-slate-900/70 via-slate-900/60 to-emerald-900/40 backdrop-blur-sm">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white/90 rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 border border-white/70">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-50 via-white to-amber-50 border-b border-white/60">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm"
            >
              <ArrowLeft size={16} className="text-slate-700" />
            </button>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600">Payment</div>
              <h2 className="text-sm font-black text-slate-900">ຊຳລະເງິນ</h2>
              <p className="text-[10px] text-slate-500 font-semibold">Order #{orderId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-full">
              ລໍຖ້າຊຳລະ
            </span>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm"
            >
              <X size={16} className="text-slate-600" />
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row">

          {/* Left: Payment Input */}
          <div className="flex-1 p-5 space-y-5 bg-white">

            {/* Payment Method Tabs */}
            <div className="flex gap-2">
              <PaymentMethodTab
                active={activeTab === 'cash'}
                icon={Banknote}
                label="ເງິນສົດ"
                onClick={() => { setActiveTab('cash'); if (onPaymentTypeChange) onPaymentTypeChange('cash'); }}
              />
              <PaymentMethodTab
                active={activeTab === 'qr'}
                icon={QrCode}
                label="OnePay QR"
                onClick={() => { setActiveTab('qr'); if (onPaymentTypeChange) onPaymentTypeChange('transfer'); }}
              />
            </div>

            {activeTab === 'cash' ? (
              <div className="space-y-4">
                {/* Main Currency Input */}
                <CurrencyInput
                  value={kipAmount}
                  onChange={setKipAmount}
                  currency="LAK"
                  symbol="₭"
                  label="ຈຳນວນເງິນທີ່ຮັບ"
                  size="large"
                  autoFocus
                />

                {/* Quick Amount Buttons */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    ເລືອກໄວ
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <QuickAmountButton label="ພໍດີ" value={total} onClick={setKipAmount} variant="primary" />
                    <QuickAmountButton label="50k" value={50000} onClick={setKipAmount} />
                    <QuickAmountButton label="100k" value={100000} onClick={setKipAmount} />
                    <QuickAmountButton label="500k" value={500000} onClick={setKipAmount} />
                  </div>
                </div>

                {/* Foreign Currency Section */}
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CreditCard size={14} className="text-slate-400" />
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">ສະກຸນເງິນອື່ນ</span>
                    </div>
                    <button
                      onClick={() => setShowRates(!showRates)}
                      className="flex items-center gap-1 text-[10px] font-black text-emerald-600 hover:text-emerald-700"
                    >
                      <Calculator size={12} />
                      <span>{showRates ? 'ເຊື່ອງ' : 'ແກ້ເລດ'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <CurrencyInput
                      value={thbAmount}
                      onChange={setThbAmount}
                      currency="THB"
                      symbol="฿"
                      size="large"
                    />
                  </div>

                  {/* Exchange Rates */}
                  {showRates && (
                    <div className="pt-2 border-t border-emerald-100 space-y-1.5">
                      <RateInput
                        label="THB→LAK"
                        value={rates.thb}
                        onChange={(val) => setRates(prev => ({ ...prev, thb: val }))}
                        symbol="฿"
                      />
                    </div>
                  )}

                  {/* Total in LAK */}
                  {numericThb > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">ລວມເປັນກີບ:</span>
                        <span className="font-bold text-slate-900">{formatPrice(totalReceivedKip)} ₭</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Button */}
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm || isPaying}
                  className={`
                    w-full h-11 rounded-2xl font-black text-sm
                    flex items-center justify-center gap-2
                    transition-all duration-200 active:scale-[0.98]
                    ${canConfirm && !isPaying
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }
                  `}
                >
                  {isPaying ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>ກຳລັງດຳເນີນການ...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} strokeWidth={2.5} />
                      <span>ຢືນຢັນການຊຳລະ</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* QR Payment Tab */
              <div className="flex flex-col items-center py-4">
                <div className="mb-4 text-center">
                  <h3 className="text-sm font-bold text-slate-900 mb-0.5">ສະແກນ QR Code</h3>
                  <p className="text-[10px] text-slate-500">ໃຊ້ແອັບ OnePay ສະແກນເພື່ອຊຳລະ</p>
                </div>

                <div className="w-48 h-48 bg-white p-2 rounded-2xl shadow-lg border border-slate-100 mb-4">
                  <OnePayQR orderId={orderId} totalAmount={total} onPaymentSuccess={onPaymentSuccess} />
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full">
                  <Loader2 size={12} className="animate-spin text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-600">ກຳລັງລໍຖ້າການຊຳລະ...</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Order Summary */}
          <div className="w-full md:w-56 bg-gradient-to-br from-[#0F2B2E] via-[#183A3C] to-[#1F4A48] text-white p-4 flex flex-col">
            <div className="mb-4">
              <h3 className="text-[10px] font-black text-emerald-200 uppercase tracking-[0.3em] mb-0.5">ຍອດທີ່ຕ້ອງຊຳລະ</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black">{formatPrice(total)}</span>
                <span className="text-base font-black text-emerald-300">₭</span>
              </div>
            </div>

            <div className="flex-1 space-y-1">
              <div className="py-2 border-t border-slate-700">
                <SummaryRow label="ຮັບມາ" value={`${formatPrice(totalReceivedKip)} ₭`} />
              </div>

              {canConfirm && (
                <div className="py-2 border-t border-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-emerald-400">ເງິນທອນ</span>
                    <span className="text-lg font-black text-emerald-400">{formatPrice(change)} ₭</span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Status Indicator */}
            <div className="mt-4 pt-3 border-t border-emerald-900/50">
              <div className={`
                flex items-center justify-center gap-1.5 py-2 rounded-md
                ${canConfirm
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-amber-500/20 text-amber-200'
                }
              `}>
                {canConfirm ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span className="text-[10px] font-bold">ພ້ອມຢືນຢັນແລ້ວ</span>
                  </>
                ) : (
                  <>
                    <Banknote size={14} />
                    <span className="text-[10px] font-bold">ຍັງຂາດ {formatPrice(total - totalReceivedKip)} ₭</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
