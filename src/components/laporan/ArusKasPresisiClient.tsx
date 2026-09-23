"use client";

import React, { useState } from "react";
import { Download, Printer, CheckCircle2, TrendingUp, TrendingDown, FileSpreadsheet, AlertTriangle } from "lucide-react";
import type { ArusKasPresisiData } from "@/lib/arus-kas-presisi";
import { formatRupiahArusKas } from "@/lib/arus-kas-presisi";

interface ArusKasPresisiClientProps {
  data: ArusKasPresisiData;
  entityId: string;
}

export function ArusKasPresisiClient({ data, entityId }: ArusKasPresisiClientProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = () => {
    setIsExporting(true);
    const url = `/api/arus-kas/export?entityId=${encodeURIComponent(entityId)}&year=${data.year}&version=${data.version}`;
    window.location.href = url;
    setTimeout(() => setIsExporting(false), 2000);
  };

  const isPositive = data.kenaikanBersihKas >= 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header Laporan Resmi (Sesuai Desain Standar) ── */}
      <div className="bg-surface-card border border-border-soft rounded-[22px] px-7 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-muted-faintest uppercase tracking-[0.16em]">
              {data.entityName}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-border-soft" />
            <span className="text-[11px] font-bold text-brand uppercase tracking-wider">
              Laporan Arus Kas
            </span>
          </div>
          <h2 className="text-[22px] font-extrabold text-navy-text mt-1">Arus Kas (Cash Flow)</h2>
          <p className="text-[13px] text-muted mt-1">
            Arus Kas Aktivitas Operasi, Investasi, & Pendanaan Periode {data.year} · Metode Tidak Langsung · Standar SAK
          </p>
        </div>
        <div className="shrink-0 flex flex-wrap items-center gap-2.5 print:hidden">
          <span
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12.5px] font-extrabold shadow-xs ${
              isPositive
                ? "bg-green-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            {isPositive ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {isPositive ? "ARUS KAS SURPLUS" : "ARUS KAS DEFISIT"}
          </span>
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            {isExporting ? "Menyiapkan..." : "Ekspor Excel"}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-muted-stronger bg-surface-card border border-border-soft hover:bg-surface-hover active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <Printer size={15} />
            Cetak PDF
          </button>
        </div>
      </div>

      {/* ── Top Metric Cards (Sesuai Desain Standar) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
          <div className="text-[12px] font-bold text-muted-faint uppercase tracking-wider mb-2">Total Arus Kas Operasi</div>
          <div className="text-[22px] font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
            {formatRupiahArusKas(data.totalArusKasOperasi)}
          </div>
          <div className="text-[11.5px] text-muted mt-2">Laba operasi & modal kerja</div>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
          <div className="text-[12px] font-bold text-muted-faint uppercase tracking-wider mb-2">Total Arus Kas Investasi</div>
          <div className="text-[22px] font-extrabold text-orange-600 dark:text-orange-400 tabular-nums">
            {formatRupiahArusKas(data.totalArusKasInvestasi)}
          </div>
          <div className="text-[11.5px] text-muted mt-2">Perolehan aset tetap tahun berjalan</div>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
          <div className="text-[12px] font-bold text-muted-faint uppercase tracking-wider mb-2">Total Arus Kas Pendanaan</div>
          <div className="text-[22px] font-extrabold text-violet-600 dark:text-violet-400 tabular-nums">
            {formatRupiahArusKas(data.totalArusKasPendanaan)}
          </div>
          <div className="text-[11.5px] text-muted mt-2">Laba ditahan & ekuitas modal</div>
        </div>

        <div
          className={`rounded-[20px] border p-5 shadow-xs ${
            isPositive
              ? "bg-green-50/50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30"
              : "bg-red-50/50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30"
          }`}
        >
          <div className="text-[12px] font-bold uppercase tracking-wider mb-2">
            <span className={isPositive ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
              Kas & Setara Kas Akhir
            </span>
          </div>
          <div className={`text-[20px] font-extrabold tabular-nums ${isPositive ? "text-status-green" : "text-status-red"}`}>
            {formatRupiahArusKas(data.kasAkhirPeriode)}
          </div>
          <div className="text-[11.5px] text-muted mt-2">
            Kenaikan bersih: {formatRupiahArusKas(data.kenaikanBersihKas)}
          </div>
        </div>
      </div>

      {/* Main Table: Templat Excel Acuan */}
      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-sm">
        {/* Header Document */}
        <div className="text-center py-6 px-4 border-b border-border-soft bg-surface-card">
          <h2 className="text-base font-extrabold text-navy-text tracking-wide uppercase">
            {data.entityName}
          </h2>
          <h1 className="text-lg font-black text-navy-text tracking-wider uppercase mt-0.5">
            LAPORAN ARUS KAS
          </h1>
          <p className="text-xs text-muted font-medium mt-1">
            Tahun {data.year}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-t-2 border-b-2 border-slate-900 bg-surface-subtle/80 text-[12.5px] font-black text-navy-text uppercase tracking-wider">
                <th className="py-3 px-6 min-w-[340px]">URAIAN</th>
                <th className="py-3 px-6 text-right w-56">{data.year}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, idx) => {
                const isHeader = row.isHeader;
                const isSubtotal = row.isSubtotal;
                const isTotal = row.isTotal;

                // Indentation styling
                let indentClass = "pl-6";
                if (row.level === 1) indentClass = "pl-10";
                if (row.level === 2) indentClass = "pl-14";
                if (row.level === 3) indentClass = "pl-20";

                // Row background and border styling
                let rowBg = "hover:bg-surface-hover/30 transition-colors";
                let borderClass = "border-b border-surface-subtle";

                if (isHeader) {
                  borderClass = "border-b border-surface-subtle";
                }
                if (isSubtotal) {
                  borderClass = isTotal
                    ? "border-t border-b-2 border-border-strong font-black bg-surface-subtle/40"
                    : "border-t border-b border-border-soft font-bold bg-surface-subtle/20";
                }

                return (
                  <tr key={`${row.label}-${idx}`} className={`${rowBg} ${borderClass}`}>
                    <td
                      className={`py-2 px-6 text-[13px] ${indentClass} ${
                        isHeader || isSubtotal || isTotal
                          ? "font-bold text-navy-text"
                          : "text-muted-stronger font-normal"
                      }`}
                    >
                      {row.label}
                    </td>

                    <td
                      className={`py-2 px-6 text-right tabular-nums text-[13px] ${
                        isSubtotal || isTotal ? "font-extrabold text-navy-text" : "font-medium"
                      } ${
                        row.amount < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : row.amount > 0
                          ? "text-navy-text"
                          : "text-muted"
                      }`}
                    >
                      {isHeader ? "" : formatRupiahArusKas(row.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
