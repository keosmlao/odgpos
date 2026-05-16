"use client";
// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Minus, Trash2, ScanLine, ShoppingBag, ClipboardList } from 'lucide-react';
import { listProductImagesAction } from '@/app/_actions/product-images';
import { calculateLinePricing } from '@/utils/pricing';

// --- UTILITY FUNCTIONS ---
const toNumber = (value) => {
  const parsed = Number(typeof value === 'string' ? value.replace(/,/g, '').trim() : value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPrice = (price) => toNumber(price).toLocaleString();


// --- 1. NEW, MODERN & RESPONSIVE CART ITEM ---
const CartItem = ({
  item,
  imageUrl,
  discountPercent = 0,
  onUpdateQty,
  onSetQty,
  onRemove,
  isEditing,
  onEditingChange,
  qtyInputValue,
  onQtyInputChange,
}) => {
  const { id, name, price, quantity, unit } = item;
  const giftForName = item?.gift_for_name || '';
  const isGiftItem = !!item?.is_promo_gift;

  const safePrice = toNumber(price);
  const pricing = calculateLinePricing(item, discountPercent);
  const lineSubtotal = pricing.lineSubtotal;
  const lineNet = pricing.lineNet;
  const promoDiscount = pricing.promoDiscount;
  const promoFreeQty = pricing.promoFreeQty;
  const hasMemberDiscount = discountPercent > 0;
  const hasPromoDiscount = promoDiscount > 0;
  const hasDiscount = hasMemberDiscount || hasPromoDiscount;
  const unitNetPrice = quantity > 0 ? lineNet / quantity : safePrice;

  const handleQtyBlur = () => {
    const raw = String(qtyInputValue ?? '');
    const normalized = raw.replace(',', '.').trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed > 0) {
      onSetQty(id, parsed);
    } else {
      // Reset to original quantity if input is invalid
      onQtyInputChange(id, quantity);
    }
    onEditingChange(id, false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur(); // This will trigger onBlur
    }
  };

  return (
    <tr className={`border-b border-slate-100 ${isGiftItem ? 'bg-rose-50' : 'bg-white'}`}>
      <td className="py-2 px-2">
        <div className="flex items-center gap-2 min-w-[180px]">
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <ShoppingBag size={18} className="text-slate-300" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className={`font-bold text-[13px] truncate ${isGiftItem ? 'text-rose-700' : 'text-slate-800'}`}>{name}</h4>
              {hasPromoDiscount && (
                <span className="bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">1+1</span>
              )}
              {hasMemberDiscount && (
                <span className="bg-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                  -{discountPercent}%
                </span>
              )}
            </div>
            <div className={`text-[10px] font-medium font-mono ${isGiftItem ? 'text-rose-500' : 'text-slate-400'}`}>
              #{id} {unit && `• ${unit}`}
            </div>
            {promoFreeQty > 0 && (
              <div className="text-[9px] font-bold text-emerald-600 mt-1">ໂປຣໂມຊັນ 1 ແຖມ 1: ແຖມ {promoFreeQty}</div>
            )}
            {item?.is_promo_gift && giftForName && (
              <div className="text-[9px] font-bold text-rose-600 mt-1">ແຖມຈາກ: {giftForName}</div>
            )}
          </div>
        </div>
      </td>
      <td className="py-2 px-2 text-right align-top hidden sm:table-cell">
        {hasDiscount ? (
          <>
            <div className={`text-[13px] font-bold ${isGiftItem ? 'text-rose-600' : 'text-blue-600'}`}>{formatPrice(unitNetPrice)}</div>
            <div className="text-[10px] text-slate-400 line-through">{formatPrice(safePrice)}</div>
          </>
        ) : (
          <div className={`text-[13px] font-bold ${isGiftItem ? 'text-rose-600' : 'text-slate-700'}`}>{formatPrice(safePrice)}</div>
        )}
        <div className={`text-[10px] ${isGiftItem ? 'text-rose-500' : 'text-slate-500'}`}>₭/{unit || 'ໜ່ວຍ'}</div>
      </td>
      <td className="py-2 px-2 text-center align-top">
        <div className="inline-flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
          <button
            onClick={() => { if (!isGiftItem) onUpdateQty(id, -1); }}
            disabled={isGiftItem}
            className={`w-7 h-7 flex items-center justify-center transition-transform ${
              isGiftItem
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-500 hover:text-blue-600 active:scale-90'
            }`}
          >
            <Minus size={14} strokeWidth={3} />
          </button>
          <input
            type="text"
            inputMode="decimal"
            value={isEditing ? qtyInputValue : quantity}
            onChange={(e) => {
              if (isGiftItem) return;
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                onQtyInputChange(id, value);
              }
            }}
            onFocus={() => { if (!isGiftItem) onEditingChange(id, true); }}
            onBlur={handleQtyBlur}
            onKeyDown={handleKeyDown}
            readOnly={isGiftItem}
            className={`w-14 h-7 text-center text-[12px] font-bold rounded border ${
              isGiftItem
                ? 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed'
                : 'text-slate-800 bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400'
            }`}
          />
          <button
            onClick={() => { if (!isGiftItem) onUpdateQty(id, 1); }}
            disabled={isGiftItem}
            className={`w-7 h-7 flex items-center justify-center transition-transform ${
              isGiftItem
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-500 hover:text-blue-600 active:scale-90'
            }`}
          >
            <Plus size={14} strokeWidth={3} />
          </button>
        </div>
      </td>
      <td className="py-2 px-2 text-right align-top">
        {hasDiscount && (
          <div className="text-[10px] text-slate-400 line-through">{formatPrice(lineSubtotal)}₭</div>
        )}
        <div className={`text-[13px] font-black ${isGiftItem ? 'text-rose-600' : 'text-blue-600'}`}>{formatPrice(lineNet)}₭</div>
      </td>
      <td className="py-2 px-2 text-center align-top">
        <button
          onClick={() => { if (!isGiftItem) onRemove(id); }}
          disabled={isGiftItem}
          className={`p-1.5 rounded-lg transition-colors ${
            isGiftItem
              ? 'text-slate-300 bg-slate-50 cursor-not-allowed'
              : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'
          }`}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
};


// --- 2. MAIN CART COMPONENT ---
const Cart = ({
  items = [],
  onUpdateQty,
  onSetQty,
  onRemoveItem,
  hasMember = false,
  selectedMember = null,
  onBarcodeSubmit,
}) => {
  const isEmpty = items.length === 0;
  const [barcode, setBarcode] = useState('');

  // State for handling non-blocking quantity input
  const [qtyInputs, setQtyInputs] = useState({});
  const [editingIds, setEditingIds] = useState({});

  useEffect(() => {
    // Sync local quantity state when cart items change from props, but preserve edits
    const newQtyInputs = { ...qtyInputs };
    items.forEach(item => {
      if (!editingIds[item.id]) {
        newQtyInputs[item.id] = item.quantity;
      }
    });
    setQtyInputs(newQtyInputs);
  }, [items]);

  const handleQtyInputChange = (id, value) => {
    setQtyInputs(prev => ({ ...prev, [id]: value }));
  };

  const handleEditingChange = (id, isEditing) => {
    setEditingIds(prev => ({ ...prev, [id]: isEditing }));
    // If we start editing, ensure the input state is primed
    if (isEditing) {
      const currentItem = items.find(item => item.id === id);
      if (currentItem) {
        setQtyInputs(prev => ({ ...prev, [id]: currentItem.quantity }));
      }
    }
  };

  // --- Image Fetching ---
  const [imageMap, setImageMap] = useState({});
  useEffect(() => {
    let isMounted = true;
    const fetchImages = async () => {
      try {
        const list: any[] = (await listProductImagesAction()) || [];
        const newImageMap: Record<string, any> = {};
        if (Array.isArray(list)) {
          list.forEach((img) => {
            const key = String(img?.ic_code ?? '');
            if (key && !newImageMap[key]) newImageMap[key] = img;
          });
        }
        if (isMounted) setImageMap(newImageMap);
      } catch {
        if (isMounted) setImageMap({});
      }
    };
    fetchImages();
    return () => { isMounted = false; };
  }, []);

  const imageBaseUrl = '';
  const getImageUrl = (item) => {
    const img = imageMap[item.id] || imageMap[item.barcode] || imageMap[item.ic_code];
    return img?.file_url ? `${imageBaseUrl}${img.file_url}` : '';
  };

  const handleBarcodeSubmit = (event) => {
    event.preventDefault();
    if (!barcode.trim()) return;
    onBarcodeSubmit?.(barcode.trim());
    setBarcode('');
  };

  const discountPercent = hasMember && selectedMember?.discount > 0 ? selectedMember.discount : 0;

  const displayItems = useMemo(() => {
    const baseItems = items.filter((item) => !item?.is_promo_gift);
    const giftItems = items.filter((item) => item?.is_promo_gift);
    if (giftItems.length === 0) return items;
    const giftMap = new Map();
    giftItems.forEach((gift) => {
      const key = gift.gift_for_code || '';
      if (!key) return;
      if (!giftMap.has(key)) giftMap.set(key, []);
      giftMap.get(key).push(gift);
    });
    const usedGiftIds = new Set();
    const ordered = [];
    baseItems.forEach((item) => {
      ordered.push(item);
      const matchCodes = [
        item.id,
        item.item_code,
        item.barcode,
      ].filter(Boolean);
      matchCodes.forEach((code) => {
        const gifts = giftMap.get(code) || [];
        gifts.forEach((gift) => {
          if (!usedGiftIds.has(gift.id)) {
            ordered.push(gift);
            usedGiftIds.add(gift.id);
          }
        });
      });
    });
    giftItems.forEach((gift) => {
      if (!usedGiftIds.has(gift.id)) {
        ordered.push(gift);
        usedGiftIds.add(gift.id);
      }
    });
    return ordered;
  }, [items]);

  return (
    <div className="flex w-full flex-col bg-slate-50/50 rounded-2xl sm:rounded-[2rem] lg:rounded-[2.5rem] border border-slate-200/80 shadow-xl lg:h-full min-h-0">

      {/* Header: Title & Scan */}
      <div className="p-4 sm:p-5 lg:p-6 pb-4 bg-white/80 backdrop-blur-sm border-b border-slate-200/80 rounded-t-[2.5rem]">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/30">
                    <ShoppingBag size={20} strokeWidth={2.5} />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">ລາຍການສິນຄ້າ</h2>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider">
                {items.length} ລາຍການ
            </span>
        </div>

        {onBarcodeSubmit && (
          <form onSubmit={handleBarcodeSubmit} className="relative group">
            <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="ສະແກນບາໂຄດ ຫຼື ພິມລະຫັດ..."
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-slate-100 border-2 border-slate-300 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm font-medium placeholder:text-slate-400"
            />
          </form>
        )}
      </div>

      {/* Items List Area */}
      <div className="flex-1 p-2 sm:p-3 lg:p-4 lg:overflow-y-auto scrollbar-hide">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10">
            <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-slate-300 mb-5 shadow-inner-sm border border-slate-100">
                <ClipboardList size={40} strokeWidth={1.5} />
            </div>
            <p className="text-slate-800 font-bold text-base">ກະຕ່າສິນຄ້າຫວ່າງເປົ່າ</p>
            <p className="text-slate-500 text-sm mt-1 max-w-xs">ເພີ່ມສິນຄ້າຈາກລາຍການ ຫຼື ສະແກນບາໂຄດເພື່ອເລີ່ມການຂາຍ</p>
          </div>
        ) : (
          <div className="pb-4 overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-[10px] sm:text-xs text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-2 px-2 text-left">ສິນຄ້າ</th>
                  <th className="py-2 px-2 text-right hidden sm:table-cell">ລາຄາ/ໜ່ວຍ</th>
                  <th className="py-2 px-2 text-center">ຈຳນວນ</th>
                  <th className="py-2 px-2 text-right">ລວມ</th>
                  <th className="py-2 px-2 text-center">ຈັດການ</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item) => (
                  <CartItem
                    key={item.id}
                    item={item}
                    imageUrl={getImageUrl(item)}
                    discountPercent={discountPercent}
                    onUpdateQty={onUpdateQty}
                    onSetQty={onSetQty}
                    onRemove={onRemoveItem}
                    isEditing={!!editingIds[item.id]}
                    onEditingChange={handleEditingChange}
                    qtyInputValue={qtyInputs[item.id]}
                    onQtyInputChange={handleQtyInputChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
