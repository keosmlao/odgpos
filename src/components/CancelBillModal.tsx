"use client";
import React, { useState } from 'react';
import { X, Search, AlertTriangle, Trash2, CheckCircle2, History, Loader2 } from 'lucide-react';
import { searchBillsAction } from '@/app/_actions/bills';

const REASONS = ['\u0EA5\u0EB9\u0E81\u0E84\u0EC9\u0EB2\u0E8D\u0EBB\u0E81\u0EC0\u0EA5\u0EB5\u0E81', '\u0E9B\u0EC8\u0EBD\u0E99\u0EA5\u0EB2\u0E8D\u0E81\u0EB2\u0E99', '\u0E9A\u0EB1\u0E99\u0EAB\u0EB2\u0E81\u0EB2\u0E99\u0E8A\u0ECD\u0EB2\u0EA5\u0EB0', '\u0EAA\u0EB4\u0E99\u0E84\u0EC9\u0EB2\u0E9A\u0ECD\u0EC8\u0E9E\u0ECD', '\u0EDD\u0EBB\u0E94\u0EC0\u0EA7\u0EA5\u0EB2\u0EA5\u0ECD\u0E96\u0EC9\u0EB2', '\u{1F4DD} \u0EAD\u0EB7\u0EC8\u0E99\u0EC6'];

