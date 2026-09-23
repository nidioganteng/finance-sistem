"use client";

import React, { useState } from "react";
import { Download, Printer, CheckCircle2, TrendingUp, TrendingDown, FileSpreadsheet } from "lucide-react";
import type { LaporanPajakData, TaxReportRow } from "@/lib/pajak";
import { formatAccounting } from "@/lib/pajak";

interface LaporanPajakClientProps {
  data: LaporanPajakData;
  entityKey: string;
}

export function LaporanPajakClient({ data, entityKey }: LaporanPajakClientProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = () => {
    setIsExporting(true);
    const url = `/api/pajak/export?entityId=${encodeURIComponent(data.entityId)}&year=${data.year}`;
    window.location.href = url;
    setTimeout(() => setIsExporting(false), 2000);
  };

  const renderRow = (item: TaxReportRow, isIndent = true) => {
    const isZeroKoreksi = Math.round(item.koreksi) === 0;
    return (
      <tr key={item.code} className="border-b border-surface-subtle hover:bg-surface-hover/50 transition-colors">
        <td className="py-2 px-4 text-center text-[12.5px] font-mono text-muted">{item.code}</td>
        <td className={`py-2 px-4 text-[13px] text-navy-text ${isIndent ? "pl-8" : "font-medium"}`}>
          {item.name}
        </td>
        <td className="py-2 px-4 text-right tabular-nums text-[13px] font-medium text-navy-text">
          {formatAccounting(item.komersial)}
        </td>
        <td
          className={`py-2 px-4 text-right tabular-nums text-[13px] font-medium ${
            isZeroKoreksi
              ? "text-muted"
              : item.koreksi > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {formatAccounting(item.koreksi)}
        </td>
        <td className="py-2 px-4 text-right tabular-nums text-[13px] font-medium text-navy-text">
          {formatAccounting(item.fiskal)}
        </td>
      </tr>
    );
  };

  const renderSectionHeader = (title: string) => (
    <tr className="bg-surface-subtle/70">
      <td className="py-2.5 px-4 text-center font-bold text-xs text-muted-stronger">—</td>
      <td colSpan={4} className="py-2.5 px-4 text-[13px] font-bold text-navy-text tracking-wide">
        {title}
      </td>
    </tr>
  );

  const renderSubtotalRow = (
    label: string,
    komersial: number,
    koreksi: number,
    fiskal: number,
    isMajor = false
  ) => {
    const isZeroKoreksi = Math.round(koreksi) === 0;
    const isNegativeLaba = isMajor && komersial < 0;

    return (
      <tr
        className={`${
          isMajor
            ? "bg-navy/5 dark:bg-navy/15 border-t-2 border-b-2 border-border-strong"
            : "bg-surface-subtle/50 border-t border-b border-border-soft"
        }`}
      >
        <td className="py-2.5 px-4 text-center text-xs text-muted font-bold">—</td>
        <td className={`py-2.5 px-4 text-[13px] font-bold text-navy-text ${isMajor ? "uppercase tracking-wide" : ""}`}>
          {label}
        </td>
        <td
          className={`py-2.5 px-4 text-right tabular-nums text-[13px] font-bold ${
            isNegativeLaba ? "text-rose-600 dark:text-rose-400" : "text-navy-text"
          }`}
        >
          {formatAccounting(komersial)}
        </td>
        <td
          className={`py-2.5 px-4 text-right tabular-nums text-[13px] font-bold ${
            isZeroKoreksi
              ? "text-muted"
              : koreksi > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {formatAccounting(koreksi)}
        </td>
        <td
          className={`py-2.5 px-4 text-right tabular-nums text-[13px] font-bold ${
            isMajor && fiskal < 0 ? "text-rose-600 dark:text-rose-400" : "text-navy-text"
          }`}
        >
          {formatAccounting(fiskal)}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top action toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <CheckCircle2 size={13} />
            Format Komersial vs Fiskal Presisi
          </span>
          <span className="text-xs text-muted">
            Sinkron dengan Modul Aktiva Tetap & Transaksi Riil
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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        {/* Card 1: Pendapatan Usaha Bersih */}
        <div className="bg-surface-card p-4 rounded-2xl border border-border-soft flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
            Pendapatan Bersih
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-navy-text tabular-nums">
              Rp {formatAccounting(data.pendapatan.totalKomersial)}
            </span>
            <span className="text-xs text-muted">Komersial</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-subtle">
            <span className="text-muted">Fiskal: Rp {formatAccounting(data.pendapatan.totalFiskal)}</span>
            <span
              className={`font-semibold tabular-nums ${
                data.pendapatan.totalKoreksi >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {data.pendapatan.totalKoreksi >= 0 ? "+" : ""}
              {formatAccounting(data.pendapatan.totalKoreksi)}
            </span>
          </div>
        </div>

        {/* Card 2: Laba Kotor */}
        <div className="bg-surface-card p-4 rounded-2xl border border-border-soft flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
            Laba Kotor
          </span>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-lg font-bold tabular-nums ${
                data.labaKotor.komersial >= 0
                  ? "text-navy-text"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              Rp {formatAccounting(data.labaKotor.komersial)}
            </span>
            <span className="text-xs text-muted">Komersial</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-subtle">
            <span className="text-muted">Fiskal: Rp {formatAccounting(data.labaKotor.fiskal)}</span>
            <span
              className={`font-semibold tabular-nums ${
                data.labaKotor.koreksi >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {data.labaKotor.koreksi >= 0 ? "+" : ""}
              {formatAccounting(data.labaKotor.koreksi)}
            </span>
          </div>
        </div>

        {/* Card 3: Biaya Operasional */}
        <div className="bg-surface-card p-4 rounded-2xl border border-border-soft flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
            Biaya Operasional
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-navy-text tabular-nums">
              Rp {formatAccounting(data.biayaOperasional.totalKomersial)}
            </span>
            <span className="text-xs text-muted">Komersial</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-subtle">
            <span className="text-muted">Fiskal: Rp {formatAccounting(data.biayaOperasional.totalFiskal)}</span>
            <span
              className={`font-semibold tabular-nums ${
                data.biayaOperasional.totalKoreksi >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {data.biayaOperasional.totalKoreksi >= 0 ? "+" : ""}
              {formatAccounting(data.biayaOperasional.totalKoreksi)}
            </span>
          </div>
        </div>

        {/* Card 4: Rugi / Laba Bersih */}
        <div
          className={`p-4 rounded-2xl border flex flex-col gap-2 ${
            data.labaBersih.komersial >= 0
              ? "bg-navy/5 dark:bg-navy/15 border-navy/20"
              : "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20"
          }`}
        >
          <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
            {data.labaBersih.komersial >= 0 ? "Laba Bersih" : "Rugi Bersih"}
          </span>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-lg font-extrabold tabular-nums ${
                data.labaBersih.komersial >= 0
                  ? "text-navy-text"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              Rp {formatAccounting(data.labaBersih.komersial)}
            </span>
            <span className="text-xs text-muted">Komersial</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-subtle">
            <span className="text-muted">Fiskal: Rp {formatAccounting(data.labaBersih.fiskal)}</span>
            <span
              className={`font-semibold tabular-nums ${
                data.labaBersih.koreksi >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {data.labaBersih.koreksi >= 0 ? "+" : ""}
              {formatAccounting(data.labaBersih.koreksi)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table: Templat Excel Acuan */}
      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-surface-subtle bg-surface-card flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-navy-text text-base">
              Laporan Rekonsiliasi Fiskal (Laba Rugi Komersial vs Fiskal)
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Entitas: <strong>{data.entityName}</strong> | Tahun Pajak: <strong>{data.year}</strong>
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              <span>Komersial (Internal)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Fiskal (Pajak DJP)</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[12px] uppercase tracking-wider font-bold">
                <th className="py-3 px-4 text-center w-24">No Akun</th>
                <th className="py-3 px-4 min-w-[280px]">Keterangan</th>
                <th className="py-3 px-4 text-right min-w-[150px]">Komersial</th>
                <th className="py-3 px-4 text-right min-w-[150px]">Koreksi Fiskal</th>
                <th className="py-3 px-4 text-right min-w-[150px]">Fiskal</th>
              </tr>
            </thead>
            <tbody>
              {/* 1. PENDAPATAN */}
              {renderSectionHeader("PENDAPATAN :")}
              {data.pendapatan.items.map((row) => renderRow(row))}
              {renderSubtotalRow(
                "TOTAL PENDAPATAN USAHA BERSIH",
                data.pendapatan.totalKomersial,
                data.pendapatan.totalKoreksi,
                data.pendapatan.totalFiskal
              )}

              {/* 2. BIAYA LANGSUNG */}
              {renderSectionHeader("BIAYA LANGSUNG :")}
              {data.biayaLangsung.items.map((row) => renderRow(row))}
              {renderSubtotalRow(
                "TOTAL BIAYA LANGSUNG",
                data.biayaLangsung.totalKomersial,
                data.biayaLangsung.totalKoreksi,
                data.biayaLangsung.totalFiskal
              )}

              {/* 3. LABA KOTOR */}
              {renderSubtotalRow(
                "LABA KOTOR",
                data.labaKotor.komersial,
                data.labaKotor.koreksi,
                data.labaKotor.fiskal,
                true
              )}

              {/* 4. BIAYA OPERASIONAL */}
              {renderSectionHeader("BIAYA OPERASIONAL :")}
              {data.biayaOperasional.items.map((row) => renderRow(row))}
              {renderSubtotalRow(
                "TOTAL BIAYA OPERASIONAL",
                data.biayaOperasional.totalKomersial,
                data.biayaOperasional.totalKoreksi,
                data.biayaOperasional.totalFiskal
              )}

              {/* 5. LABA OPERASIONAL */}
              {renderSubtotalRow(
                "LABA OPERASIONAL",
                data.labaOperasional.komersial,
                data.labaOperasional.koreksi,
                data.labaOperasional.fiskal,
                true
              )}

              {/* 6. PPH FINAL PASAL 4 AYAT 2 */}
              {data.pphFinal.items.map((row) => renderRow(row, false))}

              {/* 7. LABA SETELAH PAJAK */}
              {renderSubtotalRow(
                "LABA SETELAH PAJAK",
                data.labaSetelahPajak.komersial,
                data.labaSetelahPajak.koreksi,
                data.labaSetelahPajak.fiskal,
                true
              )}

              {/* 8. PENDAPATAN & BIAYA LAIN - LAIN */}
              {renderSectionHeader("PENDAPATAN & BIAYA LAIN - LAIN :")}
              {data.pendapatanBiayaLain.items.map((row) => renderRow(row))}
              {renderSubtotalRow(
                "TOTAL PENDAPATAN & BIAYA LAIN - LAIN",
                data.pendapatanBiayaLain.totalKomersial,
                data.pendapatanBiayaLain.totalKoreksi,
                data.pendapatanBiayaLain.totalFiskal
              )}

              {/* 9. RUGI / LABA BERSIH */}
              {renderSubtotalRow(
                "RUGI / LABA BERSIH",
                data.labaBersih.komersial,
                data.labaBersih.koreksi,
                data.labaBersih.fiskal,
                true
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
