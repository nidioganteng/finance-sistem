import Link from "next/link";
import { TrendingUp, TrendingDown, Scale, Waves, ArrowRight } from "lucide-react";

type LaporanData = {
  // Laba Rugi
  totalPendapatan: number;
  totalBeban: number;
  labaBersih: number;
  totalPendapatanFmt: string;
  totalBebanFmt: string;
  labaBersihFmt: string;
  labaBersihPositive: boolean;
  // Neraca
  totalAset: number;
  totalKewajiban: number;
  totalModal: number;
  totalPassiva: number;
  neracaBalanced: boolean;
  totalAsetFmt: string;
  totalKewajibanFmt: string;
  totalModalFmt: string;
  // Arus Kas
  kasOperasi: number;
  kasInvestasi: number;
  kasPendanaan: number;
  kenaikanBersihKas: number;
  kasAkhir: number;
  kasAkhirFmt: string;
  kasOperasiFmt: string;
  kasInvestasiFmt: string;
  kenaikanBersihFmt: string;
};

function pct(a: number, b: number) {
  if (b === 0) return 0;
  return Math.round((a / b) * 100);
}

function MetricRow({ label, value, sub, color = "text-navy-text" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-surface-subtle last:border-0">
      <span className="text-[12.5px] text-muted-stronger">{label}</span>
      <div className="text-right">
        <div className={`text-[13px] font-bold tabular-nums ${color}`}>{value}</div>
        {sub && <div className="text-[10.5px] text-muted-faint">{sub}</div>}
      </div>
    </div>
  );
}

export function EntityFinancialSummary({
  data,
  entityKey,
  year,
}: {
  data: LaporanData;
  entityKey: string;
  year: number;
}) {
  const margin = data.totalPendapatan > 0
    ? ((data.labaBersih / data.totalPendapatan) * 100).toFixed(1)
    : "0.0";

  const bebanRatio = pct(data.totalBeban, data.totalPendapatan);

  const laporanHref = `/laporan?entity=${entityKey}&year=${year}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Section title */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-navy-text">Ringkasan Laporan Keuangan {year}</div>
        <Link
          href={`${laporanHref}&tab=ringkasan`}
          className="flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline"
        >
          Lihat detail <ArrowRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ── Laba Rugi ───────────────────────────────────────────── */}
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            {data.labaBersihPositive
              ? <TrendingUp size={15} className="text-status-green" />
              : <TrendingDown size={15} className="text-status-red" />}
            <span className="text-[12px] font-bold text-muted-faint uppercase tracking-wide">Laba Rugi</span>
          </div>

          {/* Mini laba rugi overview */}
          <div className="mb-3">
            <div className="text-[11px] text-muted-faint mb-1 flex justify-between">
              <span>Beban / Pendapatan</span>
              <span>{bebanRatio}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${bebanRatio > 100 ? "bg-status-red" : bebanRatio > 80 ? "bg-status-amber" : "bg-status-green"}`}
                style={{ width: `${Math.min(bebanRatio, 100)}%` }}
              />
            </div>
          </div>

          <MetricRow label="Pendapatan" value={data.totalPendapatanFmt} color="text-status-green" />
          <MetricRow label="Beban" value={data.totalBebanFmt} color="text-status-red" />
          <MetricRow
            label={data.labaBersihPositive ? "Laba Bersih" : "Rugi Bersih"}
            value={(data.labaBersihPositive ? "" : "-") + data.labaBersihFmt}
            sub={`Margin ${margin}%`}
            color={data.labaBersihPositive ? "text-status-green" : "text-status-red"}
          />

          <Link href={`${laporanHref}&tab=laba-rugi`} className="mt-3 flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline">
            Lihat Laba Rugi <ArrowRight size={11} />
          </Link>
        </div>

        {/* ── Neraca ──────────────────────────────────────────────── */}
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Scale size={15} className="text-brand" />
              <span className="text-[12px] font-bold text-muted-faint uppercase tracking-wide">Neraca</span>
            </div>
            {data.neracaBalanced
              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">Seimbang</span>
              : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">Tidak Seimbang</span>}
          </div>

          <MetricRow label="Total Aktiva" value={data.totalAsetFmt} color="text-brand" />
          <MetricRow label="Total Kewajiban" value={data.totalKewajibanFmt} color="text-status-red" />
          <MetricRow label="Modal & Ekuitas" value={data.totalModalFmt} color="text-status-green" />

          {/* Aktiva = Pasiva bar */}
          {data.totalPassiva > 0 && (
            <div className="mt-3 mb-1">
              <div className="text-[11px] text-muted-faint mb-1">Komposisi Pasiva</div>
              <div className="h-2 rounded-full overflow-hidden flex">
                <div
                  className="bg-status-red h-full"
                  style={{ width: `${pct(data.totalKewajiban, data.totalPassiva)}%` }}
                />
                <div
                  className="bg-status-green h-full flex-1"
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-faint mt-0.5">
                <span>Kewajiban {pct(data.totalKewajiban, data.totalPassiva)}%</span>
                <span>Ekuitas {pct(data.totalModal, data.totalPassiva)}%</span>
              </div>
            </div>
          )}

          <Link href={`${laporanHref}&tab=neraca`} className="mt-2 flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline">
            Lihat Neraca <ArrowRight size={11} />
          </Link>
        </div>

        {/* ── Arus Kas ────────────────────────────────────────────── */}
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Waves size={15} className={data.kenaikanBersihKas >= 0 ? "text-status-green" : "text-status-red"} />
            <span className="text-[12px] font-bold text-muted-faint uppercase tracking-wide">Arus Kas</span>
          </div>

          <MetricRow
            label="Aktivitas Operasi"
            value={(data.kasOperasi >= 0 ? "+" : "") + data.kasOperasiFmt?.replace("Rp ", "")}
            color={data.kasOperasi >= 0 ? "text-status-green" : "text-status-red"}
          />
          <MetricRow
            label="Aktivitas Investasi"
            value={(data.kasInvestasi >= 0 ? "+" : "-") + data.kasInvestasiFmt?.replace("Rp ", "")}
            color={data.kasInvestasi >= 0 ? "text-status-green" : "text-status-red"}
          />
          <MetricRow
            label="Kenaikan Bersih"
            value={(data.kenaikanBersihKas >= 0 ? "+" : "-") + data.kenaikanBersihFmt}
            color={data.kenaikanBersihKas >= 0 ? "text-status-green" : "text-status-red"}
          />
          <MetricRow
            label="Saldo Kas Akhir"
            value={data.kasAkhirFmt}
            color="text-navy-text"
          />

          <Link href={`${laporanHref}&tab=arus-kas`} className="mt-3 flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline">
            Lihat Arus Kas <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}
