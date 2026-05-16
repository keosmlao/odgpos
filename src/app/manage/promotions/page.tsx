"use client";
// @ts-nocheck

import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { searchProductsAction } from '@/app/_actions/products'
import {
  listPromotionsAction,
  createPromotionAction,
  updatePromotionAction,
  deletePromotionAction,
} from '@/app/_actions/promotions'
import {
  getPromotionRuleConfig,
  normalizePromotionBuyItem,
  normalizePromotionGiftItem,
  normalizePromotionRecord,
  PROMO_TYPE_BUY_ONE_CHOOSE_MANY,
  PROMO_TYPE_BUY_ONE_CHOOSE_ONE,
  PROMO_TYPE_BUY_ONE_GET_GIFT,
  PROMO_TYPE_BUY_QTY_GET_GIFT,
  PROMO_TYPE_COMBO_QTY_GET_GIFT,
  PROMO_SELECTION_CHOOSE_MANY,
  PROMO_SELECTION_CHOOSE_ONE,
} from '@/lib/promotions'

const PROMO_TYPES = [
  {
    value: PROMO_TYPE_BUY_ONE_GET_GIFT,
    label: 'ຊື້ 1 ແຖມ 1',
    description: 'ຊື້ຄົບ 1 ຈາກລາຍການທີ່ກຳນົດ → ລະບົບແຖມທັນທີ',
    buyLabel: 'ສິນຄ້າທີ່ຊື້ (1 ຊິ້ນກໍແຖມ)',
    giftLabel: 'ຂອງແຖມ (auto-add)',
    buyHint: 'ເລືອກສິນຄ້າ 1 ຫຼື ຫຼາຍລາຍການ — ຊື້ອັນໃດກໍແຖມ',
    giftHint: 'ລະບົບຈະເພີ່ມຂອງແຖມໃຫ້ອັດຕະໂນມັດ',
  },
  {
    value: PROMO_TYPE_BUY_QTY_GET_GIFT,
    label: 'ຊື້ຄົບຈຳນວນ ແຖມ 1',
    description: 'ຊື້ສິນຄ້າ 1 ລາຍການ ຄົບຈຳນວນທີ່ກຳນົດ (ເຊັ່ນ 2, 3, 4 ຊິ້ນ) → ແຖມ',
    buyLabel: 'ສິນຄ້າທີ່ຊື້ (1 ລາຍການ)',
    giftLabel: 'ຂອງແຖມ (1 ລາຍການ, auto-add)',
    buyHint: 'ເລືອກສິນຄ້າ 1 ລາຍການ — ຊື້ຄົບຈຳນວນທີ່ກຳນົດຈຶ່ງແຖມ',
    giftHint: 'ລະບົບຈະເພີ່ມຂອງແຖມໃຫ້ອັດຕະໂນມັດ',
  },
  {
    value: PROMO_TYPE_COMBO_QTY_GET_GIFT,
    label: 'ຊື້ຫຼາຍຢ່າງລວມກັນ ແຖມ 1',
    description: 'ນັບລວມຂອງ buy items ໃຫ້ຄົບຈຳນວນ → ແຖມ',
    buyLabel: 'ສິນຄ້າທີ່ນັບລວມ (combo)',
    giftLabel: 'ຂອງແຖມ (auto-add)',
    buyHint: 'ຊື້ລາຍການໃດກໍໄດ້ ນັບລວມໃຫ້ຄົບຈຳນວນ',
    giftHint: 'ຄົບຈຳນວນແລ້ວ ລະບົບເພີ່ມແຖມໃຫ້',
  },
  {
    value: PROMO_TYPE_BUY_ONE_CHOOSE_ONE,
    label: 'ຊື້ 1 ເລືອກແຖມໄດ້ 1 ຢ່າງ',
    description: 'ຊື້ແລ້ວ ລູກຄ້າເລືອກຂອງແຖມເອງ 1 ລາຍການ',
    buyLabel: 'ສິນຄ້າທີ່ຊື້',
    giftLabel: 'ຕົວເລືອກຂອງແຖມ (ລູກຄ້າເລືອກ 1)',
    buyHint: 'ເມື່ອຊື້ສິນຄ້າຈາກລາຍການນີ້',
    giftHint: 'ລູກຄ້າເລືອກເອົາ 1 ລາຍການຈາກລາຍການຂ້າງລຸ່ມ',
  },
  {
    value: PROMO_TYPE_BUY_ONE_CHOOSE_MANY,
    label: 'ຊື້ 1 ເລືອກແຖມໄດ້ຫຼາຍ',
    description: 'ຊື້ແລ້ວ ລູກຄ້າເລືອກຂອງແຖມເອງຕາມ limit',
    buyLabel: 'ສິນຄ້າທີ່ຊື້',
    giftLabel: 'ຕົວເລືອກຂອງແຖມ (ລູກຄ້າເລືອກຕາມ limit)',
    buyHint: 'ເມື່ອຊື້ສິນຄ້າຈາກລາຍການນີ້',
    giftHint: 'ລູກຄ້າເລືອກໄດ້ຕາມຈຳນວນ limit ທີ່ກຳນົດ',
  },
]

