"use client";

import React, { useState } from "react";
import { Printer, CheckCircle2, FileSpreadsheet, AlertTriangle } from "lucide-react";
import type { LaporanPajakData, TaxReportRow } from "@/lib/pajak";
import { formatAccounting } from "@/lib/pajak";

interface LabaRugiUmumViewProps {
  data: LaporanPajakData;
  entityKey: string;
  version?: "INTERNAL" | "UMUM";
}

export function LabaRugiUmumView({ data, entityKey, version = "INTERNAL" }: LabaRugiUmumViewProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = () => {
    setIsExporting(true);
    const url = `/api/pajak/export?entityId=${encodeURIComponent(data.entityId)}&year=${data.year}&version=${version}`;
    window.location.href = url;
    setTimeout(() => setIsExporting(false), 2000);
  };

  const renderRow = (item: TaxReportRow, isIndent = true) => {
    return (
      <tr key={item.code} className="border-b border-surface-subtle hover:bg-surface-hover/50 transition-colors">
        <td className="py-2.5 px-6 text-center text-[12.5px] font-mono text-muted w-28">{item.code}</td>
        <td className={`py-2.5 px-6 text-[13px] text-navy-text ${isIndent ? "pl-10" : "font-medium"}`}>
          {item.name}
        </td>
        <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold text-navy-text w-60">
          {formatAccounting(item.komersial)}
        </td>
      </tr>
    );
  };

  const renderSectionHeader = (title: string) => (
    <tr className="bg-surface-subtle/80 border-b border-surface-subtle">
      <td className="py-2.5 px-6 text-center font-bold text-xs text-muted-stronger">—</td>
      <td colSpan={2} className="py-2.5 px-6 text-[13px] font-black text-navy-text tracking-wide uppercase">
        {title}
      </td>
    </tr>
  );

  const renderSubtotalRow = (
    label: string,
    amount: number,
    isMajor = false
  ) => {
    const isNegative = amount < 0;

    return (
      <tr
        className={`${
          isMajor
            ? "bg-navy/5 dark:bg-navy/15 border-t-2 border-b-2 border-border-strong font-black"
            : "bg-surface-subtle/50 border-t border-b border-border-soft font-bold"
        }`}
      >
        <td className="py-2.5 px-6 text-center text-xs text-muted font-bold">—</td>
        <td className={`py-2.5 px-6 text-[13px] text-navy-text ${isMajor ? "uppercase tracking-wide font-black" : "font-bold"}`}>
          {label}
        </td>
        <td
          className={`py-2.5 px-6 text-right tabular-nums text-[13px] ${
            isMajor ? "font-extrabold text-[14px]" : "font-bold"
          } ${isNegative ? "text-rose-600 dark:text-rose-400" : "text-navy-text"}`}
        >
          {formatAccounting(amount)}
        </td>
      </tr>
    );
  };

  const isPositive = data.labaBersih.komersial >= 0;

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
              Laporan Laba Rugi Komprehensif
            </span>
          </div>
          <h2 className="text-[22px] font-extrabold text-navy-text mt-1">Laba Rugi (Income Statement)</h2>
          <p className="text-[13px] text-muted mt-1">
            Periode Akuntansi 1 Januari s/d 31 Desember {data.year} · Standar SAK ({version === "UMUM" ? "Versi Umum" : "Versi Internal"})
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
            {isPositive ? "SURPLUS BERSIH (LABA)" : "DEFISIT BERSIH (RUGI)"}
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
          <div className="text-[12px] font-bold text-muted-faint uppercase tracking-wider mb-2">Total Pendapatan</div>
          <div className="text-[22px] font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
            {formatAccounting(data.pendapatan.totalKomersial)}
          </div>
          <div className="text-[11.5px] text-muted mt-2">Pendapatan usaha & operasional</div>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
          <div className="text-[12px] font-bold text-muted-faint uppercase tracking-wider mb-2">Total Biaya Langsung</div>
          <div className="text-[22px] font-extrabold text-orange-600 dark:text-orange-400 tabular-nums">
            {formatAccounting(data.biayaLangsung.totalKomersial)}
          </div>
          <div className="text-[11.5px] text-muted mt-2">
            {version === "UMUM" ? "Akun 6xx tanpa By Marketing" : "Akun 6xx termasuk By Marketing"}
          </div>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
          <div className="text-[12px] font-bold text-muted-faint uppercase tracking-wider mb-2">Total Beban Operasional</div>
          <div className="text-[22px] font-extrabold text-violet-600 dark:text-violet-400 tabular-nums">
            {formatAccounting(data.biayaOperasional.totalKomersial)}
          </div>
          <div className="text-[11.5px] text-muted mt-2">Beban operasional & penyusutan</div>
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
              Status Laba / (Rugi) Bersih
            </span>
          </div>
          <div className={`text-[20px] font-extrabold tabular-nums ${isPositive ? "text-status-green" : "text-status-red"}`}>
            {formatAccounting(data.labaBersih.komersial)}
          </div>
          <div className="text-[11.5px] text-muted mt-2">
            {isPositive ? "Surplus Tahun Berjalan" : "Defisit Tahun Berjalan"}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-sm">
        <div className="text-center py-6 px-4 border-b border-border-soft bg-surface-card">
          <h2 className="text-base font-extrabold text-navy-text tracking-wide uppercase">
            {data.entityName}
          </h2>
          <h1 className="text-lg font-black text-navy-text tracking-wider uppercase mt-0.5">
            LAPORAN LABA RUGI {version === "UMUM" ? "(VERSI UMUM)" : "(VERSI INTERNAL)"}
          </h1>
          <p className="text-xs text-muted font-medium mt-1">
            Periode 1 Januari s/d 31 Desember {data.year}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-t-2 border-b-2 border-slate-900 bg-surface-subtle text-[12.5px] uppercase tracking-wider font-black text-navy-text">
                <th className="py-3 px-6 text-center w-28">No Akun</th>
                <th className="py-3 px-6 min-w-[320px]">Keterangan</th>
                <th className="py-3 px-6 text-right w-60">Komersial</th>
              </tr>
            </thead>
            <tbody>
              {/* 1. PENDAPATAN */}
              {renderSectionHeader("PENDAPATAN :")}
              {data.pendapatan.items.map((row) => renderRow(row))}
              {renderSubtotalRow(
                "TOTAL PENDAPATAN USAHA BERSIH",
                data.pendapatan.totalKomersial,
                true
              )}

              {/* 2. BIAYA LANGSUNG */}
              {renderSectionHeader("BIAYA LANGSUNG :")}
              {data.biayaLangsung.items.map((row) => renderRow(row))}
              {renderSubtotalRow(
                "TOTAL BIAYA LANGSUNG",
                data.biayaLangsung.totalKomersial,
                true
              )}

              {/* 3. LABA KOTOR */}
              {renderSubtotalRow(
                "LABA KOTOR",
                data.labaKotor.komersial,
                true
              )}

              {/* 4. BIAYA OPERASIONAL */}
              {renderSectionHeader("BIAYA OPERASIONAL :")}
              {data.biayaOperasional.items.map((row) => renderRow(row))}
              {renderSubtotalRow(
                "TOTAL BIAYA OPERASIONAL",
                data.biayaOperasional.totalKomersial,
                true
              )}

              {/* 5. LABA OPERASIONAL */}
              {renderSubtotalRow(
                "LABA OPERASIONAL",
                data.labaOperasional.komersial,
                true
              )}

              {/* 6. PPH FINAL */}
              {renderSectionHeader("PPH FINAL PASAL 4 AYAT 2 :")}
              {data.pphFinal.items.map((row) => renderRow(row))}
              {renderSubtotalRow(
                "TOTAL PPH FINAL",
                data.pphFinal.totalKomersial,
                false
              )}

              {/* 7. LABA SETELAH PAJAK */}
              {renderSubtotalRow(
                "LABA SETELAH PAJAK",
                data.labaSetelahPajak.komersial,
                true
              )}

              {/* 8. PENDAPATAN DAN BIAYA LAIN-LAIN */}
              {renderSectionHeader("PENDAPATAN DAN BIAYA LAIN-LAIN :")}
              {data.pendapatanBiayaLain.items.map((row) => renderRow(row))}
              {renderSubtotalRow(
                "TOTAL PENDAPATAN DAN BIAYA LAIN-LAIN",
                data.pendapatanBiayaLain.totalKomersial,
                false
              )}

              {/* 9. RUGI / LABA BERSIH */}
              {renderSubtotalRow(
                data.labaBersih.komersial >= 0 ? "LABA BERSIH" : "RUGI BERSIH",
                data.labaBersih.komersial,
                true
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
