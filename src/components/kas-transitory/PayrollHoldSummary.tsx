import Link from "next/link";
import type { TransitoryItem } from "@/lib/kas-transitory";

export function PayrollHoldSummary({ items, entityKey }: { items: TransitoryItem[]; entityKey: string }) {
  const holds = items.filter(item => item.category === "GAJI_HOLD" && item.remaining > 0);
  if (!holds.length) return null;
  const total = holds.reduce((sum, item) => sum + item.remaining, 0);
  return <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
    <summary className="cursor-pointer font-semibold">Gaji ditahan di Kas Transitory: Rp {total.toLocaleString("id-ID")} · {holds.length} dana</summary>
    <p className="mt-2 leading-relaxed">Pembayaran sudah tercatat sebagai cash out, tetapi dana berikut belum diserahkan kepada penerima. Ringkasan mencakup seluruh periode sampai dana diserahkan atau dibatalkan.</p>
    <ul className="mt-2 space-y-1">{holds.map(item => <li key={item.id}>{item.recipient} · {item.projectCode || "Non-proyek"} · Rp {item.remaining.toLocaleString("id-ID")} · {item.balanced ? item.status === "OVERDUE" ? "Lewat target" : "Ditahan" : "Unbalanced"}{!item.payrollId ? " · Belum ditautkan ke payroll" : ""}</li>)}</ul>
    <Link href={`/kas-transitory?entity=${encodeURIComponent(entityKey)}`} className="mt-2 inline-block font-semibold underline underline-offset-2">Buka monitoring dan pencairan Kas Transitory →</Link>
  </details>;
}
