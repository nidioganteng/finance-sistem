"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  DollarSign,
  Landmark,
  Scale,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Layers,
} from "lucide-react";
import type { LaporanJurnalRow, LaporanBankRow } from "@/lib/laporan-keuangan";

interface RingkasanTabProps {
  kpi: {
    totalPendapatan: number;
    totalBeban: number;
    labaBersih: number;
    totalPendapatanFmt: string;
    totalBebanFmt: string;
    labaBersihFmt: string;
    labaBersihPositive: boolean;
    txCount: number;
    marginPct: number;
  };
  jurnal: {
    totalCount: number;
    totalDebit: number;
    totalKredit: number;
    totalDebitFmt: string;
    totalKreditFmt: string;
    isBalanced: boolean;
    rows: LaporanJurnalRow[];
  };
  bank: {
    totalCount: number;
    totalPenerimaan: number;
    totalPengeluaran: number;
    totalPenerimaanFmt: string;
    totalPengeluaranFmt: string;
    netMutasi: number;
    netMutasiFmt: string;
    netPositive: boolean;
    rows: LaporanBankRow[];
  };
  entityName: string;
  isGrup: boolean;
  year: number;
}

export function RingkasanTab({
  kpi,
  jurnal,
  bank,
  entityName,
  isGrup,
  year,
}: RingkasanTabProps) {
  const [jurnalSumberFilter, setJurnalSumberFilter] = useState<string>("semua");
  const [jurnalSearch, setJurnalSearch] = useState<string>("");
  const [bankSearch, setBankSearch] = useState<string>("");

  // Filter rows Jurnal
  const filteredJurnalRows = useMemo(() => {
    return jurnal.rows.filter((r) => {
      const matchSumber = jurnalSumberFilter === "semua" || r.sumberKey === jurnalSumberFilter;
      const q = jurnalSearch.toLowerCase();
      const matchSearch =
        !q ||
        r.keterangan.toLowerCase().includes(q) ||
        r.noBukti.toLowerCase().includes(q) ||
        r.kodeAkun.toLowerCase().includes(q) ||
        r.namaAkun.toLowerCase().includes(q) ||
        r.entityName.toLowerCase().includes(q);
      return matchSumber && matchSearch;
    });
  }, [jurnal.rows, jurnalSumberFilter, jurnalSearch]);

  // Filter rows Bank
  const filteredBankRows = useMemo(() => {
    return bank.rows.filter((r) => {
      const q = bankSearch.toLowerCase();
      return (
        !q ||
        r.keterangan.toLowerCase().includes(q) ||
        r.noBukti.toLowerCase().includes(q) ||
        r.rekeningNama.toLowerCase().includes(q) ||
        r.namaAkun.toLowerCase().includes(q) ||
        r.entityName.toLowerCase().includes(q)
      );
    });
  }, [bank.rows, bankSearch]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── 1. Top 4 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pendapatan */}
        <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[12px] font-bold text-muted-faint uppercase tracking-wider">Total Pendapatan</span>
            <div className="w-9 h-9 rounded-xl bg-green-500/10 dark:bg-green-500/20 text-status-green flex items-center justify-center shrink-0">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-[22px] font-extrabold text-navy-text tabular-nums">{kpi.totalPendapatanFmt}</div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-muted-stronger">
            <span className="inline-flex items-center text-status-green font-semibold">
              <ArrowUpRight size={13} className="mr-0.5" /> Pendapatan Usaha
            </span>
            <span>· Tahun {year}</span>
          </div>
        </div>

        {/* Total Beban */}
        <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[12px] font-bold text-muted-faint uppercase tracking-wider">Total Beban</span>
            <div className="w-9 h-9 rounded-xl bg-red-500/10 dark:bg-red-500/20 text-status-red flex items-center justify-center shrink-0">
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="text-[22px] font-extrabold text-navy-text tabular-nums">{kpi.totalBebanFmt}</div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-muted-stronger">
            <span className="inline-flex items-center text-status-red font-semibold">
              <ArrowDownRight size={13} className="mr-0.5" /> Beban Operasional
            </span>
            <span>· Tahun {year}</span>
          </div>
        </div>

        {/* Laba / Rugi Bersih */}
        <div className={`rounded-[20px] border p-5 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
          kpi.labaBersihPositive
            ? "bg-green-50/50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30"
            : "bg-red-50/50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30"
        }`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className={`text-[12px] font-bold uppercase tracking-wider ${
              kpi.labaBersihPositive ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
            }`}>
              {kpi.labaBersihPositive ? "Laba Bersih" : "Rugi Bersih"}
            </span>
            <div className={`px-2.5 py-1 rounded-full text-[10.5px] font-extrabold ${
              kpi.labaBersihPositive
                ? "bg-green-500 text-white"
                : "bg-red-500 text-white"
            }`}>
              {kpi.marginPct.toFixed(1)}% Margin
            </div>
          </div>
          <div className={`text-[22px] font-extrabold tabular-nums ${
            kpi.labaBersihPositive ? "text-status-green" : "text-status-red"
          }`}>
            {kpi.labaBersihPositive ? "" : "–"}{kpi.labaBersihFmt}
          </div>
          <div className="mt-2.5 text-[11.5px] text-muted-stronger">
            Net Result ({entityName})
          </div>
        </div>

        {/* Total Transaksi Jurnal */}
        <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[12px] font-bold text-muted-faint uppercase tracking-wider">Total Transaksi Jurnal</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
          </div>
          <div className="text-[22px] font-extrabold text-navy-text tabular-nums">
            {jurnal.totalCount.toLocaleString("id-ID")}{" "}
            <span className="text-[13px] font-medium text-muted">transaksi</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[11.5px]">
            {jurnal.isBalanced ? (
              <span className="inline-flex items-center text-status-green font-semibold">
                <CheckCircle2 size={13} className="mr-1" /> Jurnal Seimbang
              </span>
            ) : (
              <span className="inline-flex items-center text-status-red font-semibold">
                <AlertTriangle size={13} className="mr-1" /> Jurnal Selisih
              </span>
            )}
            <span className="text-muted-faint">· Jurnal Umum {year}</span>
          </div>
        </div>
      </div>

      {/* ── 2. SECTION: JURNAL UMUM ── */}
      <div className="bg-surface-card rounded-[24px] border border-border-soft shadow-sm overflow-hidden flex flex-col">
        {/* Header Section Jurnal */}
        <div className="px-6 py-5 border-b border-surface-subtle flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-subtle/30">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold">
                <FileText size={16} />
              </div>
              <h3 className="text-[17px] font-extrabold text-navy-text">Jurnal Umum</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-surface-hover text-muted-stronger border border-border-soft">
                {entityName}
              </span>
            </div>
            <p className="text-[12.5px] text-muted mt-1">
              Catatan debet dan kredit lengkap dari seluruh transaksi kas & bank
            </p>
          </div>

          {/* Quick stats & status */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-right">
              <div className="text-[10px] font-bold text-muted-faint uppercase">Total Debet</div>
              <div className="text-[13.5px] font-extrabold text-navy-text tabular-nums">{jurnal.totalDebitFmt}</div>
            </div>
            <div className="h-7 w-[1px] bg-border-soft hidden sm:block" />
            <div className="text-right">
              <div className="text-[10px] font-bold text-muted-faint uppercase">Total Kredit</div>
              <div className="text-[13.5px] font-extrabold text-navy-text tabular-nums">{jurnal.totalKreditFmt}</div>
            </div>
            <div className="h-7 w-[1px] bg-border-soft hidden sm:block" />
            <div className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold flex items-center gap-1.5 shrink-0 ${
              jurnal.isBalanced
                ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                : "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
            }`}>
              {jurnal.isBalanced ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {jurnal.isBalanced ? "Debet = Kredit Seimbang" : "Perlu Penyesuaian"}
            </div>
          </div>
        </div>

        {/* Toolbar & Filter Jurnal */}
        <div className="px-6 py-3.5 border-b border-surface-subtle flex flex-wrap items-center justify-between gap-3 bg-surface-card">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11.5px] font-bold text-muted-faint mr-1 flex items-center gap-1">
              <Filter size={12} /> Sumber:
            </span>
            {[
              { key: "semua", label: "Semua" },
              { key: "kasKecil", label: "Kas Kecil" },
              { key: "kasBesar", label: "Kas Besar" },
              { key: "bankBuku", label: "Buku Bank" },
            ].map((chip) => (
              <button
                key={chip.key}
                onClick={() => setJurnalSumberFilter(chip.key)}
                className={`px-3 py-1 rounded-full text-[11.5px] font-semibold transition-all ${
                  jurnalSumberFilter === chip.key
                    ? "bg-navy text-white shadow-sm"
                    : "bg-surface-subtle text-muted-stronger hover:bg-surface-hover border border-border-soft"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Cari transaksi, no. bukti, akun..."
              value={jurnalSearch}
              onChange={(e) => setJurnalSearch(e.target.value)}
              className="w-full text-[12px] px-3 py-1.5 rounded-xl border border-border-soft bg-surface-subtle focus:bg-surface-card focus:outline-none focus:ring-1 focus:ring-brand text-navy-text"
            />
          </div>
        </div>

        {/* Tabel Jurnal Umum */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint uppercase tracking-wider bg-surface-subtle/50">
                <th className="py-3 px-5 whitespace-nowrap">Tanggal</th>
                <th className="py-3 px-3 whitespace-nowrap">No. Bukti</th>
                {isGrup && <th className="py-3 px-3 whitespace-nowrap">Entitas</th>}
                <th className="py-3 px-3 whitespace-nowrap">Sumber</th>
                <th className="py-3 px-4 min-w-[200px]">Keterangan</th>
                <th className="py-3 px-3 whitespace-nowrap">Kode Akun</th>
                <th className="py-3 px-4">Nama Akun</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Debet</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Kredit</th>
                <th className="py-3 px-5 whitespace-nowrap text-right">Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-subtle">
              {filteredJurnalRows.length === 0 ? (
                <tr>
                  <td colSpan={isGrup ? 10 : 9} className="py-12 text-center text-sm text-muted">
                    Tidak ada transaksi jurnal yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredJurnalRows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-hover/30 transition-colors">
                    <td className="py-3 px-5 text-[12px] text-muted whitespace-nowrap">{row.tanggal}</td>
                    <td className="py-3 px-3 text-[11.5px] font-mono font-semibold text-muted-stronger whitespace-nowrap">
                      {row.noBukti}
                    </td>
                    {isGrup && (
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10.5px] font-bold text-white shadow-xs"
                          style={{ backgroundColor: row.entityColor }}
                        >
                          {row.entityName}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className="px-2.5 py-0.5 rounded-md text-[11px] font-bold"
                        style={{ backgroundColor: row.sumberBg, color: row.sumberColor }}
                      >
                        {row.sumberLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[12.5px] text-navy-text">{row.keterangan}</td>
                    <td className={`py-3 px-3 text-[11px] font-mono text-muted-faintest whitespace-nowrap ${row.isKredit ? "pl-7" : ""}`}>
                      {row.isKredit && <span className="text-muted-faint select-none mr-1">↳</span>}
                      {row.kodeAkun}
                    </td>
                    <td className={`py-3 px-4 text-[12.5px] text-muted-stronger font-medium ${row.isKredit ? "pl-7 italic" : ""}`}>{row.namaAkun}</td>
                    <td className="py-3 px-4 text-right text-[12.5px] tabular-nums font-semibold text-navy-text">
                      {row.debitFmt}
                    </td>
                    <td className="py-3 px-4 text-right text-[12.5px] tabular-nums font-semibold text-navy-text">
                      {row.kreditFmt}
                    </td>
                    <td className="py-3 px-5 text-right text-[12px] text-muted whitespace-nowrap">
                      {row.staffName}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredJurnalRows.length > 0 && (
              <tfoot>
                <tr className="bg-surface-subtle/70 font-extrabold border-t-2 border-border-soft text-navy-text">
                  <td colSpan={isGrup ? 7 : 6} className="py-3 px-5 text-right text-[12.5px] uppercase">
                    Total Halaman Ini ({filteredJurnalRows.length} entri):
                  </td>
                  <td className="py-3 px-4 text-right text-[13px] tabular-nums font-extrabold text-navy-text">
                    Rp {filteredJurnalRows.reduce((s, r) => s + r.debit, 0).toLocaleString("id-ID")}
                  </td>
                  <td className="py-3 px-4 text-right text-[13px] tabular-nums font-extrabold text-navy-text">
                    Rp {filteredJurnalRows.reduce((s, r) => s + r.kredit, 0).toLocaleString("id-ID")}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── 3. SECTION: BUKU BANK ── */}
      <div className="bg-surface-card rounded-[24px] border border-border-soft shadow-sm overflow-hidden flex flex-col">
        {/* Header Section Bank */}
        <div className="px-6 py-5 border-b border-surface-subtle flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-subtle/30">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                <Landmark size={16} />
              </div>
              <h3 className="text-[17px] font-extrabold text-navy-text">Buku Bank (Rekening Koran)</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-surface-hover text-muted-stronger border border-border-soft">
                {entityName}
              </span>
            </div>
            <p className="text-[12.5px] text-muted mt-1">
              Catatan mutasi keluar-masuk dana perbankan beserta posisi saldo berjalan
            </p>
          </div>

          {/* Quick stats Bank */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-right">
              <div className="text-[10px] font-bold text-muted-faint uppercase">Penerimaan Bank</div>
              <div className="text-[13.5px] font-extrabold text-status-green tabular-nums">{bank.totalPenerimaanFmt}</div>
            </div>
            <div className="h-7 w-[1px] bg-border-soft hidden sm:block" />
            <div className="text-right">
              <div className="text-[10px] font-bold text-muted-faint uppercase">Pengeluaran Bank</div>
              <div className="text-[13.5px] font-extrabold text-status-red tabular-nums">{bank.totalPengeluaranFmt}</div>
            </div>
            <div className="h-7 w-[1px] bg-border-soft hidden sm:block" />
            <div className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold flex items-center gap-1.5 shrink-0 ${
              bank.netPositive
                ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                : "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
            }`}>
              Net Mutasi: {bank.netPositive ? "+" : "–"}{bank.netMutasiFmt}
            </div>
          </div>
        </div>

        {/* Toolbar Pencarian Bank */}
        <div className="px-6 py-3.5 border-b border-surface-subtle flex flex-wrap items-center justify-between gap-3 bg-surface-card">
          <div className="text-[12px] font-semibold text-muted">
            Menampilkan <span className="font-bold text-navy-text">{filteredBankRows.length}</span> transaksi rekening bank
          </div>
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Cari rekening, keterangan, no. bukti..."
              value={bankSearch}
              onChange={(e) => setBankSearch(e.target.value)}
              className="w-full text-[12px] px-3 py-1.5 rounded-xl border border-border-soft bg-surface-subtle focus:bg-surface-card focus:outline-none focus:ring-1 focus:ring-brand text-navy-text"
            />
          </div>
        </div>

        {/* Tabel Buku Bank */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint uppercase tracking-wider bg-surface-subtle/50">
                <th className="py-3 px-5 whitespace-nowrap">Tanggal</th>
                <th className="py-3 px-3 whitespace-nowrap">No. Bukti</th>
                {isGrup && <th className="py-3 px-3 whitespace-nowrap">Entitas</th>}
                <th className="py-3 px-3 whitespace-nowrap">Rekening Bank</th>
                <th className="py-3 px-4 min-w-[220px]">Keterangan</th>
                <th className="py-3 px-4">Akun COA</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Penerimaan (Debet)</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Pengeluaran (Kredit)</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Saldo Setelah</th>
                <th className="py-3 px-5 whitespace-nowrap text-right">Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-subtle">
              {filteredBankRows.length === 0 ? (
                <tr>
                  <td colSpan={isGrup ? 10 : 9} className="py-12 text-center text-sm text-muted">
                    Belum ada transaksi rekening bank untuk filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredBankRows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-hover/30 transition-colors">
                    <td className="py-3 px-5 text-[12px] text-muted whitespace-nowrap">{row.tanggal}</td>
                    <td className="py-3 px-3 text-[11.5px] font-mono font-semibold text-muted-stronger whitespace-nowrap">
                      {row.noBukti}
                    </td>
                    {isGrup && (
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10.5px] font-bold text-white shadow-xs"
                          style={{ backgroundColor: row.entityColor }}
                        >
                          {row.entityName}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-500/30">
                        {row.rekeningNama}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[12.5px] text-navy-text">{row.keterangan}</td>
                    <td className="py-3 px-4 text-[12px] text-muted-stronger">
                      {row.kodeAkun !== "—" && <span className="font-mono text-muted-faint mr-1">[{row.kodeAkun}]</span>}
                      {row.namaAkun}
                    </td>
                    <td className="py-3 px-4 text-right text-[12.5px] tabular-nums font-semibold text-status-green">
                      {row.penerimaanFmt}
                    </td>
                    <td className="py-3 px-4 text-right text-[12.5px] tabular-nums font-semibold text-status-red">
                      {row.pengeluaranFmt}
                    </td>
                    <td className="py-3 px-4 text-right text-[12.5px] tabular-nums font-bold text-navy-text">
                      {row.saldoSetelahFmt}
                    </td>
                    <td className="py-3 px-5 text-right text-[12px] text-muted whitespace-nowrap">
                      {row.staffName}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredBankRows.length > 0 && (
              <tfoot>
                <tr className="bg-surface-subtle/70 font-extrabold border-t-2 border-border-soft text-navy-text">
                  <td colSpan={isGrup ? 6 : 5} className="py-3 px-5 text-right text-[12.5px] uppercase">
                    Total Halaman Ini ({filteredBankRows.length} entri):
                  </td>
                  <td className="py-3 px-4 text-right text-[13px] tabular-nums font-extrabold text-status-green">
                    Rp {filteredBankRows.reduce((s, r) => s + r.penerimaan, 0).toLocaleString("id-ID")}
                  </td>
                  <td className="py-3 px-4 text-right text-[13px] tabular-nums font-extrabold text-status-red">
                    Rp {filteredBankRows.reduce((s, r) => s + r.pengeluaran, 0).toLocaleString("id-ID")}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
