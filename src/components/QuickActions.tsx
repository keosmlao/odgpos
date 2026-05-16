"use client";
import React, { useState } from 'react';
import { Zap, Coffee, Droplet, Pizza, IceCream, Apple, Beef, Milk, Wine, ShoppingBag, Settings } from 'lucide-react';

const formatPrice = (price: unknown) => (Number(price) || 0).toLocaleString();

const QuickActionButton = ({ item, onClick, icon: Icon }: any) => {
  const isOutOfStock = item.stock !== null && item.stock !== undefined && item.stock <= 0;
  return (
    <button onClick={() => !isOutOfStock && onClick(item)} disabled={isOutOfStock}
      className={`group relative pos-card p-4 transition-all ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl hover:scale-105 active:scale-95'}`}>
      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-rose-400 flex items-center justify-center text-white mb-3 mx-auto group-hover:scale-110 transition-transform shadow-lg ${isOutOfStock ? 'grayscale' : ''}`}>
        {Icon ? <Icon size={28} strokeWidth={2.5} /> : <ShoppingBag size={28} strokeWidth={2.5} />}
      </div>
      <div className="space-y-1">
        <h3 className="font-bold text-slate-800 text-sm truncate text-center group-hover:text-blue-800 transition-colors">{item.name}</h3>
        <p className="text-lg font-black text-blue-800 text-center">{formatPrice(item.price)} ₭</p>
      </div>
      {item.badge && <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-lg">{item.badge}</div>}
    </button>
  );
};

const iconMap: Record<string, any> = { Coffee, Droplet, Pizza, IceCream, Apple, Beef, Milk, Wine, ShoppingBag };

const QuickActions = ({ quickItems = [], onAddProduct, onUpdateQuickItems, title = "\u0EAA\u0EB4\u0E99\u0E84\u0EC9\u0EB2\u0E82\u0EB2\u0E8D\u0E94\u0EC8\u0EA7\u0E99", columns = 4 }: any) => {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const defaultQuickItems = [
    { id: 'q1', name: '\u0E99\u0EC9\u0EB3\u0EC0\u0E9B\u0EBB\u0EC8\u0EB2', price: 5000, barcode: 'WATER001', iconName: 'Droplet', badge: 'Hot' },
    { id: 'q2', name: '\u0E81\u0EB2\u0EC0\u0E9F', price: 15000, barcode: 'COFFEE001', iconName: 'Coffee' },
    { id: 'q3', name: '\u0EC0\u0E9A\u0E8D', price: 12000, barcode: 'BEER001', iconName: 'Wine' },
    { id: 'q4', name: '\u0EC2\u0E84\u0EA5\u0EB2', price: 8000, barcode: 'COLA001', iconName: 'Droplet' },
  ];
  const items = quickItems.length > 0 ? quickItems : defaultQuickItems;
  void showSettingsModal; void setShowSettingsModal; void onUpdateQuickItems;
  return (
    <div className="pos-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2"><Zap className="text-blue-500" size={24} /><h2 className="text-xl font-black text-slate-800">{title}</h2></div>
        <button onClick={() => setShowSettingsModal(true)} className="p-2 bg-white rounded-lg border-2 border-blue-100 hover:border-blue-300 transition-colors"><Settings size={18} className="text-blue-500" /></button>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map((item: any) => {
          const Icon = iconMap[item.iconName] || ShoppingBag;
          return <QuickActionButton key={item.id} item={item} onClick={onAddProduct} icon={Icon} />;
        })}
      </div>
    </div>
  );
};

export default QuickActions;
