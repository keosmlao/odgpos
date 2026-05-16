"use client";
import React from 'react';
import { Pause, RotateCcw, X, ClipboardList, Monitor, LogOut } from 'lucide-react';

const DockButton = ({ icon: Icon, label, onClick, badge, active, disabled }: any) => (
  <button onClick={onClick} disabled={disabled} className={`relative flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${disabled ? 'bg-blue-50 text-blue-200 border border-blue-100 cursor-not-allowed' : active ? 'bg-blue-500 text-white shadow-md' : 'bg-white/80 text-blue-900 border border-blue-200 hover:bg-blue-50'}`}>
    <Icon size={18} /><span>{label}</span>
    {badge !== undefined && badge !== null && badge > 0 && <span className="ml-1 rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">{badge > 99 ? '99+' : badge}</span>}
  </button>
);

const ActionDock = ({ onHold, heldCount = 0, onRecall, onCancel, onDaily, onDisplay, isDisplayOpen = false, onLogout, hasItems = false }: any) => (
  <div className="pos-card flex flex-wrap items-center gap-3 p-4">
    <DockButton icon={Pause} label="Hold Bill" onClick={onHold} disabled={!hasItems} />
    <DockButton icon={RotateCcw} label="Held Bills" onClick={onRecall} badge={heldCount} />
    <DockButton icon={X} label="Cancel" onClick={onCancel} disabled={!hasItems} />
    <DockButton icon={ClipboardList} label="Daily" onClick={onDaily} />
    <DockButton icon={Monitor} label={isDisplayOpen ? 'Display On' : 'Display Off'} onClick={onDisplay} active={isDisplayOpen} />
    <div className="ml-auto"><DockButton icon={LogOut} label="Logout" onClick={onLogout} /></div>
  </div>
);

export default ActionDock;
