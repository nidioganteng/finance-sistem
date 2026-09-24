"use client";

import { TrendingUp, TrendingDown, Percent, Award, ArrowUpRight, ArrowDownRight, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import type { CoaLine } from "@/lib/laporan-keuangan";
import { getMetricValueFontSize } from "@/lib/dashboard-data";

interface LabaRugiViewProps {
  data: {
    pendapatan: CoaLine[];
    beban: CoaLine[];
    totalPendapatan: number;
    totalBeban: number;
    labaBersih: number;
    totalPendapatanFmt: string;
    totalBebanFmt: string;
    labaBersihFmt: string;
    labaBersihPositive: boolean;
  };
  year: number;
  entityName: string;
}

export function LabaRugiView({ data, year, entityName }: LabaRugiViewProps) {
  const marginPct =
    data.totalPendapatan > 0
      ? (data.labaBersih / data.totalPendapatan) * 100
      : 0;
  const costRatio =
    data.totalPendapatan > 0
      ? (data.totalBeban / data.totalPendapatan) * 100
      : 0;

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
            <span className="text-[11px] font-bold text-brand uppercase tracking-wider">Laporan Keuangan</span>
          </div>
          <h2 className="text-[22px] font-extrabold text-navy-text mt-1">Laporan Laba Rugi Komprehensif</h2>
          <p className="text-[13px] text-muted mt-1">
            Periode Akuntansi 1 Januari s/d 31 Desember {year} · Standar Pelaporan Akuntansi SAK
          </p>
        </div>
        <div className="shrink-0 flex flex-wrap items-center gap-2.5">
          <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-extrabold shadow-xs ${
            data.labaBersihPositive
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}>
            {data.labaBersihPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {data.labaBersihPositive ? "SURPLUS BERSIH (LABA)" : "DEFISIT BERSIH (RUGI)"}
          </span>
        </div>
      </div>

      {/* ── Top Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-2 text-[12px] font-bold text-muted-faint uppercase tracking-wider">
            <span className="truncate">Total Pendapatan</span>
            <TrendingUp size={16} className="text-status-green flex-none" />
          </div>
          <div className={`${getMetricValueFontSize(data.totalPendapatanFmt)} text-status-green truncate`} title={data.totalPendapatanFmt}>
            {data.totalPendapatanFmt}
          </div>
          <div className="text-[11.5px] text-muted mt-2 truncate">100% dari basis omzet</div>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-2 text-[12px] font-bold text-muted-faint uppercase tracking-wider">
            <span className="truncate">Total Beban Usaha</span>
            <TrendingDown size={16} className="text-status-red flex-none" />
          </div>
          <div className={`${getMetricValueFontSize(data.totalBebanFmt)} text-status-red truncate`} title={data.totalBebanFmt}>
            {data.totalBebanFmt}
          </div>
          <div className="text-[11.5px] text-muted mt-2 truncate">{costRatio.toFixed(1)}% dari total pendapatan</div>
        </div>

        <div className={`rounded-[20px] border p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden ${
          data.labaBersihPositive
            ? "bg-green-50/50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30"
            : "bg-red-50/50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30"
        }`}>
          <div className="flex items-center justify-between gap-2 mb-2 text-[12px] font-bold uppercase tracking-wider">
            <span className={`truncate ${data.labaBersihPositive ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
              {data.labaBersihPositive ? "Laba Bersih" : "Rugi Bersih"}
            </span>
            <Award size={16} className={`flex-none ${data.labaBersihPositive ? "text-status-green" : "text-status-red"}`} />
          </div>
          <div className={`${getMetricValueFontSize(data.labaBersihFmt)} ${
            data.labaBersihPositive ? "text-status-green" : "text-status-red"
          } truncate`} title={(data.labaBersihPositive ? "" : "–") + data.labaBersihFmt}>
            {data.labaBersihPositive ? "" : "–"}{data.labaBersihFmt}
          </div>
          <div className="text-[11.5px] text-muted-stronger mt-2 font-medium truncate">
            Laba/Rugi tahun berjalan {year}
          </div>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-2 text-[12px] font-bold text-muted-faint uppercase tracking-wider">
            <span className="truncate">Net Profit Margin</span>
            <Percent size={16} className="text-brand flex-none" />
          </div>
          <div className={`text-[19px] sm:text-[21px] font-extrabold tabular-nums truncate ${
            marginPct >= 0 ? "text-status-green" : "text-status-red"
          }`}>
            {marginPct.toFixed(1)}%
          </div>
          <div className="text-[11.5px] text-muted mt-2 truncate">Efisiensi margin operasional</div>
        </div>
      </div>

      {/* ── Main Breakdown Tables: Pendapatan & Beban ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pendapatan */}
        <div className="bg-surface-card rounded-[22px] border border-border-soft shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-surface-subtle bg-green-50/40 dark:bg-green-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-5 rounded-full bg-green-500" />
                <span className="text-[13px] font-extrabold text-green-800 dark:text-green-400 uppercase tracking-wider">
                  I. Pendapatan Usaha
                </span>
              </div>
              <span className="text-[11px] font-bold text-muted-faint">{data.pendapatan.length} Akun</span>
            </div>

            <div className="divide-y divide-surface-subtle">
              {data.pendapatan.length === 0 ? (
                <p className="py-8 px-6 text-center text-[13px] text-muted italic">Tidak ada transaksi akun pendapatan.</p>
              ) : (
                data.pendapatan.map((item) => {
                  const sharePct = data.totalPendapatan > 0 ? (item.saldo / data.totalPendapatan) * 100 : 0;
                  return (
                    <div key={item.code} className="px-6 py-3.5 hover:bg-surface-hover/30 transition-colors">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <code className="text-[11px] font-mono text-muted-faint shrink-0">[{item.code}]</code>
                          <span className="text-[13px] font-semibold text-navy-text truncate">{item.name}</span>
                        </div>
                        <span className="text-[13.5px] font-bold text-status-green tabular-nums shrink-0 whitespace-nowrap">
                          {item.saldoFmt}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(2, sharePct))}%` }}
                          />
                        </div>
                        <span className="text-[10.5px] font-medium text-muted shrink-0 tabular-nums">
                          {sharePct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="px-6 py-4 bg-green-50/70 dark:bg-green-500/15 border-t-2 border-green-200 dark:border-green-500/30 flex items-center justify-between">
            <span className="text-[13.5px] font-extrabold text-green-900 dark:text-green-300 uppercase">
              Total Pendapatan Usaha
            </span>
            <span className="text-[16px] font-black text-status-green tabular-nums whitespace-nowrap">
              {data.totalPendapatanFmt}
            </span>
          </div>
        </div>

        {/* Beban */}
        <div className="bg-surface-card rounded-[22px] border border-border-soft shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-surface-subtle bg-red-50/40 dark:bg-red-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-5 rounded-full bg-red-500" />
                <span className="text-[13px] font-extrabold text-red-800 dark:text-red-400 uppercase tracking-wider">
                  II. Beban Operasional & Usaha
                </span>
              </div>
              <span className="text-[11px] font-bold text-muted-faint">{data.beban.length} Akun</span>
            </div>

            <div className="divide-y divide-surface-subtle max-h-[500px] overflow-y-auto">
              {data.beban.length === 0 ? (
                <p className="py-8 px-6 text-center text-[13px] text-muted italic">Tidak ada transaksi akun beban.</p>
              ) : (
                data.beban.map((item) => {
                  const sharePct = data.totalBeban > 0 ? (item.saldo / data.totalBeban) * 100 : 0;
                  return (
                    <div key={item.code} className="px-6 py-3.5 hover:bg-surface-hover/30 transition-colors">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <code className="text-[11px] font-mono text-muted-faint shrink-0">[{item.code}]</code>
                          <span className="text-[13px] font-semibold text-navy-text truncate">{item.name}</span>
                        </div>
                        <span className="text-[13.5px] font-bold text-status-red tabular-nums shrink-0 whitespace-nowrap">
                          {item.saldoFmt}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(2, sharePct))}%` }}
                          />
                        </div>
                        <span className="text-[10.5px] font-medium text-muted shrink-0 tabular-nums">
                          {sharePct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="px-6 py-4 bg-red-50/70 dark:bg-red-500/15 border-t-2 border-red-200 dark:border-red-500/30 flex items-center justify-between">
            <span className="text-[13.5px] font-extrabold text-red-900 dark:text-red-300 uppercase">
              Total Beban Usaha
            </span>
            <span className="text-[16px] font-black text-status-red tabular-nums whitespace-nowrap">
              {data.totalBebanFmt}
            </span>
          </div>
        </div>
      </div>

      {/* ── Rekapitulasi Akhir / Bottom Banner ── */}
      <div className={`rounded-[24px] border-2 p-7 shadow-sm ${
        data.labaBersihPositive
          ? "bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-transparent border-green-300 dark:border-green-500/40"
          : "bg-gradient-to-r from-red-500/10 via-rose-500/10 to-transparent border-red-300 dark:border-red-500/40"
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className={`text-[11px] font-extrabold uppercase tracking-widest ${
              data.labaBersihPositive ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
            }`}>
              Hasil Akhir Laporan Keuangan
            </span>
            <h3 className="text-[20px] font-extrabold text-navy-text mt-0.5">
              {data.labaBersihPositive ? "Laba Bersih Tahun Berjalan" : "Rugi Bersih Tahun Berjalan"}
            </h3>
            <p className="text-[13px] text-muted mt-1">
              Dihitung dari Total Pendapatan ({data.totalPendapatanFmt}) dikurangi Total Beban ({data.totalBebanFmt})
            </p>
          </div>

          <div className="text-right">
            <div className={`text-[32px] font-black tabular-nums leading-none ${
              data.labaBersihPositive ? "text-status-green" : "text-status-red"
            }`}>
              {data.labaBersihPositive ? "" : "–"}{data.labaBersihFmt}
            </div>
            <div className="text-[12px] font-bold text-muted-stronger mt-2">
              Margin Bersih: {marginPct.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
