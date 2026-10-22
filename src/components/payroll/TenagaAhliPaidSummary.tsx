import type { RiwayatGajiTenagaAhliItem } from "@/lib/payroll";

const money = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
const label = (period: string) => new Date(`${period}-01T12:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

export function TenagaAhliPaidSummary({ history = [], year }: { history?: RiwayatGajiTenagaAhliItem[]; year: number }) {
  const payments = [...new Map(history.filter(item => item.tahun === year).map(item => [item.id, item])).values()];
  const months = new Map<string, number>();
  for (const payment of payments) {
    const period = `${payment.tahun}-${String(payment.bulan).padStart(2, "0")}`;
    months.set(period, (months.get(period) || 0) + payment.nominalHonor);
  }
  const entries = [...months].sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return <p className="text-xs font-normal text-muted-faint">Belum ada pembayaran {year}</p>;
  function MonthRows({ items }: { items: typeof entries }) {
    return <div className="space-y-1">{items.map(([period, amount]) => <div key={period} className="flex items-baseline justify-between gap-3 text-[11px]"><span className="font-normal text-muted-faint">{label(period)}</span><span className="font-mono tabular-nums">{money(amount)}</span></div>)}</div>;
  }
  return <div className="min-w-[210px] space-y-2 text-left">
    <div><p className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{money(payments.reduce((sum, item) => sum + item.nominalHonor, 0))}</p><p className="mt-0.5 text-[10px] font-normal text-muted-faint">Seluruh proyek · {entries.length} bulan · {year}</p></div>
    <MonthRows items={entries.slice(0, 3)} />
    {entries.length > 3 && <details className="text-[11px]"><summary className="cursor-pointer font-semibold text-navy-text">Lihat {entries.length - 3} bulan lainnya</summary><div className="mt-2"><MonthRows items={entries.slice(3)} /></div></details>}
  </div>;
}
