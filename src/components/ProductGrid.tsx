"use client";
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Search,
  Grid3x3,
  List,
  Package,
  Star,
  TrendingUp,
  Filter,
  X,
  Tag
} from 'lucide-react';

const formatPrice = (price) => (Number(price) || 0).toLocaleString();

// Product Card Component
const ProductCard = ({ product, onAdd, viewMode = 'grid' }) => {
  const { id, name, price, barcode, unit, stock, image, category, isBestSeller } = product;
  const isLowStock = stock !== null && stock !== undefined && stock < 10;
  const isOutOfStock = stock !== null && stock !== undefined && stock <= 0;

  if (viewMode === 'list') {
    return (
      <button
        onClick={() => !isOutOfStock && onAdd(product)}
        disabled={isOutOfStock}
        className={`w-full p-4 bg-white rounded-xl border-2 transition-all text-left group ${
          isOutOfStock
            ? 'border-slate-200 opacity-50 cursor-not-allowed'
            : 'border-blue-100 hover:border-blue-500 hover:shadow-lg'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
            {image ? (
              <img src={image} alt={name} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <Package className="text-blue-500" size={32} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-slate-800 truncate group-hover:text-blue-800">{name}</h3>
              {isBestSeller && (
                <Star className="text-blue-500 fill-blue-500 flex-shrink-0" size={14} />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono">#{barcode || id}</span>
              {category && (
                <>
                  <span>•</span>
                  <span>{category}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-black text-blue-800">{formatPrice(price)} ₭</p>
            {stock !== null && stock !== undefined && (
              <p className={`text-xs font-semibold ${
                isOutOfStock ? 'text-rose-500' : isLowStock ? 'text-blue-500' : 'text-emerald-500'
              }`}>
                {isOutOfStock ? 'ໝົດສະຕ໋ອກ' : `ສະຕ໋ອກ: ${stock}`}
              </p>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => !isOutOfStock && onAdd(product)}
      disabled={isOutOfStock}
      className={`pos-card p-4 transition-all group relative ${
        isOutOfStock
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:shadow-xl hover:scale-105 active:scale-95'
      }`}
    >
      {/* Badges */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 items-end z-10">
        {isBestSeller && (
          <div className="bg-blue-500 text-white px-2 py-1 rounded-full flex items-center gap-1 text-xs font-bold shadow-lg">
            <Star size={10} className="fill-white" />
            <span>Hot</span>
          </div>
        )}
        {isLowStock && !isOutOfStock && (
          <div className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
            ໃກ້ໝົດ
          </div>
        )}
        {isOutOfStock && (
          <div className="bg-rose-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
            ໝົດສະຕ໋ອກ
          </div>
        )}
      </div>

      {/* Product Image */}
      <div className="w-full aspect-square bg-gradient-to-br from-blue-100 to-rose-100 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
        {image ? (
          <img src={image} alt={name} className="w-full h-full object-cover" />
        ) : (
          <Package className="text-blue-500" size={48} />
        )}
      </div>

      {/* Product Info */}
      <div className="space-y-2">
        <div>
          <h3 className="font-bold text-slate-800 text-sm truncate group-hover:text-blue-800 transition-colors">
            {name}
          </h3>
          <p className="text-xs text-slate-400 font-mono">#{barcode || id}</p>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xl font-black text-blue-800">{formatPrice(price)}</p>
            <p className="text-xs text-slate-500">₭/{unit || 'ຊິ້ນ'}</p>
          </div>
          {stock !== null && stock !== undefined && (
            <div className={`text-xs font-semibold px-2 py-1 rounded ${
              isOutOfStock ? 'bg-rose-100 text-rose-600' :
              isLowStock ? 'bg-blue-100 text-blue-800' :
              'bg-emerald-100 text-emerald-600'
            }`}>
              {stock}
            </div>
          )}
        </div>
      </div>
    </button>
  );
};

// Category Filter Component
const CategoryFilter = ({ categories = [], selected, onSelect, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-lg border-2 border-blue-100 hover:border-blue-300 transition-colors font-semibold text-sm"
      >
        <Filter size={16} className="text-blue-500" />
        <span>{selected || 'ໝວດໝູ່ທັງໝົດ'}</span>
        {selected && (
          <X
            size={14}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="text-slate-400 hover:text-slate-600"
          />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border-2 border-blue-100 z-20 overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <button
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 font-semibold text-sm"
              >
                ທັງໝົດ
              </button>
              {categories.map((category, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onSelect(category);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 ${
                    selected === category ? 'bg-blue-100 text-blue-900 font-bold' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{category}</span>
                    {selected === category && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Main Product Grid Component
const ProductGrid = ({
  products = [],
  onAddProduct,
  categories = [],
  showSearch = true,
  showCategoryFilter = true,
  defaultViewMode = 'grid'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState(defaultViewMode);

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch = !searchTerm.trim() ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.id && String(product.id).toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = !selectedCategory || product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Sort products - bestsellers and in-stock first
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    // Out of stock items go to the end
    const aOutOfStock = a.stock !== null && a.stock !== undefined && a.stock <= 0;
    const bOutOfStock = b.stock !== null && b.stock !== undefined && b.stock <= 0;
    if (aOutOfStock && !bOutOfStock) return 1;
    if (!aOutOfStock && bOutOfStock) return -1;

    // Bestsellers go first
    if (a.isBestSeller && !b.isBestSeller) return -1;
    if (!a.isBestSeller && b.isBestSeller) return 1;

    return 0;
  });

  return (
    <div className="pos-card p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-5 space-y-4">
        {/* Title & View Mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="text-blue-500" size={24} />
            <h2 className="text-xl font-black text-slate-800">ສິນຄ້າ</h2>
            <span className="px-2 py-1 bg-blue-100 text-blue-900 rounded-full text-xs font-bold">
              {filteredProducts.length}
            </span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border-2 border-blue-100 text-slate-600 hover:border-blue-300'
              }`}
            >
              <Grid3x3 size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border-2 border-blue-100 text-slate-600 hover:border-blue-300'
              }`}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex gap-3">
          {showSearch && (
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ຄົ້ນຫາສິນຄ້າ..."
                className="w-full h-11 pl-11 pr-4 rounded-lg border-2 border-blue-100 focus:border-blue-500 focus:outline-none text-sm font-semibold"
              />
            </div>
          )}

          {showCategoryFilter && categories.length > 0 && (
            <CategoryFilter
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              onClear={() => setSelectedCategory('')}
            />
          )}
        </div>
      </div>

      {/* Products Grid/List */}
      <div className="flex-1 overflow-y-auto pr-2">
        {sortedProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
            <Package size={64} strokeWidth={1.5} className="mb-4 text-slate-300" />
            <p className="text-base font-semibold text-slate-600 mb-1">ບໍ່ພົບສິນຄ້າ</p>
            <p className="text-xs text-slate-500">ລອງຄົ້ນຫາດ້ວຍຄຳອື່ນ</p>
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
              : 'space-y-3'
          }>
            {sortedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={onAddProduct}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductGrid;
