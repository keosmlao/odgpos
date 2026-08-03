"use client";
import Link from "next/link";
import { ChevronDown, CircleHelp, LogOut, Settings2, ShoppingBag, User } from "lucide-react";

type Props = {
  cashierName: string;
  cashierCode: string;
  orderId: string;
  currentTime: string;
  onLogout?: () => void | Promise<void>;
};

export default function TopBar({ cashierName, cashierCode, orderId, currentTime, onLogout }: Props) {
  return (
    <header className="h-16 shrink-0 border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 flex items-center gap-5 shadow-[0_1px_12px_rgba(15,23,42,0.04)] backdrop-blur-xl z-30">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
          <ShoppingBag size={17} strokeWidth={2.5} />
        </div>
        <div className="hidden sm:block leading-tight">
          <div className="text-[14px] font-black text-slate-900 tracking-tight">ODIEN <span className="text-indigo-600">POS</span></div>
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Point of sale</div>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-3 ml-2 pl-5 border-l border-slate-200">
        <div><div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">ບິນປັດຈຸບັນ</div><div className="font-mono text-[12px] font-bold text-slate-700">{orderId || 'ບິນໃໝ່'}</div></div>
        <div className="h-7 w-px bg-slate-200" />
        <div><div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">ເວລາ</div><div className="font-mono text-[12px] font-bold tabular-nums text-slate-700">{currentTime || '—'}</div></div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
        </span>

        <Link href="/manage" className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
          <Settings2 size={15} /> ຈັດການ
        </Link>
        <Link href="/help" className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
          <CircleHelp size={15} /> ຊ່ວຍເຫຼືອ
        </Link>

        <div className="mx-2 h-6 w-px bg-slate-200 hidden sm:block" />

        <div className="flex items-center gap-2 h-10 px-2 rounded-xl hover:bg-slate-50">
          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center ring-1 ring-indigo-100">
            <User size={14} />
          </div>
          <ChevronDown size={13} className="hidden sm:block text-slate-400" />
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-[12px] font-bold text-slate-800 truncate max-w-[140px]">{cashierName || 'Cashier'}</span>
            <span className="text-[10px] text-slate-400 font-mono">#{cashierCode || '—'}</span>
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Logout"
          className="ml-1 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
