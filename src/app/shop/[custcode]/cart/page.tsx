"use client";
// @ts-nocheck
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { ShoppingCart, Plus, Minus, X, Package, Sparkles, ChevronLeft } from 'lucide-react'
import { getShopProductsAction } from '@/app/_actions/products'
import { saveBillAction } from '@/app/_actions/bills'
import { searchCustomersAction } from '@/app/_actions/people'
import { createShopOrderAction } from '@/app/_actions/shop-orders'
import { listProductImagesAction } from '@/app/_actions/product-images'
import OnePayQR from '@/components/OnePayQR'

const ShopCartPage = () => {
  const params = useParams()
  const custcode = params?.custcode
  const effectiveCustcode = custcode || localStorage.getItem('pos_shop_custcode') || 'guest'
  const router = useRouter()
  const cartStorageKey = `pos_shop_cart_${effectiveCustcode}`
  const cartLoadedRef = useRef(false)
  const skipNextSaveRef = useRef(false)
  const [cart, setCart] = useState([])
  const [products, setProducts] = useState([])
  const [customer, setCustomer] = useState(null)
  const [customerLoading, setCustomerLoading] = useState(false)
  const [productImageMap, setProductImageMap] = useState({})
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [orderSuccess, setOrderSuccess] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [qrOrderId, setQrOrderId] = useState('')

  useEffect(() => {
    if (custcode) {
      localStorage.setItem('pos_shop_custcode', custcode)
    }
  }, [custcode])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(cartStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          skipNextSaveRef.current = true
          setCart(parsed)
        }
      }
      cartLoadedRef.current = true
    } catch {}
  }, [cartStorageKey])

  useEffect(() => {
    if (!cartLoadedRef.current) {
      return
    }
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cart))
    } catch {}
  }, [cart, cartStorageKey])

  useEffect(() => {
    let isMounted = true
    const fetchCustomer = async () => {
      if (!custcode) {
        setCustomer(null)
        return
      }
      setCustomerLoading(true)
      try {
        const res = await searchCustomersAction(custcode)
        const list = Array.isArray(res) ? res : []
        const match = list.find((m) => String(m.code || '').trim() === String(custcode).trim()) || list[0]
        if (isMounted) {
          setCustomer(
            match
              ? {
                  code: match.code || custcode,
                  name: match.name_1 || match.name || 'Customer',
                  phone: match.telephone || match.phone || '',
                  points: Number(match.point_balance || 0),
                  discount: Number(String(match.discount_item || '').replace('%', '').trim() || 0),
                }
              : null,
          )
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (isMounted) {
          setCustomerLoading(false)
        }
      }
    }

    fetchCustomer()
    return () => { isMounted = false }
  }, [custcode])

  useEffect(() => {
    let isMounted = true
    const fetchProducts = async () => {
      try {
        const data = (await getShopProductsAction()) || []
        if (isMounted) {
          setProducts(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (isMounted) {
          console.error(err)
        }
      }
    }

    fetchProducts()
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    let isMounted = true
    const fetchProductImages = async () => {
      try {
        const list: any[] = (await listProductImagesAction()) || []
        const map: Record<string, any> = {}
        if (Array.isArray(list)) {
          list.forEach((img) => {
            const key = String(img?.ic_code ?? '')
            if (key && !map[key]) map[key] = img
          })
        }
        if (isMounted) {
          setProductImageMap(map)
        }
      } catch {
        if (isMounted) {
          setProductImageMap({})
        }
      }
    }
    fetchProductImages()
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    if (paymentMethod !== 'transfer' || cart.length === 0) {
      setQrOrderId('')
      return
    }
    if (!qrOrderId) {
      setQrOrderId(`SHOP-${Date.now()}`)
    }
  }, [paymentMethod, cart.length, qrOrderId])

  const updateQuantity = (ic_code, delta) => {
    setCart(cart.map(item => {
      if (item.ic_code !== ic_code) return item
      const maxQty = Number(item.balance_qty || 0)
      const newQty = Math.min(item.quantity + delta, maxQty || item.quantity + delta)
      return newQty > 0 ? { ...item, quantity: newQty } : item
    }).filter(item => item.quantity > 0))
  }

  const removeFromCart = (ic_code) => {
    setCart(cart.filter(item => item.ic_code !== ic_code))
  }

  const getUnitPrice = (item) => {
    const price = item?.unit_price ?? item?.price ?? item?.unit_cost ?? item?.unit_code
    return Number(price || 0)
  }

  const getItemUnitLabel = (item) => item?.unit_code || 'ຊິ້ນ'

  const getItemCost = (item) => {
    const match = products.find((product) => product.ic_code === item.ic_code)
    const unitCost = item?.unit_cost ?? item?.average_cost ?? match?.unit_cost ?? match?.average_cost ?? 0
    const averageCost = item?.average_cost ?? match?.average_cost ?? 0
    return {
      unit_cost: Number(unitCost || 0),
      average_cost: Number(averageCost || 0),
    }
  }

  const placeOrder = async (paymentOverride) => {
    if (cart.length === 0 || orderLoading || orderSuccess) {
      return
    }
    setOrderLoading(true)
    setOrderError('')
    setOrderSuccess('')
    const payload = {
      customer: customer
        ? {
            code: customer.code,
            name: customer.name,
            phone: customer.phone,
          }
        : null,
      customer_code: customer?.code || effectiveCustcode,
      discount_percent: customer?.discount || 0,
      payment_method: paymentOverride || paymentMethod,
      items: cart.map((item) => ({
        ic_code: item.ic_code,
        ic_name: item.ic_name,
        unit_code: item.unit_code,
        price: getUnitPrice(item),
        quantity: item.quantity,
        price_from_qty: item.price_from_qty,
        ...getItemCost(item),
      })),
    }
    try {
      const res = await createShopOrderAction(payload)
      const orderNo = res?.order_no || ''
      setOrderSuccess(orderNo ? `ບັນທຶກສຳເລັດ: ${orderNo}` : 'ບັນທຶກສຳເລັດ')
      setCart([])
      try {
        localStorage.removeItem(cartStorageKey)
      } catch {}
    } catch (err) {
      setOrderError(err?.message || 'ບັນທຶກບໍ່ສຳເລັດ')
    } finally {
      setOrderLoading(false)
    }
  }

  const savePosBilling = async () => {
    if (cart.length === 0 || orderLoading || orderSuccess) {
      return
    }
    setOrderLoading(true)
    setOrderError('')
    setOrderSuccess('')
    const discountPercent = customer?.discount || 0
    const itemsWithDiscount = cart.map((item) => {
      const unitPrice = getUnitPrice(item)
      const lineSubtotal = unitPrice * item.quantity
      const lineDiscountAmount = discountPercent > 0 ? Math.round(lineSubtotal * (discountPercent / 100)) : 0
      const lineTotal = lineSubtotal - lineDiscountAmount
      return {
        ic_code: item.ic_code,
        ic_name: item.ic_name,
        unit_code: item.unit_code || 'EA',
        price: unitPrice,
        quantity: item.quantity,
        discount_amount: lineDiscountAmount,
        discount_percent: discountPercent,
        sum_amount: lineTotal,
        unit_cost: item.unit_cost,
        average_cost: item.average_cost,
      }
    })
    const subtotal = itemsWithDiscount.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const discount = itemsWithDiscount.reduce((sum, item) => sum + (item.discount_amount || 0), 0)
    const total = Math.max(subtotal - discount, 0)

    try {
      const res = await saveBillAction({
        items: itemsWithDiscount,
        orderId: qrOrderId || undefined,
        total,
        subtotal,
        discount,
        paymentType: 'transfer',
        received: total,
        receivedAmount: total,
        cust_code: customer?.code,
        member: customer
          ? {
              id: customer.code,
              name: customer.name,
              phone: customer.phone,
            }
          : null,
        user_login: 'shop',
      })
      if (res?.success === false) {
        throw new Error(res?.error || 'POS billing failed')
      }
      const docNo = res?.doc_no || ''
      setOrderSuccess(docNo ? `ບັນທຶກສຳເລັດ: ${docNo}` : 'ບັນທຶກສຳເລັດ')
      setCart([])
      try {
        localStorage.removeItem(cartStorageKey)
      } catch {}
    } catch (err) {
      setOrderError(err?.message || 'ບັນທຶກບໍ່ສຳເລັດ')
    } finally {
      setOrderLoading(false)
    }
  }

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotalWithPrice = cart.reduce((sum, item) => sum + (getUnitPrice(item) * item.quantity), 0)
  const cartTotalAfterDiscount = customer && customer.discount > 0
    ? cartTotalWithPrice * (1 - customer.discount / 100)
    : cartTotalWithPrice

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-[#2E6AB3]/5 to-slate-50 font-['Noto_Sans_Lao'] pb-24">
      <div className="sticky top-0 z-40 bg-gradient-to-r from-[#2E6AB3] via-[#2E6AB3] to-[#2E6AB3] shadow-2xl backdrop-blur-xl">
        <div className="max-w-screen-sm mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/shop/${effectiveCustcode}`)}
                className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-300 active:scale-95"
                title="ກັບໄປຊື້ສິນຄ້າ"
              >
                <ChevronLeft size={20} className="text-white" />
              </button>
              <div>
                <h1 className="text-xl font-normal text-white tracking-tight drop-shadow-lg">
                  ກະຕ່າຂອງຂ້ອຍ
                </h1>
                <p className="text-[10px] text-blue-100 font-normal uppercase tracking-wider">
                  {cartItemsCount} ລາຍການ
                </p>
              </div>
            </div>
            <Link
              href="/shop/orders"
              className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-300 active:scale-95"
              title="ຕິດຕາມ Order"
            >
              <ShoppingCart size={18} className="text-white" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-screen-sm mx-auto px-4 pt-5">
        {customer && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 text-[#2E6AB3] text-xs shadow-sm">
              <Sparkles size={12} className="text-[#2E6AB3]" />
              <span>{customer.discount}% ສ່ວນຫຼຸດ</span>
            </div>
            {customerLoading && (
              <div className="text-xs text-slate-400">ກຳລັງໂຫຼດຂໍ້ມູນລູກຄ້າ...</div>
            )}
          </div>
        )}

        {cart.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-[#2E6AB3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart size={48} className="text-[#2E6AB3]/30" />
            </div>
            <p className="text-lg font-normal text-slate-800">ກະຕ່າວ່າງ</p>
            <p className="text-xs text-slate-400 mt-1">ເລືອກສິນຄ້າເພື່ອເລີ່ມຊື້ຂາຍ</p>
            <button
              onClick={() => router.push(`/shop/${effectiveCustcode}`)}
              className="mt-6 h-11 px-6 bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3] text-white text-xs rounded-xl shadow-lg shadow-[#2E6AB3]/20 hover:shadow-xl transition-all"
            >
              ກັບໄປເລືອກສິນຄ້າ
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item, idx) => (
              <div
                key={item.ic_code}
                style={{ animationDelay: `${idx * 50}ms` }}
                className="group bg-white rounded-2xl p-4 flex gap-4 border-2 border-slate-100 hover:border-[#2E6AB3]/30 hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-right-4"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-slate-50 to-[#2E6AB3]/10 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-slate-100 group-hover:border-[#2E6AB3]/30 transition-colors overflow-hidden">
                  {productImageMap[item.ic_code]?.file_url ? (
                    <img
                      src={`${''}${
                        productImageMap[item.ic_code].file_url || ''
                      }`}
                      alt={item.ic_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={28} className="text-slate-400 group-hover:text-[#2E6AB3] transition-colors" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-normal text-slate-900 mb-1 line-clamp-1 group-hover:text-[#2E6AB3] transition-colors">
                    {item.ic_name}
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">₭{getUnitPrice(item).toLocaleString()}/{getItemUnitLabel(item)}</p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.ic_code, -1)}
                      className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-all active:scale-90"
                    >
                      <Minus size={14} strokeWidth={3} className="text-slate-700" />
                    </button>
                    <span className="w-12 text-center text-sm font-normal text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.ic_code, 1)}
                      className="w-8 h-8 bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3] rounded-lg flex items-center justify-center hover:shadow-lg transition-all active:scale-90"
                    >
                      <Plus size={14} strokeWidth={3} className="text-white" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between">
                  <button
                    onClick={() => removeFromCart(item.ic_code)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all active:scale-90"
                  >
                    <X size={18} strokeWidth={2.5} />
                  </button>
                  <p className="text-base font-normal text-[#2E6AB3]">
                    ₭{(getUnitPrice(item) * item.quantity).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="max-w-screen-sm mx-auto px-4 pt-6">
          <div className="border-2 border-slate-100 rounded-3xl p-5 bg-white space-y-4 shadow-lg">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">ຍອດລວມ</span>
                <span className="font-normal text-slate-900">
                  ₭{cartTotalWithPrice.toLocaleString()}
                </span>
              </div>

              {customer && customer.discount > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#2E6AB3] font-normal flex items-center gap-1">
                      <Sparkles size={14} />
                      ສ່ວນຫຼຸດ ({customer.discount}%)
                    </span>
                    <span className="font-normal text-[#2E6AB3]">
                      -₭{(cartTotalWithPrice * customer.discount / 100).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t-2 border-slate-100">
                    <span className="text-lg font-normal text-slate-900">ລວมທັງໝົດ</span>
                    <span className="text-3xl font-normal bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3] bg-clip-text text-transparent">
                      ₭{(cartTotalWithPrice * (1 - customer.discount / 100)).toLocaleString()}
                    </span>
                  </div>
                </>
              )}

              {!customer && (
                <div className="flex items-center justify-between pt-3 border-t-2 border-slate-100">
                  <span className="text-lg font-normal text-slate-900">ລວມທັງໝົດ</span>
                  <span className="text-3xl font-normal bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3] bg-clip-text text-transparent">
                    ₭{cartTotalWithPrice.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {orderError && (
              <div className="text-sm text-rose-700 bg-rose-50 border-2 border-rose-200 p-3 rounded-xl font-medium animate-in fade-in slide-in-from-top-2">
                {orderError}
              </div>
            )}
            {orderSuccess && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border-2 border-emerald-200 p-3 rounded-xl font-medium animate-in fade-in slide-in-from-top-2">
                {orderSuccess}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
              onClick={() => setPaymentMethod('cash')}
                className={`h-12 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-[#0B1F3B] bg-[#0B1F3B] text-white shadow-lg shadow-[#0B1F3B]/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-[#0B1F3B] hover:text-[#0B1F3B]'
                }`}
              >
                ຈ່າຍຢູ່ໜ້າຮ້ານ
              </button>
              <button
              onClick={() => {
                setPaymentMethod('transfer')
              }}
                className={`h-12 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all ${
                  paymentMethod === 'transfer'
                    ? 'border-[#2E6AB3] bg-[#2E6AB3] text-white shadow-lg shadow-[#2E6AB3]/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-[#2E6AB3] hover:text-[#2E6AB3]'
                }`}
              >
                ໂອນ
              </button>
            </div>

            {paymentMethod === 'transfer' && (
              <div className="rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-lg">
                <div className="mb-3 text-center">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">QR Pay</p>
                  <p className="text-sm font-bold text-slate-800">ສະແກນເພື່ອຊຳລະ</p>
                </div>
                <div className="mx-auto w-full max-w-[260px]">
                  <OnePayQR
                    orderId={qrOrderId}
                    totalAmount={cartTotalAfterDiscount}
                    onPaymentSuccess={() => {
                      if (!orderLoading) {
                        savePosBilling()
                      }
                    }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if (paymentMethod !== 'transfer') {
                  placeOrder()
                }
              }}
              disabled={orderLoading || paymentMethod === 'transfer'}
              className="w-full h-14 bg-gradient-to-r from-[#2E6AB3] via-[#2E6AB3] to-[#2E6AB3] hover:from-[#2E6AB3]/90 hover:via-[#2E6AB3]/90 hover:to-[#2E6AB3]/90 text-white font-normal text-lg rounded-2xl shadow-2xl shadow-[#2E6AB3]/50 flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 group-hover:translate-x-full transition-transform duration-1000"></div>
              <ShoppingCart size={22} strokeWidth={3} className="relative z-10" />
              <span className="relative z-10">{orderLoading ? 'ກຳລັງບັນທຶກ...' : 'ສັ່ງຊື້ດຽວນີ້'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShopCartPage
