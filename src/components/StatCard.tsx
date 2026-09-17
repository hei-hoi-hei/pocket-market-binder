import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
  sub?: string;
}

/** A compact stat tile for the collection overview. */
export function StatCard({ label, value, icon: Icon, accent = 'text-leather-700', sub }: Props) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-parchment-200 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-leather-500">{label}</span>
      </div>
      <span className="font-display text-xl text-leather-800 leading-tight">{value}</span>
      {sub && <span className="text-[10px] text-leather-400">{sub}</span>}
    </div>
  );
}
