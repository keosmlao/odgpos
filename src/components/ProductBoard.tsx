"use client";
// @ts-nocheck
import React, { useState } from 'react';
import { Search, Package, Loader2, ScanLine } from 'lucide-react';

const formatPrice = (price) => (Number(price) || 0).toLocaleString();
const formatQty = (qty) => (Number(qty) || 0).toLocaleString();

const ProductBoard = ({
  searchTerm,
  onSearch,
  onClear,
  products = [],
  onAddItem,
  onAddBarcode,
  isSearching = false,
}) => {
  const [barcode, setBarcode] = useState('');

  const handleBarcodeSubmit = (event) => {
    event.preventDefault();
    const trimmed = barcode.trim();
    if (!trimmed) return;
    onAddBarcode?.(trimmed);
    setBarcode('');
  };

  return (
    <div className="pos-card flex-1 p-6 flex flex-col overflow-hidden">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={18} />
          <input
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="ຄົ້ນຫາສິນຄ້າ, ລະຫັດ, ຊື່..."
            className="w-full h-12 pl-10 pr-10 rounded-2xl border border-blue-100 bg-white text-sm text-orange-900 placeholder:text-blue-300 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
          {searchTerm && !isSearching && (
            <button
              onClick={onClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-500 hover:bg-blue-100"
            >
              Clear
            </button>
          )}
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" size={18} />
          )}
        </div>

        <form onSubmit={handleBarcodeSubmit} className="relative min-w-[220px] flex-1">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={18} />
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="ສະແກນບາໂຄດ..."
            className="w-full h-12 pl-10 pr-10 rounded-2xl border border-blue-100 bg-white text-sm text-orange-900 placeholder:text-blue-300 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-500"
          >
            Enter
          </button>
        </form>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="h-full flex flex-col items-center justify-center text-blue-300">
            <Loader2 className="mb-3 h-10 w-10 animate-spin" />
            <p className="text-sm font-semibold">ກຳລັງຄົ້ນຫາ...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-blue-300">
            <div className="mb-4 rounded-3xl bg-blue-50 p-6">
              <Package size={42} />
            </div>
            <p className="text-base font-bold text-blue-500">ຍັງບໍ່ມີສິນຄ້າ</p>
            <p className="text-sm text-blue-300">ຄົ້ນຫາຫຼືສະແກນບາໂຄດເພື່ອເພີ່ມ</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product, idx) => {
              const hasStock = Number.isFinite(Number(product.stock));
              return (
                <button
                  key={product.id || `product-${idx}`}
                  onClick={() => onAddItem(product)}
                  className="group rounded-2xl border border-blue-100 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-blue-500">#{product.id}</p>
                      <h4 className="mt-1 line-clamp-2 text-sm font-bold text-orange-900 group-hover:text-blue-800">
                        {product.name}
                      </h4>
                    </div>
                    <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-500">
                      {product.unit || 'EA'}
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-lg font-black text-orange-900">{formatPrice(product.price)}</p>
                      <p className="text-xs font-semibold text-blue-300">₭</p>
                    </div>
                    {hasStock && (
                      <div className="rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-600">
                        {formatQty(product.stock)}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductBoard;
