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

      {/* Main Table */}
      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
        {/* Print-only Document Title */}
        <div className="hidden print:block text-center py-6 px-4 border-b border-border-soft bg-surface-card">
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
              <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint uppercase tracking-wider bg-surface-subtle/50">
                <th className="py-3.5 px-6 min-w-[360px]">URAIAN ARUS KAS</th>
                <th className="py-3.5 px-6 text-right w-64 whitespace-nowrap">PERIODE {data.year}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, idx) => {
                const isHeader = row.isHeader;
                const isSubtotal = row.isSubtotal;
                const isTotal = row.isTotal;
                const isZero = row.amount === 0;

                // 1. Level 0 Section Header (Aktivitas Operasi / Investasi / Pendanaan)
                if (isHeader && row.level === 0) {
                  let accentBar = "bg-blue-500";
                  if (row.label.toLowerCase().includes("investasi")) accentBar = "bg-orange-500";
                  else if (row.label.toLowerCase().includes("pendanaan")) accentBar = "bg-violet-500";
                  else if (row.label.toLowerCase().includes("kas") || row.label.toLowerCase().includes("setara")) accentBar = "bg-emerald-500";

                  return (
                    <tr key={`${row.label}-${idx}`} className="bg-surface-subtle/60 border-y border-border-soft">
                      <td colSpan={2} className="py-2.5 px-6">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-4 rounded-full ${accentBar} shrink-0`} />
                          <span className="text-[11.5px] font-extrabold text-navy-text tracking-wider uppercase">
                            {row.label}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // 2. Sub-section Header (e.g. "Perubahan Modal Kerja :", "Piutang Pihak Berelasi :")
                if (isHeader) {
                  let indentClass = "pl-6";
                  if (row.level === 1) indentClass = "pl-8";
                  if (row.level === 2) indentClass = "pl-12";
                  if (row.level === 3) indentClass = "pl-16";

                  return (
                    <tr key={`${row.label}-${idx}`} className="border-b border-surface-subtle bg-surface-subtle/25">
                      <td colSpan={2} className={`py-2 px-6 ${indentClass} text-[12px] font-bold text-muted-stronger`}>
                        {row.label}
                      </td>
                    </tr>
                  );
                }

                // 3. Grand Total at Bottom: Kas & Setara Kas pada Akhir Periode
                if (isTotal && row.label.toLowerCase().includes("akhir")) {
                  const isSurplus = row.amount >= 0;
                  return (
                    <tr
                      key={`${row.label}-${idx}`}
                      className={`border-t-2 border-border ${
                        isSurplus
                          ? "bg-emerald-50/50 dark:bg-emerald-500/10"
                          : "bg-rose-50/50 dark:bg-rose-500/10"
                      }`}
                    >
                      <td className="py-3.5 px-6 text-[13.5px] font-black text-navy-text uppercase tracking-wider">
                        {row.label}
                      </td>
                      <td
                        className={`py-3.5 px-6 text-right tabular-nums text-[15px] font-black whitespace-nowrap ${
                          isSurplus ? "text-status-green" : "text-status-red"
                        }`}
                      >
                        {formatRupiahArusKas(row.amount)}
                      </td>
                    </tr>
                  );
                }

                // 4. Major Activity Total / Kenaikan Bersih
                if (isTotal || (isSubtotal && row.level === 0)) {
                  return (
                    <tr
                      key={`${row.label}-${idx}`}
                      className="border-t border-b border-border-soft bg-surface-subtle/80"
                    >
                      <td className="py-3 px-6 text-[13px] font-black text-navy-text uppercase tracking-wide">
                        {row.label}
                      </td>
                      <td
                        className={`py-3 px-6 text-right tabular-nums text-[13.5px] font-black whitespace-nowrap ${
                          row.amount < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : row.amount > 0
                            ? "text-navy-text"
                            : "text-muted-faint font-normal"
                        }`}
                      >
                        {formatRupiahArusKas(row.amount)}
                      </td>
                    </tr>
                  );
                }

                // 5. Section Subtotal (e.g. Laba Operasi setelah penyesuaian)
                if (isSubtotal) {
                  return (
                    <tr
                      key={`${row.label}-${idx}`}
                      className="border-t border-b border-surface-hover bg-surface-subtle/40"
                    >
                      <td className="py-2.5 px-6 text-[12.5px] font-bold text-muted-strong pl-8 uppercase tracking-wider">
                        {row.label}
                      </td>
                      <td
                        className={`py-2.5 px-6 text-right tabular-nums text-[13px] font-bold whitespace-nowrap ${
                          row.amount < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : row.amount > 0
                            ? "text-navy-text"
                            : "text-muted-faint font-normal"
                        }`}
                      >
                        {formatRupiahArusKas(row.amount)}
                      </td>
                    </tr>
                  );
                }

                // 6. Regular Data Row
                let indentClass = "pl-6";
                if (row.level === 1) indentClass = "pl-8";
                if (row.level === 2) indentClass = "pl-12";
                if (row.level === 3) indentClass = "pl-16";

                return (
                  <tr
                    key={`${row.label}-${idx}`}
                    className="border-b border-surface-subtle hover:bg-surface-hover/50 transition-colors"
                  >
                    <td className={`py-2.5 px-6 text-[13px] text-navy-text ${indentClass}`}>
                      <div className="flex items-center gap-2">
                        {row.code && (
                          <span className="text-[12px] font-mono text-muted shrink-0">
                            {row.code}
                          </span>
                        )}
                        <span>{row.label}</span>
                      </div>
                    </td>
                    <td
                      className={`py-2.5 px-6 text-right tabular-nums text-[13px] whitespace-nowrap ${
                        isZero
                          ? "font-normal text-muted-faint"
                          : row.amount < 0
                          ? "font-semibold text-rose-600 dark:text-rose-400"
                          : "font-semibold text-navy-text"
                      }`}
                    >
                      {formatRupiahArusKas(row.amount)}
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
