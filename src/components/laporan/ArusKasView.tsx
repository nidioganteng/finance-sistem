"use client";

import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Wallet, Activity } from "lucide-react";

interface MonthlyRow {
  bulan: string;
  masuk: number;
  keluar: number;
  net: number;
  masukFmt: string;
  keluarFmt: string;
  netFmt: string;
  netPositive: boolean;
  hasData: boolean;
}

interface ArusKasViewProps {
  data: {
    monthly: MonthlyRow[];
    totalMasuk: number;
    totalKeluar: number;
    netTotal: number;
    totalMasukFmt: string;
    totalKeluarFmt: string;
    netTotalFmt: string;
    netTotalPositive: boolean;
    kasAwalFmt: string;
    kasOperasiFmt: string;
    kasInvestasiFmt: string;
    kasPendanaanFmt: string;
    kenaikanBersihFmt: string;
    kasAkhirFmt: string;
    kasOperasi: number;
    kasInvestasi: number;
    kasPendanaan: number;
    kenaikanBersihKas: number;
  };
  year: number;
  entityName: string;
}

export function ArusKasView({ data, year, entityName }: ArusKasViewProps) {
  const maxFlow = Math.max(
    ...data.monthly.map((m) => Math.max(m.masuk, m.keluar)),
    1
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header Laporan Resmi ── */}
      <div className="bg-surface-card border border-border-soft rounded-[22px] px-7 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-muted-faintest uppercase tracking-[0.16em]">
              {entityName}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-border-soft" />
            <span className="text-[11px] font-bold text-brand uppercase tracking-wider">Laporan Arus Kas</span>
          </div>
          <h2 className="text-[22px] font-extrabold text-navy-text mt-1">Laporan Arus Kas (Cash Flow)</h2>
          <p className="text-[13px] text-muted mt-1">
            Periode 1 Januari s/d 31 Desember {year} · Metode Arus Kas Aktivitas Operasi, Investasi & Pendanaan
          </p>
        </div>
        <div className="shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-extrabold shadow-xs ${
            data.netTotalPositive
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}>
            {data.netTotalPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {data.netTotalPositive ? "ARUS KAS SURPLUS" : "ARUS KAS DEFISIT"}
          </span>
        </div>
      </div>

      {/* ── Top Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
          <div className="text-[12px] font-bold text-muted-faint uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Total Kas Masuk</span>
            <ArrowUpRight size={16} className="text-status-green" />
          </div>
          <div className="text-[22px] font-extrabold text-status-green tabular-nums">{data.totalMasukFmt}</div>
          <div className="text-[11.5px] text-muted mt-2">Seluruh arus masuk kas & bank</div>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
          <div className="text-[12px] font-bold text-muted-faint uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Total Kas Keluar</span>
            <ArrowDownRight size={16} className="text-status-red" />
          </div>
          <div className="text-[22px] font-extrabold text-status-red tabular-nums">{data.totalKeluarFmt}</div>
          <div className="text-[11.5px] text-muted mt-2">Pengeluaran kas & bank tahun {year}</div>
        </div>

        <div className={`rounded-[20px] border p-5 shadow-xs ${
          data.netTotalPositive
            ? "bg-green-50/50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30"
            : "bg-red-50/50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30"
        }`}>
          <div className="text-[12px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className={data.netTotalPositive ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
              Net Cash Flow
            </span>
            <Activity size={16} className={data.netTotalPositive ? "text-status-green" : "text-status-red"} />
          </div>
          <div className={`text-[22px] font-extrabold tabular-nums ${
            data.netTotalPositive ? "text-status-green" : "text-status-red"
          }`}>
            {data.netTotalPositive ? "+" : "–"}{data.netTotalFmt}
          </div>
          <div className="text-[11.5px] text-muted-stronger mt-2 font-medium">
            Arus kas bersih periode berjalan
          </div>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
          <div className="text-[12px] font-bold text-muted-faint uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Saldo Akhir Kas & Bank</span>
            <Wallet size={16} className="text-brand" />
          </div>
          <div className="text-[22px] font-extrabold text-navy-text tabular-nums">{data.kasAkhirFmt}</div>
          <div className="text-[11.5px] text-muted mt-2">Posisi kas dan setara kas</div>
        </div>
      </div>

      {/* ── Rincian Aktivitas Arus Kas (Metode Akuntansi) ── */}
      <div className="bg-surface-card rounded-[22px] border border-border-soft shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-subtle bg-surface-subtle/40 flex items-center justify-between">
          <h3 className="text-[14px] font-extrabold text-navy-text uppercase tracking-wider">
            Rincian Arus Kas Berdasarkan Aktivitas
          </h3>
          <span className="text-[11px] font-bold text-muted-faint">Metode Tidak Langsung</span>
        </div>

        <div className="divide-y divide-surface-subtle">
          {/* Operasi */}
          <div className="p-5 flex items-center justify-between hover:bg-surface-hover/20 transition-colors">
            <div>
              <span className="text-[13px] font-bold text-navy-text">I. Arus Kas dari Aktivitas Operasi</span>
              <p className="text-[12px] text-muted mt-0.5">Laba bersih disesuaikan perubahan modal kerja dan kewajiban</p>
            </div>
            <span className={`text-[14px] font-bold tabular-nums ${data.kasOperasi >= 0 ? "text-status-green" : "text-status-red"}`}>
              {data.kasOperasi >= 0 ? "+" : "–"}{data.kasOperasiFmt}
            </span>
          </div>

          {/* Investasi */}
          <div className="p-5 flex items-center justify-between hover:bg-surface-hover/20 transition-colors">
            <div>
              <span className="text-[13px] font-bold text-navy-text">II. Arus Kas dari Aktivitas Investasi</span>
              <p className="text-[12px] text-muted mt-0.5">Perolehan atau pelepasan aset tetap dan investasi jangka panjang</p>
            </div>
            <span className="text-[14px] font-bold tabular-nums text-muted-stronger">
              {data.kasInvestasiFmt}
            </span>
          </div>

          {/* Pendanaan */}
          <div className="p-5 flex items-center justify-between hover:bg-surface-hover/20 transition-colors">
            <div>
              <span className="text-[13px] font-bold text-navy-text">III. Arus Kas dari Aktivitas Pendanaan</span>
              <p className="text-[12px] text-muted mt-0.5">Penerimaan modal saham, dividen, dan pendanaan ekuitas</p>
            </div>
            <span className={`text-[14px] font-bold tabular-nums ${data.kasPendanaan >= 0 ? "text-status-green" : "text-status-red"}`}>
              {data.kasPendanaan >= 0 ? "+" : "–"}{data.kasPendanaanFmt}
            </span>
          </div>

          {/* Net */}
          <div className="p-5 bg-surface-subtle/60 flex items-center justify-between font-extrabold border-t-2 border-border-soft">
            <span className="text-[13.5px] text-navy-text uppercase">Kenaikan / (Penurunan) Bersih Kas</span>
            <span className={`text-[16px] tabular-nums ${data.kenaikanBersihKas >= 0 ? "text-status-green" : "text-status-red"}`}>
              {data.kenaikanBersihKas >= 0 ? "+" : "–"}{data.kenaikanBersihFmt}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tabel Rekapitulasi Arus Kas Bulanan (12 Bulan) ── */}
      <div className="bg-surface-card rounded-[22px] border border-border-soft shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-subtle bg-surface-subtle/30 flex items-center justify-between">
          <h3 className="text-[14px] font-extrabold text-navy-text uppercase tracking-wider">
            Tren Arus Kas Bulanan (Januari – Desember {year})
          </h3>
          <span className="text-[11.5px] font-bold text-muted-faint">12 Periode Bulan</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint uppercase tracking-wider bg-surface-subtle/50">
                <th className="py-3.5 px-6">Bulan</th>
                <th className="py-3.5 px-4 text-right">Kas Masuk</th>
                <th className="py-3.5 px-4 text-right">Kas Keluar</th>
                <th className="py-3.5 px-4 text-right">Net Flow</th>
                <th className="py-3.5 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-subtle">
              {data.monthly.map((m) => (
                <tr key={m.bulan} className={`hover:bg-surface-hover/30 transition-colors ${!m.hasData ? "opacity-40" : ""}`}>
                  <td className="py-3.5 px-6 font-bold text-[13px] text-navy-text">{m.bulan}</td>
                  <td className="py-3.5 px-4 text-right text-[13px] font-semibold text-status-green tabular-nums">
                    {m.masukFmt}
                  </td>
                  <td className="py-3.5 px-4 text-right text-[13px] font-semibold text-status-red tabular-nums">
                    {m.keluarFmt}
                  </td>
                  <td className={`py-3.5 px-4 text-right text-[13.5px] font-bold tabular-nums ${
                    m.netPositive ? "text-status-green" : "text-status-red"
                  }`}>
                    {m.hasData ? (m.netPositive ? "+" : "–") + m.netFmt : "—"}
                  </td>
                  <td className="py-3.5 px-6 text-center">
                    {m.hasData ? (
                      <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-extrabold ${
                        m.netPositive
                          ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
                      }`}>
                        {m.netPositive ? "Surplus" : "Defisit"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-subtle/70 font-black border-t-2 border-border-soft text-navy-text">
                <td className="py-4 px-6 text-[13px] uppercase">Total Tahun {year}</td>
                <td className="py-4 px-4 text-right text-[14px] text-status-green tabular-nums">
                  {data.totalMasukFmt}
                </td>
                <td className="py-4 px-4 text-right text-[14px] text-status-red tabular-nums">
                  {data.totalKeluarFmt}
                </td>
                <td className={`py-4 px-4 text-right text-[15px] tabular-nums ${
                  data.netTotalPositive ? "text-status-green" : "text-status-red"
                }`}>
                  {data.netTotalPositive ? "+" : "–"}{data.netTotalFmt}
                </td>
                <td className="py-4 px-6 text-center">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${
                    data.netTotalPositive
                      ? "bg-green-500 text-white"
                      : "bg-red-500 text-white"
                  }`}>
                    {data.netTotalPositive ? "Total Surplus" : "Total Defisit"}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
