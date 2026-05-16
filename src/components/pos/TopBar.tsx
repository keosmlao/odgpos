"use client";
import Link from "next/link";
import { Cog, HelpCircle, LogOut, User } from "lucide-react";

type Props = {
  cashierName: string;
  cashierCode: string;
  orderId: string;
  currentTime: string;
  onLogout?: () => void | Promise<void>;
};

export default function TopBar({ cashierName, cashierCode, orderId, currentTime, onLogout }: Props) {
  return (
    <header className="h-12 shrink-0 border-b border-slate-200 bg-white px-3 sm:px-4 flex items-center gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center text-[11px] font-black tracking-tight">
          OD
        </div>
        <span className="hidden sm:inline text-[12px] font-bold text-slate-700 tracking-tight">ODIEN&nbsp;POS</span>
      </div>

      <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-400">
        <span>·</span>
        <span className="font-mono font-semibold text-slate-600">{orderId || '—'}</span>
        <span>·</span>
        <span className="font-mono font-semibold tabular-nums text-slate-600">{currentTime || '—'}</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
        </span>

        <Link href="/manage" className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
          <Cog size={14} /> Manage
        </Link>
        <Link href="/help" className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
          <HelpCircle size={14} /> Help
        </Link>

        <div className="mx-2 h-6 w-px bg-slate-200 hidden sm:block" />

        <div className="flex items-center gap-2 h-8 px-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
            <User size={14} />
          </div>
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