export default function CancelBillModal({ isOpen, onClose, onConfirm }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [note, setNote] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  if (!isOpen) return null;
  const finalReason = selectedReason === '\u{1F4DD} \u0EAD\u0EB7\u0EC8\u0E99\u0EC6' ? note : selectedReason;
  const billCode = selectedBill?.doc_no || selectedBill?.orderId || '';
  const readyToConfirm = !!selectedBill && !!finalReason && confirmCode.trim() === (billCode || '').trim();
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    try { const data = await searchBillsAction(searchTerm.trim()); setResults(Array.isArray(data) ? data : []); setSelectedBill(null); setConfirmCode(''); setHasSearched(true); }
    catch { setResults([]); setHasSearched(true); }
    finally { setIsSearching(false); }
  };
  const handleClose = () => { setSelectedReason(''); setNote(''); setConfirmCode(''); setSelectedBill(null); setResults([]); setSearchTerm(''); setHasSearched(false); onClose(); };
  const onConfirmAction = () => { onConfirm({ bill: selectedBill, reason: finalReason.trim() }); handleClose(); };
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white rounded-[2.5rem] max-w-2xl w-full max-h-[90vh] shadow-2xl overflow-hidden flex flex-col border border-white/20">
        <div className="bg-rose-500 p-6 text-white flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10"><div className="flex items-center gap-2 mb-1"><Trash2 size={18} className="text-rose-200" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-100">Cancel Management</span></div><h3 className="text-2xl font-black tracking-tight">{'\u0E8D\u0EBB\u0E81\u0EC0\u0EA5\u0EB5\u0E81\u0E9A\u0EB4\u0E99\u0E82\u0EB2\u0E8D'}</h3></div>
          <button onClick={handleClose} className="relative z-10 p-2 hover:bg-white/20 rounded-full transition-colors"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-slate-50/50">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{'\u0E84\u0EBB\u0EC9\u0E99\u0EAB\u0EB2\u0E9A\u0EB4\u0E99\u0E97\u0EB5\u0EC8\u0E95\u0EC9\u0EAD\u0E87\u0E81\u0EB2\u0E99\u0E8D\u0EBB\u0E81\u0EC0\u0EA5\u0EB5\u0E81'}</label>
            <div className="flex gap-2">
              <div className="relative flex-1 group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder={'\u0E9B\u0EC9\u0EAD\u0E99\u0EC0\u0EA5\u0E81\u0E9A\u0EB4\u0E99...'} className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white border-transparent focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono font-bold text-slate-700 shadow-sm" autoFocus />
              </div>
              <button onClick={handleSearch} disabled={isSearching} className="px-6 h-14 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:bg-slate-200 transition-all flex items-center gap-2 shadow-lg">
                {isSearching ? <Loader2 size={18} className="animate-spin" /> : '\u0E84\u0EBB\u0EC9\u0E99\u0EAB\u0EB2'}
              </button>
            </div>
          </div>
          {hasSearched && <div className="grid gap-2">{results.length > 0 ? results.map((bill: any) => (
            <button key={bill.doc_no} onClick={() => { setSelectedBill(bill); setConfirmCode(''); }} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${selectedBill?.doc_no === bill.doc_no ? 'bg-white border-blue-500 shadow-md ring-4 ring-blue-500/5' : 'bg-white border-transparent hover:border-slate-200'}`}>
              <div className="text-left"><div className="font-black text-slate-900 font-mono tracking-tight">{bill.doc_no}</div><div className="text-[10px] font-bold text-slate-400 uppercase mt-1">{bill.customer_name || '\u0EA5\u0EB9\u0E81\u0E84\u0EC9\u0EB2\u0E97\u0EBB\u0EC8\u0EA7\u0EC4\u0E9B'} &bull; {bill.item_count} items</div></div>
              <div className="text-right"><div className="font-black text-rose-500 text-lg">{(bill.grand_total || 0).toLocaleString()} ₭</div><div className="text-[10px] font-bold text-slate-300 flex items-center justify-end gap-1"><History size={10} /> {bill.doc_date}</div></div>
            </button>
          )) : <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-200"><p className="text-slate-400 font-bold text-sm">{'\u0E9A\u0ECD\u0EC8\u0E9E\u0EBB\u0E9A\u0E9A\u0EB4\u0E99'}</p></div>}</div>}
          {selectedBill && (
            <div className="space-y-6">
              <div className="h-px bg-slate-200 w-full" />
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-3">{'\u0EC0\u0EAB\u0E94\u0E9C\u0EBB\u0E99\u0E81\u0EB2\u0E99\u0E8D\u0EBB\u0E81\u0EC0\u0EA5\u0EB5\u0E81'}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{REASONS.map((r) => (
                  <button key={r} onClick={() => setSelectedReason(r)} className={`py-3 px-2 rounded-xl text-[11px] font-black transition-all border-2 ${selectedReason === r ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}>{r}</button>
                ))}</div></div>
              {selectedReason === '\u{1F4DD} \u0EAD\u0EB7\u0EC8\u0E99\u0EC6' && <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-2 border-slate-100 focus:border-blue-500 focus:outline-none text-sm font-medium resize-none" rows={2} />}
              <div className="bg-rose-50 rounded-[2rem] p-6 border border-rose-100">
                <div className="flex gap-3 mb-4"><div className="p-2 bg-rose-500 rounded-lg text-white h-fit"><AlertTriangle size={20} /></div><div><h4 className="text-sm font-black text-rose-900">{'\u0E8D\u0EB7\u0E99\u0E8D\u0EB1\u0E99\u0E81\u0EB2\u0E99\u0EA5\u0EB6\u0E9A\u0E9A\u0EB4\u0E99'}</h4><p className="text-[11px] font-bold text-rose-700/60">{'\u0E9E\u0EB4\u0EA1\u0EC0\u0EA5\u0E81\u0E9A\u0EB4\u0E99'} <span className="text-rose-600 bg-rose-200 px-1 rounded">{selectedBill.doc_no}</span></p></div></div>
                <input value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} placeholder={'\u0E9E\u0EB4\u0EA1\u0EC0\u0EA5\u0E81\u0E9A\u0EB4\u0E99...'} className="w-full h-14 bg-white rounded-2xl border-none focus:ring-4 focus:ring-rose-500/20 text-center font-mono font-black text-rose-600 text-xl placeholder:text-rose-200" />
              </div>
            </div>
          )}
        </div>
        <div className="p-6 bg-white border-t border-slate-100 flex gap-3">
          <button onClick={handleClose} className="flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">{'\u0E8D\u0EBB\u0E81\u0EC0\u0EA5\u0EB5\u0E81'}</button>
          <button onClick={onConfirmAction} disabled={!readyToConfirm} className={`flex-[2] h-14 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg ${readyToConfirm ? 'bg-rose-500 text-white shadow-rose-200 hover:bg-rose-600' : 'bg-slate-100 text-slate-300 shadow-none grayscale cursor-not-allowed'}`}>
            <CheckCircle2 size={18} />{'\u0E8D\u0EB7\u0E99\u0E8D\u0EB1\u0E99\u0E81\u0EB2\u0E99\u0EA5\u0EB6\u0E9A'}
          </button>
        </div>
      </div>
    </div>
  );
}
