import Link from "next/link";
import { formatMiliar } from "@/lib/dashboard-data";

// Compact card untuk Master Dashboard (grup view)
export function EntityCardCompact({
  entityKey,
  name,
  legalName,
  colorHex,
  revenue,
  profit,
  isUmum = false,
}: {
  entityKey: string;
  name: string;
  legalName: string;
  colorHex: string;
  revenue: number;
  profit: number;
  isUmum?: boolean;
}) {
  return (
    <Link href={`/dashboard?entity=${entityKey}`} className="block">
      <div
        className="bg-surface-card rounded-2xl border border-border p-4 flex flex-col gap-3 hover:shadow-[0_4px_16px_rgba(15,23,42,.06)] transition-shadow"
        style={{ borderLeft: `4px solid ${colorHex}` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-none"
            style={{ background: colorHex }}
          >
            {name[0]}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-navy-text truncate">{name}</div>
            {isUmum && (
              <div className="text-[10.5px] text-muted truncate">{legalName}</div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-faint font-semibold">Pendapatan</span>
            <span className="text-[12.5px] font-bold text-navy-text tabular-nums">{formatMiliar(revenue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-faint font-semibold">Laba Bersih</span>
            <span className={`text-[12.5px] font-bold tabular-nums ${profit >= 0 ? "text-status-green" : "text-status-red"}`}>
              {formatMiliar(profit)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Full card untuk tampilan per-entitas (detail)
export function EntityCard({
  entityKey,
  name,
  legalName,
  colorHex,
  revenue,
  spend,
  profit,
  interactive = true,
}: {
  entityKey: string;
  name: string;
  legalName: string;
  colorHex: string;
  revenue: number;
  spend: number;
  profit: number;
  interactive?: boolean;
}) {
  const content = (
    <div
      className={`bg-surface-card rounded-2xl border border-border p-5 flex flex-col gap-3 ${
        interactive ? "hover:shadow-[0_4px_16px_rgba(15,23,42,.06)] transition-shadow" : ""
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-none"
          style={{ background: colorHex }}
        >
          {name[0]}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-navy-text truncate">{name}</div>
          <div className="text-[11px] text-muted truncate">{legalName}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div>
          <div className="text-[10.5px] text-muted-faint font-semibold">Pendapatan</div>
          <div className="text-[12.5px] font-bold text-navy-text mt-0.5">{formatMiliar(revenue)}</div>
        </div>
        <div>
          <div className="text-[10.5px] text-muted-faint font-semibold">Pengeluaran</div>
          <div className="text-[12.5px] font-bold text-navy-text mt-0.5">{formatMiliar(spend)}</div>
        </div>
        <div>
          <div className="text-[10.5px] text-muted-faint font-semibold">Laba</div>
          <div className={`text-[12.5px] font-bold mt-0.5 ${profit >= 0 ? "text-status-green" : "text-status-red"}`}>
            {formatMiliar(profit)}
          </div>
        </div>
      </div>
    </div>
  );

  if (!interactive) return content;

  return (
    <Link href={`/dashboard?entity=${entityKey}`} className="block">
      {content}
    </Link>
  );
}
