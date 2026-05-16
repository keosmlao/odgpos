"use client";
// @ts-nocheck
import React, { useEffect, useState, useRef } from "react";
import { ShoppingBag, QrCode, CheckCircle2, User, Sparkles, Package, Wallet, Clock, ArrowRight } from "lucide-react";
import OnePayQR from "@/components/OnePayQR";

const formatCurrency = (val) => (Number(val) || 0).toLocaleString("en-US");

export default function CustomerDisplaySimple({
  orderId, items = [], total = 0, paymentType = "cash",
  receivedAmount = 0, onPaymentSuccess, cashierName = "Staff"
}) {
  const [status, setStatus] = useState("idle");
  const [currentTime, setCurrentTime] = useState("");
  const bottomRef = useRef(null);

  // Clock Logic
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync with POS Channel
  useEffect(() => {
    const channel = new BroadcastChannel("odg-pos");
    channel.onmessage = (e) => {
      if (e.data?.type === "PAYMENT_SUCCESS") setStatus("success");
    };
    return () => channel.close();
  }, []);

  // Auto Scroll to new items
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items]);

  // Status Management
  useEffect(() => {
    if (status === 'success') {
       if(onPaymentSuccess) onPaymentSuccess();
       const t = setTimeout(() => setStatus("idle"), 5000);
       return () => clearTimeout(t);
    } else if (items.length > 0) {
       setStatus("active");
    } else {
       setStatus("idle");
    }
  }, [status, items, onPaymentSuccess]);

  const change = Math.max((Number(receivedAmount) || 0) - total, 0);
  const getLineTotal = (item) => (
    Number(item?.lineNet ?? item?.line_total ?? item?.lineTotal ?? (item?.price || 0) * (item?.quantity || 0))
  );

  // ---------------------------------------------------------
  // 1. IDLE SCREEN (Screensaver)
  // ---------------------------------------------------------
  if (items.length === 0 && status !== 'success') {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-['Noto_Sans_Lao'] text-white">
         <div className="absolute inset-0 opacity-30">
            <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-800 rounded-full blur-[150px] animate-pulse" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-900 rounded-full blur-[120px]" />
         </div>

         <div className="relative z-10 flex flex-col items-center text-center">
            <div className="mb-10 relative">
                <div className="w-40 h-40 bg-blue-500 rounded-[3rem] flex items-center justify-center shadow-[0_20px_50px_rgba(249,115,22,0.4)] animate-bounce duration-[3000ms]">
                    <ShoppingBag size={80} strokeWidth={1.5} />
                </div>
            </div>
            <h1 className="text-9xl font-black tracking-tighter mb-4 italic">ODIEN</h1>
            <p className="text-3xl font-bold tracking-[0.5em] text-blue-500 mb-12 uppercase">Spare Parts</p>

            <div className="bg-white/5 backdrop-blur-2xl px-12 py-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
               <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-black mb-2">Local Time</p>
               <p className="text-7xl font-black font-mono tracking-tighter text-white">{currentTime}</p>
            </div>
         </div>

         <div className="absolute bottom-12 flex items-center gap-3 bg-white/5 px-6 py-3 rounded-full border border-white/5">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            <span className="text-sm font-bold text-slate-400">Cashier: {cashierName}</span>
         </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // 2. SUCCESS SCREEN
  // ---------------------------------------------------------
  if (status === 'success') {
    return (
      <div className="h-screen w-screen bg-emerald-500 text-white flex flex-col items-center justify-center relative overflow-hidden font-['Noto_Sans_Lao']">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent" />

         <div className="relative z-10 flex flex-col items-center animate-in zoom-in duration-500">
            <div className="w-48 h-48 bg-white text-emerald-500 rounded-full flex items-center justify-center shadow-2xl mb-10">
                <CheckCircle2 size={120} strokeWidth={2.5} />
            </div>
            <h1 className="text-9xl font-black mb-2 tracking-tighter">ຂອບໃຈ</h1>
            <p className="text-4xl font-bold opacity-80 uppercase tracking-widest">Payment Success</p>

            {change > 0 && (
                <div className="mt-16 bg-black/10 backdrop-blur-md px-16 py-8 rounded-[3rem] border border-white/20 text-center">
                    <p className="text-sm font-black uppercase tracking-widest mb-2 opacity-70">ເງິນທອນ (Change)</p>
                    <p className="text-8xl font-black font-mono tracking-tighter">{formatCurrency(change)} ₭</p>
                </div>
            )}
         </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // 3. SELLING & PAYMENT MODE
  // ---------------------------------------------------------
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 font-['Noto_Sans_Lao'] overflow-hidden">

       {/* TOP: TOTAL AMOUNT AREA */}
       <div className="h-[40%] bg-slate-950 text-white p-12 relative flex flex-col justify-end overflow-hidden">
          <div className="absolute top-0 right-0 w-[50%] h-full bg-blue-800/20 blur-[100px]" />

          <div className="relative z-10 flex justify-between items-end">
             <div className="space-y-4">
                <div className="inline-flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Order #{orderId || 'NEW'}</span>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-400 uppercase tracking-wider mb-1">ຍອດລວມທັງໝົດ</h2>
                    <div className="flex items-baseline gap-4">
                        <span className="text-[10rem] font-black leading-none tracking-tighter text-white font-mono">
                            {formatCurrency(total)}
                        </span>
                        <span className="text-5xl font-black text-blue-500">₭</span>
                    </div>
                </div>
             </div>

             {paymentType === 'transfer' && (
                <div className="mb-8 animate-in slide-in-from-right duration-500">
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl shadow-blue-500/20 border-4 border-blue-500">
                        <OnePayQR orderId={orderId} totalAmount={total} size={240} />
                        <div className="mt-4 flex items-center justify-center gap-2 text-slate-900 font-black uppercase tracking-tighter">
                            <QrCode size={20} className="text-blue-500" /> Scan to pay
                        </div>
                    </div>
                </div>
             )}
          </div>
       </div>

       {/* MIDDLE: ITEMS LIST */}
       <div className="flex-1 bg-white overflow-y-auto px-12 py-8 scrollbar-hide">
          <div className="grid grid-cols-1 gap-4">
             {items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200">
                        <Package size={32} className="text-slate-400" />
                      </div>
                      <div>
                        <h4 className="text-3xl font-black text-slate-900 leading-none mb-1 uppercase">{item.name}</h4>
                        <p className="text-xl font-bold text-slate-400 uppercase">
                            {formatCurrency(item.price)} × {item.quantity}
                        </p>
                        {item?.is_promo_gift && item?.gift_for_name && (
                          <p className="text-lg font-bold text-blue-600 uppercase">
                            ແຖມຈາກ: {item.gift_for_name}
                          </p>
                        )}
                      </div>
                   </div>
                   <div className="text-right">
                      <span className="text-4xl font-black font-mono text-slate-900">{formatCurrency(getLineTotal(item))}</span>
                      <span className="ml-2 text-lg font-bold text-slate-300">₭</span>
                   </div>
                </div>
             ))}
             <div ref={bottomRef} />
          </div>
       </div>

       {/* BOTTOM: PAYMENT STATUS BAR */}
       <div className="h-32 bg-white border-t border-slate-100 px-12 flex items-center justify-between shadow-[0_-20px_50px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
             <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Clock size={32} />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Time</p>
                <p className="text-2xl font-black font-mono text-slate-900">{currentTime}</p>
             </div>
          </div>

          <div className="flex items-center gap-6">
             {paymentType === 'cash' && receivedAmount > 0 ? (
                <>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Received (ຮັບມາ)</p>
                        <p className="text-3xl font-black text-slate-900 font-mono">{formatCurrency(receivedAmount)} ₭</p>
                    </div>
                    <div className="h-16 w-px bg-slate-200 mx-2" />
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Change (ທອນ)</p>
                        <p className="text-5xl font-black text-blue-500 font-mono tracking-tighter">{formatCurrency(change)} ₭</p>
                    </div>
                </>
             ) : (
                <div className="flex items-center gap-3 bg-slate-950 px-8 py-4 rounded-2xl">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
                        <Wallet size={16} className="text-white" />
                    </div>
                    <span className="text-lg font-black text-white uppercase tracking-widest">
                        {paymentType === 'transfer' ? 'Waiting for Transfer' : 'Waiting for Cash'}
                    </span>
                    <div className="flex gap-1 ml-4">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                </div>
             )}
          </div>
       </div>
    </div>
  );
}
