export const PROMO_SELECTION_AUTO = 'auto'
export const PROMO_SELECTION_CHOOSE_ONE = 'choose_one'
export const PROMO_SELECTION_CHOOSE_MANY = 'choose_many'

export const PROMO_TYPE_BUY_ONE_GET_GIFT = 'buy_one_get_gift'
export const PROMO_TYPE_BUY_QTY_GET_GIFT = 'buy_qty_get_gift'
export const PROMO_TYPE_COMBO_QTY_GET_GIFT = 'combo_qty_get_gift'
export const PROMO_TYPE_BUY_ONE_CHOOSE_ONE = 'buy_one_choose_one'
export const PROMO_TYPE_BUY_ONE_CHOOSE_MANY = 'buy_one_choose_many'

export const PROMO_TYPE_BOGO = 'bogo'
export const PROMO_TYPE_BUNDLE_GIFT = 'bundle_gift'

const PROMO_TYPE_ALIASES = {
  [PROMO_TYPE_BUY_ONE_GET_GIFT]: PROMO_TYPE_BUY_ONE_GET_GIFT,
  [PROMO_TYPE_BUY_QTY_GET_GIFT]: PROMO_TYPE_BUY_QTY_GET_GIFT,
  [PROMO_TYPE_COMBO_QTY_GET_GIFT]: PROMO_TYPE_COMBO_QTY_GET_GIFT,
  [PROMO_TYPE_BUY_ONE_CHOOSE_ONE]: PROMO_TYPE_BUY_ONE_CHOOSE_ONE,
  [PROMO_TYPE_BUY_ONE_CHOOSE_MANY]: PROMO_TYPE_BUY_ONE_CHOOSE_MANY,
  [PROMO_TYPE_BOGO]: PROMO_TYPE_BUY_ONE_GET_GIFT,
  [PROMO_TYPE_BUNDLE_GIFT]: PROMO_TYPE_BUY_ONE_GET_GIFT,
  buy1get1: PROMO_TYPE_BUY_ONE_GET_GIFT,
  buy1_get1: PROMO_TYPE_BUY_ONE_GET_GIFT,
  b1g1: PROMO_TYPE_BUY_ONE_GET_GIFT,
  '1+1': PROMO_TYPE_BUY_ONE_GET_GIFT,
}

const cleanString = (value: unknown) => {
  if (typeof value === 'string') return value.trim()
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const normalizePositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

const normalizeBoolean = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false
  }
  return fallback
}

const parseMaybeJson = (value: unknown) => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const dedupeByLookup = <T extends { lookup_code?: string; item_code?: string; barcode?: string }>(items: T[]) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = cleanString(item.lookup_code || item.barcode || item.item_code)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const resolvePromotionType = (raw: unknown) => {
  const normalized = cleanString(raw).toLowerCase().replace(/\s+/g, '_')
  return PROMO_TYPE_ALIASES[normalized as keyof typeof PROMO_TYPE_ALIASES] || PROMO_TYPE_BUY_ONE_GET_GIFT
}

export const getPromotionDefaultRuleConfig = (rawPromoType: unknown) => {
  const promoType = resolvePromotionType(rawPromoType)

  switch (promoType) {
    case PROMO_TYPE_BUY_QTY_GET_GIFT:
      return {
        trigger_qty: 2,
        combine_buy_items: false,
        selection_mode: PROMO_SELECTION_AUTO,
        selection_limit: 1,
      }
    case PROMO_TYPE_COMBO_QTY_GET_GIFT:
      return {
        trigger_qty: 2,
        combine_buy_items: true,
        selection_mode: PROMO_SELECTION_AUTO,
        selection_limit: 1,
      }
    case PROMO_TYPE_BUY_ONE_CHOOSE_ONE:
      return {
        trigger_qty: 1,
        combine_buy_items: false,
        selection_mode: PROMO_SELECTION_CHOOSE_ONE,
        selection_limit: 1,
      }
    case PROMO_TYPE_BUY_ONE_CHOOSE_MANY:
      return {
        trigger_qty: 1,
        combine_buy_items: false,
        selection_mode: PROMO_SELECTION_CHOOSE_MANY,
        selection_limit: 2,
      }
    case PROMO_TYPE_BUY_ONE_GET_GIFT:
    default:
      return {
        trigger_qty: 1,
        combine_buy_items: false,
        selection_mode: PROMO_SELECTION_AUTO,
        selection_limit: 1,
      }
  }
}

