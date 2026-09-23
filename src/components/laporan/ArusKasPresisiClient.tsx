"use client";

import React, { useState } from "react";
import { Download, Printer, CheckCircle2, TrendingUp, TrendingDown, FileSpreadsheet } from "lucide-react";
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

  return (
    <div className="flex flex-col gap-6">
      {/* Top action toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
            <CheckCircle2 size={13} />
            Metode Tidak Langsung (Standar Excel Acuan)
          </span>
          <span className="text-xs text-muted">
            Rincian Modal Kerja & Pihak Berelasi
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
          >
            <FileSpreadsheet size={15} />
            {isExporting ? "Menyiapkan Excel..." : "Ekspor Excel (.xlsx)"}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-muted-stronger bg-surface-card border border-border-soft hover:bg-surface-hover active:scale-95 transition-all"
          >
            <Printer size={15} />
            Cetak PDF
          </button>
        </div>
      </div>

      {/* KPI Cards Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div className="bg-surface-card p-4 rounded-2xl border border-border-soft flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            I. Kas Aktivitas Operasi
          </span>
          <span
            className={`text-lg font-bold tabular-nums ${
              data.totalArusKasOperasi >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {formatRupiahArusKas(data.totalArusKasOperasi)}
          </span>
          <span className="text-xs text-muted">Laba operasi + modal kerja</span>
        </div>

        <div className="bg-surface-card p-4 rounded-2xl border border-border-soft flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            II. Kas Aktivitas Investasi
          </span>
          <span className="text-lg font-bold tabular-nums text-navy-text">
            {formatRupiahArusKas(data.totalArusKasInvestasi)}
          </span>
          <span className="text-xs text-muted">Perolehan aset tetap</span>
        </div>

        <div className="bg-surface-card p-4 rounded-2xl border border-border-soft flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            III. Kas Aktivitas Pendanaan
          </span>
          <span
            className={`text-lg font-bold tabular-nums ${
              data.totalArusKasPendanaan >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {formatRupiahArusKas(data.totalArusKasPendanaan)}
          </span>
          <span className="text-xs text-muted">Laba ditahan / ekuitas</span>
        </div>

        <div className="bg-surface-card p-4 rounded-2xl border border-border-soft flex flex-col gap-1.5 bg-navy/5 dark:bg-navy/15">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            Kas & Setara Kas Akhir
          </span>
          <span className="text-lg font-extrabold tabular-nums text-navy-text">
            {formatRupiahArusKas(data.kasAkhirPeriode)}
          </span>
          <span className="text-xs text-muted">Konsisten dengan saldo Neraca</span>
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
