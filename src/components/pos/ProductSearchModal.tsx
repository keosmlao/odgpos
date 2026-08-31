"use client";
import { Search, X } from "lucide-react";

const fmt = (n: number) => (Number(n) || 0).toLocaleString();

type Product = { id?: string; name?: string; price?: number; stock?: number | null };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onClear: () => void;
  results: Product[];
  isSearching: boolean;
  onSelect: (product: Product) => void;
};

export default function ProductSearchModal({
  isOpen, onClose, searchTerm, onSearchTermChange, onClear, results, isSearching, onSelect,
}: Props) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-900/40 p-4 pt-[8vh] backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 h-14 border-b border-slate-100">
          <Search size={18} className="text-slate-400" />
          <input
            autoFocus
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Search by name or barcode…"
            className="flex-1 h-full bg-transparent text-[15px] font-medium text-slate-800 placeholder:text-slate-400 outline-none"
          />
          {searchTerm ? (
            <button
              onClick={onClear}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-700 transition-colors"
            >
              CLEAR
            </button>
          ) : null}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {isSearching ? (
            <div className="p-8 text-center text-[13px] text-slate-400 font-medium">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-slate-400 font-medium">
              {searchTerm ? "No products found" : "Type to search products"}
            </div>
          ) : (
            results.map((product, idx) => {
              // Stock is only known for stock-tracked items; null means "no figure",
              // which must not read as "out of stock".
              const stock = Number.isFinite(Number(product.stock)) ? Number(product.stock) : null;
              const outOfStock = stock !== null && stock <= 0;
              return (
                <button
                  key={(product.id as string) || idx}
                  disabled={outOfStock}
                  onClick={() => { onSelect(product); onClose(); }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 border-b border-slate-50 last:border-0 transition-colors text-left ${
                    outOfStock ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-slate-800 truncate">{product.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-slate-400">#{product.id}</span>
                      {stock !== null ? (
                        <span
                          className={`text-[10px] font-bold ${outOfStock ? "text-rose-500" : "text-emerald-600"}`}
                        >
                          {outOfStock ? "ໝົດສະຕ໋ອກ" : `ສະຕ໋ອກ: ${fmt(stock)}`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-[14px] font-black tabular-nums text-slate-900 shrink-0">
                    {fmt(Number(product.price) || 0)}&nbsp;<span className="text-slate-400 text-[11px]">₭</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