export const normalizePromotionRuleConfig = (raw: unknown, rawPromoType: unknown) => {
  const promoType = resolvePromotionType(rawPromoType)
  const defaults = getPromotionDefaultRuleConfig(promoType)
  const parsed = parseMaybeJson(raw)
  const source = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}

  let selectionMode = cleanString(source.selection_mode).toLowerCase()
  if (!selectionMode) selectionMode = defaults.selection_mode
  if (![PROMO_SELECTION_AUTO, PROMO_SELECTION_CHOOSE_ONE, PROMO_SELECTION_CHOOSE_MANY].includes(selectionMode)) {
    selectionMode = defaults.selection_mode
  }
  if (promoType === PROMO_TYPE_BUY_ONE_CHOOSE_ONE) selectionMode = PROMO_SELECTION_CHOOSE_ONE
  if (promoType === PROMO_TYPE_BUY_ONE_CHOOSE_MANY) selectionMode = PROMO_SELECTION_CHOOSE_MANY
  if ([PROMO_TYPE_BUY_ONE_GET_GIFT, PROMO_TYPE_BUY_QTY_GET_GIFT, PROMO_TYPE_COMBO_QTY_GET_GIFT].includes(promoType)) {
    selectionMode = PROMO_SELECTION_AUTO
  }

  const triggerQty = normalizePositiveNumber(source.trigger_qty, defaults.trigger_qty)
  const selectionLimit = selectionMode === PROMO_SELECTION_CHOOSE_ONE
    ? 1
    : normalizePositiveNumber(source.selection_limit, defaults.selection_limit)

  return {
    trigger_qty: triggerQty,
    combine_buy_items: promoType === PROMO_TYPE_COMBO_QTY_GET_GIFT
      ? true
      : normalizeBoolean(source.combine_buy_items, defaults.combine_buy_items),
    selection_mode: selectionMode,
    selection_limit: selectionLimit,
  }
}

export const normalizePromotionBuyItem = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const itemCode = cleanString(source.item_code || source.ic_code || source.code || source.id)
  const barcode = cleanString(source.barcode)
  const lookupCode = cleanString(source.lookup_code || barcode || itemCode)
  if (!lookupCode && !itemCode && !barcode) return null

  return {
    item_code: itemCode,
    barcode,
    lookup_code: lookupCode || itemCode || barcode,
    name: cleanString(source.name || source.item_name || source.name_1 || source.title) || itemCode || barcode || lookupCode,
  }
}

export const normalizePromotionGiftItem = (raw: unknown) => {
  const normalized = normalizePromotionBuyItem(raw)
  if (!normalized) return null
  const source = raw as Record<string, unknown>

  return {
    ...normalized,
    qty: normalizePositiveNumber(source.qty || source.gift_qty, 1),
  }
}

export const normalizePromotionBuyItems = (raw: unknown) => {
  const parsed = parseMaybeJson(raw)
  const items = Array.isArray(parsed) ? parsed : parsed ? [parsed] : []
  return dedupeByLookup(
    items
      .map((item) => normalizePromotionBuyItem(item))
      .filter(Boolean),
  )
}

export const normalizePromotionGiftItems = (raw: unknown) => {
  const parsed = parseMaybeJson(raw)
  const items = Array.isArray(parsed) ? parsed : parsed ? [parsed] : []
  return dedupeByLookup(
    items
      .map((item) => normalizePromotionGiftItem(item))
      .filter(Boolean),
  )
}

export const buildLegacyPromotionFields = (buyItems: unknown, giftItems: unknown) => {
  const normalizedBuyItems = normalizePromotionBuyItems(buyItems)
  const normalizedGiftItems = normalizePromotionGiftItems(giftItems)
  const firstBuy = normalizedBuyItems[0] || null
  const firstGift = normalizedGiftItems[0] || null

  return {
    item_code: firstBuy?.item_code || null,
    barcode: firstBuy?.barcode || null,
    gift_code: firstGift?.lookup_code || firstGift?.barcode || firstGift?.item_code || null,
    gift_qty: firstGift?.qty || 1,
  }
}