const todayDate = () => new Date().toISOString().slice(0, 10)

const createEmptyForm = () => ({
  id: null,
  promo_type: PROMO_TYPE_BUY_ONE_GET_GIFT,
  rule_config: getPromotionRuleConfig({ promo_type: PROMO_TYPE_BUY_ONE_GET_GIFT }),
  buy_items: [],
  gift_items: [],
  start_date: todayDate(),
  end_date: todayDate(),
  is_active: true,
})

const toDateInput = (value) => {
  if (!value) return ''
  try {
    return new Date(value).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

const formatDateDisplay = (value) => {
  if (!value) return '-'
  try {
    const date = new Date(value)
    return date.toLocaleDateString('lo-LA', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '-'
  }
}

const getLookupCode = (item) => item?.lookup_code || item?.barcode || item?.item_code || item?.ic_code || ''

const getItemCode = (item) => (
  item?.item_code ||
  item?.ic_code ||
  item?.code ||
  item?.lookup_code ||
  item?.barcode ||
  '-'
)

const getItemMetaLine = (item) => {
  const code = getItemCode(item)
  const barcode = item?.barcode || ''
  return barcode && barcode !== code ? `${code} · ${barcode}` : code
}

const getItemTitle = (item) => item?.name || item?.item_name || item?.name_1 || getItemCode(item)

const getPromoTypeMeta = (promoType) => (
  PROMO_TYPES.find((type) => type.value === promoType) || PROMO_TYPES[0]
)

const formatRuleSummary = (promotion) => {
  const rule = getPromotionRuleConfig(promotion)
  if (rule.selection_mode === PROMO_SELECTION_CHOOSE_ONE) {
    return 'ເລືອກຂອງແຖມໄດ້ 1 ລາຍການ'
  }
  if (rule.selection_mode === PROMO_SELECTION_CHOOSE_MANY) {
    return `ເລືອກຂອງແຖມໄດ້ ${rule.selection_limit} ລາຍການ`
  }
  if (rule.combine_buy_items) {
    return `ລວມ buy items ໃຫ້ຄົບ ${rule.trigger_qty} ຈຶ່ງແຖມ`
  }
  if (rule.trigger_qty > 1) {
    return `ຊື້ຄົບ ${rule.trigger_qty} ຈຶ່ງແຖມ`
  }
  return 'ຊື້ຄົບ 1 ແຖມທັນທີ'
}

const getTotalGiftQty = (items = []) => items.reduce((sum, item) => sum + Number(item?.qty || 1), 0)

const formatPeriodSummary = (promotion) => {
  const start = formatDateDisplay(promotion?.start_date)
  const end = formatDateDisplay(promotion?.end_date)
  if (start === '-' && end === '-') return 'ບໍ່ກຳນົດໄລຍະເວລາ'
  if (start !== '-' && end !== '-') return `${start} - ${end}`
  if (start !== '-') return `ເລີ່ມ ${start}`
  return `ເຖິງ ${end}`
}

const PromotionItemsPreview = ({ items = [], variant = 'buy' }) => {
  const tone = variant === 'gift'
    ? 'bg-amber-50 text-amber-700 border-amber-100'
    : 'bg-slate-100 text-slate-700 border-slate-200'

  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-[12px] text-slate-400">ບໍ່ມີລາຍການ</p>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.slice(0, 3).map((item) => (
        <span
          key={getLookupCode(item)}
          className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone}`}
        >
          <span className="shrink-0 font-mono text-[10px] opacity-60">{getItemCode(item)}</span>
          <span className="truncate">{getItemTitle(item)}</span>
          {variant === 'gift' && Number(item?.qty || 1) > 1 ? <span className="shrink-0">x{Number(item.qty || 1)}</span> : null}
        </span>
      ))}
      {items.length > 3 ? (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
          +{items.length - 3}
        </span>
      ) : null}
    </div>
  )
}

const PromotionListCard = ({ promotion, onEdit, onDelete }) => {
  const typeMeta = getPromoTypeMeta(promotion.promo_type)
  const totalGiftQty = getTotalGiftQty(promotion.gift_items)

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
              <Sparkles size={11} />
              {typeMeta.label}
            </span>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
              promotion.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {promotion.is_active ? 'Active' : 'Inactive'}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
              #{promotion.id}
            </span>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Buy Items</p>
                <span className="text-[11px] font-medium text-slate-400">{promotion.buy_items.length} ລາຍການ</span>
              </div>
              <div className="mt-2">
                <PromotionItemsPreview items={promotion.buy_items} />
              </div>
            </section>

            <section className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">Gift Items</p>
                <span className="text-[11px] font-medium text-amber-600">{totalGiftQty} ຊິ້ນ</span>
              </div>
              <div className="mt-2">
                <PromotionItemsPreview items={promotion.gift_items} variant="gift" />
              </div>
            </section>
          </div>

          <div className="grid gap-2 text-[12px] text-slate-500 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="font-semibold text-slate-700">Rule:</span> {formatRuleSummary(promotion)}
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Calendar size={13} className="text-slate-400" />
              <span>{formatPeriodSummary(promotion)}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:flex-col lg:items-stretch">
          <button
            onClick={() => onEdit?.(promotion)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            <Pencil size={14} />
            ແກ້ໄຂ
          </button>
          <button
            onClick={() => onDelete?.(promotion.id)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100"
          >
            <Trash2 size={14} />
            ລຶບ
          </button>
        </div>
      </div>
    </article>
  )
}

const ProductChip = ({ item, onRemove, qtyEditable = false, onQtyChange = null, triggerQty = 0, onTriggerQtyChange = null }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-slate-800">{getItemTitle(item)}</div>
        <div className="text-[11px] text-slate-400 font-mono">{getItemMetaLine(item)}</div>
      </div>
      {qtyEditable && (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-slate-400">x</span>
          <input
            type="number"
            min="1"
            step="1"
            value={item.qty || 1}
            onChange={(e) => onQtyChange?.(getLookupCode(item), e.target.value)}
            className="h-8 w-14 rounded-md border border-slate-200 bg-white px-2 text-center text-[13px] font-semibold text-slate-700 focus:border-blue-400 outline-none"
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => onRemove?.(getLookupCode(item))}
        className="shrink-0 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
      >
        <Trash2 size={13} />
      </button>
    </div>
    {onTriggerQtyChange && triggerQty > 0 && (
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200">
        <span className="text-[11px] text-slate-500">ຊື້ຄົບ</span>
        <input
          type="number"
          min="1"
          step="1"
          value={triggerQty}
          onChange={(e) => onTriggerQtyChange(Math.max(1, Number(e.target.value) || 1))}
          className="h-7 w-14 rounded-md border border-slate-200 bg-white px-2 text-center text-[12px] font-semibold text-slate-700 focus:border-blue-400 outline-none"
        />
        <span className="text-[11px] text-slate-500">ຊິ້ນ ຈຶ່ງແຖມ</span>
      </div>
    )}
  </div>
)

export default function Promotions() {
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(createEmptyForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [buyQuery, setBuyQuery] = useState('')
  const [buyResults, setBuyResults] = useState([])
  const [buyLoading, setBuyLoading] = useState(false)
  const [giftQuery, setGiftQuery] = useState('')
  const [giftResults, setGiftResults] = useState([])
  const [giftLoading, setGiftLoading] = useState(false)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [searchModalType, setSearchModalType] = useState('buy')
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)

  const stats = useMemo(() => {
    const active = promotions.filter((promotion) => promotion.is_active).length
    const inactive = promotions.length - active
    const today = new Date().toISOString().slice(0, 10)
    const expiringSoon = promotions.filter((promotion) => {
      if (!promotion.end_date) return false
      const endDate = toDateInput(promotion.end_date)
      const diffDays = Math.ceil((new Date(endDate) - new Date(today)) / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays <= 7
    }).length
    return { total: promotions.length, active, inactive, expiringSoon }
  }, [promotions])

  const currentRule = getPromotionRuleConfig(form)
  const currentTypeMeta = getPromoTypeMeta(form.promo_type)
  // BUY_QTY_GET_GIFT → trigger_qty ຢູ່ໃນ buy chip ແລ້ວ, ສະແດງ input ທີ່ step 1 ແຕ່ COMBO ເທົ່ານັ້ນ
  const showTriggerQtyInput = form.promo_type === PROMO_TYPE_COMBO_QTY_GET_GIFT
  const showSelectionLimitInput = form.promo_type === PROMO_TYPE_BUY_ONE_CHOOSE_MANY

  // "ຊື້ 1 ແຖມ 1" — ອະນຸຍາດແຕ່ 1 buy + 1 gift
  // "ຊື້ 1 ແຖມ 1" ແລະ "ຊື້ຫຼາຍກວ່າ 1 ແຖມ 1" → ສິນຄ້າ 1 ລາຍການ + ແຖມ 1 ລາຍການ
  const isSingleBuyGift = [PROMO_TYPE_BUY_ONE_GET_GIFT, PROMO_TYPE_BUY_QTY_GET_GIFT].includes(form.promo_type)
  const canAddBuy = !isSingleBuyGift || form.buy_items.length < 1
  const canAddGift = !isSingleBuyGift || form.gift_items.length < 1

  const loadPromotions = async (value = '') => {
    setLoading(true)
    setError('')
    try {
      const rows = await listPromotionsAction(value)
      setPromotions(Array.isArray(rows) ? rows : [])
    } catch (err) {
      console.error(err)
      setError('ໂຫລດຂໍ້ມູນບໍ່ສຳເລັດ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPromotions()
  }, [])

  useEffect(() => {
    const trimmed = buyQuery.trim()
    if (!trimmed) {
      setBuyResults([])
      return
    }
    setBuyLoading(true)
    const timer = setTimeout(async () => {
      try {
        const results = await searchProductsAction(trimmed)
        setBuyResults(Array.isArray(results) ? results : [])
      } catch (err) {
        console.error(err)
        setBuyResults([])
      } finally {
        setBuyLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [buyQuery])

  useEffect(() => {
    const trimmed = giftQuery.trim()
    if (!trimmed) {
      setGiftResults([])
      return
    }
    setGiftLoading(true)
    const timer = setTimeout(async () => {
      try {
        const results = await searchProductsAction(trimmed)
        setGiftResults(Array.isArray(results) ? results : [])
      } catch (err) {
        console.error(err)
        setGiftResults([])
      } finally {
        setGiftLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [giftQuery])

  const resetForm = () => {
    setForm(createEmptyForm())
    setError('')
    setSuccess('')
    setBuyQuery('')
    setGiftQuery('')
    setBuyResults([])
    setGiftResults([])
  }

  const openFormModal = (promotion = null) => {
    if (!promotion) {
      resetForm()
      setIsFormModalOpen(true)
      return
    }

    const normalized = normalizePromotionRecord(promotion)
    setForm({
      id: normalized.id,
      promo_type: normalized.promo_type || PROMO_TYPE_BUY_ONE_GET_GIFT,
      rule_config: getPromotionRuleConfig(normalized),
      buy_items: normalized.buy_items || [],
      gift_items: normalized.gift_items || [],
      start_date: toDateInput(normalized.start_date),
      end_date: toDateInput(normalized.end_date),
      is_active: !!normalized.is_active,
    })
    setError('')
    setSuccess('')
    setBuyQuery('')
    setGiftQuery('')
    setBuyResults([])
    setGiftResults([])
    setIsFormModalOpen(true)
  }

  const closeFormModal = () => {
    setIsFormModalOpen(false)
    resetForm()
  }

  const addBuyItem = (product) => {
    const normalized = normalizePromotionBuyItem({
      item_code: product.ic_code || product.item_code || product.code || '',
      barcode: product.barcode || product.ic_code || product.item_code || '',
      name: product.item_name || product.name_1 || product.name || '',
      unit_code: product.unit_code || 'EA',
    })
    if (!normalized) return
    setForm((prev) => {
      const exists = prev.buy_items.some((item) => getLookupCode(item) === getLookupCode(normalized))
      if (exists) return prev
      return { ...prev, buy_items: [...prev.buy_items, normalized] }
    })
    setBuyQuery('')
    setBuyResults([])
    setIsSearchModalOpen(false)
  }

  const addGiftItem = (product) => {
    const normalized = normalizePromotionGiftItem({
      item_code: product.ic_code || product.item_code || product.code || '',
      barcode: product.barcode || product.ic_code || product.item_code || '',
      name: product.item_name || product.name_1 || product.name || '',
      unit_code: product.unit_code || 'EA',
      qty: 1,
    })
    if (!normalized) return
    setForm((prev) => {
      const exists = prev.gift_items.some((item) => getLookupCode(item) === getLookupCode(normalized))
      if (exists) return prev
      return { ...prev, gift_items: [...prev.gift_items, normalized] }
    })
    setGiftQuery('')
    setGiftResults([])
    setIsSearchModalOpen(false)
  }

  const removeBuyItem = (lookupCode) => {
    setForm((prev) => ({
      ...prev,
      buy_items: prev.buy_items.filter((item) => getLookupCode(item) !== lookupCode),
    }))
  }

  const removeGiftItem = (lookupCode) => {
    setForm((prev) => ({
      ...prev,
      gift_items: prev.gift_items.filter((item) => getLookupCode(item) !== lookupCode),
    }))
  }

  const updateGiftQty = (lookupCode, value) => {
    const nextQty = Math.max(1, Number(value) || 1)
    setForm((prev) => ({
      ...prev,
      gift_items: prev.gift_items.map((item) => (
        getLookupCode(item) === lookupCode
          ? { ...item, qty: nextQty }
          : item
      )),
    }))
  }

  const handlePromoTypeChange = (nextPromoType) => {
    setForm((prev) => ({
      ...prev,
      promo_type: nextPromoType,
      rule_config: getPromotionRuleConfig({ promo_type: nextPromoType }),
    }))
  }

  const updateRuleConfig = (field, value) => {
    setForm((prev) => {
      const currentRule = getPromotionRuleConfig(prev)
      let nextValue = value

      if (field === 'trigger_qty' || field === 'selection_limit') {
        nextValue = Math.max(1, Number(value) || 1)
      }

      return {
        ...prev,
        rule_config: {
          ...currentRule,
          [field]: nextValue,
        },
      }
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.buy_items.length) {
      setError('ກະລຸນາເລືອກສິນຄ້າຫຼັກຢ່າງນ້ອຍ 1 ລາຍການ')
      return
    }
    if (!form.gift_items.length) {
      setError('ກະລຸນາເລືອກຂອງແຖມຢ່າງນ້ອຍ 1 ລາຍການ')
      return
    }

    const payload = {
      promo_type: form.promo_type,
      rule_config: {
        ...getPromotionRuleConfig(form),
        selection_limit: Math.max(
          1,
          Math.min(
            Number(form.rule_config?.selection_limit || 1),
            Math.max(form.gift_items.length, 1),
          ),
        ),
      },
      buy_items: form.buy_items,
      gift_items: form.gift_items,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      is_active: !!form.is_active,
    }

    try {
      if (form.id) {
        await updatePromotionAction(form.id, payload)
        setSuccess('ອັບເດດສຳເລັດ')
      } else {
        await createPromotionAction(payload)
        setSuccess('ບັນທຶກສຳເລັດ')
      }
      setTimeout(() => {
        closeFormModal()
        loadPromotions(query)
      }, 800)
    } catch (err) {
      console.error(err)
      setError('ບັນທຶກບໍ່ສຳເລັດ')
    }
  }


  const handleDelete = async (promotionId) => {
    if (!window.confirm('ຢືນຢັນລຶບໂປຣໂມຊັນນີ້?')) return
    setError('')
    try {
      await deletePromotionAction(promotionId)
      loadPromotions(query)
    } catch (err) {
      console.error(err)
      setError('ລຶບບໍ່ສຳເລັດ')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Campaigns</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">ຈັດການໂປຣໂມຊັນ</h1>
          <p className="mt-1 text-sm text-slate-500">auto-apply, threshold, combo, selectable gifts</p>
        </div>
        <button
          onClick={() => openFormModal()}
          className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold flex items-center gap-2 hover:bg-slate-800 transition-colors"
        >
          <Plus size={15} /> ເພີ່ມ
        </button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-2">
          <span className="text-lg font-bold text-slate-900">{stats.total}</span>
          <span className="text-[11px] text-slate-400">ທັງໝົດ</span>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-lg font-bold text-emerald-600">{stats.active}</span>
          <span className="text-[11px] text-slate-400">active</span>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          <span className="text-lg font-bold text-slate-400">{stats.inactive}</span>
          <span className="text-[11px] text-slate-400">inactive</span>
        </div>
        {stats.expiringSoon > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
            <Calendar size={13} className="text-amber-600" />
            <span className="text-lg font-bold text-amber-600">{stats.expiringSoon}</span>
            <span className="text-[11px] text-amber-600">ໃກ້ໝົດ</span>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Search */}
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadPromotions(query)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all"
              placeholder="ຄົ້ນຫາ code, barcode..."
            />
          </div>
          <button
            onClick={() => loadPromotions(query)}
            disabled={loading}
            className="h-9 px-4 rounded-lg bg-slate-100 text-sm font-medium text-slate-600 flex items-center gap-1.5 hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            ໂຫລດ
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <RefreshCw size={24} className="animate-spin text-blue-500" />
              <span className="text-sm font-medium text-slate-500">ກຳລັງໂຫລດ...</span>
            </div>
          ) : promotions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <Package size={28} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">ບໍ່ມີຂໍ້ມູນໂປຣໂມຊັນ</p>
                <p className="mt-1 text-xs text-slate-400">ກົດ “ເພີ່ມໂປຣໂມຊັນ” ເພື່ອເລີ່ມຕົ້ນ</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {promotions.map((promotion) => (
                <PromotionListCard
                  key={promotion.id}
                  promotion={promotion}
                  onEdit={openFormModal}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {promotions.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
            <p className="text-xs font-medium text-slate-500">ສະແດງ {promotions.length} ລາຍການ</p>
          </div>
        )}
      </div>

      {/* ── Slide Panel ── */}
      {isFormModalOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-slate-900/30" onClick={closeFormModal} />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 shrink-0">
              <h3 className="text-sm font-bold text-slate-900">
                {form.id ? 'ແກ້ໄຂໂປຣໂມຊັນ' : 'ເພີ່ມໂປຣໂມຊັນໃໝ່'}
              </h3>
              <button onClick={closeFormModal} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Panel body — scrollable */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* ── Step 1: ປະເພດໂປຣໂມຊັນ ── */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">① ປະເພດໂປຣໂມຊັນ</label>
                <select
                  value={form.promo_type}
                  onChange={(e) => handlePromoTypeChange(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-700 focus:border-blue-400 outline-none"
                >
                  {PROMO_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[12px] text-slate-500">
                  {currentTypeMeta.description}
                </div>

                {showTriggerQtyInput && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">ຈຳນວນຊື້ຕ້ອງຄົບ</label>
                    <input type="number" min="1" value={currentRule.trigger_qty} onChange={(e) => updateRuleConfig('trigger_qty', e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-700 focus:border-blue-400 outline-none" />
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {form.promo_type === PROMO_TYPE_COMBO_QTY_GET_GIFT ? 'ນັບລວມທຸກ buy items' : 'ນັບແຕ່ລະລາຍການແຍກ'}
                    </p>
                  </div>
                )}

                {showSelectionLimitInput && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">ເລືອກແຖມໄດ້</label>
                    <input type="number" min="1" max={Math.max(form.gift_items.length, 1)} value={Math.min(currentRule.selection_limit, Math.max(form.gift_items.length, 1))} onChange={(e) => updateRuleConfig('selection_limit', e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-700 focus:border-blue-400 outline-none" />
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100" />

              {/* ── Step 2: ສິນຄ້າທີ່ຊື້ ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">② {currentTypeMeta.buyLabel || 'ສິນຄ້າທີ່ຊື້'}</label>
                  {canAddBuy ? (
                    <button type="button" onClick={() => { setSearchModalType('buy'); setIsSearchModalOpen(true) }} className="text-[12px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                      <Plus size={13} /> ເພີ່ມ
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400">ຄົບແລ້ວ</span>
                  )}
                </div>
                {currentTypeMeta.buyHint && (
                  <p className="text-[11px] text-slate-400">{currentTypeMeta.buyHint}</p>
                )}
                {form.buy_items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-sm text-slate-400">ຍັງບໍ່ມີ</div>
                ) : (
                  <div className="space-y-1.5">{form.buy_items.map((item) => (
                    <ProductChip
                      key={getLookupCode(item)}
                      item={item}
                      onRemove={removeBuyItem}
                      triggerQty={form.promo_type === PROMO_TYPE_BUY_QTY_GET_GIFT ? currentRule.trigger_qty : 0}
                      onTriggerQtyChange={form.promo_type === PROMO_TYPE_BUY_QTY_GET_GIFT ? (v) => updateRuleConfig('trigger_qty', v) : null}
                    />
                  ))}</div>
                )}
              </div>

              {/* ── Step 3: ຂອງແຖມ ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">③ {currentTypeMeta.giftLabel || 'ຂອງແຖມ'}</label>
                  {canAddGift ? (
                    <button type="button" onClick={() => { setSearchModalType('gift'); setIsSearchModalOpen(true) }} className="text-[12px] font-medium text-pink-600 hover:text-pink-700 flex items-center gap-1">
                      <Plus size={13} /> ເພີ່ມ
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400">ຄົບແລ້ວ</span>
                  )}
                </div>
                {currentTypeMeta.giftHint && (
                  <p className="text-[11px] text-slate-400">{currentTypeMeta.giftHint}</p>
                )}
                {form.gift_items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-sm text-slate-400">ຍັງບໍ່ມີ</div>
                ) : (
                  <div className="space-y-1.5">{form.gift_items.map((item) => <ProductChip key={getLookupCode(item)} item={item} onRemove={removeGiftItem} qtyEditable onQtyChange={updateGiftQty} />)}</div>
                )}
              </div>

              <div className="border-t border-slate-100" />

              {/* ── Step 4: ໄລຍະເວລາ & ສະຖານະ ── */}
              <div className="space-y-3">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">④ ໄລຍະເວລາ & ສະຖານະ</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400">ເລີ່ມ</label>
                    <input type="date" value={form.start_date} onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-700 focus:border-blue-400 outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">ສິ້ນສຸດ</label>
                    <input type="date" value={form.end_date} onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-700 focus:border-blue-400 outline-none" />
                  </div>
                </div>
                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 h-9 text-[13px] text-slate-700 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                  ເປີດໃຊ້ງານ
                </label>
              </div>

              {/* Rule summary */}
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[12px] text-slate-500">
                <span className="font-semibold text-slate-700">{currentTypeMeta.label}</span> — {formatRuleSummary(form)}
              </div>

              {/* Messages */}
              {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</div>}
              {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-600">{success}</div>}
            </form>

            {/* Panel footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 shrink-0">
              <button type="button" onClick={closeFormModal} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                ຍົກເລີກ
              </button>
              <button onClick={handleSubmit} className="h-9 px-5 rounded-lg bg-slate-900 text-sm font-semibold text-white flex items-center gap-2 hover:bg-slate-800 transition-colors">
                <Save size={14} />
                {form.id ? 'ອັບເດດ' : 'ບັນທຶກ'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Search Modal ── */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setIsSearchModalOpen(false)} />
          <div className="relative w-full max-w-2xl max-h-[80vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  {searchModalType === 'buy' ? 'ເລືອກສິນຄ້າທີ່ຊື້' : 'ເລືອກຂອງແຖມ'}
                </h3>
                <button type="button" onClick={() => setIsSearchModalOpen(false)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400">
                  <X size={15} />
                </button>
              </div>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchModalType === 'buy' ? buyQuery : giftQuery}
                  onChange={(e) => searchModalType === 'buy' ? setBuyQuery(e.target.value) : setGiftQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-400/20 outline-none transition-all"
                  placeholder="ພິມ barcode ຫຼື ຊື່ສິນຄ້າ..."
                  autoFocus
                />
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {(searchModalType === 'buy' ? buyLoading : giftLoading) && (
                <div className="py-10 text-center text-sm text-slate-400">ກຳລັງຄົ້ນຫາ...</div>
              )}
              {(searchModalType === 'buy' ? buyResults : giftResults).length === 0 &&
                !(searchModalType === 'buy' ? buyLoading : giftLoading) && (
                  <div className="py-10 text-center text-sm text-slate-400">ພິມເພື່ອຄົ້ນຫາສິນຄ້າ</div>
                )}
              <div className="p-1.5">
                {(searchModalType === 'buy' ? buyResults : giftResults).map((item) => (
                  <button
                    type="button"
                    key={`${item.ic_code || item.item_code || item.barcode}__${searchModalType}`}
                    onClick={() => searchModalType === 'buy' ? addBuyItem(item) : addGiftItem(item)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-blue-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-800">{getItemTitle(item)}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{getItemMetaLine(item)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
