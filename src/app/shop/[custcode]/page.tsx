"use client";
// @ts-nocheck
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { ShoppingBag, ShoppingCart, Plus, Minus, X, User, Package, Search, Star, TrendingUp, Bell, ClipboardList, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { getShopProductsAction, getShopPriceListAction } from '@/app/_actions/products'
import { searchCustomersAction } from '@/app/_actions/people'
import { listProductImagesAction } from '@/app/_actions/product-images'

const ShopPage = () => {
  const params = useParams()
  const custcode = params?.custcode
  const effectiveCustcode = custcode || localStorage.getItem('pos_shop_custcode') || 'guest'
  const router = useRouter()
  const cartStorageKey = `pos_shop_cart_${effectiveCustcode}`
  const cartLoadedRef = useRef(false)
  const skipNextSaveRef = useRef(false)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [customer, setCustomer] = useState(null)
  const [cart, setCart] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [priceOptions, setPriceOptions] = useState([])
  const [productImageMap, setProductImageMap] = useState({})
  const [priceLoading, setPriceLoading] = useState(false)
  const [priceError, setPriceError] = useState('')
  const [selectedPriceIndex, setSelectedPriceIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [modalQuantity, setModalQuantity] = useState(1)

  const openCartView = () => {
    router.push(`/shop/${effectiveCustcode}/cart`)
  }
  const [imageModalProduct, setImageModalProduct] = useState(null)
  const [productImages, setProductImages] = useState([])
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState('')
  const [activeImageIndex, setActiveImageIndex] = useState(0)

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
      }
    }

    fetchCustomer()
    return () => { isMounted = false }
  }, [custcode])

  useEffect(() => {
    let isMounted = true
    const fetchProducts = async () => {
      setLoading(true)
      setError('')
      try {
        const data = (await getShopProductsAction()) || []
        if (isMounted) {
          setProducts(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'ໂຫຼດສິນຄ້າບໍ່ສຳເລັດ')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
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
        const map = {}
        if (Array.isArray(list)) {
          list.forEach((img) => {
            if (!map[img.ic_code]) {
              map[img.ic_code] = img
            }
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
    if (!imageModalProduct?.ic_code) {
      setProductImages([])
      setActiveImageIndex(0)
      return
    }
    let isMounted = true
    const fetchImagesForProduct = async () => {
      setImageLoading(true)
      setImageError('')
      try {
        const list: any[] = (await listProductImagesAction(imageModalProduct.ic_code)) || []
        if (isMounted) {
          setProductImages(Array.isArray(list) ? list : [])
          setActiveImageIndex(0)
        }
      } catch (err) {
        if (isMounted) {
          setImageError(err?.message || 'ໂຫຼດຮູບບໍ່ສຳເລັດ')
          setProductImages([])
        }
      } finally {
        if (isMounted) {
          setImageLoading(false)
        }
      }
    }
    fetchImagesForProduct()
    return () => { isMounted = false }
  }, [imageModalProduct])

  useEffect(() => {
    let isMounted = true
    const fetchPriceDetail = async () => {
      if (!selectedProduct?.ic_code) {
        setPriceOptions([])
        setSelectedPriceIndex(0)
        setModalQuantity(1)
        return
      }
      setPriceLoading(true)
      setPriceError('')
      try {
        const res = await getShopPriceListAction(selectedProduct.ic_code)
        const list = Array.isArray(res) ? res : []
        if (isMounted) {
          setPriceOptions(list)
          setSelectedPriceIndex(0)
          const firstQty = Math.max(Number(list[0]?.from_qty || 1), 1)
          setModalQuantity(firstQty)
        }
      } catch (err) {
        if (isMounted) {
          setPriceError(err?.message || 'ໂຫຼດລາຍລະອຽດລາຄາບໍ່ສຳເລັດ')
        }
      } finally {
        if (isMounted) {
          setPriceLoading(false)
        }
      }
    }

    fetchPriceDetail()
    return () => { isMounted = false }
  }, [selectedProduct])

  const getDiscountPercent = () => (customer?.discount > 0 ? customer.discount : 0)
  const buildCartPriceMeta = (product, unitPrice) => {
    const discountPercent = getDiscountPercent()
    const priceBeforeDiscount = Number(unitPrice || 0)
    const priceAfterDiscount = discountPercent > 0
      ? priceBeforeDiscount * (1 - discountPercent / 100)
      : priceBeforeDiscount
    return {
      price_before_discount: priceBeforeDiscount,
      price_after_discount: priceAfterDiscount,
      discount_percent: discountPercent,
      unit_cost: Number(product?.unit_cost ?? product?.average_cost ?? 0),
      average_cost: Number(product?.average_cost ?? 0),
    }
  }

  const addToCart = (product) => {
    const existing = cart.find(item => item.ic_code === product.ic_code)
    const maxQty = Number(product.balance_qty || 0)
    const unitPrice = getUnitPrice(product)
    const priceMeta = buildCartPriceMeta(product, unitPrice)
    if (existing) {
      setCart(cart.map(item => {
        if (item.ic_code !== product.ic_code) return item
        const nextQty = Math.min(item.quantity + 1, maxQty || item.quantity + 1)
        return { ...item, quantity: nextQty }
      }))
    } else {
      setCart([
        ...cart,
        {
          ...product,
          unit_code: product.unit_code || 'EA',
          unit_price: unitPrice,
          ...priceMeta,
          quantity: Math.min(1, maxQty || 1),
        },
      ])
    }
    openCartView()
  }

  const addToCartWithPrice = (product, priceOption, quantity) => {
    const unitPrice = Number(priceOption?.sale_price1 || 0)
    const fromQty = Math.max(Number(priceOption?.from_qty || 1), 1)
    const maxQty = Number(product.balance_qty || 0)
    const qtyToAdd = Math.max(Number(quantity || fromQty), 1)
    const priceMeta = buildCartPriceMeta(product, unitPrice)
    const payload = {
      ...product,
      unit_code: priceOption?.unit_code || product.unit_code || 'EA',
      unit_price: unitPrice,
      price_from_qty: fromQty,
      ...priceMeta,
    }
    const existing = cart.find(
      item =>
        item.ic_code === product.ic_code &&
        item.unit_price === unitPrice &&
        item.price_from_qty === fromQty,
    )
    if (existing) {
      setCart(cart.map(item => {
        if (
          item.ic_code !== product.ic_code ||
          item.unit_price !== unitPrice ||
          item.price_from_qty !== fromQty
        ) {
          return item
        }
        const nextQty = Math.min(item.quantity + qtyToAdd, maxQty || item.quantity + qtyToAdd)
        return { ...item, quantity: nextQty }
      }))
    } else {
      setCart([
        ...cart,
        { ...payload, quantity: Math.min(qtyToAdd, maxQty || qtyToAdd) },
      ])
    }
    openCartView()
  }

  const updateQuantity = (ic_code, delta) => {
    setCart(cart.map(item => {
      if (item.ic_code !== ic_code) return item
      const maxQty = Number(item.balance_qty || 0)
      const newQty = Math.min(item.quantity + delta, maxQty || item.quantity + delta)
      return newQty > 0 ? { ...item, quantity: newQty } : item
    }).filter(item => item.quantity > 0))
  }

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const getUnitPrice = (item) => {
    const price = item?.unit_price ?? item?.price ?? item?.unit_cost ?? item?.unit_code
    return Number(price || 0)
  }
  const getSelectedPrice = () => {
    const option = priceOptions[selectedPriceIndex]
    if (option?.sale_price1 !== undefined && option?.sale_price1 !== null) {
      return Number(option.sale_price1 || 0)
    }
    return getUnitPrice(selectedProduct)
  }
  const getSelectedFromQty = () => {
    const option = priceOptions[selectedPriceIndex]
    return Math.max(Number(option?.from_qty || 1), 1)
  }
  const getSelectedUnitLabel = () => {
    const option = priceOptions[selectedPriceIndex]
    return option?.unit_code || selectedProduct?.unit_code || 'ຊິ້ນ'
  }
  const getItemUnitLabel = (item) => item?.unit_code || 'ຊິ້ນ'
  const minModalQty = Math.max(getSelectedFromQty(), 1)

  const categories = ['all', ...new Set(products.map(p => p.cat_name).filter(Boolean))]

  const filteredProducts = products.filter(p => {
    const matchCategory = selectedCategory === 'all' || p.cat_name === selectedCategory
    const matchSearch = searchQuery === '' ||
      p.ic_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.ic_code?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-[#2E6AB3]/5 to-slate-50 font-['Noto_Sans_Lao'] pb-20">

      {/* Premium Gradient Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-[#2E6AB3] via-[#2E6AB3] to-[#2E6AB3] shadow-2xl backdrop-blur-xl">
        <div className="max-w-screen-sm mx-auto px-4 py-4">

          {/* Top Bar with Glass Effect */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-white/30 blur-xl rounded-full"></div>
                <ShoppingBag size={28} className="text-white relative z-10 drop-shadow-lg" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-normal text-white tracking-tight drop-shadow-lg">ODIEN</h1>
                <p className="text-[10px] text-blue-100 font-normal uppercase tracking-wider">Shop Online</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-300 active:scale-95 relative group">
                <Bell size={18} className="text-white" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[10px] font-normal text-white flex items-center justify-center group-hover:scale-110 transition-transform">3</span>
              </button>
              <Link
                href="/shop/orders"
                className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-300 active:scale-95"
                title="ຕິດຕາມ Order"
              >
                <ClipboardList size={18} className="text-white" />
              </Link>
              <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-300 active:scale-95">
                <User size={18} className="text-white" />
              </button>
            </div>
          </div>

          {customer && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs">
                <Star size={12} className="text-yellow-300 fill-yellow-300" />
                {customer.points.toLocaleString()} Points
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs">
                <span>ສ່ວນຫຼຸດ</span>
                <span className="text-yellow-200">{customer.discount}%</span>
              </div>
            </div>
          )}

          {/* Premium Search Bar */}
          <div className="relative group">
            <div className="absolute inset-0 bg-white/20 blur-md rounded-2xl group-hover:bg-white/30 transition-all duration-300"></div>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 z-10 group-focus-within:text-white transition-colors duration-300" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ຄົ້ນຫາສິນຄ້າ..."
              className="relative z-10 w-full h-12 pl-12 pr-12 bg-white/90 backdrop-blur-md rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white transition-all duration-300 shadow-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-100 transition-all duration-300 active:scale-95"
              >
                <X size={16} className="text-blue-600" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Premium Promo Banner with Animation */}
      <div className="max-w-screen-sm mx-auto px-4 pt-4">
        <div className="relative bg-gradient-to-r from-[#2E6AB3] via-[#2E6AB3] to-[#2E6AB3] rounded-3xl p-6 text-white overflow-hidden shadow-2xl hover:shadow-[#2E6AB3]/50 transition-all duration-500 group">
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -skew-x-12 group-hover:translate-x-full transition-transform duration-1000"></div>
          <div className="absolute top-0 right-0 opacity-10">
            <TrendingUp size={150} strokeWidth={1} className="animate-pulse" />
          </div>
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-yellow-300 animate-pulse" />
                <p className="text-xs font-normal uppercase tracking-wider">Flash Sale Today</p>
              </div>
              <h2 className="text-3xl font-normal mb-2 tracking-tight">ສ່ວນຫຼຸດສູງສຸດ</h2>
            {customer && customer.discount > 0 && (
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-normal">{customer.discount}%</p>
                <p className="text-xl font-normal text-blue-100">OFF</p>
              </div>
            )}
            {!customer && (
              <p className="text-lg font-normal text-blue-100">ເຂົ້າສູ່ລະບົບເພື່ອຮັບສ່ວນຫຼຸດ!</p>
            )}
          </div>
        </div>
      </div>

      {/* Smooth Category Pills */}
      {!loading && products.length > 0 && (
        <div className="max-w-screen-sm mx-auto px-4 pt-5">
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
            {categories.map((cat, idx) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{ animationDelay: `${idx * 50}ms` }}
                className={`
                  px-5 py-2.5 rounded-full font-normal text-xs whitespace-nowrap transition-all duration-300 shadow-sm animate-in fade-in slide-in-from-top-2
                  ${selectedCategory === cat
                    ? 'bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3] text-white shadow-lg shadow-[#2E6AB3]/20 scale-105'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-[#2E6AB3]/30 hover:shadow-md active:scale-95'
                  }
                `}
              >
                {cat === 'all' ? 'ທັງໝົດ' : cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products Grid with Stagger Animation */}
      <div className="max-w-screen-sm mx-auto px-4 pt-4">
        {loading && (
          <div className="text-center py-16">
            <div className="relative inline-block">
              <div className="w-12 h-12 border-4 border-[#2E6AB3]/20 border-t-[#2E6AB3] rounded-full animate-spin"></div>
              <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-[#2E6AB3] rounded-full animate-spin animation-delay-150"></div>
            </div>
            <p className="mt-4 text-sm text-slate-600 font-medium animate-pulse">ກຳລັງໂຫຼດສິນຄ້າ...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-gradient-to-br from-rose-50 to-red-50 border-2 border-rose-200 rounded-3xl p-6 text-center animate-in fade-in slide-in-from-top-4">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Package size={32} className="text-rose-500" />
            </div>
            <p className="text-sm text-rose-700 font-normal">{error}</p>
          </div>
        )}

        {!loading && !error && filteredProducts.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200 animate-in fade-in zoom-in">
            <Package size={64} className="mx-auto text-slate-300 mb-4" />
            <p className="text-lg font-normal text-slate-800">ບໍ່ພົບສິນຄ້າ</p>
            <p className="text-xs text-slate-400 mt-1">ລອງຄົ້ນຫາດ້ວຍຄຳຄົ້ນອື່ນ</p>
          </div>
        )}

        {!loading && !error && filteredProducts.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product, idx) => {
              const inCart = cart.find(item => item.ic_code === product.ic_code)
              const quantity = inCart?.quantity || 0
              const originalPrice = getUnitPrice(product)
              const hasDiscount = customer && customer.discount > 0
              const discountedPrice = hasDiscount ? originalPrice * (1 - customer.discount / 100) : originalPrice

              return (
                <div
                  key={product.ic_code}
                  style={{ animationDelay: `${idx * 30}ms` }}
                  onClick={() => setImageModalProduct(product)}
                  className="group bg-white rounded-2xl border-2 border-slate-100 overflow-hidden hover:border-[#2E6AB3]/30 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 cursor-pointer"
                >
                  {/* Product Image with Hover Effect */}
                  <div className="relative h-44 bg-gradient-to-br from-slate-50 to-[#2E6AB3]/5 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#2E6AB3]/0 to-[#2E6AB3]/0 group-hover:from-[#2E6AB3]/10 group-hover:to-[#2E6AB3]/10 transition-all duration-500"></div>
                    {productImageMap[product.ic_code]?.file_url ? (
                      <img
                        src={`${''}${
                          productImageMap[product.ic_code].file_url || ''
                        }`}
                        alt={product.ic_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={48} className="text-slate-300 group-hover:text-[#2E6AB3] group-hover:scale-110 transition-all duration-300" />
                    )}

                    {hasDiscount && (
                      <div className="absolute top-2 left-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-normal px-3 py-1.5 rounded-full shadow-lg animate-in zoom-in">
                        -{customer.discount}%
                      </div>
                    )}

                  </div>

                  {/* Product Info */}
                  <div className="p-3">
                    <h3 className="text-xs font-normal text-slate-900 mb-1.5 line-clamp-2 leading-tight min-h-[2rem] group-hover:text-[#2E6AB3] transition-colors">
                      {product.ic_name}
                    </h3>

                    {/* Price with Animation */}
                    <div className="mb-2">
                      {hasDiscount ? (
                        <>
                          <div className="text-xs text-slate-400 line-through">
                            ₭{originalPrice.toLocaleString()}
                          </div>
                          <div className="text-[#2E6AB3] text-lg font-normal flex items-baseline gap-1">
                            ₭{discountedPrice.toLocaleString()}
                            <span className="text-[10px] text-slate-400 font-medium">/{getItemUnitLabel(product)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-[#2E6AB3] text-lg font-normal flex items-baseline gap-1">
                          ₭{originalPrice.toLocaleString()}
                          <span className="text-[10px] text-slate-400 font-medium">/{getItemUnitLabel(product)}</span>
                        </div>
                      )}
                    </div>

                    {/* Rating */}
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={10} className={i < 4 ? "text-[#2E6AB3] fill-[#2E6AB3]" : "text-slate-300"} />
                        ))}
                      </div>
                      <span className="text-[10px]">ຂາຍແລ້ວ 99+</span>
                    </div>

                    {/* Add to Cart Button */}
                    {quantity === 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProduct(product)
                        }}
                        className="w-full h-10 bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3] hover:from-[#2E6AB3]/90 hover:to-[#2E6AB3]/90 text-white font-normal text-xs rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-[#2E6AB3]/20 hover:shadow-xl active:scale-95"
                      >
                        <ShoppingCart size={14} strokeWidth={2.5} />
                        ເພີ່ມໃສ່ກະຕ່າ
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 animate-in fade-in zoom-in">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            updateQuantity(product.ic_code, -1)
                          }}
                          className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90"
                        >
                          <Minus size={16} strokeWidth={3} className="text-slate-700" />
                        </button>
                        <div className="flex-1 h-10 bg-gradient-to-r from-[#2E6AB3]/10 to-[#2E6AB3]/10 rounded-xl flex items-center justify-center border-2 border-[#2E6AB3]/20">
                          <span className="text-sm font-normal text-[#2E6AB3]">{quantity}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            updateQuantity(product.ic_code, 1)
                          }}
                          className="w-10 h-10 bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3] hover:from-[#2E6AB3]/90 hover:to-[#2E6AB3]/90 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 shadow-lg shadow-[#2E6AB3]/20"
                        >
                          <Plus size={16} strokeWidth={3} className="text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating Cart Button with Pulse Animation */}
      {cartItemsCount > 0 && (
        <div className="fixed bottom-6 right-6 z-50 animate-in zoom-in duration-500">
          <button
            onClick={openCartView}
            className="relative w-16 h-16 bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3] rounded-full shadow-2xl shadow-[#2E6AB3]/50 flex items-center justify-center hover:scale-110 transition-all duration-300 active:scale-95 group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3] rounded-full opacity-0 group-hover:opacity-100 animate-ping"></div>
            <ShoppingCart size={28} className="text-white relative z-10" strokeWidth={2.5} />
            <span className="absolute -top-2 -right-2 w-9 h-9 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-normal rounded-full flex items-center justify-center ring-4 ring-white shadow-lg animate-bounce">
              {cartItemsCount > 99 ? '99+' : cartItemsCount}
            </span>
          </button>
        </div>
      )}

      {/* Product Images Modal */}
      {imageModalProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end animate-in fade-in duration-300"
          onClick={() => {
            setImageModalProduct(null)
            setProductImages([])
            setActiveImageIndex(0)
          }}
        >
          <div
            className="w-full max-w-screen-sm mx-auto bg-white rounded-t-[2.5rem] max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-500 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center justify-between p-5 bg-gradient-to-r from-[#2E6AB3] via-[#2E6AB3] to-[#2E6AB3]">
              <h2 className="text-lg font-normal text-white">ຮູບພາບສິນຄ້າ</h2>
              <button
                onClick={() => {
                  setImageModalProduct(null)
                  setProductImages([])
                  setActiveImageIndex(0)
                }}
                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all"
              >
                <X size={20} className="text-white" strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-3">
                <p className="text-xs text-slate-400 font-mono">{imageModalProduct.ic_code}</p>
                <p className="text-sm font-normal text-slate-900">{imageModalProduct.ic_name}</p>
              </div>

              {imageLoading && (
                <div className="text-center py-10">
                  <div className="inline-block w-8 h-8 border-4 border-[#2E6AB3]/20 border-t-[#2E6AB3] rounded-full animate-spin"></div>
                  <p className="mt-3 text-sm text-slate-600">ກຳລັງໂຫຼດຮູບ...</p>
                </div>
              )}

              {!imageLoading && imageError && (
                <div className="text-sm text-rose-700 bg-rose-50 border-2 border-rose-200 p-3 rounded-xl">
                  {imageError}
                </div>
              )}

              {!imageLoading && !imageError && productImages.length === 0 && (
                <div className="py-10 text-center">
                  <Package size={40} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">ບໍ່ພົບຮູບພາບ</p>
                </div>
              )}

              {!imageLoading && !imageError && productImages.length > 0 && (
                <>
                  <div className="relative w-full aspect-square bg-slate-100 rounded-2xl overflow-hidden">
                    <img
                      src={`${''}${productImages[activeImageIndex]?.file_url || ''}`}
                      alt={productImages[activeImageIndex]?.file_name || imageModalProduct.ic_name}
                      className="w-full h-full object-cover"
                    />
                    {productImages.length > 1 && (
                      <>
                        <button
                          onClick={() =>
                            setActiveImageIndex((prev) =>
                              prev === 0 ? productImages.length - 1 : prev - 1
                            )
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-lg"
                        >
                          <ChevronLeft size={20} className="text-slate-700" />
                        </button>
                        <button
                          onClick={() =>
                            setActiveImageIndex((prev) =>
                              prev === productImages.length - 1 ? 0 : prev + 1
                            )
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-lg"
                        >
                          <ChevronRight size={20} className="text-slate-700" />
                        </button>
                      </>
                    )}
                  </div>

                  {productImages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {productImages.map((img, index) => (
                        <button
                          key={img.id || `${img.file_name}-${index}`}
                          onClick={() => setActiveImageIndex(index)}
                          className={`w-16 h-16 rounded-xl border-2 overflow-hidden flex-shrink-0 ${
                            activeImageIndex === index ? 'border-[#2E6AB3]' : 'border-slate-200'
                          }`}
                        >
                          <img
                            src={`${''}${img.file_url || ''}`}
                            alt={img.file_name || imageModalProduct.ic_name}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Price Detail Modal - Keeping original for now */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={() => {
          setSelectedProduct(null)
          setSelectedPriceIndex(0)
          setModalQuantity(1)
        }}>
          <div
            className="w-full max-w-screen-sm mx-auto bg-white rounded-t-3xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3]">
              <h2 className="text-lg font-normal text-white">ລາຍລະອຽດສິນຄ້າ</h2>
              <button
                onClick={() => {
                  setSelectedProduct(null)
                  setSelectedPriceIndex(0)
                  setModalQuantity(1)
                }}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
              >
                <X size={18} className="text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              <div className="bg-slate-50 rounded-2xl p-2">
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-200 overflow-hidden">
                    {productImageMap[selectedProduct.ic_code]?.file_url ? (
                      <img
                        src={`${''}${
                          productImageMap[selectedProduct.ic_code].file_url || ''
                        }`}
                        alt={selectedProduct.ic_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={28} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 font-mono mb-1">{selectedProduct.ic_code}</p>
                    <h3 className="text-xs font-normal text-slate-900 mb-1 leading-tight">
                      {selectedProduct.ic_name}
                    </h3>
                    <p className="text-[10px] text-slate-500 mb-1">{selectedProduct.cat_name || '-'}</p>

                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-emerald-600" />
                      <span className="text-[10px] font-normal text-emerald-600">
                        ສະຕ໋ອກ: {Number(selectedProduct.balance_qty || 0).toLocaleString()} {getSelectedUnitLabel()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-normal text-slate-500">ລາຄາທີ່ເລືອກ</p>
                    {customer && customer.discount > 0 ? (
                      <>
                        <p className="text-[10px] font-normal text-slate-400 line-through">
                          ₭{getSelectedPrice().toLocaleString()}/{getSelectedUnitLabel()}
                        </p>
                        <p className="text-lg font-normal text-emerald-600">
                          ₭{(getSelectedPrice() * (1 - customer.discount / 100)).toLocaleString()}/{getSelectedUnitLabel()}
                        </p>
                      </>
                    ) : (
                      <p className="text-lg font-normal text-[#2E6AB3]">
                        ₭{getSelectedPrice().toLocaleString()}/{getSelectedUnitLabel()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-normal">ຕໍ່ {getSelectedFromQty().toLocaleString()} {getSelectedUnitLabel()}</p>
                    {customer && customer.discount > 0 && (
                      <p className="text-[10px] text-emerald-600 font-normal">
                        ສ່ວນຫຼຸດ {customer.discount}%
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-2 space-y-2">
                <h4 className="text-xs font-normal text-slate-600 uppercase">ເລືອກລະດັບລາຄາ</h4>

                {priceLoading && (
                  <div className="text-center py-4">
                    <div className="inline-block w-6 h-6 border-3 border-[#2E6AB3] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-slate-500 mt-2">ກຳລັງໂຫຼດລາຄາ...</p>
                  </div>
                )}

                {!priceLoading && priceError && (
                  <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg">{priceError}</div>
                )}

                {!priceLoading && !priceError && priceOptions.length === 0 && (
                  <div className="text-sm text-slate-500">ບໍ່ມີລາຄາ</div>
                )}

                {!priceLoading && !priceError && priceOptions.length > 0 && (
                  <div className="space-y-2">
                    {priceOptions.map((option, index) => {
                      const unitPrice = Number(option.sale_price1 || 0)
                      const fromQty = Math.max(Number(option.from_qty || 1), 1)
                      return (
                        <button
                          key={`${unitPrice}-${fromQty}-${index}`}
                          onClick={() => {
                            setSelectedPriceIndex(index)
                            setModalQuantity(fromQty)
                          }}
                          className={`w-full p-2 rounded-xl border-2 transition-all flex items-center justify-between ${
                            selectedPriceIndex === index
                              ? 'border-[#2E6AB3] bg-[#2E6AB3]/10'
                              : 'border-slate-200 hover:border-[#2E6AB3]/30'
                          }`}
                        >
                        <div className="text-left flex-1">
                          <p className="text-[10px] font-normal text-slate-500 mb-1">ລາຄາ {index + 1}</p>
                          <div className="flex items-baseline gap-2">
                            <p className="text-base font-normal text-[#2E6AB3]">
                              ₭{unitPrice.toLocaleString()}
                            </p>
                              <span className="text-[10px] text-slate-400 font-normal">
                                / {fromQty.toLocaleString()} {option.unit_code || 'ຊິ້ນ'}
                              </span>
                            </div>
                          </div>
                          {selectedPriceIndex === index && (
                            <div className="w-5 h-5 bg-[#2E6AB3] rounded-full flex items-center justify-center ml-2">
                              <Star size={12} className="text-white fill-white" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-2">
                <h4 className="text-xs font-normal text-slate-600 uppercase mb-2">ຈຳນວນ ({getSelectedUnitLabel()})</h4>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setModalQuantity(Math.max(minModalQty, modalQuantity - 1))}
                    className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors"
                  >
                    <Minus size={16} strokeWidth={3} className="text-slate-700" />
                  </button>
                  <input
                    type="number"
                    min={minModalQty}
                    max={Number(selectedProduct.balance_qty || 999)}
                    value={modalQuantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1
                      const maxQty = Number(selectedProduct.balance_qty || 999)
                      setModalQuantity(Math.min(Math.max(minModalQty, val), maxQty))
                    }}
                    className="flex-1 min-w-[140px] h-10 px-2 text-center text-lg font-normal text-slate-900 bg-[#2E6AB3]/10 rounded-xl border-2 border-[#2E6AB3]/20 focus:border-[#2E6AB3] focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      const maxQty = Number(selectedProduct.balance_qty || 999)
                      setModalQuantity(Math.min(modalQuantity + 1, maxQty))
                    }}
                    className="w-9 h-9 bg-[#2E6AB3] hover:bg-[#2E6AB3]/90 rounded-xl flex items-center justify-center transition-colors"
                  >
                    <Plus size={16} strokeWidth={3} className="text-white" />
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 p-2 bg-white">
              <button
                onClick={() => {
                  const option = priceOptions[selectedPriceIndex]
                  if (option) {
                    addToCartWithPrice(selectedProduct, option, modalQuantity)
                  } else {
                    addToCart(selectedProduct)
                  }
                  setSelectedProduct(null)
                  setSelectedPriceIndex(0)
                  setModalQuantity(1)
                }}
                disabled={priceOptions.length === 0}
                className="w-full h-10 bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3] hover:from-[#2E6AB3]/90 hover:to-[#2E6AB3]/90 text-white font-normal text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart size={16} strokeWidth={3} />
                ເພີ່ມໃສ່ກະຕ່າ ({modalQuantity})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShopPage
