import Link from "next/link";
import { formatRupiah } from "@/lib/dashboard-data";

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
      className={`bg-white rounded-2xl border border-border p-5 flex flex-col gap-3 ${
        interactive ? "hover:shadow-[0_4px_16px_rgba(15,23,42,.06)] transition-shadow" : "opacity-55 pointer-events-none"
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
          <div className="text-[12.5px] font-bold text-navy-text mt-0.5">{formatRupiah(revenue)}</div>
        </div>
        <div>
          <div className="text-[10.5px] text-muted-faint font-semibold">Pengeluaran</div>
          <div className="text-[12.5px] font-bold text-navy-text mt-0.5">{formatRupiah(spend)}</div>
        </div>
        <div>
          <div className="text-[10.5px] text-muted-faint font-semibold">Laba</div>
          <div className={`text-[12.5px] font-bold mt-0.5 ${profit >= 0 ? "text-status-green" : "text-status-red"}`}>
            {formatRupiah(profit)}
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
