"use client";
// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { logoutAction } from '@/app/_actions/auth';
import {
  searchProductsAction,
  getProductByBarcodeAction,
  getProductByIdAction,
} from '@/app/_actions/products';
import {
  getDocNoAction,
  searchBillsAction,
  getPosBillAction,
  saveBillAction,
  cancelBillAction,
} from '@/app/_actions/bills';
import {
  searchCustomersAction,
  searchStaffAction,
} from '@/app/_actions/people';
import {
  listPromotionsAction,
  lookupPromotionAction,
} from '@/app/_actions/promotions';
import {
  getShopOrdersAction,
  getShopOrderAction,
  updateShopOrderStatusAction,
  expireStaleOrdersAction,
} from '@/app/_actions/shop-orders';
import { listProductImagesAction } from '@/app/_actions/product-images';
import { getErpCurrenciesAction, getErpThbRateAction } from '@/app/_actions/fx';
import {
  getDailySummaryAction,
  commitDailySummaryAction,
} from '@/app/_actions/daily-summary';
import {
  getOnlineOrdersAction,
  getOnlineOrderAction,
  updateOnlineOrderStatusAction,
} from '@/app/_actions/online-orders';
import {
  normalizePromotionRecord,
  getPromotionGiftItems,
  getPromotionRuleConfig,
  isAutomaticPromotion,
  promotionMatchesCode,
  getPromotionQualificationCount,
} from '@/lib/promotions';

import { calculateOrderPricing, calculateLinePricing } from '@/utils/pricing';

// Icons
import {
  CheckCircle, X, Loader2, Search, Package,
  Wrench, Users, Clock,
  Plus, Minus, Trash2, ScanLine, ShoppingBag, ClipboardList,
  CreditCard, QrCode, Pause, RotateCcw, Monitor, Wallet, CheckCircle2, Printer,
  Banknote, ArrowLeft, Calculator, AlertTriangle, History, Sparkles, ArrowRight, Bell
} from 'lucide-react';

// New POS shell components (Stage 1 of redesign)
import TopBar from '@/components/pos/TopBar';
import LeftRail, { type LeftRailAction } from '@/components/pos/LeftRail';
import PayPanel from '@/components/pos/PayPanel';
import ProductSearchModal from '@/components/pos/ProductSearchModal';

/* --- Constants & Config --- */
const POINTS_RATE = 50000;
const CURRENT_BILL_STORAGE_KEY = 'pos_current_bill';
const ORDER_COUNTER_PREFIX = 'pos_order_counter_';
const HELD_BILLS_KEY = 'pos_held_bills';
const SALES_STORAGE_KEY = 'pos_selected_sales';
const DEFAULT_MEMBER = {
  id: '01-2125',
  code: '01-2125',
  name: 'ລູກຄ້າໜ້າຮ້ານ(ຂົວຫຼວງ)',
  phone: '',
  points: 0,
  discount: 0,
};

/* --- Utils --- */
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
const normalizePrice = (raw) => toNumber(raw);
const normalizeQty = (raw) => Number.isFinite(Number(raw)) ? Number(raw) : null;
const formatQtyLabel = (value) => Number(Number(value).toFixed(2)).toLocaleString();
const OUT_OF_STOCK_MSG = 'ໝົດສະຕ໋ອກ ຂາຍຕິດລົບບໍ່ໄດ້';

const normalizeOrderId = (raw) => {
  if (!raw || typeof raw !== 'string') return raw;
  if (raw.startsWith('SPOS-')) return `POS${raw.slice(5)}`;
  if (raw.startsWith('SPOS')) return `POS${raw.slice(4)}`;
  return raw;
};

const sanitizeStoredItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const quantity = Number(item.quantity) || 0;
  if (quantity <= 0) return null;
  return {
    ...item,
    price: normalizePrice(item.price),
    quantity,
    unit_code: item.unit_code || 'EA',
  };
};

const normalizeApiProduct = (raw) => {
  const resolved = Array.isArray(raw) ? raw[0] : (raw?.data || raw);
  const stockQty = normalizeQty(
    resolved?.stock_balance ??
    resolved?.balance_qty ??
    resolved?.qty_balance ??
    resolved?.on_hand ??
    resolved?.onhand ??
    resolved?.stock_qty ??
    resolved?.stock ??
    resolved?.qty ??
    resolved?.quantity ??
    resolved?.remain ??
    resolved?.balance
  );
  return {
    id: resolved?.item_code || resolved?.ic_code || resolved?.barcode || resolved?.id || 'item',
    name: resolved?.item_name || resolved?.name_1 || resolved?.name || resolved?.ic_code || 'Product',
    price: normalizePrice(
      resolved?.sale_price1 ??
      resolved?.sale_price ??
      resolved?.price ??
      resolved?.price1 ??
      resolved?.saleprice
    ),
    barcode: resolved?.barcode || resolved?.ic_code || resolved?.item_code || '',
    unit_code: resolved?.unit_code || resolved?.unit || resolved?.unitName || resolved?.unitname || 'EA',
    unit: resolved?.unit_code || resolved?.unit || resolved?.unitName || resolved?.unitname || 'EA',
    stock: stockQty,
    promotion_id: resolved?.promotion_id || resolved?.promo_id || resolved?.id || null,
    promo_type: resolved?.promo_type || resolved?.promotion_type || resolved?.promotion || resolved?.promo,
    promo_buy1_get1: resolved?.promo_buy1_get1,
    bogo: resolved?.bogo,
    buy1get1: resolved?.buy1get1,
    rule_config: resolved?.rule_config,
    buy_items: resolved?.buy_items,
    gift_items: resolved?.gift_items,
    gift_code: resolved?.gift_code || '',
    gift_qty: resolved?.gift_qty,
  };
};

const BAHT_CURRENCY_CODE = '01';
const CURRENCY_SYMBOLS = { '01': '฿', '03': '$', '04': '¥' };

const SALES_REQUIRED_MSG = 'ກະລຸນາເລືອກພະນັກງານຂາຍກ່ອນ';

const ViewportPortal = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
};

/* ════════════════════════════════════════════
   Inlined Components (Header, Cart, SummaryPayCard, PaymentPanel)
   ════════════════════════════════════════════ */

/* ────────────────────────────────────────────
   SelectModal — full-screen modal picker
   ──────────────────────────────────────────── */
const SelectModal = ({
  isOpen,
  onClose,
  icon: Icon,
  title,
  items = [],
  onSelect,
  onSearch = null,
  isLoading = false,
  searchPlaceholder = 'ຄົ້ນຫາ...',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (onSearch) onSearch(searchTerm);
  }, [searchTerm, onSearch]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredItems = !normalizedSearch
    ? items
    : items.filter((item) => {
        const name = String(item.name || '').toLowerCase();
        const code = String(item.code || '').toLowerCase();
        const phone = String(item.phone || '').toLowerCase();
        return name.includes(normalizedSearch) || code.includes(normalizedSearch) || phone.includes(normalizedSearch);
      });

  const handleSelect = (item) => {
    onSelect?.(item);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ViewportPortal>
      <div
        className="fixed inset-0 z-[200] flex items-start justify-center p-3 sm:p-4 pt-[8vh] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-md max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Slim header with inline search */}
          <div className="flex items-center gap-2 px-4 h-14 border-b border-slate-100 shrink-0">
            <Icon size={16} className="text-slate-400" strokeWidth={2} />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">{title}</span>
            <span className="mx-1 text-slate-200">·</span>
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 h-full bg-transparent text-[13px] font-medium text-slate-800 placeholder:text-slate-400 outline-none min-w-0"
            />
            {isLoading ? (
              <Loader2 className="animate-spin text-slate-400 shrink-0" size={14} />
            ) : searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-700 shrink-0"
              >
                CLEAR
              </button>
            ) : null}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="p-10 text-center text-[13px] text-slate-400 font-medium">
                {searchTerm ? 'ບໍ່ພົບຂໍ້ມູນ' : 'ພິມເພື່ອຄົ້ນຫາ'}
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.code || item.id}
                  onClick={() => handleSelect(item)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-800 truncate">{item.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      #{item.code}{item.phone ? ` · ${item.phone}` : ''}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </ViewportPortal>
  );
};

/* ChipButton, InfoPill, and the old Header component were removed during the
 * modern-minimal redesign. The new layout uses TopBar + LeftRail + PayPanel
 * components from @/components/pos. */

/* ════════════════════════════════════════════
   OnePayQR — QR payment via OnePay
   ════════════════════════════════════════════ */
const scriptPromises = new Map();
const globalSession = { orderId: null, amount: null, code: null, success: false, notified: false, unsubscribe: null, listeners: new Set(), successHandlers: new Set() };

const ensureScript = (src, globalName) => {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window is not available'));
  if (globalName && window[globalName]) return Promise.resolve();
  if (scriptPromises.has(src)) return scriptPromises.get(src);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = src; script.async = true;
    script.addEventListener('load', () => resolve(undefined), { once: true });
    script.addEventListener('error', () => { script.remove(); scriptPromises.delete(src); reject(new Error(`Failed to load script: ${src}`)); }, { once: true });
    document.body.appendChild(script);
  });
  scriptPromises.set(src, promise);
  return promise;
};

const notifyListeners = () => { globalSession.listeners.forEach((l) => { try { l({ code: globalSession.code, success: globalSession.success }); } catch {} }); };
const notifySuccessHandlers = () => { if (globalSession.notified) return; globalSession.notified = true; globalSession.successHandlers.forEach((h) => { try { h(); } catch {} }); };

