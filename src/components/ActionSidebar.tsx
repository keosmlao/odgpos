"use client";
import React from 'react';
import { Pause, RotateCcw, X, ClipboardList, Monitor, LogOut } from 'lucide-react';

const ActionButton = ({ icon: Icon, label, onClick, disabled = false, badge = null, active = false, variant = 'default' }: any) => {
  const getVariantStyles = () => {
    if (disabled) return 'bg-blue-100 text-blue-300 cursor-not-allowed opacity-60 border-l-4 border-transparent';
    if (active) return 'bg-blue-500 text-white border-l-4 border-blue-200 shadow-md';
    switch (variant) {
      case 'danger': return 'text-rose-600 hover:bg-rose-100 hover:text-rose-700 border-l-4 border-transparent hover:border-l-rose-300';
      case 'secondary': return 'text-blue-900 hover:bg-blue-100 hover:text-orange-800 border-l-4 border-transparent hover:border-l-blue-300';
      default: return 'text-orange-800 hover:bg-blue-100 hover:text-orange-900 border-l-4 border-transparent hover:border-l-blue-300';
    }
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`w-full h-14 flex items-center gap-3 px-4 transition-all text-sm font-semibold uppercase tracking-wide ${getVariantStyles()} relative group`}>
      <Icon size={18} className="flex-shrink-0" /><span className="flex-1 text-left text-xs">{label}</span>
      {badge !== null && badge > 0 && <span className="flex-shrink-0 px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">{badge > 99 ? '99+' : badge}</span>}
    </button>
  );
};

const ActionSidebar = ({ onHold, heldCount = 0, onRecall, onCancel, onDaily, onDisplay, isDisplayOpen = false, onLogout, hasItems = false }: any) => (
  <aside className="pos-sidebar w-60 flex flex-col">
    <div className="h-24 flex items-center justify-center border-b border-blue-200 px-4 bg-blue-50">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 pos-logo rounded flex items-center justify-center"><span className="text-white font-bold text-2xl">O</span></div>
        <div className="flex flex-col leading-tight"><span className="text-orange-900 text-base font-bold">ODIEN</span><span className="text-blue-500 text-[10px] font-semibold uppercase">POS System</span></div>
      </div>
    </div>
    <div className="flex-1 py-4 overflow-y-auto">
      <div className="mb-4"><div className="px-4 mb-2"><span className="text-[9px] uppercase tracking-wider text-blue-500 font-semibold">Bill Actions</span></div>
        <ActionButton icon={Pause} label="Hold Bill" onClick={onHold} disabled={!hasItems} />
        <ActionButton icon={RotateCcw} label="Held Bills" onClick={onRecall} badge={heldCount} />
        <ActionButton icon={X} label="Cancel" onClick={onCancel} variant="danger" />
      </div>
      <div className="my-2 border-t border-blue-200" />
      <div className="mt-4"><div className="px-4 mb-2"><span className="text-[9px] uppercase tracking-wider text-blue-500 font-semibold">Operations</span></div>
        <ActionButton icon={ClipboardList} label="Daily Summary" onClick={onDaily} />
        <ActionButton icon={Monitor} label="Display" onClick={onDisplay} active={isDisplayOpen} />
      </div>
    </div>
    <div className="border-t border-blue-200 bg-blue-50"><ActionButton icon={LogOut} label="Logout" onClick={onLogout} variant="secondary" /></div>
  </aside>
);

export default ActionSidebar;
