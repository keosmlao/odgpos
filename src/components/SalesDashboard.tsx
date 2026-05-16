"use client";
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Clock,
  BarChart3,
  Calendar,
  Award
} from 'lucide-react';

const formatPrice = (price) => (Number(price) || 0).toLocaleString();

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, subValue, trend, color = 'orange' }) => {
  const colorClasses = {
    orange: 'from-blue-500 to-rose-400',
    emerald: 'from-emerald-400 to-teal-400',
    blue: 'from-blue-400 to-cyan-400',
    purple: 'from-blue-600 to-pink-400',
  };

  return (
    <div className="pos-card p-5 hover:shadow-2xl transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
          <Icon size={24} strokeWidth={2.5} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
            trend > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}>
            <TrendingUp size={12} className={trend < 0 ? 'rotate-180' : ''} />
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
        {subValue && <p className="text-xs text-slate-400 font-medium">{subValue}</p>}
      </div>
    </div>
  );
};

// Quick Period Selector
const PeriodSelector = ({ selected, onChange }) => {
  const periods = [
    { id: 'today', label: 'ມື້ນີ້' },
    { id: 'week', label: 'ອາທິດນີ້' },
    { id: 'month', label: 'ເດືອນນີ້' },
    { id: 'year', label: 'ປີນີ້' },
  ];

  return (
    <div className="flex gap-2">
      {periods.map((period) => (
        <button
          key={period.id}
          onClick={() => onChange(period.id)}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            selected === period.id
              ? 'bg-blue-500 text-white shadow-md'
              : 'bg-white text-slate-600 border border-blue-100 hover:border-blue-300'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
};

// Top Products List
const TopProductsList = ({ products = [] }) => {
  return (
    <div className="pos-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Award className="text-blue-500" size={20} />
        <h3 className="font-black text-slate-800">ສິນຄ້າຂາຍດີ</h3>
      </div>
      <div className="space-y-3">
        {products.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">ບໍ່ມີຂໍ້ມູນ</div>
        ) : (
          products.map((product, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                idx === 0 ? 'bg-blue-500 text-white' :
                idx === 1 ? 'bg-blue-500 text-white' :
                idx === 2 ? 'bg-blue-300 text-white' :
                'bg-slate-200 text-slate-600'
              }`}>
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">{product.name}</p>
                <p className="text-xs text-slate-500">ຂາຍ: {product.quantity} {product.unit || 'ຊິ້ນ'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-900 text-sm">{formatPrice(product.total)} ₭</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Sales by Hour Chart (Simple Bar Chart)
const SalesByHourChart = ({ data = [] }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="pos-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="text-blue-500" size={20} />
        <h3 className="font-black text-slate-800">ຍອດຂາຍຕາມຊົ່ວໂມງ</h3>
      </div>
      <div className="flex items-end justify-between gap-2 h-40">
        {data.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">ບໍ່ມີຂໍ້ມູນ</div>
        ) : (
          data.map((item, idx) => {
            const height = (item.value / maxValue) * 100;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="relative group w-full">
                  <div
                    className="w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-lg transition-all group-hover:from-blue-800 group-hover:to-blue-500"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {formatPrice(item.value)} ₭
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-500">{item.hour}h</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// Main Sales Dashboard Component
const SalesDashboard = ({
  isOpen,
  onClose,
  salesData = null,
  onPeriodChange
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('lo-LA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    onPeriodChange?.(period);
  };

  // Default data structure
  const data = salesData || {
    totalSales: 0,
    totalOrders: 0,
    totalCustomers: 0,
    avgOrderValue: 0,
    topProducts: [],
    salesByHour: [],
    trends: {
      sales: 0,
      orders: 0,
      customers: 0,
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-blue-200/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Dashboard Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="bg-gradient-to-br from-blue-50 to-rose-50 w-full max-w-7xl h-[90vh] rounded-3xl shadow-2xl border-2 border-blue-200 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-blue-500 via-blue-500 to-rose-400 text-white border-b-2 border-blue-300">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 size={32} strokeWidth={2.5} />
                  <h2 className="text-3xl font-black">Sales Dashboard</h2>
                </div>
                <p className="text-sm text-white/80 font-semibold">ສະຫຼຸບຍອດຂາຍ ແລະ ສະຖິຕິ</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
                  <Clock size={16} />
                  <span className="text-sm font-bold">{currentTime}</span>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>

            {/* Period Selector */}
            <PeriodSelector selected={selectedPeriod} onChange={handlePeriodChange} />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Stats Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={DollarSign}
                label="ຍອດຂາຍລວມ"
                value={`${formatPrice(data.totalSales)} ₭`}
                subValue={selectedPeriod === 'today' ? 'ມື້ນີ້' : selectedPeriod}
                trend={data.trends?.sales}
                color="orange"
              />
              <StatCard
                icon={ShoppingCart}
                label="ຈຳນວນບິນ"
                value={data.totalOrders}
                subValue={`ສະເລ່ຍ: ${formatPrice(data.avgOrderValue)} ₭/ບິນ`}
                trend={data.trends?.orders}
                color="emerald"
              />
              <StatCard
                icon={Users}
                label="ລູກຄ້າ"
                value={data.totalCustomers}
                subValue={`${data.totalOrders > 0 ? ((data.totalCustomers / data.totalOrders) * 100).toFixed(0) : 0}% ສະມາຊິກ`}
                trend={data.trends?.customers}
                color="blue"
              />
              <StatCard
                icon={Award}
                label="ຍອດສະເລ່ຍຕໍ່ບິນ"
                value={`${formatPrice(data.avgOrderValue)} ₭`}
                subValue="ມູນຄ່າສະເລ່ຍ"
                color="purple"
              />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <SalesByHourChart data={data.salesByHour || []} />
              </div>
              <div className="lg:col-span-1">
                <TopProductsList products={data.topProducts || []} />
              </div>
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="pos-card p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">ການຊຳລະເງິນສົດ</p>
                <p className="text-xl font-black text-emerald-600">{formatPrice(data.cashPayments || 0)} ₭</p>
                <p className="text-xs text-slate-400 mt-1">{data.cashPaymentsCount || 0} ລາຍການ</p>
              </div>
              <div className="pos-card p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">ການໂອນເງິນ</p>
                <p className="text-xl font-black text-blue-600">{formatPrice(data.transferPayments || 0)} ₭</p>
                <p className="text-xs text-slate-400 mt-1">{data.transferPaymentsCount || 0} ລາຍການ</p>
              </div>
              <div className="pos-card p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">ສ່ວນຫຼຸດລວມ</p>
                <p className="text-xl font-black text-blue-800">{formatPrice(data.totalDiscounts || 0)} ₭</p>
                <p className="text-xs text-slate-400 mt-1">{data.discountedOrders || 0} ບິນມີສ່ວນຫຼຸດ</p>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 bg-white border-t-2 border-blue-100 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-semibold">
              ອັບເດດລ່າສຸດ: {currentTime}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm hover:bg-blue-800 transition-colors"
            >
              ປິດ
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default SalesDashboard;
