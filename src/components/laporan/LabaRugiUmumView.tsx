"use client";

import React, { useState } from "react";
import { Printer, CheckCircle2, FileSpreadsheet } from "lucide-react";
import type { LaporanPajakData, TaxReportRow } from "@/lib/pajak";
import { formatAccounting } from "@/lib/pajak";

interface LabaRugiUmumViewProps {
  data: LaporanPajakData;
  entityKey: string;
}

export function LabaRugiUmumView({ data, entityKey }: LabaRugiUmumViewProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = () => {
    setIsExporting(true);
    const url = `/api/pajak/export?entityId=${encodeURIComponent(data.entityId)}&year=${data.year}`;
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

  return (
    <div className="flex flex-col gap-6">
      {/* Top action toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
            <CheckCircle2 size={13} />
            Laporan Laba Rugi
          </span>
          <span className="text-xs text-muted">
            Format Berjenjang (Biaya Langsung & Operasional)
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
            Pendapatan Usaha
          </span>
          <span className="text-lg font-bold tabular-nums text-status-green">
            Rp {data.pendapatan.totalKomersial.toLocaleString("id-ID")}
          </span>
          <span className="text-xs text-muted">Akun Pendapatan 400</span>
        </div>

        <div className="bg-surface-card p-4 rounded-2xl border border-border-soft flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            Biaya Langsung Proyek
          </span>
          <span className="text-lg font-bold tabular-nums text-status-red">
            Rp {data.biayaLangsung.totalKomersial.toLocaleString("id-ID")}
          </span>
          <span className="text-xs text-muted">Akun Biaya Langsung 6xx</span>
        </div>

        <div className="bg-surface-card p-4 rounded-2xl border border-border-soft flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            Biaya Operasional
          </span>
          <span className="text-lg font-bold tabular-nums text-status-red">
            Rp {data.biayaOperasional.totalKomersial.toLocaleString("id-ID")}
          </span>
          <span className="text-xs text-muted">Beban Operasional & Penyusutan</span>
        </div>

        <div className="bg-surface-card p-4 rounded-2xl border border-border-soft flex flex-col gap-1.5 bg-navy/5 dark:bg-navy/15">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            Laba / (Rugi) Bersih
          </span>
          <span
            className={`text-lg font-extrabold tabular-nums ${
              data.labaBersih.komersial >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            Rp {data.labaBersih.komersial.toLocaleString("id-ID")}
          </span>
          <span className="text-xs text-muted">Laba Tahun Berjalan</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-sm">
        <div className="text-center py-6 px-4 border-b border-border-soft bg-surface-card">
          <h2 className="text-base font-extrabold text-navy-text tracking-wide uppercase">
            {data.entityName}
          </h2>
          <h1 className="text-lg font-black text-navy-text tracking-wider uppercase mt-0.5">
            LAPORAN LABA RUGI
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
                <th className="py-3 px-6 text-right w-60">Jumlah</th>
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
