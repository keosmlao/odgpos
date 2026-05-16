"use client";
import {
  Search, Pause, RotateCcw, Package, Trash2, ClipboardList, Printer,
  Monitor, Bell,
} from "lucide-react";

export type LeftRailAction = {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick?: () => void;
  badge?: number;
  active?: boolean;
  hint?: string;
  hidden?: boolean;
};

type Props = {
  actions: LeftRailAction[];
  divider?: string[]; // ids after which to render a divider
};

function RailButton({ action }: { action: LeftRailAction }) {
  const { icon: Icon, label, onClick, badge = 0, active = false, hint } = action;
  return (
    <button
      onClick={onClick}
      title={hint || label}
      className={`group relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
        active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <Icon size={16} strokeWidth={2} />
      {badge > 0 ? (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
      <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 transition-all z-50 shadow-lg">
        {label}
      </span>
    </button>
  );
}

export default function LeftRail({ actions, divider = [] }: Props) {
  const visible = actions.filter((a) => !a.hidden);
  return (
    <aside className="hidden md:flex flex-col items-center gap-1 py-3 px-1.5 border-r border-slate-200 bg-white w-14 shrink-0">
      {visible.map((action, idx) => (
        <div key={action.id} className="contents">
          <RailButton action={action} />
          {divider.includes(action.id) && idx < visible.length - 1 ? (
            <div className="my-1 h-px w-6 bg-slate-200" />
          ) : null}
        </div>
      ))}
    </aside>
  );
}

// Re-export icons commonly used so callers don't have to import lucide directly
export const RailIcons = {
  Search, Pause, RotateCcw, Package, Trash2, ClipboardList, Printer, Monitor, Bell,
};