export const normalizePromotionPayload = (raw: unknown) => {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const promoType = resolvePromotionType(source.promo_type)
  const buyItems = normalizePromotionBuyItems(source.buy_items)
  const giftItems = normalizePromotionGiftItems(source.gift_items)

  const fallbackBuyItems = buyItems.length
    ? buyItems
    : normalizePromotionBuyItems({
        item_code: source.item_code,
        barcode: source.barcode,
      })
  const fallbackGiftItems = giftItems.length
    ? giftItems
    : normalizePromotionGiftItems({
        item_code: source.gift_code,
        barcode: source.gift_code,
        lookup_code: source.gift_code,
        qty: source.gift_qty,
      })

  const legacy = buildLegacyPromotionFields(fallbackBuyItems, fallbackGiftItems)

  return {
    promo_type: promoType,
    rule_config: normalizePromotionRuleConfig(source.rule_config, promoType),
    buy_items: fallbackBuyItems,
    gift_items: fallbackGiftItems,
    item_code: legacy.item_code,
    barcode: legacy.barcode,
    gift_code: legacy.gift_code,
    gift_qty: legacy.gift_qty,
    start_date: cleanString(source.start_date) || null,
    end_date: cleanString(source.end_date) || null,
    is_active: source.is_active !== false,
  }
}

export const normalizePromotionRecord = (raw: unknown) => {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const normalized = normalizePromotionPayload(source)

  return {
    ...source,
    ...normalized,
  }
}

export const getPromotionBuyItems = (promotion: unknown) => normalizePromotionRecord(promotion).buy_items

export const getPromotionGiftItems = (promotion: unknown) => normalizePromotionRecord(promotion).gift_items

export const getPromotionRuleConfig = (promotion: unknown) => normalizePromotionRecord(promotion).rule_config

export const isAutomaticPromotion = (promotion: unknown) => (
  getPromotionRuleConfig(promotion).selection_mode === PROMO_SELECTION_AUTO
)

export const isSelectablePromotion = (promotion: unknown) => !isAutomaticPromotion(promotion)

export const isCombinedPromotion = (promotion: unknown) => !!getPromotionRuleConfig(promotion).combine_buy_items

export const getPromotionTriggerQty = (promotion: unknown) => normalizePositiveNumber(
  getPromotionRuleConfig(promotion).trigger_qty,
  1,
)

export const getPromotionSelectionLimit = (promotion: unknown) => normalizePositiveNumber(
  getPromotionRuleConfig(promotion).selection_limit,
  1,
)

export const getPromotionQualificationCount = (promotion: unknown, rawQuantity: unknown) => {
  const quantity = normalizePositiveNumber(rawQuantity, 0)
  const triggerQty = getPromotionTriggerQty(promotion)
  return Math.max(Math.floor(quantity / triggerQty), 0)
}

export const getPromotionGroupKey = (promotion: unknown) => {
  const normalized = normalizePromotionRecord(promotion)
  const explicitId = cleanString(normalized.promotion_id || normalized.promo_id || normalized.id)
  if (explicitId) return explicitId

  return JSON.stringify({
    promo_type: normalized.promo_type,
    buy_items: normalized.buy_items,
    gift_items: normalized.gift_items,
    rule_config: normalized.rule_config,
  })
}

export const promotionMatchesCode = (promotion: unknown, rawCode: unknown) => {
  const code = cleanString(rawCode)
  if (!code) return false
  const normalized = normalizePromotionRecord(promotion)

  return normalized.buy_items.some((item: Record<string, unknown>) => {
    const candidates = [
      cleanString(item.lookup_code),
      cleanString(item.barcode),
      cleanString(item.item_code),
      cleanString(normalized.barcode),
      cleanString(normalized.item_code),
    ].filter(Boolean)
    return candidates.includes(code)
  })
}

export const promotionMatchesQuery = (promotion: unknown, rawQuery: unknown) => {
  const query = cleanString(rawQuery).toLowerCase()
  if (!query) return true
  const normalized = normalizePromotionRecord(promotion)
  const haystack = [
    normalized.promo_type,
    normalized.item_code,
    normalized.barcode,
    normalized.gift_code,
    String(normalized.rule_config?.trigger_qty || ''),
    String(normalized.rule_config?.selection_mode || ''),
    String(normalized.rule_config?.selection_limit || ''),
    ...normalized.buy_items.flatMap((item: Record<string, unknown>) => [
      cleanString(item.name),
      cleanString(item.lookup_code),
      cleanString(item.barcode),
      cleanString(item.item_code),
    ]),
    ...normalized.gift_items.flatMap((item: Record<string, unknown>) => [
      cleanString(item.name),
      cleanString(item.lookup_code),
      cleanString(item.barcode),
      cleanString(item.item_code),
    ]),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}
