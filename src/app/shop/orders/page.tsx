"use client";
// @ts-nocheck
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Search, ClipboardList, ChevronRight, Package, ArrowLeft, ShoppingBag, Loader2, CheckCircle2, Clock, User, Phone } from 'lucide-react'
import { getPosBillsAction, getPosBillAction } from '@/app/_actions/bills'
import { getShopOrdersAction, getShopOrderAction } from '@/app/_actions/shop-orders'
import { listProductImagesAction } from '@/app/_actions/product-images'

const OrderTracking = () => {
  const { orderNo } = useParams()
  const [query, setQuery] = useState('')
  const customerCode = typeof window !== 'undefined' ? localStorage.getItem('pos_shop_custcode') || '' : ''
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [imageMap, setImageMap] = useState({})

  const handleSearch = async () => {
    setLoading(true)
    setError('')
    setSelectedOrder(null)
    setDetailError('')
    try {
      const [shopRes, posRes] = await Promise.all([
        getShopOrdersAction(query.trim(), customerCode),
        getPosBillsAction(query.trim(), customerCode),
      ])
      const shopData = shopRes?.data || shopRes || []
      const posData = posRes?.data || posRes || []
      const shopList = Array.isArray(shopData)
        ? shopData.map((o) => ({ ...o, source: 'shop', order_no: o.order_no }))
        : []
      const shopOrderSet = new Set(shopList.map((o) => o.order_no).filter(Boolean))
      const posList = Array.isArray(posData)
        ? posData
            .map((b) => ({
              ...b,
              source: 'pos',
              order_no: b.doc_no,
              status: b.status || 'billed',
            }))
            .filter((b) => !shopOrderSet.has(b.order_no))
        : []
      setOrders([...shopList, ...posList])
    } catch (err) {
      setError(err?.message || 'ດຶງຂໍ້ມູນບໍ່ສຳເລັດ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    handleSearch()
  }, [])

  useEffect(() => {
    let isMounted = true
    const fetchImages = async () => {
      try {
        const list: any[] = (await listProductImagesAction()) || []
        const map = {}
        if (Array.isArray(list)) {
          list.forEach((img) => {
            if (!map[img.ic_code]) {
              map[img.ic_code] = img
            }
          })
        }
        if (isMounted) {
          setImageMap(map)
        }
      } catch {
        if (isMounted) {
          setImageMap({})
        }
      }
    }
    fetchImages()
    return () => { isMounted = false }
  }, [])

  const getItemImageUrl = (item) => {
    const code = item.ic_code || item.item_code || item.id || item.barcode || ''
    const img = imageMap[code]
    const fileUrl = img?.file_url || ''
    return fileUrl ? `${''}${fileUrl}` : ''
  }

  const openOrder = async (orderNo, source = 'shop') => {
    setDetailLoading(true)
    setDetailError('')
    try {
      const res = source === 'pos'
        ? await getPosBillAction(orderNo)
        : await getShopOrderAction(orderNo)
      const normalized = source === 'pos'
        ? {
            ...res,
            order_no: res?.doc_no || orderNo,
            status: res?.status || 'billed',
            source: 'pos',
          }
        : { ...res, source: 'shop' }
      setSelectedOrder(normalized)
    } catch (err) {
      setDetailError(err?.message || 'ດຶງລາຍລະອຽດບໍ່ສຳເລັດ')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (!orderNo) return
    setQuery(orderNo)
    openOrder(orderNo)
  }, [orderNo])

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { label: 'ລໍຖ້າ', color: 'bg-[#2E6AB3]/10 text-[#2E6AB3] border-[#2E6AB3]/20' },
      'picked': { label: 'ຮັບແລ້ວ', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      'billed': { label: 'ຊຳລະແລ້ວ', color: 'bg-[#2E6AB3]/10 text-[#2E6AB3] border-[#2E6AB3]/20' },
      'cancelled': { label: 'ຍົກເລີກ', color: 'bg-rose-100 text-rose-700 border-rose-200' },
    }
    const config = statusMap[status] || { label: status, color: 'bg-slate-100 text-slate-700 border-slate-200' }
    return (
      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${config.color}`}>
        {config.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-['Noto_Sans_Lao'] pb-20">

      {/* Premium Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3] shadow-lg">
        <div className="max-w-screen-sm mx-auto px-4 py-4">

          {/* Top Section */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => window.history.back()}
              className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft size={18} className="text-white" strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <ClipboardList size={24} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">ຕິດຕາມ Order</h1>
                <p className="text-xs text-white/70 font-bold">ຄົ້ນຫາດ້ວຍເລກ Order ຫຼື ເບີໂທ</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2E6AB3]/60" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="ປ້ອນເລກ Order ຫຼື ເບີໂທ..."
                className="w-full h-12 pl-12 pr-4 bg-white rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2E6AB3]/30 shadow-sm"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="h-12 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60 shadow-lg"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'ຄົ້ນຫາ'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-screen-sm mx-auto px-4 py-4 space-y-4">

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-2xl p-8 text-center border border-[#2E6AB3]/10">
            <Loader2 size={32} className="mx-auto text-[#2E6AB3] animate-spin mb-3" />
            <p className="text-sm text-slate-600 font-medium">ກຳລັງໂຫຼດ...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0">
              <ClipboardList size={20} className="text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-900">ເກີດຂໍ້ຜິດພາດ</p>
              <p className="text-xs text-rose-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && orders.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100">
            <div className="w-20 h-20 bg-[#2E6AB3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardList size={40} className="text-[#2E6AB3]/30" />
            </div>
            <p className="text-lg font-black text-slate-800">ບໍ່ພົບ Order</p>
            <p className="text-xs text-slate-400 mt-1">ລອງຄົ້ນຫາດ້ວຍເລກ Order ຫຼື ເບີໂທ</p>
          </div>
        )}

        {/* Orders List */}
        {!loading && !error && orders.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                ພົບ {orders.length} Order
              </p>
            </div>

            {orders.map((order) => (
              <button
                key={`${order.source}-${order.order_no}`}
                onClick={() => openOrder(order.order_no, order.source)}
                className="w-full bg-white rounded-2xl border-2 border-slate-100 hover:border-[#2E6AB3]/30 hover:shadow-lg p-4 flex items-center justify-between transition-all active:scale-98 group"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 bg-[#2E6AB3]/10 rounded-xl flex items-center justify-center group-hover:bg-[#2E6AB3]/20 transition-colors">
                    <ShoppingBag size={20} className="text-[#2E6AB3]" strokeWidth={2.5} />
                  </div>

                  <div className="text-left flex-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Order No</p>
                    <p className="text-sm font-black text-slate-900 group-hover:text-[#2E6AB3] transition-colors">
                      {order.order_no}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {order.customer_phone && (
                        <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <Phone size={10} /> {order.customer_phone}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">•</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {order.source === 'pos' ? 'POS' : 'Shop'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total</p>
                    <p className="text-lg font-black text-[#2E6AB3]">
                      ₭{Number(order.total || 0).toLocaleString()}
                    </p>
                    <div className="mt-1">
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-300 group-hover:text-[#2E6AB3] transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Detail Loading */}
        {detailLoading && (
          <div className="bg-white rounded-2xl p-6 text-center border border-[#2E6AB3]/10 animate-in fade-in slide-in-from-top-2">
            <Loader2 size={24} className="mx-auto text-[#2E6AB3] animate-spin mb-2" />
            <p className="text-sm text-slate-600 font-medium">ດຶງລາຍລະອຽດ...</p>
          </div>
        )}

        {/* Detail Error */}
        {!detailLoading && detailError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-700">
            {detailError}
          </div>
        )}

        {/* Order Detail */}
        {!detailLoading && selectedOrder && (
          <div className="bg-white rounded-3xl border-2 border-[#2E6AB3]/10 overflow-hidden shadow-lg animate-in fade-in slide-in-from-top-2">

            {/* Detail Header */}
            <div className="bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3] p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-white/70">Order Details</span>
                {getStatusBadge(selectedOrder.status)}
              </div>
              <p className="text-2xl font-black tracking-tight">{selectedOrder.order_no}</p>
              <div className="flex items-center gap-4 mt-2 text-xs font-bold text-white/70">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {selectedOrder.created_at || '-'}
                </span>
                {selectedOrder.customer_name && (
                  <span className="flex items-center gap-1">
                    <User size={12} /> {selectedOrder.customer_name}
                  </span>
                )}
              </div>
            </div>

            {/* Items List */}
            <div className="p-5 bg-slate-50/50">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">ລາຍການສິນຄ້າ</p>
              <div className="space-y-2">
                {(selectedOrder.items || []).map((item, index) => {
                  const name = item.name || item.ic_name || item.item_name || 'Product'
                  const qty = item.quantity ?? item.qty ?? 0
                  const price = item.price ?? 0
                  const lineTotal = Number(price) * Number(qty)

                  return (
                    <div key={`${item.ic_code || item.id || item.item_code}-${index}`}
                         className="flex items-center justify-between bg-white rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden">
                          {getItemImageUrl(item) ? (
                            <img
                              src={getItemImageUrl(item)}
                              alt={name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package size={18} className="text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">{name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {qty} x ₭{Number(price || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-black text-[#2E6AB3]">
                        ₭{lineTotal.toLocaleString()}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Total Section */}
            <div className="p-5 bg-white border-t-2 border-[#2E6AB3]/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">ລວມທັງໝົດ</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {(selectedOrder.items || []).length} ລາຍການ
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-[#2E6AB3]">
                    ₭{Number(selectedOrder.total || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedOrder.status === 'picked' && (
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <p className="text-sm font-bold text-emerald-700">Order ນີ້ຖືກຮັບແລ້ວ</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderTracking
