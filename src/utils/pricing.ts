const toNumber = (value: unknown): number => {
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const PROMO_TYPE_BOGO = "bogo";

const normalizePromoType = (raw: unknown): string | null => {
  if (!raw) return null;
  const normalized = String(raw).toLowerCase().replace(/\s+/g, "");
  if (["bogo", "buy1get1", "buy1_get1", "1+1", "b1g1"].includes(normalized)) {
    return PROMO_TYPE_BOGO;
  }
  return null;
};

interface ItemLike {
  bogo?: boolean;
  buy1get1?: boolean;
  buy1_get1?: boolean;
  promo_buy1_get1?: boolean;
  promo_type?: string;
  promoType?: string;
  promotion_type?: string;
  promotion?: string;
  promo?: string;
  price?: number | string;
  quantity?: number | string;
  [key: string]: unknown;
}

export const getItemPromoType = (item: ItemLike | null): string | null => {
  if (!item || typeof item !== "object") return null;
  if (item.bogo || item.buy1get1 || item.buy1_get1 || item.promo_buy1_get1) return PROMO_TYPE_BOGO;
  const raw = item.promo_type || item.promoType || item.promotion_type || item.promotion || item.promo;
  return normalizePromoType(raw);
};

const getBogoFreeQty = (quantity: number): number => Math.floor(quantity / 2);

export const calculateLinePricing = (item: ItemLike | null, memberDiscountPercent = 0) => {
  const price = toNumber(item?.price);
  const quantity = Math.max(toNumber(item?.quantity), 0);
  const lineSubtotal = price * quantity;
  const promoType = getItemPromoType(item);
  const promoFreeQty = promoType === PROMO_TYPE_BOGO ? getBogoFreeQty(quantity) : 0;
  const promoDiscount = price * promoFreeQty;
  const memberBase = Math.max(lineSubtotal - promoDiscount, 0);
  const memberDiscount = memberDiscountPercent > 0
    ? Math.round(memberBase * (memberDiscountPercent / 100))
    : 0;
  const lineDiscount = promoDiscount + memberDiscount;
  const lineNet = Math.max(lineSubtotal - lineDiscount, 0);

  return {
    ...item,
    lineSubtotal, promoType, promoFreeQty, promoDiscount,
    memberDiscount, lineDiscount, lineNet,
  };
};

export const calculateOrderPricing = (items: ItemLike[], memberDiscountPercent = 0) => {
  const lineItems = Array.isArray(items)
    ? items.map((item) => calculateLinePricing(item, memberDiscountPercent))
    : [];
  const subtotal = lineItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const promoDiscount = lineItems.reduce((sum, item) => sum + item.promoDiscount, 0);
  const memberDiscount = lineItems.reduce((sum, item) => sum + item.memberDiscount, 0);
  const discountTotal = promoDiscount + memberDiscount;
  const total = Math.max(subtotal - discountTotal, 0);

  return { lineItems, subtotal, promoDiscount, memberDiscount, discountTotal, total };
};