const OnePayQR = ({ orderId, totalAmount, onPaymentSuccess }) => {
  const qrRef = useRef(null);
  const [qrSuccess, setQrSuccess] = useState(false);
  const successCallbackRef = useRef(onPaymentSuccess);
  useEffect(() => { successCallbackRef.current = onPaymentSuccess; }, [onPaymentSuccess]);
  useEffect(() => { if (!orderId) { setQrSuccess(false); if (qrRef.current) qrRef.current.removeAttribute('src'); } }, [orderId]);
  useEffect(() => {
    if (typeof window === 'undefined' || !orderId) return;
    const amountNumber = Number(totalAmount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return;
    const currentOrderId = String(orderId);
    const handleSessionUpdate = ({ code, success: s }) => { if (code && qrRef.current && qrRef.current.src !== code) qrRef.current.src = code; setQrSuccess(s); };
    const successHandler = () => { if (typeof successCallbackRef.current === 'function') successCallbackRef.current('transfer'); };
    globalSession.listeners.add(handleSessionUpdate);
    globalSession.successHandlers.add(successHandler);
    handleSessionUpdate({ code: globalSession.code, success: globalSession.success && globalSession.orderId === currentOrderId });
    const startNewSession = async () => {
      try {
        await ensureScript('https://cdn.pubnub.com/sdk/javascript/pubnub.4.27.3.js', 'PubNub');
        await ensureScript('/onepay.js', 'OnePay');
        if (!window.OnePay) throw new Error('OnePay library is not available');
        if (globalSession.unsubscribe) try { globalSession.unsubscribe(); } catch {}
        globalSession.orderId = currentOrderId; globalSession.amount = amountNumber; globalSession.code = null; globalSession.success = false; globalSession.notified = false;
        notifyListeners();
        const onePay = new window.OnePay('mch5c1b169a4dc76'); onePay.debug = true;
        globalSession.unsubscribe = () => { try { if (typeof onePay.stop === 'function') onePay.stop(); } catch {} };
        onePay.getCode({ transactionid: currentOrderId, invoiceid: currentOrderId, terminalid: '001', amount: amountNumber, description: `Order: ${currentOrderId}`, expiretime: 5 }, (code) => {
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${code}`;
          if (globalSession.orderId !== currentOrderId) return; globalSession.code = qrUrl; notifyListeners();
        });
        onePay.subscribe({ uuid: currentOrderId, shopcode: null, tid: null }, (res) => {
          if (!res || res.uuid !== currentOrderId || globalSession.orderId !== currentOrderId || globalSession.success) return;
          globalSession.success = true; notifyListeners(); notifySuccessHandlers();
        });
      } catch (error) { console.error('OnePay initialization failed', error); }
    };
    if (!(globalSession.orderId === currentOrderId && globalSession.amount === amountNumber)) startNewSession();
    else notifyListeners();
    return () => { globalSession.listeners.delete(handleSessionUpdate); globalSession.successHandlers.delete(successHandler); };
  }, [orderId, totalAmount]);

  return (
    <div className="flex flex-col items-center justify-center text-center space-y-4">
      {qrSuccess ? (
        <div className="flex flex-col items-center justify-center space-y-3"><CheckCircle className="text-green-500 w-20 h-20" /><p className="text-lg font-semibold text-green-600">ຊໍາລະເງິນສໍາເລັດ!</p></div>
      ) : (
        <><div id="qrcode" className="border-4 border-dashed border-red-400 rounded-xl p-2 bg-white shadow-lg"><img ref={qrRef} className="rounded-md" alt="QR Code" /></div>
          <p className="text-gray-600 text-sm">ສະແກນ QR ດ້ວຍ <span className="font-bold text-blue-600">BCEL One</span></p>
          <div className="mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm">{Number(totalAmount || 0).toLocaleString()} ₭</div>
        </>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════
   CancelBillModal
   ════════════════════════════════════════════ */
const REASONS = ['ລູກຄ້າຍົກເລີກ', 'ປ່ຽນລາຍການ', 'ບັນຫາການຊໍາລະ', 'ສິນຄ້າບໍ່ພໍ', 'ໝົດເວລາລໍຖ້າ', '📝 ອື່ນໆ'];

const CancelBillModal = ({ isOpen, onClose, onConfirm }) => {
  const [cancelSearchTerm, setCancelSearchTerm] = useState('');
  const [isCancelSearching, setIsCancelSearching] = useState(false);
  const [cancelResults, setCancelResults] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  if (!isOpen) return null;
  const finalReason = selectedReason === '📝 ອື່ນໆ' ? cancelNote : selectedReason;
  const billCode = selectedBill?.doc_no || selectedBill?.orderId || '';
  const readyToConfirm = !!selectedBill && !!finalReason && confirmCode.trim() === (billCode || '').trim();
  const handleCancelSearch = async () => {
    if (!cancelSearchTerm.trim()) return;
    setIsCancelSearching(true);
    try { const data = await searchBillsAction(cancelSearchTerm.trim()); setCancelResults(Array.isArray(data) ? data : []); setSelectedBill(null); setConfirmCode(''); setHasSearched(true); }
    catch { setCancelResults([]); setHasSearched(true); }
    finally { setIsCancelSearching(false); }
  };
  const handleCancelClose = () => { setSelectedReason(''); setCancelNote(''); setConfirmCode(''); setSelectedBill(null); setCancelResults([]); setCancelSearchTerm(''); setHasSearched(false); onClose(); };
  const onConfirmAction = () => { onConfirm({ bill: selectedBill, reason: finalReason.trim() }); handleCancelClose(); };
  return (
    <div
      className="fixed inset-0 z-[150] flex items-start justify-center p-3 pt-[6vh] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleCancelClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Slim header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-100 shrink-0">
          <Trash2 size={16} className="text-rose-500" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-slate-800 leading-tight">ຍົກເລີກບິນຂາຍ</div>
            <div className="text-[10px] text-slate-400 leading-tight">ຄົ້ນຫາ ແລະ ຢືນຢັນເພື່ອລຶບ</div>
          </div>
          <button
            onClick={handleCancelClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Search row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
              <input
                value={cancelSearchTerm}
                onChange={(e) => setCancelSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCancelSearch()}
                placeholder="ປ້ອນເລກບິນ…"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none text-[13px] font-mono font-bold text-slate-700 placeholder:text-slate-400 transition-all"
                autoFocus
              />
            </div>
            <button
              onClick={handleCancelSearch}
              disabled={isCancelSearching}
              className="h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              {isCancelSearching ? <Loader2 size={14} className="animate-spin" /> : 'ຄົ້ນຫາ'}
            </button>
          </div>

          {/* Search results */}
          {hasSearched ? (
            cancelResults.length > 0 ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                {cancelResults.map((bill) => (
                  <button
                    key={bill.doc_no}
                    onClick={() => { setSelectedBill(bill); setConfirmCode(''); }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 last:border-0 transition-colors text-left ${
                      selectedBill?.doc_no === bill.doc_no ? 'bg-slate-50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold font-mono text-slate-800 truncate">{bill.doc_no}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {bill.customer_name || 'ລູກຄ້າທົ່ວໄປ'} · {bill.item_count} ລາຍການ
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[14px] font-black tabular-nums text-slate-900">{(bill.grand_total || 0).toLocaleString()} ₭</div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                        <History size={10} /> {bill.doc_date}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 text-[13px] text-slate-400 font-medium">
                ບໍ່ພົບບິນ
              </div>
            )
          ) : null}

          {/* Reason + confirm */}
          {selectedBill ? (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  ເຫດຜົນການຍົກເລີກ
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedReason(r)}
                      className={`h-10 px-2 rounded-lg text-[12px] font-bold border transition-colors ${
                        selectedReason === r
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {selectedReason === '📝 ອື່ນໆ' ? (
                <textarea
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  placeholder="ລະບຸເຫດຜົນ…"
                  className="w-full p-3 rounded-lg bg-white border border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none text-[13px] font-medium resize-none transition-colors"
                  rows={2}
                />
              ) : null}

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                <div className="flex gap-2.5 mb-3">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[13px] font-bold text-rose-800">ຢືນຢັນການລຶບບິນ</div>
                    <div className="text-[11px] text-rose-700/80 mt-0.5">
                      ພິມເລກບິນ <span className="font-mono font-bold bg-rose-100 px-1.5 py-0.5 rounded">{selectedBill.doc_no}</span> ເພື່ອຢືນຢັນ
                    </div>
                  </div>
                </div>
                <input
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="ພິມເລກບິນ…"
                  className="w-full h-11 px-3 rounded-lg bg-white border border-rose-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 outline-none text-center font-mono font-bold text-rose-700 text-[15px] placeholder:text-rose-200 transition-colors"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-slate-100 flex gap-2">
          <button
            onClick={handleCancelClose}
            className="h-11 px-4 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            ປິດ
          </button>
          <button
            onClick={onConfirmAction}
            disabled={!readyToConfirm}
            className={`flex-1 h-11 rounded-lg text-[13px] font-bold flex items-center justify-center gap-2 transition-colors ${
              readyToConfirm
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 size={15} /> ຢືນຢັນການລຶບ
          </button>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   ReceiptSlip — Print receipt
   ════════════════════════════════════════════ */
const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleString('en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateString; }
};

const ReceiptSlip = ({
  items: slipItems = [], orderId: slipOrderId, cashierName: slipCashier, cashierCode: slipCashierCode, salesName: slipSales, salesCode: slipSalesCode, member: slipMember, hasMember: slipHasMember,
  subtotal: slipSubtotal = 0, discount: slipDiscount = 0, promoDiscount: slipPromoDiscount = 0, memberDiscount: slipMemberDiscount = 0, total: slipTotal = 0,
  paymentType: slipPaymentType, receivedAmount: slipReceived = 0, changeDue: slipChange = 0, earnedPoints: slipPoints = 0, issuedAt: slipIssuedAt,
}) => {
  const timeLabel = slipIssuedAt ? formatDate(slipIssuedAt) : formatDate(new Date().toISOString());
  const SlipRow = ({ label, value, isBold, className = '' }) => (
    <div className={`flex justify-between items-start text-[8pt] ${isBold ? 'font-bold' : ''} ${className}`}>
      <span className="pr-2 whitespace-nowrap">{label}</span>
      <span className="font-mono text-right">{value}</span>
    </div>
  );
  return (
    <div id="slip-print-root" style={{ fontFamily: "'Phetsarath OT', 'Noto Sans Lao', sans-serif" }}>
      <div className="slip-paper bg-white text-black p-[3mm]">
        <header className="text-center mb-3">
          <h1 className="font-bold text-[11pt] tracking-wide">ODIENMALL</h1>
          <p className="text-[7pt]">ອາໄຫຼ່ ແລະ ບໍລິການ</p>
          <p className="text-[7pt]">ບ້ານ ຂົວຫຼວງ, ເມືອງ ຈັນທະບູລີ, ນະຄອນຫຼວງວຽງຈັນ</p>
          <p className="text-[7pt]">ໂທ: 021 216 060</p>
        </header>
        <section className="border-t border-b border-dashed border-black py-2 my-2 space-y-1">
          <SlipRow label="ເລກທີບິນ:" value={slipOrderId || '-'} />
          <SlipRow label="ວັນທີ:" value={timeLabel} />
          <SlipRow label="ພນງ.ຂາຍ:" value={slipSales || slipSalesCode || '-'} />
          <SlipRow label="ພນງ.ເກັບເງິນ:" value={slipCashier || slipCashierCode || '-'} />
        </section>
        <table className="w-full text-[8pt]">
          <thead><tr className="border-b border-dashed border-black"><th className="text-left font-bold pb-1">ລາຍການ</th><th className="text-center font-bold pb-1">Qty</th><th className="text-right font-bold pb-1">ລວມ</th></tr></thead>
          <tbody>{slipItems.map((item, idx) => (
            <tr key={item.id || idx} className="align-top">
              <td className="pt-1 pr-1">{item.name}<div className="font-mono text-[7pt] opacity-80">{formatPrice(item.price)}</div>
                {item?.is_promo_gift && item?.gift_for_name && <div className="text-[7pt] text-blue-600 font-bold">ແຖມຈາກ: {item.gift_for_name}</div>}
              </td>
              <td className="pt-1 text-center font-mono">{item.quantity}</td>
              <td className="pt-1 text-right font-mono">{formatPrice(item.price * item.quantity)}</td>
            </tr>
          ))}</tbody>
        </table>
        <section className="border-t border-dashed border-black mt-2 pt-2 space-y-1">
          <SlipRow label="ຍອດລວມ:" value={formatPrice(slipSubtotal)} />
          {slipPromoDiscount > 0 && <SlipRow label="ໂປຣໂມຊັນ 1 ແຖມ 1:" value={`-${formatPrice(slipPromoDiscount)}`} />}
          {slipMemberDiscount > 0 && <SlipRow label={`ສ່ວນຫຼຸດ (${slipMember?.discount || 0}%):`} value={`-${formatPrice(slipMemberDiscount)}`} />}
          {slipDiscount > 0 && slipPromoDiscount <= 0 && slipMemberDiscount <= 0 && <SlipRow label="ສ່ວນຫຼຸດ:" value={`-${formatPrice(slipDiscount)}`} />}
          <SlipRow label="ລວມທັງໝົດ:" value={`${formatPrice(slipTotal)} ກີບ`} isBold className="text-[10pt] mt-2" />
        </section>
        <section className="border-t border-dashed border-black mt-2 pt-2 space-y-1">
          <SlipRow label="ຊໍາລະໂດຍ:" value={slipPaymentType === 'transfer' ? 'ໂອນ (OnePay)' : 'ເງິນສົດ'} isBold />
          {slipPaymentType === 'cash' && (<><SlipRow label="ຮັບເງິນ:" value={formatPrice(slipReceived)} /><SlipRow label="ເງິນທອນ:" value={formatPrice(slipChange)} className="font-bold" /></>)}
        </section>
        {slipHasMember && (
          <section className="border-t border-dashed border-black mt-2 pt-2 space-y-1">
            <div className="font-bold text-center text-[8pt] mb-1">-- ສະมາຊິກ --</div>
            <SlipRow label="ຊື່:" value={slipMember?.name || '-'} />
            <SlipRow label="ເບີໂທ:" value={slipMember?.phone || '-'} />
            <SlipRow label="ແຕ້ມທີ່ໄດ້ຮັບ:" value={`+${slipPoints}`} isBold />
          </section>
        )}
        <footer className="text-center mt-3 pt-2 border-t border-dashed border-black">
          <p className="font-bold text-[9pt]">ຂອບໃຈທີ່ມາອຸດໜູນ!</p>
          <p className="text-[7pt] mt-1">www.odglao.com</p>
          <p className="text-[7pt] opacity-80">Powered by ODIEN POS</p>
        </footer>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   DailySubmissionSlip — Print daily summary
   ════════════════════════════════════════════ */
const DailySubmissionSlip = ({ summary: dsSummary = {}, bills: dsBills = [], cashierName: dsCashier = '', cashierCode: dsCashierCode = '', salesName: dsSales = '', salesCode: dsSalesCode = '', recipient: dsRecipient = '', submittedAt: dsSubmittedAt = new Date().toLocaleString('lo-LA') }) => {
  const { total_all: ds_total_all = 0, total_cash: ds_total_cash = 0, total_transfer: ds_total_transfer = 0, count_bills: ds_count_bills = 0 } = dsSummary;
  return (
    <div className="slip-print-root">
      <div className="slip-paper">
        <div className="text-center mb-4">
          <div className="text-[16px] font-black text-slate-900 mb-1">ODG SPARE PART</div>
          <div className="text-[11px] font-bold text-slate-700">ໃບສົ່ງເງິນປະຈໍາວັນ</div>
          <div className="text-[10px] font-semibold text-slate-600">Daily Money Submission</div>
        </div>
        <div className="slip-divider" />
        <div className="text-center mb-3"><div className="text-[10px] font-bold text-slate-700">{dsSubmittedAt}</div></div>
        <div className="slip-divider" />
        <div className="space-y-2 mb-3">
          <div className="text-[11px] font-black text-slate-800 mb-2">ສະຫຼຸບຍອດເງິນ</div>
          <div className="slip-row text-[10px]"><span className="font-bold text-emerald-700">ເງິນສົດ (Cash)</span><span className="font-mono font-bold text-emerald-700">{formatPrice(ds_total_cash)} ₭</span></div>
          <div className="slip-row text-[10px]"><span className="font-bold text-blue-700">ເງິນໂອນ (Transfer)</span><span className="font-mono font-bold text-blue-700">{formatPrice(ds_total_transfer)} ₭</span></div>
          <div className="slip-divider" />
          <div className="slip-row text-[12px]"><span className="font-black text-slate-900">ຍອດລວມທັງໝົດ</span><span className="font-mono font-black text-slate-900">{formatPrice(ds_total_all)} ₭</span></div>
          <div className="slip-row text-[10px]"><span className="font-bold text-slate-600">ຈຳນວນບິນ</span><span className="font-mono font-bold text-slate-700">{ds_count_bills}</span></div>
        </div>
        <div className="slip-divider" />
        {dsBills && dsBills.length > 0 && (
          <div className="mb-3"><div className="text-[10px] font-black text-slate-800 mb-2">ລາຍການບິນ</div>
            <div className="space-y-1">{dsBills.map((bill, idx) => (
              <div key={bill.id || bill.order_id || idx} className="text-[9px] border-b border-slate-100 pb-1">
                <div className="flex justify-between items-center"><span className="font-mono font-bold text-slate-700">{bill.order_id || '-'}</span><span className="font-mono font-bold text-slate-900">{formatPrice(bill.total || 0)} ₭</span></div>
                <div className="flex justify-between items-center mt-0.5 text-slate-500"><span className="font-semibold">{bill.staff || '-'}</span><span className="uppercase font-bold text-[8px]">{bill.payment_type || '-'}</span></div>
              </div>
            ))}</div></div>
        )}
        <div className="slip-divider" />
        <div className="space-y-1.5 mb-3 text-[10px]">
          <div className="slip-row"><span className="font-bold text-slate-600">Cashier</span><span className="font-semibold text-slate-800">{dsCashierCode ? `${dsCashierCode} / ${dsCashier}` : dsCashier || '-'}</span></div>
          {dsSalesCode && dsSales && <div className="slip-row"><span className="font-bold text-slate-600">Sales</span><span className="font-semibold text-slate-800">{dsSalesCode} / {dsSales}</span></div>}
          {dsRecipient && <div className="slip-row"><span className="font-bold text-slate-600">ຜູ້ຮັບເງິນ</span><span className="font-semibold text-slate-800">{dsRecipient}</span></div>}
        </div>
        <div className="slip-divider" />
        <div className="grid grid-cols-2 gap-4 mb-3 text-[9px]">
          <div className="text-center"><div className="h-8 border-b border-slate-300 mb-1"></div><div className="font-bold text-slate-700">ຜູ້ສົ່ງເງິນ</div></div>
          <div className="text-center"><div className="h-8 border-b border-slate-300 mb-1"></div><div className="font-bold text-slate-700">ຜູ້ຮັບເງິນ</div></div>
        </div>
        <div className="slip-divider" />
        <div className="text-center space-y-2 mb-3"><div className="text-[12px] font-black text-slate-800">ຂອບໃຈ</div><div className="text-[10px] font-bold text-slate-600">THANK YOU</div></div>
        <div className="text-center text-[8px] text-slate-400 space-y-0.5"><p className="font-mono">www.odglao.com</p><p className="font-semibold">Powered by ODIEN POS System</p></div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   CustomerDisplay — secondary screen
   ════════════════════════════════════════════ */
const formatCurrency = (val) => (Number(val) || 0).toLocaleString("en-US");

const CustomerDisplay = ({
  orderId: cdOrderId, items: cdItems = [], total: cdTotal = 0, paymentType: cdPaymentType = "cash",
  receivedAmount: cdReceived = 0, onPaymentSuccess: cdOnPaymentSuccess, cashierName: cdCashier = "Staff"
}) => {
  const [cdStatus, setCdStatus] = useState("idle");
  const [cdCurrentTime, setCdCurrentTime] = useState("");
  const cdBottomRef = useRef(null);

  useEffect(() => {
    const updateTime = () => { setCdCurrentTime(new Date().toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })); };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel("odg-pos");
    channel.onmessage = (e) => { if (e.data?.type === "PAYMENT_SUCCESS") setCdStatus("success"); };
    return () => channel.close();
  }, []);

  useEffect(() => { cdBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [cdItems]);

  useEffect(() => {
    if (cdStatus === 'success') {
       if(cdOnPaymentSuccess) cdOnPaymentSuccess();
       const t = setTimeout(() => setCdStatus("idle"), 5000);
       return () => clearTimeout(t);
    } else if (cdItems.length > 0) {
       setCdStatus("active");
    } else {
       setCdStatus("idle");
    }
  }, [cdStatus, cdItems, cdOnPaymentSuccess]);

  const cdChange = Math.max((Number(cdReceived) || 0) - cdTotal, 0);
  const getLineTotal = (item) => (
    Number(item?.lineNet ?? item?.line_total ?? item?.lineTotal ?? (item?.price || 0) * (item?.quantity || 0))
  );

  if (cdItems.length === 0 && cdStatus !== 'success') {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-['Noto_Sans_Lao'] text-white">
         <div className="absolute inset-0 opacity-30">
            <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-800 rounded-full blur-[150px] animate-pulse" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-900 rounded-full blur-[120px]" />
         </div>
         <div className="relative z-10 flex flex-col items-center text-center">
            <div className="mb-10 relative">
                <div className="w-40 h-40 bg-blue-500 rounded-[3rem] flex items-center justify-center shadow-[0_20px_50px_rgba(249,115,22,0.4)] animate-bounce duration-[3000ms]">
                    <ShoppingBag size={80} strokeWidth={1.5} />
                </div>
            </div>
            <h1 className="text-9xl font-black tracking-tighter mb-4 italic">ODIEN</h1>
            <p className="text-3xl font-bold tracking-[0.5em] text-blue-500 mb-12 uppercase">Spare Parts</p>
            <div className="bg-white/5 backdrop-blur-2xl px-12 py-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
               <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-black mb-2">Local Time</p>
               <p className="text-7xl font-black font-mono tracking-tighter text-white">{cdCurrentTime}</p>
            </div>
         </div>
         <div className="absolute bottom-12 flex items-center gap-3 bg-white/5 px-6 py-3 rounded-full border border-white/5">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            <span className="text-sm font-bold text-slate-400">Cashier: {cdCashier}</span>
         </div>
      </div>
    );
  }

  if (cdStatus === 'success') {
    return (
      <div className="h-screen w-screen bg-emerald-500 text-white flex flex-col items-center justify-center relative overflow-hidden font-['Noto_Sans_Lao']">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent" />
         <div className="relative z-10 flex flex-col items-center animate-in zoom-in duration-500">
            <div className="w-48 h-48 bg-white text-emerald-500 rounded-full flex items-center justify-center shadow-2xl mb-10">
                <CheckCircle2 size={120} strokeWidth={2.5} />
            </div>
            <h1 className="text-9xl font-black mb-2 tracking-tighter">ຂອບໃຈ</h1>
            <p className="text-4xl font-bold opacity-80 uppercase tracking-widest">Payment Success</p>
            {cdChange > 0 && (
                <div className="mt-16 bg-black/10 backdrop-blur-md px-16 py-8 rounded-[3rem] border border-white/20 text-center">
                    <p className="text-sm font-black uppercase tracking-widest mb-2 opacity-70">ເງິນທອນ (Change)</p>
                    <p className="text-8xl font-black font-mono tracking-tighter">{formatCurrency(cdChange)} ₭</p>
                </div>
            )}
         </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 font-['Noto_Sans_Lao'] overflow-hidden">
       <div className="h-[40%] bg-slate-950 text-white p-12 relative flex flex-col justify-end overflow-hidden">
          <div className="absolute top-0 right-0 w-[50%] h-full bg-blue-800/20 blur-[100px]" />
          <div className="relative z-10 flex justify-between items-end">
             <div className="space-y-4">
                <div className="inline-flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Order #{cdOrderId || 'NEW'}</span>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-400 uppercase tracking-wider mb-1">ຍອດລວມທັງໝົດ</h2>
                    <div className="flex items-baseline gap-4">
                        <span className="text-[10rem] font-black leading-none tracking-tighter text-white font-mono">{formatCurrency(cdTotal)}</span>
                        <span className="text-5xl font-black text-blue-500">₭</span>
                    </div>
                </div>
             </div>
             {cdPaymentType === 'transfer' && (
                <div className="mb-8 animate-in slide-in-from-right duration-500">
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl shadow-blue-500/20 border-4 border-blue-500">
                        <OnePayQR orderId={cdOrderId} totalAmount={cdTotal} size={240} />
                        <div className="mt-4 flex items-center justify-center gap-2 text-slate-900 font-black uppercase tracking-tighter">
                            <QrCode size={20} className="text-blue-500" /> Scan to pay
                        </div>
                    </div>
                </div>
             )}
          </div>
       </div>
       <div className="flex-1 bg-white overflow-y-auto px-12 py-8 scrollbar-hide">
          <div className="grid grid-cols-1 gap-4">
             {cdItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200">
                        <Package size={32} className="text-slate-400" />
                      </div>
                      <div>
                        <h4 className="text-3xl font-black text-slate-900 leading-none mb-1 uppercase">{item.name}</h4>
                        <p className="text-xl font-bold text-slate-400 uppercase">{formatCurrency(item.price)} × {item.quantity}</p>
                        {item?.is_promo_gift && item?.gift_for_name && (
                          <p className="text-lg font-bold text-blue-600 uppercase">ແຖມຈາກ: {item.gift_for_name}</p>
                        )}
                      </div>
                   </div>
                   <div className="text-right">
                      <span className="text-4xl font-black font-mono text-slate-900">{formatCurrency(getLineTotal(item))}</span>
                      <span className="ml-2 text-lg font-bold text-slate-300">₭</span>
                   </div>
                </div>
             ))}
             <div ref={cdBottomRef} />
          </div>
       </div>
       <div className="h-32 bg-white border-t border-slate-100 px-12 flex items-center justify-between shadow-[0_-20px_50px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
             <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Clock size={32} /></div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Time</p>
                <p className="text-2xl font-black font-mono text-slate-900">{cdCurrentTime}</p>
             </div>
          </div>
          <div className="flex items-center gap-6">
             {cdPaymentType === 'cash' && cdReceived > 0 ? (
                <>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Received (ຮັບມາ)</p>
                        <p className="text-3xl font-black text-slate-900 font-mono">{formatCurrency(cdReceived)} ₭</p>
                    </div>
                    <div className="h-16 w-px bg-slate-200 mx-2" />
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Change (ທອນ)</p>
                        <p className="text-5xl font-black text-blue-500 font-mono tracking-tighter">{formatCurrency(cdChange)} ₭</p>
                    </div>
                </>
             ) : (
                <div className="flex items-center gap-3 bg-slate-950 px-8 py-4 rounded-2xl">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500"><Wallet size={16} className="text-white" /></div>
                    <span className="text-lg font-black text-white uppercase tracking-widest">{cdPaymentType === 'transfer' ? 'Waiting for Transfer' : 'Waiting for Cash'}</span>
                    <div className="flex gap-1 ml-4">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                </div>
             )}
          </div>
       </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   CartItem + Cart — Shopping cart
   ════════════════════════════════════════════ */
const CartItem = ({
  item, imageUrl, discountPercent = 0, onUpdateQty, onSetQty, onRemove,
  isEditing, onEditingChange, qtyInputValue, onQtyInputChange,
}) => {
  const { id, name, price, quantity, unit } = item;
  const giftForName = item?.gift_for_name || '';
  const isGiftItem = !!item?.is_promo_gift;
  const safePrice = toNumber(price);
  const cartPricing = calculateLinePricing(item, discountPercent);
  const lineSubtotal = cartPricing.lineSubtotal;
  const lineNet = cartPricing.lineNet;
  const cartPromoDiscount = cartPricing.promoDiscount;
  const promoFreeQty = cartPricing.promoFreeQty;
  const hasMemberDiscount = discountPercent > 0;
  const hasPromoDiscount = cartPromoDiscount > 0;
  const hasDiscount = hasMemberDiscount || hasPromoDiscount;
  const unitNetPrice = quantity > 0 ? lineNet / quantity : safePrice;
  const handleQtyBlur = () => {
    const raw = String(qtyInputValue ?? '');
    const normalized = raw.replace(',', '.').trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed > 0) { onSetQty(id, parsed); } else { onQtyInputChange(id, quantity); }
    onEditingChange(id, false);
  };
  const handleKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } };
  return (
    <div className={`group grid grid-cols-[44px_minmax(0,1fr)_120px_120px_28px] gap-3 items-center px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50/60 transition-colors ${isGiftItem ? 'bg-rose-50/40' : ''}`}>
      {/* Image */}
      <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <ShoppingBag size={16} className="text-slate-300" />
        )}
      </div>

      {/* Name + meta */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {isGiftItem ? (
            <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 bg-rose-100 rounded px-1.5 py-0.5 shrink-0">Gift</span>
          ) : null}
          <h4 className="text-[13px] font-semibold text-slate-800 truncate">{name}</h4>
          {hasPromoDiscount ? (
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 shrink-0">1+1</span>
          ) : null}
          {hasMemberDiscount ? (
            <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 shrink-0">-{discountPercent}%</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
          <span>#{id}</span>
          {unit ? <span>· {unit}</span> : null}
          {hasDiscount ? <span className="text-slate-500">@ {formatPrice(unitNetPrice)}</span> : <span>@ {formatPrice(safePrice)}</span>}
        </div>
        {item?.is_promo_gift && giftForName ? (
          <div className="text-[10px] text-rose-500 mt-0.5">↳ from {giftForName}</div>
        ) : null}
        {promoFreeQty > 0 ? (
          <div className="text-[10px] text-emerald-600 mt-0.5">+ {promoFreeQty} free</div>
        ) : null}
      </div>

      {/* Qty */}
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => { if (!isGiftItem) onUpdateQty(id, -1); }}
          disabled={isGiftItem}
          className={`w-7 h-7 rounded-md border flex items-center justify-center transition-colors ${
            isGiftItem
              ? 'border-slate-100 text-slate-200 cursor-not-allowed'
              : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Minus size={12} strokeWidth={2.5} />
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={isEditing ? qtyInputValue : quantity}
          onChange={(e) => {
            if (isGiftItem) return;
            const value = e.target.value;
            if (value === '' || /^\d*\.?\d*$/.test(value)) onQtyInputChange(id, value);
          }}
          onFocus={() => { if (!isGiftItem) onEditingChange(id, true); }}
          onBlur={handleQtyBlur}
          onKeyDown={handleKeyDown}
          readOnly={isGiftItem}
          className={`w-12 h-7 text-center text-[12px] font-bold tabular-nums rounded-md border outline-none transition-colors ${
            isGiftItem
              ? 'text-slate-400 bg-slate-50 border-slate-100 cursor-not-allowed'
              : 'text-slate-800 bg-white border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
          }`}
        />
        <button
          onClick={() => { if (!isGiftItem) onUpdateQty(id, 1); }}
          disabled={isGiftItem}
          className={`w-7 h-7 rounded-md border flex items-center justify-center transition-colors ${
            isGiftItem
              ? 'border-slate-100 text-slate-200 cursor-not-allowed'
              : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Plus size={12} strokeWidth={2.5} />
        </button>
      </div>

      {/* Line total */}
      <div className="text-right">
        {hasDiscount ? (
          <div className="text-[10px] text-slate-400 line-through tabular-nums leading-none">{formatPrice(lineSubtotal)}</div>
        ) : null}
        <div className={`text-[13px] font-black tabular-nums leading-tight ${isGiftItem ? 'text-rose-600' : 'text-slate-900'}`}>
          {isGiftItem && lineNet === 0 ? 'FREE' : `${formatPrice(lineNet)}`}
        </div>
        <div className="text-[10px] text-slate-400 leading-none">₭</div>
      </div>

      {/* Remove */}
      <div className="flex items-center justify-center">
        <button
          onClick={() => { if (!isGiftItem) onRemove(id); }}
          disabled={isGiftItem}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 ${
            isGiftItem
              ? 'text-slate-200 cursor-not-allowed'
              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
          }`}
          title="Remove"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

const Cart = ({ items: cartItems = [], onUpdateQty, onSetQty, onRemoveItem, hasMember: cartHasMember = false, selectedMember: cartMember = null, onBarcodeSubmit }) => {
  const cartIsEmpty = cartItems.length === 0;
  const [barcode, setBarcode] = useState('');
  const [qtyInputs, setQtyInputs] = useState({});
  const [editingIds, setEditingIds] = useState({});
  useEffect(() => {
    const newQtyInputs = { ...qtyInputs };
    cartItems.forEach(item => { if (!editingIds[item.id]) { newQtyInputs[item.id] = item.quantity; } });
    setQtyInputs(newQtyInputs);
  }, [cartItems]);
  const handleQtyInputChange = (id, value) => { setQtyInputs(prev => ({ ...prev, [id]: value })); };
  const handleEditingChange = (id, editing) => { setEditingIds(prev => ({ ...prev, [id]: editing })); if (editing) { const currentItem = cartItems.find(item => item.id === id); if (currentItem) { setQtyInputs(prev => ({ ...prev, [id]: currentItem.quantity })); } } };
  const [imageMap, setImageMap] = useState({});
  useEffect(() => {
    let isMounted = true;
    const fetchImages = async () => { try { const list: any[] = (await listProductImagesAction()) || []; const newImageMap: Record<string, any> = {}; if (Array.isArray(list)) { list.forEach((img) => { const key = String(img?.ic_code ?? ''); if (key && !newImageMap[key]) newImageMap[key] = img; }); } if (isMounted) setImageMap(newImageMap); } catch { if (isMounted) setImageMap({}); } };
    fetchImages();
    return () => { isMounted = false; };
  }, []);
  const imageBaseUrl = '';
  const getImageUrl = (item) => { const img = imageMap[item.id] || imageMap[item.barcode] || imageMap[item.ic_code]; return img?.file_url ? `${imageBaseUrl}${img.file_url}` : ''; };
  const handleBarcodeSubmit = (event) => { event.preventDefault(); if (!barcode.trim()) return; onBarcodeSubmit?.(barcode.trim()); setBarcode(''); };
  const cartDiscountPercent = cartHasMember && cartMember?.discount > 0 ? cartMember.discount : 0;
  const displayItems = useMemo(() => {
    const baseItems = cartItems.filter((item) => !item?.is_promo_gift);
    const giftItems = cartItems.filter((item) => item?.is_promo_gift);
    if (giftItems.length === 0) return cartItems;
    const giftMap = new Map(); giftItems.forEach((gift) => { const key = gift.gift_for_code || ''; if (!key) return; if (!giftMap.has(key)) giftMap.set(key, []); giftMap.get(key).push(gift); });
    const usedGiftIds = new Set(); const ordered = [];
    baseItems.forEach((item) => { ordered.push(item); [item.id, item.item_code, item.barcode].filter(Boolean).forEach((code) => { (giftMap.get(code) || []).forEach((gift) => { if (!usedGiftIds.has(gift.id)) { ordered.push(gift); usedGiftIds.add(gift.id); } }); }); });
    giftItems.forEach((gift) => { if (!usedGiftIds.has(gift.id)) { ordered.push(gift); usedGiftIds.add(gift.id); } });
    return ordered;
  }, [cartItems]);

  return (
    <div className="flex w-full flex-col h-full min-h-0 bg-white rounded-3xl border border-slate-200/80 shadow-[0_12px_40px_rgba(15,23,42,0.06)] overflow-hidden">
      {/* Sticky barcode/search header */}
      {onBarcodeSubmit ? (
        <div className="shrink-0 border-b border-slate-100 px-4 sm:px-5 py-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-600">Current order</p>
              <h1 className="text-[18px] font-black text-slate-900">ລາຍການສິນຄ້າ</h1>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">{cartItems.length} ລາຍການ</div>
          </div>
          <form onSubmit={handleBarcodeSubmit} className="relative group">
            <ScanLine
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors pointer-events-none"
              size={16}
              strokeWidth={2}
            />
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="ສະແກນບາໂຄດ ຫຼື ພິມລະຫັດ…"
              className="w-full h-12 pl-10 pr-20 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-[14px] font-semibold placeholder:text-slate-400"
              autoFocus
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 pointer-events-none">Enter</kbd>
          </form>
        </div>
      ) : null}

      {/* Column headers (only when items present) */}
      {!cartIsEmpty ? (
        <div className="shrink-0 grid grid-cols-[44px_minmax(0,1fr)_120px_120px_28px] gap-3 px-4 py-2 border-b border-slate-100 bg-slate-50/50">
          <div />
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Item</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">Qty</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Total</div>
          <div />
        </div>
      ) : null}

      {/* Items list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {cartIsEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06),transparent_32%)]">
            <div className="w-20 h-20 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 mb-5 shadow-sm">
              <ShoppingBag size={32} strokeWidth={1.7} />
            </div>
            <p className="text-[17px] font-black text-slate-800">ພ້ອມເລີ່ມການຂາຍ</p>
            <p className="text-[13px] text-slate-400 mt-1.5 max-w-xs">ສະແກນບາໂຄດ ຫຼື ເລືອກຄົ້ນຫາສິນຄ້າຈາກແຖບດ້ານຊ້າຍ</p>
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500 shadow-sm"><ScanLine size={14} className="text-indigo-500" /> ຮອງຮັບ Barcode scanner</div>
          </div>
        ) : (
          <div>
            {displayItems.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                imageUrl={getImageUrl(item)}
                discountPercent={cartDiscountPercent}
                onUpdateQty={onUpdateQty}
                onSetQty={onSetQty}
                onRemove={onRemoveItem}
                isEditing={!!editingIds[item.id]}
                onEditingChange={handleEditingChange}
                qtyInputValue={qtyInputs[item.id]}
                onQtyInputChange={handleQtyInputChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer: item count */}
      {!cartIsEmpty ? (
        <div className="shrink-0 px-4 py-2 border-t border-slate-100 bg-slate-50/30 text-[11px] text-slate-500 font-medium flex items-center justify-between">
          <span>{cartItems.length} ລາຍການ</span>
          <span className="text-slate-400">{displayItems.reduce((sum, it) => sum + (Number(it?.quantity) || 0), 0)} ຫົວ</span>
        </div>
      ) : null}
    </div>
  );
};

/* ActionButton and SummaryPayCard were removed during the redesign.
 * Secondary actions now live in LeftRail, totals + pay CTAs in PayPanel,
 * and product search in ProductSearchModal — all under @/components/pos. */

/* ════════════════════════════════════════════
   PaymentPanel — Payment modal
   ════════════════════════════════════════════ */
const CurrencyInput = ({ value, onChange, currency, symbol, label, size = 'normal', autoFocus = false }) => {
  const sizeClasses = { large: 'h-14 text-2xl', normal: 'h-11 text-lg', small: 'h-9 text-sm' };
  return (
    <div className="space-y-1.5">
      {label ? <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label> : null}
      <div className="relative">
        <input
          type="text"
          value={value ? formatPrice(value) : ''}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="0"
          autoFocus={autoFocus}
          className={`w-full ${sizeClasses[size]} pl-4 pr-20 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold text-right tabular-nums placeholder:text-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none transition-colors`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-baseline gap-1 text-slate-400">
          <span className="text-base font-bold">{symbol}</span>
          <span className="text-[10px] font-bold uppercase tracking-wide">{currency}</span>
        </div>
      </div>
    </div>
  );
};

const RateInput = ({ label, value, onChange, symbol }) => (
  <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
    <input
      type="text"
      value={value ? formatPrice(value) : ''}
      onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
      className="flex-1 h-7 px-2 bg-white border border-slate-200 rounded-md text-[12px] font-bold tabular-nums text-slate-700 text-right focus:border-slate-900 outline-none transition-colors"
    />
    <span className="text-[10px] font-mono text-slate-400">= 1{symbol}</span>
  </div>
);

const QuickAmountButton = ({ label, value, onClick, variant = 'default' }) => {
  const variants = {
    primary: 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800',
    default: 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:text-slate-900',
  };
  return (
    <button
      onClick={() => onClick(value)}
      className={`h-9 px-3 rounded-lg text-[12px] font-bold border transition-colors ${variants[variant]}`}
    >
      {label}
    </button>
  );
};

const PaymentMethodTab = ({ active, icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-[13px] font-bold transition-colors ${
      active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`}
  >
    <Icon size={15} strokeWidth={2} />
    <span>{label}</span>
  </button>
);

const PaymentSummaryRow = ({ label, value, highlight = false }) => (
  <div className="flex justify-between items-baseline py-1">
    <span className={`text-[11px] font-medium ${highlight ? 'text-slate-700' : 'text-slate-500'}`}>{label}</span>
    <span className={`tabular-nums ${highlight ? 'text-[14px] font-black text-slate-900' : 'text-[12px] font-bold text-slate-700'}`}>{value}</span>
  </div>
);

const PaymentPanel = ({ isOpen, onClose, total: pmTotal, orderId: pmOrderId, onConfirm, onPaymentSuccess: pmOnPaymentSuccess, onAmountChange, onForeignAmountChange, receivedAmount: pmReceived = '', paymentType: pmPaymentType = 'cash', onPaymentTypeChange, isPaying: pmIsPaying = false, currencies = [] }) => {
  const [activeTab, setActiveTab] = useState(pmPaymentType === 'transfer' ? 'qr' : 'cash');
  const [kipAmount, setKipAmount] = useState('');
  const [showRates, setShowRates] = useState(false);
  // One entry per currency the ERP knows, keyed by its code; rates come from
  // the ERP and the cashier can still correct one for the day.
  const [foreignAmounts, setForeignAmounts] = useState({});
  const [foreignRates, setForeignRates] = useState({});
  const [rates, setRates] = useState(() => { try { const stored = JSON.parse(localStorage.getItem('pos_fx_rates') || 'null'); if (stored && typeof stored === 'object') { return { thb: Number(stored.thb) || 520 }; } } catch {} return { thb: 520 }; });

  useEffect(() => {
    if (isOpen) {
      if (onAmountChange) onAmountChange('');
      setActiveTab(pmPaymentType === 'transfer' ? 'qr' : 'cash');
      setKipAmount(pmReceived ? String(pmReceived) : '');
      setForeignAmounts({});
      setForeignRates({});
      setShowRates(false);
      try { const stored = JSON.parse(localStorage.getItem('pos_fx_rates') || 'null'); if (stored && typeof stored === 'object') { setRates((prev) => ({ ...prev, thb: Number(stored.thb) || prev.thb })); } } catch {}
    }
  }, [isOpen, onAmountChange, pmPaymentType]);


  const numericKip = Number(kipAmount) || 0;
  // The ERP's rate unless the cashier has typed over it for the day; baht keeps
  // its own state because the top bar edits that one too.
  const rateFor = (code) => {
    if (code === BAHT_CURRENCY_CODE) return Number(rates.thb) || 0;
    const typed = Number(foreignRates[code]) || 0;
    return typed > 0 ? typed : Number(currencies.find((c) => c.code === code)?.kipPerUnit) || 0;
  };
  const tenders = currencies
    .map((c) => ({ currency_code: c.code, amount: Number(foreignAmounts[c.code]) || 0, kipRate: rateFor(c.code) }))
    .filter((t) => t.amount > 0 && t.kipRate > 0);
  const foreignInKip = tenders.reduce((sum, t) => sum + t.amount * t.kipRate, 0);
  const totalReceivedKip = numericKip + foreignInKip;
  const numericThb = Number(foreignAmounts[BAHT_CURRENCY_CODE]) || 0;
  const pmChange = Math.max(0, totalReceivedKip - pmTotal);
  const canConfirm = totalReceivedKip >= pmTotal;
  const tendersKey = JSON.stringify(tenders);

  useEffect(() => { if (onAmountChange) { onAmountChange(totalReceivedKip ? String(Math.round(totalReceivedKip)) : ''); } }, [totalReceivedKip, onAmountChange]);
  useEffect(() => {
    if (!onForeignAmountChange) return;
    onForeignAmountChange({
      thbAmount: numericThb,
      thbRate: Number(rates.thb) || 0,
      totalReceivedKip,
      tenders: JSON.parse(tendersKey).map(({ currency_code, amount }) => ({ currency_code, amount })),
    });
  }, [numericThb, rates.thb, totalReceivedKip, tendersKey, onForeignAmountChange]);
  useEffect(() => { localStorage.setItem('pos_fx_rates', JSON.stringify(rates)); }, [rates]);

  const handleConfirm = () => { if (pmIsPaying) return; onConfirm(); };
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Slim header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-slate-800 leading-tight">ຊຳລະເງິນ</div>
            <div className="text-[10px] text-slate-400 font-mono leading-tight">{pmOrderId || '—'}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row min-h-0 flex-1">
          {/* Left side — input flow */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
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
                <CurrencyInput
                  value={kipAmount}
                  onChange={setKipAmount}
                  currency="LAK"
                  symbol="₭"
                  label="ຈຳນວນເງິນທີ່ຮັບ"
                  size="large"
                  autoFocus
                />

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ເລືອກໄວ</label>
                  <div className="grid grid-cols-4 gap-2">
                    <QuickAmountButton label="ພໍດີ" value={pmTotal} onClick={setKipAmount} variant="primary" />
                    <QuickAmountButton label="50k" value={50000} onClick={setKipAmount} />
                    <QuickAmountButton label="100k" value={100000} onClick={setKipAmount} />
                    <QuickAmountButton label="500k" value={500000} onClick={setKipAmount} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 space-y-3 bg-slate-50/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ສະກຸນເງິນອື່ນ</span>
                    <button
                      onClick={() => setShowRates(!showRates)}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <Calculator size={12} />
                      <span>{showRates ? 'ເຊື່ອງ' : 'ແກ້ເລດ'}</span>
                    </button>
                  </div>
                  {currencies.map((c) => (
                    <div key={c.code} className="space-y-1.5">
                      <CurrencyInput
                        value={foreignAmounts[c.code] || ''}
                        onChange={(val) => setForeignAmounts((prev) => ({ ...prev, [c.code]: val }))}
                        currency={c.name || c.code}
                        symbol={CURRENCY_SYMBOLS[c.code] || ''}
                        size="normal"
                      />
                      {showRates ? (
                        <RateInput
                          label={`${c.name || c.code}→LAK`}
                          value={rateFor(c.code)}
                          onChange={(val) => {
                            if (c.code === BAHT_CURRENCY_CODE) setRates((prev) => ({ ...prev, thb: val }));
                            setForeignRates((prev) => ({ ...prev, [c.code]: val }));
                          }}
                          symbol={CURRENCY_SYMBOLS[c.code] || ''}
                        />
                      ) : null}
                    </div>
                  ))}
                  {foreignInKip > 0 ? (
                    <div className="pt-1 flex justify-between items-baseline text-[12px]">
                      <span className="text-slate-500">ລວມເປັນກີບ</span>
                      <span className="font-bold tabular-nums text-slate-900">{formatPrice(totalReceivedKip)} ₭</span>
                    </div>
                  ) : null}
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm || pmIsPaying}
                  className={`w-full h-12 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 transition-colors ${
                    canConfirm && !pmIsPaying
                      ? 'bg-slate-900 hover:bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {pmIsPaying ? (
                    <><Loader2 size={16} className="animate-spin" /><span>ກຳລັງດຳເນີນການ…</span></>
                  ) : (
                    <><CheckCircle2 size={16} strokeWidth={2.5} /><span>ຢືນຢັນການຊຳລະ</span></>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-2">
                <div className="mb-3 text-center">
                  <h3 className="text-[13px] font-bold text-slate-800">ສະແກນ QR Code</h3>
                  <p className="text-[11px] text-slate-500">ໃຊ້ແອັບ OnePay / BCEL ສະແກນເພື່ອຊຳລະ</p>
                </div>
                <div className="w-48 h-48 bg-white p-2 rounded-xl border border-slate-200 mb-3">
                  <OnePayQR orderId={pmOrderId} totalAmount={pmTotal} onPaymentSuccess={pmOnPaymentSuccess} />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full">
                  <Loader2 size={12} className="animate-spin text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-600">ກຳລັງລໍຖ້າການຊຳລະ…</span>
                </div>
              </div>
            )}
          </div>

          {/* Right side — running totals */}
          <div className="w-full md:w-60 bg-slate-50/60 border-t md:border-t-0 md:border-l border-slate-200 p-4 flex flex-col gap-3 shrink-0">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ຍອດທີ່ຕ້ອງຊຳລະ</div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black tabular-nums text-slate-900">{formatPrice(pmTotal)}</span>
                <span className="text-[14px] text-slate-400 font-bold">₭</span>
              </div>
            </div>
            <div className="h-px bg-slate-200" />
            <PaymentSummaryRow label="ຮັບມາ" value={`${formatPrice(totalReceivedKip)} ₭`} />
            {canConfirm ? (
              <PaymentSummaryRow label="ເງິນທອນ" value={`${formatPrice(pmChange)} ₭`} highlight />
            ) : null}
            <div className="mt-auto">
              <div
                className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] font-bold ${
                  canConfirm ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                }`}
              >
                {canConfirm ? (
                  <><CheckCircle2 size={14} /><span>ພ້ອມຢືນຢັນແລ້ວ</span></>
                ) : (
                  <><Banknote size={14} /><span>ຍັງຂາດ {formatPrice(pmTotal - totalReceivedKip)} ₭</span></>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   Main POS Page
   ════════════════════════════════════════════ */
export default function POS() {
  const navigate = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [cashierName, setCashierName] = useState('Cashier');
  const [cashierCode, setCashierCode] = useState('');
  const [salesName, setSalesName] = useState('');
  const [salesCode, setSalesCode] = useState('');
  const [items, setItems] = useState([]);
  const [orderId, setOrderId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimer = useRef(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentType, setPaymentType] = useState('cash');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [bahtAmount, setBahtAmount] = useState(0);
  const [bahtRate, setBahtRate] = useState(0);
  const [cashTenders, setCashTenders] = useState([]);
  const [erpCurrencies, setErpCurrencies] = useState([]);
  const [thbRateInput, setThbRateInput] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('pos_fx_rates') || 'null');
      const rate = Number(stored?.thb || 0);
      return rate > 0 ? String(rate) : '';
    } catch {
      return '';
    }
  });
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [showCancelBillModal, setShowCancelBillModal] = useState(false);
  // Stage 1 redesign — pickers lifted from Header to root POS render
  const [showSalesPicker, setShowSalesPicker] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [heldBills, setHeldBills] = useState([]);
  const customerWindow = useRef(null);
  const [isDisplayOpen, setIsDisplayOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const handlePaymentSuccess = useRef(null);
  const [selectedMember, setSelectedMember] = useState(DEFAULT_MEMBER);
  const hasMember = selectedMember.id !== DEFAULT_MEMBER.id;
  const [memberSearch, setMemberSearch] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const memberSearchTimer = useRef(null);
  const [staffList, setStaffList] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const staffSearchTimer = useRef(null);
  const [clock, setClock] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [isSendingDaily, setIsSendingDaily] = useState(false);
  const [isDailyLoading, setIsDailyLoading] = useState(false);
  const [dailySummary, setDailySummary] = useState({ total_all: 0, total_cash: 0, total_transfer: 0, count_bills: 0 });
  const [dailyBills, setDailyBills] = useState([]);
  const [dailyRecipient, setDailyRecipient] = useState('');
  const [showDailyConfirm, setShowDailyConfirm] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [lastSlip, setLastSlip] = useState(null);
  const [lastDailySlip, setLastDailySlip] = useState(null);
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [reprintDocNo, setReprintDocNo] = useState('');
  const [reprintLoading, setReprintLoading] = useState(false);
  const [reprintError, setReprintError] = useState('');
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [onlineOrders, setOnlineOrders] = useState([]);
  const [onlineQuery, setOnlineQuery] = useState('');
  const [onlineLoading, setOnlineLoading] = useState(false);
  const onlineSearchTimer = useRef(null);
  const [pendingPickupCount, setPendingPickupCount] = useState(0);
  const pickupCountRef = useRef({ initialized: false, count: 0 });
  const [currentPickupOrder, setCurrentPickupOrder] = useState(null);
  const [promotions, setPromotions] = useState([]);

  // Auth check
  useEffect(() => {
    const stored = localStorage.getItem('pos_user');
    if (stored) {
      const user = JSON.parse(stored);
      setCurrentUser(user);
      setCashierName(user?.name_1 || 'Cashier');
      setCashierCode(user?.code || '');
    } else {
      navigate.push('/login');
    }
  }, [navigate]);

  useEffect(() => {
    const numericRate = Number(String(thbRateInput).replace(/[^0-9]/g, '')) || 0;
    localStorage.setItem('pos_fx_rates', JSON.stringify({ thb: numericRate }));
  }, [thbRateInput]);

  // The currencies the counter may take, priced in kip by the ERP itself.
  useEffect(() => {
    let cancelled = false;
    getErpCurrenciesAction()
      .then((list) => { if (!cancelled && Array.isArray(list)) setErpCurrencies(list); })
      .catch(() => { /* the panel falls back to its last known rates */ });
    return () => { cancelled = true; };
  }, []);

  // Take the baht rate from the ERP on every load, so the till buys baht at the
  // rate the books convert at. A cashier can still type over it for the day.
  useEffect(() => {
    let cancelled = false;
    getErpThbRateAction()
      .then((res) => {
        const rate = Number(res?.rate) || 0;
        if (!cancelled && rate > 0) setThbRateInput(String(rate));
      })
      .catch(() => { /* keep the last rate the till used */ });
    return () => { cancelled = true; };
  }, []);

  /* --- Logic --- */
  const showToast = (message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => { setToast(null); toastTimerRef.current = null; }, 2400);
  };

  const playSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      setTimeout(() => ctx.close(), 400);
    } catch {}
  };

  const onLogout = async () => {
    await logoutAction();
    localStorage.removeItem('pos_user');
    navigate.push('/login');
  };

  // Clock
  useEffect(() => {
    const t = setInterval(() => {
      setClock(new Date().toLocaleTimeString('lo-LA', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Load from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(CURRENT_BILL_STORAGE_KEY);
    if (raw) { try { const parsed = JSON.parse(raw); if (parsed.items) setItems(parsed.items.map(sanitizeStoredItem).filter(Boolean)); if (parsed.member) setSelectedMember(parsed.member); if (parsed.orderId) setOrderId(normalizeOrderId(parsed.orderId)); } catch { } }
    const storedSales = localStorage.getItem(SALES_STORAGE_KEY);
    if (storedSales) {
      try {
        const parsed = JSON.parse(storedSales);
        if (parsed?.code) { setSalesName(parsed.name || ''); setSalesCode(parsed.code || ''); }
      } catch { }
    }
    const rawHeld = localStorage.getItem(HELD_BILLS_KEY); if (rawHeld) setHeldBills(JSON.parse(rawHeld));
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (items.length > 0) { localStorage.setItem(CURRENT_BILL_STORAGE_KEY, JSON.stringify({ orderId: normalizeOrderId(orderId), items, member: selectedMember })); } else { localStorage.removeItem(CURRENT_BILL_STORAGE_KEY); }
  }, [items, orderId, selectedMember]);

  useEffect(() => {
    if (salesCode) {
      localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify({ name: salesName, code: salesCode }));
    } else {
      localStorage.removeItem(SALES_STORAGE_KEY);
    }
  }, [salesName, salesCode]);

  // Auto-print receipt
  useEffect(() => {
    if (!lastSlip) return;
    const timer = setTimeout(() => window.print(), 120);
    return () => clearTimeout(timer);
  }, [lastSlip]);

  // Auto-print daily submission slip
  useEffect(() => {
    if (!lastDailySlip) return;
    const timer = setTimeout(() => window.print(), 120);
    return () => clearTimeout(timer);
  }, [lastDailySlip]);

  // Fetch active promotions on load
  useEffect(() => {
    listPromotionsAction('', { activeOnly: true }).then((res) => {
      const list = Array.isArray(res) ? res.map((r) => normalizePromotionRecord(r)) : [];
      setPromotions(list);
    }).catch(() => setPromotions([]));
  }, []);

  // Product search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchTerm.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    searchTimer.current = setTimeout(async () => {
      try { const res = await searchProductsAction(searchTerm); setSearchResults(res.map(p => ({ ...normalizeApiProduct(p) }))); } catch (e) { setSearchResults([]); } setIsSearching(false);
    }, 300);
  }, [searchTerm]);

  // Member search
  useEffect(() => {
    if (memberSearchTimer.current) clearTimeout(memberSearchTimer.current);
    setMemberLoading(true);
    memberSearchTimer.current = setTimeout(async () => {
      try {
        const res = await searchCustomersAction(memberSearch);
        const mappedMembers = Array.isArray(res) ? res.map(m => {
          let discountValue = 0;
          if (m.discount_item) {
            const discountStr = String(m.discount_item).replace('%', '').trim();
            const parsed = Number(discountStr);
            discountValue = Number.isFinite(parsed) ? parsed : 0;
          }
          return {
            id: m.code || m.id || '01-2125',
            code: m.code || m.id || '01-2125',
            name: m.name_1 || m.name || 'Customer',
            phone: m.telephone || '',
            points: Number(m.point_balance || 0),
            discount: discountValue
          };
        }) : [];
        setMembers(mappedMembers);
      } catch {
        setMembers([]);
      } finally {
        setMemberLoading(false);
      }
    }, 300);
  }, [memberSearch]);

  // Staff search
  useEffect(() => {
    if (staffSearchTimer.current) clearTimeout(staffSearchTimer.current);
    setStaffLoading(true);
    staffSearchTimer.current = setTimeout(async () => {
      try {
        const res = await searchStaffAction(staffSearch);
        const mapped = Array.isArray(res) ? res.map(s => ({
          code: s.code || s.staff_code || '',
          name: s.name_1 || s.name || s.username || 'Staff'
        })) : [];
        setStaffList(mapped);
      } catch {
        setStaffList([]);
      } finally {
        setStaffLoading(false);
      }
    }, 300);
  }, [staffSearch]);

  // Calculations
  const discountPercent = hasMember ? Number(selectedMember.discount || 0) : 0;
  const pricing = useMemo(
    () => calculateOrderPricing(items, discountPercent),
    [items, discountPercent],
  );
  const {
    lineItems,
    subtotal,
    promoDiscount,
    memberDiscount,
    discountTotal,
    total,
  } = pricing;
  const discount = discountTotal;
  const cashAmount = paymentType === 'transfer' ? 0 : Number(receivedAmount) || 0;
  const totalReceived = paymentType === 'transfer' ? total : cashAmount;
  const changeDue = Math.max(0, totalReceived - total);
  const earnedPoints = useMemo(() => total <= 0 ? 0 : Math.floor(total / POINTS_RATE), [total]);
  const pointsEligibleTotal = total;
  const remainingForNextPoint = useMemo(() => { if (pointsEligibleTotal <= 0) return 0; const remainder = pointsEligibleTotal % POINTS_RATE; return remainder === 0 ? 0 : POINTS_RATE - remainder; }, [pointsEligibleTotal]);

  // Actions
  const updateQtyByQuantity = async (id, newQuantity) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const parsedQuantity = Number(newQuantity);
    const resolvedQuantity = Number.isFinite(parsedQuantity) ? parsedQuantity : item.quantity;
    const minQty = 0.01;
    const requestedQuantity = Math.max(minQty, Number(resolvedQuantity.toFixed(2)));

    // Price and on-hand are read together: the tier price depends on quantity,
    // and a line may never be taken past what the warehouse actually holds.
    let latestPrice;
    let latestStock = normalizeQty(item.stock);
    try {
      const lookupCode = item.barcode || item.id;
      let product = null;
      if (lookupCode) {
        product = await getProductByBarcodeAction(lookupCode, requestedQuantity);
      }
      if (!product && item.id && item.id !== lookupCode) {
        product = await getProductByIdAction(item.id);
      }
      if (product) {
        const normalized = normalizeApiProduct(product);
        latestPrice = normalized.price;
        if (normalizeQty(normalized.stock) !== null) latestStock = normalizeQty(normalized.stock);
      }
    } catch (error) {
      console.error('Failed to fetch price:', error);
    }

    let safeQuantity = requestedQuantity;
    if (latestStock !== null && requestedQuantity > latestStock) {
      const allowed = Math.max(0, Number(latestStock.toFixed(2)));
      if (allowed < minQty) {
        showToast(`${item.name} ${OUT_OF_STOCK_MSG}`, 'error');
        return;
      }
      safeQuantity = allowed;
      showToast(`${item.name} ສະຕ໋ອກເຫຼືອ ${formatQtyLabel(allowed)} ເທົ່ານັ້ນ`, 'error');
    }
    if (safeQuantity === item.quantity) return;
    const matchCodes = new Set([item.id, item.item_code, item.barcode].filter(Boolean));
    const hasGiftItems = Array.isArray(item.gift_items) && item.gift_items.length > 0;
    const shouldSyncGift = !item.is_promo_gift && (item.gift_code || hasGiftItems);

    // Calculate gift qty based on promotion qualification
    const qualCount = item.promo_type ? getPromotionQualificationCount(item, safeQuantity) : safeQuantity;
    const giftPerUnit = Math.max(Number(item.gift_qty || 1), 1);
    const giftTargetQty = item.promo_type
      ? Number((qualCount * giftPerUnit).toFixed(2))
      : Number((safeQuantity * giftPerUnit).toFixed(2));

    const hasGiftMatch = items.some(
      (entry) => entry.is_promo_gift && matchCodes.has(entry.gift_for_code),
    );

    const applyQuantityUpdate = (prev, nextPrice) => {
      // If no longer qualified, remove gift items
      if (shouldSyncGift && giftTargetQty <= 0) {
        return prev
          .filter((entry) => !(entry.is_promo_gift && matchCodes.has(entry.gift_for_code)))
          .map((entry) => {
            if (entry.id === id) {
              return {
                ...entry,
                quantity: safeQuantity,
                ...(Number.isFinite(nextPrice) ? { price: nextPrice } : {}),
                ...(latestStock !== null ? { stock: latestStock } : {}),
              };
            }
            return entry;
          });
      }
      return prev.map((entry) => {
        if (entry.id === id) {
          return {
            ...entry,
            quantity: safeQuantity,
            ...(Number.isFinite(nextPrice) ? { price: nextPrice } : {}),
            ...(latestStock !== null ? { stock: latestStock } : {}),
          };
        }
        if (shouldSyncGift && entry.is_promo_gift && matchCodes.has(entry.gift_for_code)) {
          return { ...entry, quantity: giftTargetQty };
        }
        return entry;
      });
    };

    const syncMissingGifts = async () => {
      if (!shouldSyncGift || hasGiftMatch || giftTargetQty <= 0) return;
      if (hasGiftItems) {
        for (const gi of item.gift_items) {
          const code = gi.lookup_code || gi.item_code || gi.barcode;
          if (!code) continue;
          const gp = await fetchGiftProduct(code);
          if (gp) addGiftItem(gp, Number((qualCount * Math.max(Number(gi.qty || 1), 1)).toFixed(2)), item);
        }
      } else if (item.gift_code) {
        const gp = await fetchGiftProduct(item.gift_code);
        if (gp) addGiftItem(gp, giftTargetQty, item);
      }
    };

    setItems(prev => applyQuantityUpdate(prev, latestPrice));
    await syncMissingGifts();
  };
  const updateQty = (id, delta) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (item.quantity <= 0.01 && delta < 0) return;
    updateQtyByQuantity(id, item.quantity + delta);
  };
  const removeItemAndGifts = (id) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev.filter((item) => item.id !== id);
      const matchCodes = new Set([
        target.id,
        target.item_code,
        target.barcode,
      ].filter(Boolean));
      return prev.filter((item) => {
        if (item.id === id) return false;
        if (!item.is_promo_gift) return true;
        return !matchCodes.has(item.gift_for_code);
      });
    });
  };
  const getFallbackOrderId = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const counterKey = `${ORDER_COUNTER_PREFIX}${yy}${mm}${dd}`;
    let next = 1;
    try {
      const stored = localStorage.getItem(counterKey);
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed >= 1) next = parsed + 1;
    } catch {}
    localStorage.setItem(counterKey, String(next));
    const seq = String(next).padStart(4, '0');
    return `POS${yy}${mm}${seq}`;
  };

  const ensureOrderId = async () => {
    if (orderId) return orderId;
    try {
      const resp = await getDocNoAction();
      const serverDocNo = resp?.doc_no;
      if (serverDocNo) {
        setOrderId(serverDocNo);
        return serverDocNo;
      }
    } catch {}
    const fallback = getFallbackOrderId();
    setOrderId(fallback);
    return fallback;
  };

  const addItem = async (product) => {
    const available = normalizeQty(product?.stock);
    if (available !== null && available <= 0) {
      showToast(`${product?.name || 'ສິນຄ້າ'} ${OUT_OF_STOCK_MSG}`, 'error');
      return false;
    }
    await ensureOrderId();
    const exists = items.find(i => i.id === product.id);
    if (exists) {
      updateQty(product.id, 1);
      setSearchTerm('');
      return false;
    }
    setItems(prev => [...prev, { ...product, quantity: 1 }]);
    setSearchTerm('');
    return true;
  };
  const addItemFromSearch = async (product) => {
    if (!product) return;
    let resolved = normalizeApiProduct(product);
    try {
      const lookupCode = product?.barcode || product?.id || product?.item_code;
      let latest = null;
      if (lookupCode) {
        latest = await getProductByBarcodeAction(lookupCode, 1);
      }
      if (!latest && product?.id) {
        latest = await getProductByIdAction(product.id);
      }
      if (latest) {
        resolved = normalizeApiProduct(latest);
      }
    } catch {
      // Use search result when API lookup fails.
    }
    const promoResolved = await applyPromotionToProduct(resolved, resolved?.barcode || resolved?.id);
    const isNew = await addItem({ ...promoResolved, quantity: 1 });
    if (isNew) await addAllGiftItems(promoResolved, 1);
  };
  async function fetchGiftProduct(giftCode) {
    if (!giftCode) return null;
    try {
      let product = await getProductByBarcodeAction(giftCode, 1);
      if (!product) {
        product = await getProductByIdAction(giftCode);
      }
      return product ? normalizeApiProduct(product) : null;
    } catch {
      return null;
    }
  }
  async function addAllGiftItems(promoResolved, buyQty = 1) {
    if (!promoResolved) return;
    const qualCount = getPromotionQualificationCount(promoResolved, buyQty);
    if (qualCount <= 0) return;
    const giftItemsDef = Array.isArray(promoResolved.gift_items) ? promoResolved.gift_items : [];
    if (giftItemsDef.length > 0) {
      for (const gi of giftItemsDef) {
        const code = gi.lookup_code || gi.item_code || gi.barcode;
        if (!code) continue;
        const giftProduct = await fetchGiftProduct(code);
        if (giftProduct) {
          addGiftItem(giftProduct, Number(gi.qty || 1) * qualCount, promoResolved);
        }
      }
    } else if (promoResolved.gift_code) {
      const giftProduct = await fetchGiftProduct(promoResolved.gift_code);
      if (giftProduct) {
        addGiftItem(giftProduct, Number(promoResolved.gift_qty || 1) * qualCount, promoResolved);
      }
    }
  }
  function addGiftItem(giftProduct, giftQty = 1, sourceProduct = null) {
    if (!giftProduct) return;
    const sourceCode = sourceProduct?.id || sourceProduct?.barcode || sourceProduct?.item_code || 'base';
    const giftId = `${giftProduct.id}__gift__${sourceCode}`;
    let qty = Math.max(Number(giftQty || 1), 1);
    const giftStock = normalizeQty(giftProduct.stock);
    if (giftStock !== null) {
      const alreadyInCart = Number(items.find((entry) => entry.id === giftId)?.quantity) || 0;
      const allowed = Number((giftStock - alreadyInCart).toFixed(2));
      if (allowed <= 0) {
        showToast(`ຂອງແຖມ ${giftProduct.name} ${OUT_OF_STOCK_MSG}`, 'error');
        return;
      }
      if (qty > allowed) {
        qty = allowed;
        showToast(`ຂອງແຖມ ${giftProduct.name} ສະຕ໋ອກເຫຼືອ ${formatQtyLabel(allowed)} ເທົ່ານັ້ນ`, 'error');
      }
    }
    const giftItem = {
      ...giftProduct,
      id: giftId,
      item_code: giftProduct.id,
      name: `${giftProduct.name} (ຂອງແຖມ)`,
      price: 0,
      unit_code: giftProduct.unit_code || giftProduct.unit || 'EA',
      unit: giftProduct.unit || giftProduct.unit_code || 'EA',
      quantity: qty,
      promo_type: null,
      promo_buy1_get1: false,
      is_promo_gift: true,
      gift_for_code: sourceProduct?.id || sourceProduct?.item_code || sourceProduct?.barcode || '',
      gift_for_name: sourceProduct?.name || '',
    };
    setItems((prev) => {
      const existing = prev.find((item) => item.id === giftId);
      if (existing) {
        return prev.map((item) => (
          item.id === giftId ? { ...item, quantity: (Number(item.quantity) || 0) + qty } : item
        ));
      }
      return [...prev, giftItem];
    });
  }
  async function applyPromotionToProduct(product, lookupCode) {
    if (!product) return product;
    if (product.promo_type || product.promo_buy1_get1 || product.bogo || product.buy1get1) {
      return product;
    }
    const code = lookupCode || product.barcode || product.id;
    if (!code) return product;

    // Match from pre-loaded active promotions (already filtered by API)
    let matched = promotions.find((p) => promotionMatchesCode(p, code));

    // Fallback to API if not found locally (in case promotions were added after load)
    if (!matched) {
      try {
        const raw = await lookupPromotionAction(code);
        if (raw && raw.promo_type) matched = normalizePromotionRecord(raw);
      } catch {}
    }

    if (matched && matched.promo_type) {
      const promo = matched;
      const giftItems = getPromotionGiftItems(promo);
      const ruleConfig = getPromotionRuleConfig(promo);
      const autoMode = isAutomaticPromotion(promo);

      return {
        ...product,
        promotion_id: promo.id || promo.promotion_id || null,
        promo_type: promo.promo_type,
        promo_buy1_get1: promo.promo_type === 'buy_one_get_gift' || promo.promo_type === 'bogo',
        rule_config: ruleConfig,
        buy_items: promo.buy_items,
        gift_items: giftItems,
        gift_code: promo.gift_code || (giftItems[0]?.lookup_code || giftItems[0]?.item_code || ''),
        gift_qty: promo.gift_qty || (giftItems[0]?.qty || 1),
        auto_promo: autoMode,
      };
    }
    return product;
  }
  const addByBarcode = async (code) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const product = await getProductByBarcodeAction(trimmed, 1);
      if (product) {
        const normalized = normalizeApiProduct(product);
        const promoResolved = await applyPromotionToProduct(normalized, trimmed);
        const isNew = await addItem(promoResolved);
        if (isNew) await addAllGiftItems(promoResolved, 1);
        setSearchResults([]);
        return;
      }
    } catch {}
    alert('Product not found');
  };
  const holdBill = () => { if (!items.length) return; const bill = { id: normalizeOrderId(orderId), items, member: selectedMember, total, time: new Date().toLocaleTimeString() }; setHeldBills([...heldBills, bill]); localStorage.setItem(HELD_BILLS_KEY, JSON.stringify([...heldBills, bill])); setItems([]); setOrderId(null); setSelectedMember(DEFAULT_MEMBER); showToast('Bill Held'); };
  const recallBill = (bill) => { setItems(bill.items); setOrderId(normalizeOrderId(bill.id)); setSelectedMember(bill.member); const newHeld = heldBills.filter(b => b.id !== bill.id); setHeldBills(newHeld); localStorage.setItem(HELD_BILLS_KEY, JSON.stringify(newHeld)); setShowHeldModal(false); };

  const fetchDailySummary = async () => {
    setIsDailyLoading(true);
    try {
      const resp = await getDailySummaryAction();
      setDailySummary(resp?.summary || { total_all: 0, total_cash: 0, total_transfer: 0, count_bills: 0 });
      setDailyBills(Array.isArray(resp?.bills) ? resp.bills : []);
    } catch {
      setDailySummary({ total_all: 0, total_cash: 0, total_transfer: 0, count_bills: 0 });
      setDailyBills([]);
    } finally {
      setIsDailyLoading(false);
    }
  };

  const sendDaily = async () => {
    if (isSendingDaily) return;
    const totalAll = Number(dailySummary?.total_all || 0);
    if (totalAll <= 0) {
      showToast('ບໍ່ມີຍອດເງິນສົ່ງ', 'error');
      return;
    }
    setIsSendingDaily(true);
    try {
      const resp: any = await commitDailySummaryAction({
        staff: salesName || cashierName,
        staffCode: salesCode || cashierCode,
      });
      const summaryData = resp?.summary || { total_all: 0, total_cash: 0, total_transfer: 0, count_bills: 0 };
      const billsData = Array.isArray(resp?.bills) ? resp.bills : [];
      setDailySummary(summaryData);
      setDailyBills(billsData);

      setLastDailySlip({
        summary: summaryData,
        bills: billsData,
        cashierName,
        cashierCode,
        salesName,
        salesCode,
        recipient: dailyRecipient,
        submittedAt: new Date().toLocaleString('lo-LA', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
      });

      setTimeout(() => {
        setShowDailyConfirm(false);
        setShowDailyModal(false);
        setDailyRecipient('');
      }, 200);
      showToast('ສົ່ງຍອດປະຈໍາວັນສໍາເລັດ', 'success');
    } catch {
      showToast('ສົ່ງຍອດບໍ່ສໍາເລັດ', 'error');
    } finally {
      setIsSendingDaily(false);
    }
  };

  useEffect(() => {
    if (!showDailyModal) return;
    fetchDailySummary();
  }, [showDailyModal]);

  const confirmCancelBill = async (payload) => {
    const bill = payload?.bill;
    const reason = payload?.reason;
    // The modal searches saved bills, so a chosen one has to be voided in the
    // ERP — stock back, points back, cash book removed — not just cleared off
    // the screen. Clearing the cart is only right when it is that same bill.
    const docNo = String(bill?.doc_no || bill?.orderId || '').trim();
    if (docNo) {
      let res;
      try {
        res = await cancelBillAction(docNo, reason || '');
      } catch {
        showToast('ຍົກເລີກບິນບໍ່ສຳເລັດ', 'error');
        return;
      }
      if (!res?.success) {
        showToast(res?.error || 'ຍົກເລີກບິນບໍ່ສຳເລັດ', 'error');
        return;
      }
      showToast(`ຍົກເລີກບິນ ${docNo} ສຳເລັດ`, 'success');
      setShowCancelBillModal(false);
      if (normalizeOrderId(orderId) !== docNo) return;
    }
    setItems([]);
    setSelectedMember(DEFAULT_MEMBER);
    setOrderId(null);
    setCurrentPickupOrder(null);
    setShowCancelBillModal(false);
    if (!docNo) showToast('ລ້າງບິນສຳເລັດ', 'success');
  };

  const completePayment = async () => {
    const effectiveSalesCode = salesCode || cashierCode || currentUser?.code || '';
    const effectiveSalesName = salesName || cashierName || currentUser?.name_1 || '';
    if (!effectiveSalesCode) { alert(SALES_REQUIRED_MSG); setIsPaying(false); return; }
    const itemsWithDiscount = lineItems.map((item) => {
      const lineSubtotal = Number(item.lineSubtotal || 0);
      const lineDiscountAmount = Number(item.lineDiscount || 0);
      const discountPercentValue = lineSubtotal > 0
        ? Number(((lineDiscountAmount / lineSubtotal) * 100).toFixed(2))
        : 0;
      const giftRemark = item?.is_promo_gift
        ? (item.gift_for_code || item.gift_for_name || '')
        : '';
      return {
        ...item,
        unit_code: item.unit_code || item.unit || 'EA',
        unit: item.unit || item.unit_code || 'EA',
        item_code_main: item?.is_promo_gift
          ? (item.gift_for_code || item.gift_for_name || item.item_code || item.id || '')
          : (item.item_code_main || ''),
        discount_amount: lineDiscountAmount,
        discount_percent: discountPercentValue,
        sum_amount: Number(item.lineNet || 0),
        remark: giftRemark || item?.remark || '',
      };
    });
    const buildSaveErrorMessage = (error) => {
      return (
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Unknown error'
      );
    };

    let savedDocNo = orderId;
    try {
      const response = await saveBillAction({
        items: itemsWithDiscount,
        orderId,
        total,
        subtotal,
        discount,
        paymentType,
        received: totalReceived,
        receivedAmount: totalReceived,
        change_amount: changeDue,
        baht_amount: bahtAmount,
        baht_rate: bahtRate,
        tenders: cashTenders,
        pickup_order_no: currentPickupOrder?.orderNo || '',
        staff: effectiveSalesCode,
        staffName: effectiveSalesName,
        sale_code: effectiveSalesCode,
        cashier_code: cashierCode || '',
        staffCode: cashierCode || '',
        user_login: cashierCode || currentUser?.code || '',
        member: hasMember ? selectedMember : null,
        earnedPoints,
      });
      if (response?.success === false) {
        throw new Error(response?.error || 'POS billing failed');
      }
      savedDocNo = response?.doc_no || orderId;
      if (currentPickupOrder?.orderNo) {
        try {
          if (currentPickupOrder.source === 'shop') {
            await updateShopOrderStatusAction(currentPickupOrder.orderNo, 'picked');
          } else {
            await updateOnlineOrderStatusAction(currentPickupOrder.orderNo, 'picked');
          }
          setOnlineOrders((prev) => prev.filter((o) => o.order_no !== currentPickupOrder.orderNo));
          setCurrentPickupOrder(null);
        } catch (error) {
          showToast(`ອັບເດດສະຖານະອໍເດີບໍ່ສໍາເລັດ: ${buildSaveErrorMessage(error)}`, 'error');
        }
      }
    } catch (error) {
      showToast(`ບັນທຶກບິນບໍ່ສຳເລັດ: ${buildSaveErrorMessage(error)}`, 'error');
      setIsPaying(false);
      return;
    }
    const issuedAt = new Date().toLocaleString('lo-LA');
    setLastSlip({
      items: lineItems,
      orderId: savedDocNo,
      subtotal,
      discount,
      promoDiscount,
      memberDiscount,
      total,
      paymentType,
      totalReceived,
      changeDue,
      hasMember,
      selectedMember,
      earnedPoints,
      salesName,
      salesCode,
      cashierName,
      cashierCode,
      issuedAt,
    });
    playSuccessSound();
    setShowCompleteModal(true);
    setItems([]);
    setOrderId(null);
    setSelectedMember(DEFAULT_MEMBER);
    setShowPayment(false);
    setReceivedAmount('');
    setIsPaying(false);
  };

  handlePaymentSuccess.current = completePayment;

  const handlePay = async () => {
    const effectiveSalesCode = salesCode || cashierCode || currentUser?.code || '';
    if (!effectiveSalesCode) return alert(SALES_REQUIRED_MSG);
    if (items.length === 0) return;
    if (paymentType === 'cash' && totalReceived < total) return alert('Insufficient funds');
    if (paymentType === 'transfer') { setIsPaying(true); return; }
    setIsPaying(true); await completePayment();
  };

  const handleReprint = async () => {
    const docNo = reprintDocNo.trim();
    if (!docNo || reprintLoading) return;
    setReprintLoading(true);
    setReprintError('');
    try {
      const res = await getPosBillAction(docNo);
      const billItems = Array.isArray(res?.items) ? res.items : [];
      const extractGiftInfo = (remark) => {
        if (!remark || typeof remark !== 'string') return '';
        return remark.trim();
      };
      const mappedItems = billItems.map((item) => ({
        id: item.item_code || item.id || item.item_name || 'item',
        name: item.item_name || item.name || item.item_code || 'Product',
        price: normalizePrice(item.price),
        quantity: Number(item.qty) || 1,
        unit: item.unit_code || item.unit || '',
        is_promo_gift: !!extractGiftInfo(item.remark),
        gift_for_name: extractGiftInfo(item.remark),
      }));
      const totalValue = Number(res?.total) || 0;
      setLastSlip({
        items: mappedItems,
        orderId: res?.doc_no || docNo,
        subtotal: totalValue,
        discount: 0,
        promoDiscount: 0,
        memberDiscount: 0,
        total: totalValue,
        paymentType: 'cash',
        totalReceived: totalValue,
        changeDue: 0,
        hasMember: false,
        selectedMember: null,
        earnedPoints: 0,
        salesName,
        salesCode,
        cashierName,
        cashierCode,
        issuedAt: res?.doc_date || new Date().toLocaleString('lo-LA'),
      });
      setShowReprintModal(false);
      showToast('ພິມບິນຊ້ຳ', 'success');
    } catch (error) {
      setReprintError(error?.response?.data?.error || error?.message || 'ບໍ່ພົບບິນ');
    } finally {
      setReprintLoading(false);
    }
  };

  const handleCheckoutCash = () => {
    if (items.length === 0) return;
    const effectiveSalesCode = salesCode || cashierCode || currentUser?.code || '';
    if (!effectiveSalesCode) return alert(SALES_REQUIRED_MSG);
    setPaymentType('cash');
    setShowPayment(true);
  };

  const handleCheckoutTransfer = () => {
    if (items.length === 0) return;
    const effectiveSalesCode = salesCode || cashierCode || currentUser?.code || '';
    if (!effectiveSalesCode) return alert(SALES_REQUIRED_MSG);
    setPaymentType('transfer');
    setShowPayment(true);
  };

  const openCustomerDisplay = () => { if (customerWindow.current && !customerWindow.current.closed) { customerWindow.current.focus(); } else { const win = window.open('', 'customer_display', 'width=1024,height=600'); if (win) { win.document.title = 'Customer Display'; win.document.body.innerHTML = '<div id="root"></div>'; document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => { win.document.head.appendChild(node.cloneNode(true)); }); customerWindow.current = win; setIsDisplayOpen(true); } } };

  const fetchOnlineOrders = async (query = '') => {
    setOnlineLoading(true);
    try {
      const [onlineRes, shopRes] = await Promise.all([
        getOnlineOrdersAction('pending', query),
        getShopOrdersAction(query, '', 'pending'),
      ]);
      const onlineList = Array.isArray(onlineRes) ? onlineRes : [];
      const shopList = Array.isArray(shopRes) ? shopRes : [];
      const merged = [
        ...onlineList.map((o) => ({ ...o, source: 'online' })),
        ...shopList.map((o) => ({ ...o, source: 'shop' })),
      ];
      setOnlineOrders(merged);
    } catch {
      setOnlineOrders([]);
    } finally {
      setOnlineLoading(false);
    }
  };

  const fetchPickupCount = async () => {
    try {
      // Orders nobody collected get cancelled here; the action throttles
      // itself, so polling every 15s costs one sweep every ten minutes.
      await expireStaleOrdersAction().catch(() => {});
      const [onlineRes, shopRes] = await Promise.all([
        getOnlineOrdersAction('pending', ''),
        getShopOrdersAction('', '', 'pending'),
      ]);
      const onlineCount = Array.isArray(onlineRes) ? onlineRes.length : 0;
      const shopCount = Array.isArray(shopRes) ? shopRes.length : 0;
      const totalCount = onlineCount + shopCount;
      setPendingPickupCount(totalCount);
      if (!pickupCountRef.current.initialized) {
        pickupCountRef.current = { initialized: true, count: totalCount };
        return;
      }
      if (totalCount > pickupCountRef.current.count) {
        showToast('ມີອໍເດີໃໝ່ເຂົ້າມາ', 'success');
      }
      pickupCountRef.current.count = totalCount;
    } catch {}
  };

  const loadOnlineOrder = async (orderNo) => {
    if (!orderNo) return;
    setOnlineLoading(true);
    try {
      const order: any = await getOnlineOrderAction(orderNo);
      const orderItems = Array.isArray(order?.items) ? order.items : [];
      const mappedItems = orderItems.map((item) => ({
        id: item.id || item.item_code || item.barcode || 'item',
        name: item.name || item.item_name || 'Product',
        price: normalizePrice(item.price),
        quantity: Number(item.quantity) || 1,
        unit: item.unit_code || item.unit || 'EA',
        unit_code: item.unit_code || item.unit || 'EA',
        barcode: item.barcode || item.id || '',
      }));
      setItems(mappedItems);
      setOrderId(order.order_no || orderNo);
      setCurrentPickupOrder({ source: 'online', orderNo: order.order_no || orderNo });
      if (order.customer_code || order.customer_name) {
        setSelectedMember({
          id: order.customer_code || 'member',
          code: order.customer_code || '',
          name: order.customer_name || 'Member',
          phone: order.customer_phone || '',
          points: 0,
          discount: Number(order.discount_percent || 0),
        });
      }
      setShowPickupModal(false);
      showToast('ດຶງອໍເດີເຂົ້າ POS ສຳເລັດ', 'success');
    } catch {
      showToast('ດຶງອໍເດີບໍ່ສຳເລັດ', 'error');
    } finally {
      setOnlineLoading(false);
    }
  };

  const cancelOnlineOrder = async (orderNo) => {
    if (!orderNo) return;
    setOnlineLoading(true);
    try {
      await updateOnlineOrderStatusAction(orderNo, 'cancelled');
      setOnlineOrders(prev => prev.filter(o => o.order_no !== orderNo));
      showToast('ຍົກເລີກອໍເດີສໍາເລັດ', 'success');
    } catch {
      showToast('ຍົກເລີກອໍເດີບໍ່ສໍາເລັດ', 'error');
    } finally {
      setOnlineLoading(false);
    }
  };

  const cancelShopOrder = async (orderNo) => {
    if (!orderNo) return;
    setOnlineLoading(true);
    try {
      await updateShopOrderStatusAction(orderNo, 'cancelled');
      setOnlineOrders(prev => prev.filter(o => o.order_no !== orderNo));
      showToast('ຍົກເລີກອໍເດີສໍາເລັດ', 'success');
    } catch {
      showToast('ຍົກເລີກອໍເດີບໍ່ສໍາເລັດ', 'error');
    } finally {
      setOnlineLoading(false);
    }
  };

  const loadShopOrder = async (orderNo) => {
    if (!orderNo) return;
    setOnlineLoading(true);
    try {
      const order: any = await getShopOrderAction(orderNo);
      const orderItems = Array.isArray(order?.items) ? order.items : [];
      const mappedItems = orderItems.map((item) => ({
        id: item.id || item.ic_code || item.item_code || item.barcode || 'item',
        name: item.name || item.ic_name || item.item_name || 'Product',
        price: normalizePrice(item.price),
        quantity: Number(item.quantity) || 1,
        unit: item.unit_code || item.unit || 'EA',
        unit_code: item.unit_code || item.unit || 'EA',
        barcode: item.barcode || item.id || '',
      }));
      setItems(mappedItems);
      setOrderId(order.order_no || orderNo);
      setCurrentPickupOrder({ source: 'shop', orderNo: order.order_no || orderNo });
      if (order.customer_code || order.customer_name) {
        setSelectedMember({
          id: order.customer_code || 'member',
          code: order.customer_code || '',
          name: order.customer_name || 'Member',
          phone: order.customer_phone || '',
          points: 0,
          discount: Number(order.discount_percent || 0),
        });
      }
      setShowPickupModal(false);
      showToast('ດຶງອໍເດີເຂົ້າ POS ສຳເລັດ', 'success');
    } catch {
      showToast('ດຶງອໍເດີບໍ່ສຳເລັດ', 'error');
    } finally {
      setOnlineLoading(false);
    }
  };

  useEffect(() => {
    const monitor = setInterval(() => {
      if (!customerWindow.current) {
        if (isDisplayOpen) setIsDisplayOpen(false);
        return;
      }
      if (customerWindow.current.closed) {
        customerWindow.current = null;
        setIsDisplayOpen(false);
      } else if (!isDisplayOpen) {
        setIsDisplayOpen(true);
      }
    }, 500);
    return () => clearInterval(monitor);
  }, [isDisplayOpen]);

  useEffect(() => {
    if (!showPickupModal) return;
    if (onlineSearchTimer.current) clearTimeout(onlineSearchTimer.current);
    onlineSearchTimer.current = setTimeout(() => {
      fetchOnlineOrders(onlineQuery);
    }, 300);
    return () => {
      if (onlineSearchTimer.current) clearTimeout(onlineSearchTimer.current);
    };
  }, [showPickupModal, onlineQuery]);

  useEffect(() => {
    fetchPickupCount();
    const timer = setInterval(fetchPickupCount, 15000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeys = (e) => {
      if (e.key === 'F9') {
        e.preventDefault();
        if (!items.length) return;
        if (!salesCode) return alert(SALES_REQUIRED_MSG);
        setPaymentType('cash');
        setShowPayment(true);
      }
      if (e.key === 'F10') {
        e.preventDefault();
        if (!items.length) return;
        if (!salesCode) return alert(SALES_REQUIRED_MSG);
        setPaymentType('transfer');
        setShowPayment(true);
      }
    };
    window.addEventListener('keydown', handleKeys); return () => window.removeEventListener('keydown', handleKeys);
  }, [items, salesCode]);

  return (
    <div className="h-screen flex flex-col bg-[#f5f7fb] text-slate-900">
      <TopBar
        cashierName={cashierName}
        cashierCode={cashierCode}
        orderId={orderId || ''}
        currentTime={clock}
        onLogout={onLogout}
      />

      <div className="flex flex-1 min-h-0">
        <LeftRail
          divider={['cancel']}
          actions={[
            { id: 'search',  label: 'ຄົ້ນຫາສິນຄ້າ', icon: Search,        onClick: () => setShowProductSearch(true) },
            { id: 'hold',    label: 'ພັກບິນ',        icon: Pause,         onClick: holdBill, hint: items.length ? 'ພັກບິນປະຈຸບັນ' : 'ບໍ່ມີລາຍການ' },
            { id: 'recall',  label: 'ບິນພັກ',        icon: RotateCcw,     onClick: () => setShowHeldModal(true), badge: heldBills.length },
            { id: 'pickup',  label: 'ຮັບອໍເດີ',      icon: Package,       onClick: () => { setShowPickupModal(true); setOnlineQuery(''); }, badge: pendingPickupCount },
            { id: 'cancel',  label: 'ຍົກເລີກບິນ',    icon: Trash2,        onClick: () => setShowCancelBillModal(true) },
            { id: 'daily',   label: 'ສະຫຼຸບລາຍວັນ',  icon: ClipboardList, onClick: () => setShowDailyModal(true) },
            { id: 'reprint', label: 'ພິມຊ້ຳ',         icon: Printer,       onClick: () => { setShowReprintModal(true); setReprintError(''); } },
            { id: 'display', label: 'ຈໍສະແດງ',       icon: Monitor,       onClick: isDisplayOpen ? () => customerWindow.current?.close() : openCustomerDisplay, active: isDisplayOpen },
            { id: 'line',    label: 'Line Settings', icon: Bell,          onClick: () => navigate.push('/settings/line') },
          ] as LeftRailAction[]}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] p-3 sm:p-4">
          <Cart
            items={lineItems}
            onUpdateQty={updateQty}
            onSetQty={updateQtyByQuantity}
            onRemoveItem={removeItemAndGifts}
            hasMember={hasMember}
            selectedMember={selectedMember}
            onBarcodeSubmit={addByBarcode}
          />
        </main>

        <PayPanel
          cashierName={cashierName}
          salesName={salesName}
          salesCode={salesCode}
          selectedMember={selectedMember}
          hasMember={hasMember}
          subtotal={subtotal}
          promoDiscount={promoDiscount}
          memberDiscount={memberDiscount}
          discount={discount}
          total={total}
          thbRateInput={thbRateInput}
          onThbRateChange={setThbRateInput}
          onOpenSalesPicker={() => setShowSalesPicker(true)}
          onOpenCustomerPicker={() => setShowCustomerPicker(true)}
          onClearCustomer={() => setSelectedMember(DEFAULT_MEMBER)}
          onCash={handleCheckoutCash}
          onTransfer={handleCheckoutTransfer}
          disabled={items.length === 0}
        />
      </div>

      {/* Sales / Customer pickers (lifted from old Header) */}
      <SelectModal
        isOpen={showSalesPicker}
        onClose={() => setShowSalesPicker(false)}
        icon={Wrench}
        title="ເລືອກພະນັກງານຂາຍ"
        items={staffList}
        onSelect={(item) => { setSalesName(item.name); setSalesCode(item.code); }}
        onSearch={setStaffSearch}
        isLoading={staffLoading}
        searchPlaceholder="ຄົ້ນຫາຊື່ ຫຼື ລະຫັດ..."
      />
      <SelectModal
        isOpen={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        icon={Users}
        title="ເລືອກລູກຄ້າ"
        items={members}
        onSelect={(item) => setSelectedMember(item)}
        onSearch={setMemberSearch}
        isLoading={memberLoading}
        searchPlaceholder="ເບີໂທ ຫຼື ຊື່ລູກຄ້າ..."
      />

      {/* Product search (replaces inline modal in old SummaryPayCard) */}
      <ProductSearchModal
        isOpen={showProductSearch}
        onClose={() => setShowProductSearch(false)}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onClear={() => setSearchTerm('')}
        results={searchResults}
        isSearching={isSearching}
        onSelect={addItemFromSearch}
      />

      {/* Payment Panel */}
      <PaymentPanel
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        total={total}
        paymentType={paymentType}
        orderId={orderId}
        onConfirm={handlePay}
        onAmountChange={setReceivedAmount}
        onForeignAmountChange={({ thbAmount, thbRate, tenders }) => {
          setBahtAmount(thbAmount);
          setBahtRate(thbRate);
          setCashTenders(Array.isArray(tenders) ? tenders : []);
        }}
        currencies={erpCurrencies}
        receivedAmount={receivedAmount}
        isDisplayOpen={isDisplayOpen}
        isPaying={isPaying}
        onPaymentSuccess={() => handlePaymentSuccess.current?.()}
      />

      {/* Daily Summary Modal */}
      {showDailyModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[6vh] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowDailyModal(false)}
        >
          <div
            className="w-full max-w-xl max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-100 shrink-0">
              <ClipboardList size={16} className="text-slate-400" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-slate-800 leading-tight">ສະຫຼຸບລາຍວັນ</div>
                <div className="text-[10px] text-slate-400 leading-tight">ສົ່ງເງິນປະຈໍາວັນ</div>
              </div>
              <button
                onClick={() => setShowDailyModal(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cash</div>
                  <div className="text-[18px] font-black tabular-nums text-slate-900 mt-0.5">{formatPrice(dailySummary.total_cash || 0)} <span className="text-[11px] text-slate-400">₭</span></div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transfer</div>
                  <div className="text-[18px] font-black tabular-nums text-slate-900 mt-0.5">{formatPrice(dailySummary.total_transfer || 0)} <span className="text-[11px] text-slate-400">₭</span></div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-900 text-white p-4 flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">ຍອດເງິນລວມ</span>
                <span className="text-2xl font-black tabular-nums">{formatPrice(dailySummary.total_all || 0)} <span className="text-[12px] opacity-70">₭</span></span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div className="flex items-baseline justify-between"><span className="text-slate-500">ຈຳນວນບິນ</span><span className="font-bold tabular-nums text-slate-800">{dailySummary.count_bills || 0}</span></div>
                <div className="flex items-baseline justify-between"><span className="text-slate-500">Cashier</span><span className="font-bold text-slate-800 truncate">{cashierCode ? `${cashierCode} · ${cashierName}` : cashierName || '—'}</span></div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ບິນມື້ນີ້</div>
                {isDailyLoading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-[13px] text-slate-400 font-medium">ກຳລັງໂຫຼດ…</div>
                ) : dailyBills.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-[13px] text-slate-400 font-medium">ບໍ່ມີລາຍການທີ່ຕ້ອງສົ່ງ</div>
                ) : (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead className="bg-slate-50">
                        <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="px-3 py-2 text-left">ບິນ</th>
                          <th className="px-3 py-2 text-left">ພະນັກງານ</th>
                          <th className="px-3 py-2 text-left">ປະເພດ</th>
                          <th className="px-3 py-2 text-right">ຍອດ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyBills.map((bill, idx) => (
                          <tr key={bill.id || bill.order_id || idx} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-mono text-slate-700">{bill.order_id || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{bill.staff || '—'}</td>
                            <td className="px-3 py-2 text-slate-500 uppercase text-[10px] font-bold">{bill.payment_type || '—'}</td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">{formatPrice(bill.total || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 px-4 py-3 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setShowDailyModal(false)}
                className="h-11 px-4 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                ປິດ
              </button>
              <button
                onClick={() => {
                  const totalAll = Number(dailySummary?.total_all || 0);
                  if (totalAll <= 0 || dailyBills.length === 0) {
                    showToast('ບໍ່ມີຍອດເງິນສົ່ງ', 'error');
                    return;
                  }
                  setShowDailyConfirm(true);
                }}
                disabled={isSendingDaily || isDailyLoading || Number(dailySummary?.total_all || 0) <= 0 || dailyBills.length === 0}
                className="flex-1 h-11 rounded-lg bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {isSendingDaily ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isSendingDaily ? 'ກຳລັງສົ່ງ…' : 'ຕໍ່ໄປ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Confirm Modal */}
      {showDailyConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => !isSendingDaily && setShowDailyConfirm(false)}
        >
          <div
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {isSendingDaily ? (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                <Loader2 className="w-7 h-7 animate-spin text-slate-700 mb-2" />
                <p className="text-[13px] font-bold text-slate-700">ກຳລັງສົ່ງຍອດ…</p>
              </div>
            ) : null}

            <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-100">
              <CheckCircle2 size={16} className="text-slate-400" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-slate-800 leading-tight">ຢືນຢັນການສົ່ງເງິນ</div>
                <div className="text-[10px] text-slate-400 leading-tight">ຕັ້ງຜູ້ຮັບເງິນກ່ອນສົ່ງ</div>
              </div>
              <button
                onClick={() => setShowDailyConfirm(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">ຜູ້ຮັບເງິນ</label>
                <input
                  value={dailyRecipient}
                  onChange={(e) => setDailyRecipient(e.target.value)}
                  placeholder="ພິມຊື່ຜູ້ຮັບເງິນ…"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-800 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div className="flex items-baseline justify-between"><span className="text-slate-500">ຈຳນວນບິນ</span><span className="font-bold tabular-nums text-slate-800">{dailySummary.count_bills || 0}</span></div>
                <div className="flex items-baseline justify-between"><span className="text-slate-500">Cashier</span><span className="font-bold text-slate-800 truncate">{cashierCode || cashierName || '—'}</span></div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex items-baseline justify-between text-[12px]"><span className="text-slate-500">Cash</span><span className="font-bold tabular-nums text-slate-800">{formatPrice(dailySummary.total_cash || 0)} ₭</span></div>
                <div className="flex items-baseline justify-between text-[12px]"><span className="text-slate-500">Transfer</span><span className="font-bold tabular-nums text-slate-800">{formatPrice(dailySummary.total_transfer || 0)} ₭</span></div>
              </div>

              <div className="rounded-xl bg-slate-900 text-white px-4 py-3 flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">ຍອດເງິນລວມ</span>
                <span className="text-xl font-black tabular-nums">{formatPrice(dailySummary.total_all || 0)} <span className="text-[11px] opacity-70">₭</span></span>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setShowDailyConfirm(false)}
                className="h-11 px-4 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                ກັບຄືນ
              </button>
              <button
                onClick={sendDaily}
                disabled={isSendingDaily || isDailyLoading || !dailyRecipient.trim() || Number(dailySummary?.total_all || 0) <= 0}
                className="flex-1 h-11 rounded-lg bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {isSendingDaily ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 size={15} />}
                {isSendingDaily ? 'ກຳລັງສົ່ງ…' : 'ຢືນຢັນສົ່ງເງິນ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Held Bills Modal */}
      {showHeldModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[8vh] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowHeldModal(false)}
        >
          <div
            className="w-[420px] max-w-full max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-100 shrink-0">
              <Pause size={16} className="text-slate-400" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-slate-800 leading-tight">ບິນທີ່ພັກໄວ້</div>
                <div className="text-[10px] text-slate-400 leading-tight">{heldBills.length} ບິນ</div>
              </div>
              <button
                onClick={() => setShowHeldModal(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {heldBills.length === 0 ? (
                <div className="p-10 text-center text-[13px] text-slate-400 font-medium">ບໍ່ມີບິນທີ່ພັກໄວ້</div>
              ) : (
                heldBills.map(bill => (
                  <button
                    key={bill.id || bill.time}
                    onClick={() => recallBill(bill)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-slate-800 truncate">{bill.id}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{bill.time} · {bill.items.length} items</div>
                    </div>
                    <div className="text-[14px] font-black tabular-nums text-slate-900 shrink-0">{formatPrice(bill.total)} <span className="text-[11px] text-slate-400 font-bold">₭</span></div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showPickupModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[8vh] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowPickupModal(false)}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 h-14 border-b border-slate-100 shrink-0">
              <Package size={16} className="text-slate-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">ຮັບອໍເດີ</span>
              <span className="mx-1 text-slate-200">·</span>
              <input
                value={onlineQuery}
                onChange={(e) => setOnlineQuery(e.target.value)}
                placeholder="ຄົ້ນຫາ order no / ເບີໂທ…"
                className="flex-1 h-full bg-transparent text-[13px] font-medium text-slate-800 placeholder:text-slate-400 outline-none min-w-0"
              />
              <button
                onClick={() => setShowPickupModal(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {onlineLoading ? (
                <div className="p-10 text-center text-[13px] text-slate-400 font-medium">ກຳລັງໂຫຼດ…</div>
              ) : onlineOrders.length === 0 ? (
                <div className="p-12 text-center">
                  <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <div className="text-[13px] text-slate-400 font-medium">ບໍ່ມີອໍເດີລໍຖ້າຮັບ</div>
                </div>
              ) : (
                onlineOrders.map((order) => (
                  <div
                    key={order.order_no}
                    className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                  >
                    <button
                      onClick={() => {
                        if (order.source === 'shop') loadShopOrder(order.order_no);
                        else loadOnlineOrder(order.order_no);
                      }}
                      className="flex-1 flex items-center justify-between gap-3 text-left min-w-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-slate-800 truncate">{order.order_no}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 shrink-0">
                            {order.source === 'shop' ? 'Shop' : 'Online'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">{order.customer_name || '—'} · {order.customer_phone || '—'}</div>
                      </div>
                      <div className="text-[14px] font-black tabular-nums text-slate-900 shrink-0">{formatPrice(order.total || 0)} <span className="text-[11px] text-slate-400 font-bold">₭</span></div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (order.source === 'shop') cancelShopOrder(order.order_no);
                        else cancelOnlineOrder(order.order_no);
                      }}
                      className="shrink-0 h-8 px-2.5 rounded-md text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      ຍົກເລີກ
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 fade-in duration-200">
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-[13px] font-bold border ${
              toast.type === 'success'
                ? 'bg-white text-slate-800 border-slate-200'
                : 'bg-white text-rose-700 border-rose-200'
            }`}
          >
            <CheckCircle
              size={15}
              strokeWidth={2.5}
              className={toast.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}
            />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <CancelBillModal
        isOpen={showCancelBillModal}
        onClose={() => setShowCancelBillModal(false)}
        onConfirm={confirmCancelBill}
        billInfo={{ orderId, itemCount: items.length, total }}
      />

      {/* Payment Complete Modal */}
      {showCompleteModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowCompleteModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 h-12 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment</span>
              <button
                onClick={() => setShowCompleteModal(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-8 text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600" strokeWidth={2.5} />
              </div>
              <p className="text-[16px] font-bold text-slate-900">ຈ່າຍເງິນສຳເລັດ</p>
              <p className="text-[12px] text-slate-500">ບິນຖືກບັນທຶກແລ້ວ</p>
            </div>
            <div className="px-4 py-3 border-t border-slate-100">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="w-full h-11 rounded-lg bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 transition-colors"
              >
                ປິດ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reprint Modal */}
      {showReprintModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowReprintModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-100">
              <Printer size={16} className="text-slate-400" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-slate-800 leading-tight">ພິມບິນຊ້ຳ</div>
                <div className="text-[10px] text-slate-400 leading-tight">ປ້ອນເລກບິນທີ່ຕ້ອງການພິມຊ້ຳ</div>
              </div>
              <button
                onClick={() => setShowReprintModal(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">ເລກບິນ</label>
                <input
                  value={reprintDocNo}
                  onChange={(e) => setReprintDocNo(e.target.value)}
                  placeholder="ປ້ອນເລກບິນ…"
                  autoFocus
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-mono font-bold text-slate-800 placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none transition-colors"
                />
              </div>
              {reprintError ? (
                <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{reprintError}</div>
              ) : null}
              <button
                onClick={handleReprint}
                disabled={reprintLoading || !reprintDocNo.trim()}
                className="w-full h-11 rounded-lg bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {reprintLoading ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                ພິມບິນ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Slip for Printing */}
      {lastSlip && (
        <div
          aria-hidden="true"
          className="fixed left-[-10000px] top-0 pointer-events-none print-receipt-wrapper"
          style={{ opacity: 0 }}
        >
          <ReceiptSlip
            items={lastSlip.items}
            orderId={lastSlip.orderId}
            cashierName={lastSlip.cashierName}
            cashierCode={lastSlip.cashierCode}
            salesName={lastSlip.salesName}
            salesCode={lastSlip.salesCode}
            member={lastSlip.selectedMember}
            hasMember={lastSlip.hasMember}
            subtotal={lastSlip.subtotal}
            discount={lastSlip.discount}
            promoDiscount={lastSlip.promoDiscount}
            memberDiscount={lastSlip.memberDiscount}
            total={lastSlip.total}
            paymentType={lastSlip.paymentType}
            receivedAmount={lastSlip.totalReceived}
            changeDue={lastSlip.changeDue}
            earnedPoints={lastSlip.earnedPoints}
            issuedAt={lastSlip.issuedAt}
          />
        </div>
      )}

      {/* Daily Submission Slip for Printing */}
      {lastDailySlip && (
        <div
          aria-hidden="true"
          className="fixed left-[-10000px] top-0 pointer-events-none print-receipt-wrapper"
          style={{ opacity: 0 }}
        >
          <DailySubmissionSlip
            summary={lastDailySlip.summary}
            bills={lastDailySlip.bills}
            cashierName={lastDailySlip.cashierName}
            cashierCode={lastDailySlip.cashierCode}
            salesName={lastDailySlip.salesName}
            salesCode={lastDailySlip.salesCode}
            recipient={lastDailySlip.recipient}
            submittedAt={lastDailySlip.submittedAt}
          />
        </div>
      )}

      {/* Customer Display Portal */}
      {customerWindow.current && createPortal(<CustomerDisplay items={lineItems} total={total} subtotal={subtotal} memberSaving={0} hasMember={hasMember} selectedMember={selectedMember} earnedPoints={earnedPoints} pointsEligibleTotal={pointsEligibleTotal} remainingForNextPoint={remainingForNextPoint} pointsRate={POINTS_RATE} paymentType={paymentType} isProcessingPayment={isPaying} onPaymentSuccess={() => handlePaymentSuccess.current?.()} orderId={orderId} cashierName={cashierName} />, customerWindow.current.document.getElementById('root'))}
    </div>
  );
}
