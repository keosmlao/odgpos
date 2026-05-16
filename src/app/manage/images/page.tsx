"use client";
// @ts-nocheck

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { UploadCloud, Trash2, Search, Image, ArrowLeft, CheckCircle2, Loader2, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react'
import { getShopProductsAction } from '@/app/_actions/products'
import {
  listProductImagesAction,
  uploadProductImageAction,
  deleteProductImageAction,
} from '@/app/_actions/product-images'

const ProductImages = () => {
  const params = useParams()
  const icCodeParam = params?.ic_code
  const router = useRouter()
  const [icCode, setIcCode] = useState('')
  const [products, setProducts] = useState([])
  const [images, setImages] = useState([])
  const [imageMap, setImageMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedSubGroup, setSelectedSubGroup] = useState('')
  const [selectedSubGroup1, setSelectedSubGroup1] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 20

  const showSuccess = (msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const fetchImages = async () => {
    setLoading(true)
    setError('')
    try {
      const data = (await listProductImagesAction(icCode.trim())) || []
      setImages(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err?.message || 'ດຶງຮູບບໍ່ສຳເລັດ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [])
  useEffect(() => { if (icCodeParam) setIcCode(String(icCodeParam)) }, [icCodeParam])
  useEffect(() => { if (!icCode.trim()) { setImages([]); return } fetchImages() }, [icCode])
  useEffect(() => { if (!icCodeParam) fetchAllImages() }, [icCodeParam])

  const fetchAllImages = async () => {
    try {
      const data: any[] = (await listProductImagesAction()) || []
      const list = Array.isArray(data) ? data : []
      const map: Record<string, any> = {}
      list.forEach((img) => { if (!map[img.ic_code]) map[img.ic_code] = img })
      setImageMap(map)
    } catch { setImageMap({}) }
  }

  const fetchProducts = async () => {
    try {
      const data = (await getShopProductsAction()) || []
      setProducts(Array.isArray(data) ? data : [])
    } catch { setProducts([]) }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!icCode.trim() || !file) { setError('ກະລຸນາປ້ອນລະຫັດສິນຄ້າ ແລະ ເລືອກຮູບ'); return }
    setUploading(true); setError('')
    try {
      {
        const fd = new FormData();
        fd.append('ic_code', icCode.trim());
        fd.append('file', file);
        await uploadProductImageAction(fd);
      }
      setFile(null); showSuccess('ອັບໂຫຼດສຳເລັດ!'); fetchImages()
      if (!icCodeParam) fetchAllImages()
    } catch (err) { setError(err?.message || 'ອັບໂຫຼດບໍ່ສຳເລັດ') }
    finally { setUploading(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('ຢືນຢັນການລຶບຮູບນີ້?')) return
    setUploading(true); setError('')
    try {
      await deleteProductImageAction(id)
      showSuccess('ລຶບສຳເລັດ!'); fetchImages()
      if (!icCodeParam) fetchAllImages()
    } catch (err) { setError(err?.message || 'ລຶບບໍ່ສຳເລັດ') }
    finally { setUploading(false) }
  }

  const handleSearchSubmit = (e) => { e.preventDefault(); setSearchTerm(searchInput.trim()); setPage(1) }

  const uniqueValues = (field) => Array.from(new Set(products.map((p) => (p[field] || '').trim()).filter(Boolean))).sort()
  const groups = uniqueValues('group_name')
  const subGroups = uniqueValues('sub_group_name')
  const subGroups1 = uniqueValues('sub_group1_name')
  const categories = uniqueValues('cat_name')
  const brands = uniqueValues('brand_name')

  const resetFilters = () => { setSelectedGroup(''); setSelectedSubGroup(''); setSelectedSubGroup1(''); setSelectedCategory(''); setSelectedBrand(''); setPage(1) }

  const filteredProducts = products.filter((p) => {
    if (selectedGroup && p.group_name !== selectedGroup) return false
    if (selectedSubGroup && p.sub_group_name !== selectedSubGroup) return false
    if (selectedSubGroup1 && p.sub_group1_name !== selectedSubGroup1) return false
    if (selectedCategory && p.cat_name !== selectedCategory) return false
    if (selectedBrand && p.brand_name !== selectedBrand) return false
    if (!searchTerm) return true
    return `${p.ic_code || ''} ${p.ic_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const hasActiveFilter = !!(selectedGroup || selectedSubGroup || selectedSubGroup1 || selectedCategory || selectedBrand)

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / perPage))
  const pagedProducts = filteredProducts.slice((page - 1) * perPage, page * perPage)

  const imageBaseUrl = ''

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          {icCodeParam && (
            <button
              onClick={() => router.push('/manage/images')}
              className="mb-2 flex items-center gap-1 text-[12px] font-medium text-slate-400 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft size={13} /> ກັບໄປລາຍການ
            </button>
          )}
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Catalog</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
            {icCodeParam ? icCodeParam : 'ຈັດການຮູບສິນຄ້າ'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">ອັບໂຫຼດ ແລະ ຈັດການຮູບພາບສິນຄ້າ</p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
      )}
      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 size={15} /> {successMessage}
        </div>
      )}

      {/* Product List (no icCodeParam) */}
      {!icCodeParam && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Search + Filters */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 space-y-2">
            {/* Search row */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all"
                  placeholder="ຄົ້ນຫາລະຫັດ ຫຼື ຊື່..."
                />
              </div>
              <button type="submit" className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors shrink-0">
                ຄົ້ນຫາ
              </button>
              {hasActiveFilter && (
                <button type="button" onClick={resetFilters} className="h-9 px-3 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-500 hover:bg-white transition-colors shrink-0">
                  ລ້າງ filter
                </button>
              )}
            </form>

            {/* Filter row */}
            <div className="flex flex-wrap gap-2">
              <select value={selectedGroup} onChange={(e) => { setSelectedGroup(e.target.value); setPage(1) }} className="h-8 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] text-slate-600 focus:border-blue-400 outline-none">
                <option value="">ກຸ່ມຫຼັກ</option>
                {groups.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={selectedSubGroup} onChange={(e) => { setSelectedSubGroup(e.target.value); setPage(1) }} className="h-8 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] text-slate-600 focus:border-blue-400 outline-none">
                <option value="">ກຸ່ມຍ່ອຍ</option>
                {subGroups.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={selectedSubGroup1} onChange={(e) => { setSelectedSubGroup1(e.target.value); setPage(1) }} className="h-8 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] text-slate-600 focus:border-blue-400 outline-none">
                <option value="">ກຸ່ມຍ່ອຍ 1</option>
                {subGroups1.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setPage(1) }} className="h-8 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] text-slate-600 focus:border-blue-400 outline-none">
                <option value="">ໝວດ</option>
                {categories.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={selectedBrand} onChange={(e) => { setSelectedBrand(e.target.value); setPage(1) }} className="h-8 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] text-slate-600 focus:border-blue-400 outline-none">
                <option value="">ແບນ</option>
                {brands.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Count */}
          <div className="px-4 py-2 border-b border-slate-100 text-[11px] font-medium text-slate-400">
            {filteredProducts.length} ລາຍການ · ໜ້າ {page}/{totalPages}
          </div>

          {/* List */}
          {products.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">ຍັງບໍ່ມີສິນຄ້າ</div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">ບໍ່ພົບລາຍການ</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pagedProducts.map((p) => (
                <button
                  key={p.ic_code}
                  onClick={() => router.push(`/manage/images/${p.ic_code}`)}
                  className="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="relative w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                    {imageMap[p.ic_code] ? (
                      <>
                        <img src={`${imageBaseUrl}${imageMap[p.ic_code].file_url || ''}`} alt={p.ic_name} className="w-full h-full object-cover" />
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                      </>
                    ) : (
                      <Image size={18} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-slate-800 group-hover:text-blue-600 truncate transition-colors">{p.ic_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{p.ic_code}</div>
                  </div>
                  <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} /> ກ່ອນໜ້າ
              </button>
              <span className="text-[11px] font-medium text-slate-400">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ໜ້າຕໍ່ໄປ <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload + Images (with icCodeParam) */}
      {icCodeParam && (
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* Upload form */}
          <form onSubmit={handleUpload} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4">ອັບໂຫຼດຮູບໃໝ່</h2>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ລະຫັດສິນຄ້າ</label>
                <input
                  value={icCode}
                  readOnly
                  className="mt-1.5 w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ເລືອກຮູບ</label>
                <label className="mt-1.5 flex items-center justify-center h-10 px-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                  <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
                  {file ? <span className="text-blue-600 font-medium truncate">{file.name}</span> : <span>ກົດເລືອກໄຟລ໌...</span>}
                </label>
              </div>
              <button
                type="submit"
                disabled={uploading || !file}
                className="w-full h-10 rounded-lg bg-slate-900 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {uploading ? <><Loader2 size={15} className="animate-spin" /> ກຳລັງອັບໂຫຼດ...</> : <><UploadCloud size={15} /> ອັບໂຫຼດ</>}
              </button>
            </div>
          </form>

          {/* Images grid */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">ຮູບພາບ ({images.length})</h2>
              <button
                onClick={fetchImages}
                disabled={loading}
                className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> ໂຫຼດຄືນ
              </button>
            </div>

            {loading && (
              <div className="py-12 text-center">
                <Loader2 size={24} className="mx-auto text-slate-400 animate-spin mb-2" />
                <p className="text-sm text-slate-400">ກຳລັງໂຫຼດ...</p>
              </div>
            )}

            {!loading && images.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">ຍັງບໍ່ມີຮູບພາບ</div>
            )}

            {!loading && images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img) => (
                  <div key={img.id} className="group relative rounded-lg border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors">
                    <div className="aspect-square bg-slate-50">
                      <img src={`${imageBaseUrl}${img.file_url || ''}`} alt={img.file_name} className="w-full h-full object-cover" />
                    </div>
                    <div className="px-2.5 py-2">
                      <div className="text-[11px] font-mono text-slate-500 truncate">{img.ic_code}</div>
                      <div className="text-[10px] text-slate-400 truncate">{img.file_name}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(img.id)}
                      disabled={uploading}
                      className="absolute top-1.5 right-1.5 w-7 h-7 bg-white/90 hover:bg-rose-500 rounded-md flex items-center justify-center text-rose-500 hover:text-white border border-slate-200 hover:border-rose-500 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductImages
