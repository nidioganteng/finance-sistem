"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Scale,
  Building2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Receipt,
  Minus,
  ArrowRight,
  ExternalLink,
  ArrowUpDown,
  Filter,
  Search,
  X,
  Layers,
  Info,
} from "lucide-react";
import type {
  LaporanHutangPiutangEntityData,
  LaporanHutangPiutangGrupData,
  MutasiAfiliasiTx,
} from "@/lib/laporan-hutang-piutang";
import { formatAccountingRupiah, formatStandardRupiah, COUNTERPARTIES } from "@/lib/laporan-hutang-piutang";

interface Props {
  entityData: LaporanHutangPiutangEntityData | null;
  grupData: LaporanHutangPiutangGrupData | null;
  selectedEntityKey?: string;
  year: number;
}

type SingleEntityTab = "netting" | "buku-pembantu" | "rekap-akun";

export function LaporanHutangPiutangClient({
  entityData,
  grupData,
  selectedEntityKey,
  year,
}: Props) {
  const [activeTab, setActiveTab] = useState<SingleEntityTab>("netting");
  const [filterCp, setFilterCp] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [selectedTxDetail, setSelectedTxDetail] = useState<MutasiAfiliasiTx | null>(null);
  const isGrup = !selectedEntityKey || selectedEntityKey === "grup";

  // Jump from Netting Row directly into Counterparty Ledger
  const handleViewCounterpartyLedger = (cpKey: string) => {
    setFilterCp(cpKey);
    setActiveTab("buku-pembantu");
  };

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 1: SINGLE ENTITY (Modern Accounting Statement & Ledger)
  // ──────────────────────────────────────────────────────────────────────────
  if (entityData && !isGrup) {
    const { rekapHutang, rekapPiutang, netting, entity, transactions } = entityData;
    const isNetKreditur = netting.posisiBersihGlobal > 0;
    const isNetDebitur = netting.posisiBersihGlobal < 0;

    // Filtered & Sorted Transactions for Ledger
    const displayedTx = transactions
      .filter((tx) => {
        const matchCp = filterCp === "ALL" || tx.counterpartyKey === filterCp;
        if (!matchCp) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          tx.noBukti.toLowerCase().includes(q) ||
          tx.keterangan.toLowerCase().includes(q) ||
          tx.counterpartyName.toLowerCase().includes(q) ||
          (tx.coaCode && tx.coaCode.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const da = new Date(a.tanggalRaw || a.tanggal).getTime();
        const db = new Date(b.tanggalRaw || b.tanggal).getTime();
        return sortAsc ? da - db : db - da;
      });

    // Total mutasi filtered for ledger summary
    const totalPenambahanTx = displayedTx
      .filter((t) => t.efekSaldo === "TAMBAH")
      .reduce((s, t) => s + t.nominalMutasi, 0);
    const totalPenguranganTx = displayedTx
      .filter((t) => t.efekSaldo === "KURANG")
      .reduce((s, t) => s + t.nominalMutasi, 0);

    const selectedCpRow =
      filterCp !== "ALL"
        ? netting.rows.find((r) => r.counterpartyKey === filterCp)
        : null;
    const selectedCpConfig = selectedCpRow
      ? COUNTERPARTIES.find((c) => c.key === selectedCpRow.counterpartyKey)
      : null;

    return (
      <div className="flex flex-col gap-6">
        {/* ── Mode Navigation Tabs (Segmented Control) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border-soft">
          <div className="flex items-center gap-1.5 p-1 bg-surface-subtle rounded-2xl border border-border-soft w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("netting")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all cursor-pointer ${
                activeTab === "netting"
                  ? "bg-navy text-white shadow-xs"
                  : "text-muted-stronger hover:bg-surface-hover hover:text-navy-text"
              }`}
            >
              <Scale size={16} />
              <span>Posisi Netting Neraca</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("buku-pembantu")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all cursor-pointer ${
                activeTab === "buku-pembantu"
                  ? "bg-navy text-white shadow-xs"
                  : "text-muted-stronger hover:bg-surface-hover hover:text-navy-text"
              }`}
            >
              <Receipt size={16} />
              <span>Mutasi</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  activeTab === "buku-pembantu"
                    ? "bg-white/20 text-white"
                    : "bg-surface-card text-muted-stronger border border-border-soft"
                }`}
              >
                {transactions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("rekap-akun")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all cursor-pointer ${
                activeTab === "rekap-akun"
                  ? "bg-navy text-white shadow-xs"
                  : "text-muted-stronger hover:bg-surface-hover hover:text-navy-text"
              }`}
            >
              <FileSpreadsheet size={16} />
              <span>Rekap Akun COA</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[12px] text-muted font-medium">
            <Building2 size={15} className="text-muted-faint" />
            <span>
              Entitas: <strong className="text-navy-text font-bold">{entity.name}</strong>
            </span>
            <span>•</span>
            <span>
              Tahun: <strong className="text-navy-text font-bold">{year}</strong>
            </span>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB 1: POSISI NETTING NERACA (Executive & Balance Sheet View)       */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {activeTab === "netting" && (
          <div className="flex flex-col gap-6">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-bold text-muted-faint uppercase tracking-wider">
                    Total Piutang Afiliasi
                  </span>
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ArrowDownCircle size={16} />
                  </span>
                </div>
                <div className="text-[21px] font-extrabold text-navy-text tabular-nums font-mono">
                  {rekapPiutang.totalPiutangFmt}
                </div>
                <p className="text-[11.5px] text-muted mt-1.5">
                  Hak tagih atas dana yang dipinjamkan ke rekanan grup
                </p>
              </div>

              <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-bold text-muted-faint uppercase tracking-wider">
                    Total Hutang Afiliasi
                  </span>
                  <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <ArrowUpCircle size={16} />
                  </span>
                </div>
                <div className="text-[21px] font-extrabold text-navy-text tabular-nums font-mono">
                  {rekapHutang.totalHutangFmt}
                </div>
                <p className="text-[11.5px] text-muted mt-1.5">
                  Kewajiban pelunasan dana ke entitas rekanan grup
                </p>
              </div>

              <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs sm:col-span-2">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-bold text-muted-faint uppercase tracking-wider">
                    Posisi Bersih Antar-Grup (Hasil Netting)
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                      isNetKreditur
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : isNetDebitur
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        : "bg-surface-hover text-muted-stronger"
                    }`}
                  >
                    {isNetKreditur
                      ? "Net Kreditur (Hak Tagih)"
                      : isNetDebitur
                      ? "Net Debitur (Kewajiban)"
                      : "Seimbang (Rp 0)"}
                  </span>
                </div>
                <div
                  className={`text-[23px] font-extrabold tabular-nums font-mono ${
                    isNetKreditur
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isNetDebitur
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-navy-text"
                  }`}
                >
                  {netting.posisiBersihGlobalFmt}
                </div>
                <p className="text-[11.5px] text-muted mt-1.5">
                  {isNetKreditur
                    ? `${entity.name} memiliki hak tagih neto lebih besar dibanding kewajiban hutangnya ke grup.`
                    : isNetDebitur
                    ? `${entity.name} memiliki kewajiban hutang neto yang harus dilunasi ke entitas grup.`
                    : "Posisi piutang dan hutang antar-grup saling meniadakan secara seimbang."}
                </p>
              </div>
            </div>

            {/* Tabel Utama Netting Neraca */}
            <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
              <div className="px-6 py-5 border-b border-surface-hover flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-brand/10 text-brand">
                      <Scale size={18} />
                    </span>
                    <h3 className="text-[15px] font-extrabold text-navy-text">
                      Posisi Bersih Eliminasi Antar-Entitas (Masuk ke Neraca)
                    </h3>
                  </div>
                  <p className="text-[12px] text-muted mt-1">
                    Formula saldo per rekanan:{" "}
                    <code className="text-navy-text font-bold bg-surface-subtle px-1.5 py-0.5 rounded">
                      Saldo Awal Lalu + Penambahan Piutang − Pengurangan Hutang = Saldo Akhir Netto
                    </code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/neraca?entity=${entity.key}&year=${year}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-subtle hover:bg-surface-hover text-navy-text text-[12px] font-bold border border-border-soft transition-colors w-fit"
                  >
                    <span>Buka Neraca</span>
                    <ExternalLink size={13} className="text-muted-stronger" />
                  </Link>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-hover text-left bg-surface-subtle/50">
                      <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase whitespace-nowrap">
                        Posisi Neraca
                      </th>
                      <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase whitespace-nowrap">
                        Entitas Rekanan
                      </th>
                      <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right whitespace-nowrap">
                        Saldo Awal Lalu
                      </th>
                      <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        Penambahan (+)
                      </th>
                      <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        Pengurangan (−)
                      </th>
                      <th className="py-3 px-5 text-[11px] font-extrabold text-muted-faint uppercase text-right whitespace-nowrap">
                        Saldo Akhir Netto
                      </th>
                      <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase whitespace-nowrap">
                        Penempatan di Neraca
                      </th>
                      <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-center whitespace-nowrap">
                        Mutasi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-subtle">
                    {netting.rows.map((row) => (
                      <tr key={row.counterpartyKey} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-extrabold uppercase tracking-wide whitespace-nowrap ${
                              row.status === "UTANG"
                                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                : row.status === "PIUTANG"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-surface-hover text-muted-stronger"
                            }`}
                          >
                            {row.status === "UTANG" ? (
                              <ArrowUpCircle size={13} />
                            ) : row.status === "PIUTANG" ? (
                              <ArrowDownCircle size={13} />
                            ) : (
                              <Minus size={13} />
                            )}
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-navy-text text-[13px] whitespace-nowrap">
                          {row.fullName}{" "}
                          <span className="text-muted-faint font-normal text-[11.5px]">
                            ({row.shortName})
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-muted-stronger text-[12.5px] font-mono whitespace-nowrap">
                          {row.saldoAwalNetFmt}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400 text-[12.5px] font-mono whitespace-nowrap">
                          {row.penambahanPiutang > 0 ? `+${row.penambahanPiutangFmt}` : "Rp\u00A0-"}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-bold text-rose-600 dark:text-rose-400 text-[12.5px] font-mono whitespace-nowrap">
                          {row.penambahanHutang > 0 ? `−${row.penambahanHutangFmt}` : "Rp\u00A0-"}
                        </td>
                        <td className="py-3.5 px-5 text-right tabular-nums whitespace-nowrap">
                          <span
                            className={`font-extrabold text-[13.5px] px-2.5 py-1 rounded-md font-mono whitespace-nowrap inline-block ${
                              row.status === "UTANG"
                                ? "text-rose-600 dark:text-rose-400 bg-rose-500/10"
                                : row.status === "PIUTANG"
                                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                                : "text-muted-stronger"
                            }`}
                          >
                            {row.netFmt}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-semibold whitespace-nowrap ${
                              row.status === "UTANG"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : row.status === "PIUTANG"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-surface-subtle text-muted"
                            }`}
                          >
                            {row.neracaPosition}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleViewCounterpartyLedger(row.counterpartyKey)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-subtle hover:bg-navy hover:text-white text-navy-text text-[11.5px] font-bold border border-border-soft transition-all cursor-pointer group whitespace-nowrap"
                            title={`Buka Mutasi ${row.fullName}`}
                          >
                            <span>Mutasi</span>
                            <ArrowRight
                              size={12}
                              className="text-muted-stronger group-hover:text-white group-hover:translate-x-0.5 transition-all"
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Total Netting Row */}
                    <tr className="bg-surface-subtle/80 font-extrabold text-navy-text border-t-2 border-border-soft">
                      <td colSpan={2} className="py-4 px-4 text-left uppercase text-[11.5px] tracking-wider whitespace-nowrap">
                        Total Posisi Bersih Antar-Grup
                      </td>
                      <td className="py-4 px-4 text-right tabular-nums text-[12.5px] text-muted-stronger font-mono whitespace-nowrap">
                        {formatAccountingRupiah(
                          rekapPiutang.totalPiutangLalu - rekapHutang.totalHutangLalu
                        )}
                      </td>
                      <td className="py-4 px-4 text-right tabular-nums text-[12.5px] text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
                        {rekapPiutang.totalPerubahan > 0
                          ? `+${rekapPiutang.totalPerubahanFmt}`
                          : "Rp\u00A0-"}
                      </td>
                      <td className="py-4 px-4 text-right tabular-nums text-[12.5px] text-rose-600 dark:text-rose-400 font-mono whitespace-nowrap">
                        {rekapHutang.totalHutangTahunIni > 0
                          ? `−${rekapHutang.totalHutangTahunIniFmt}`
                          : "Rp\u00A0-"}
                      </td>
                      <td className="py-4 px-5 text-right tabular-nums whitespace-nowrap">
                        <span
                          className={`text-[14.5px] font-extrabold underline decoration-double font-mono whitespace-nowrap inline-block ${
                            isNetKreditur
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isNetDebitur
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-navy-text"
                          }`}
                        >
                          {netting.posisiBersihGlobalFmt}
                        </span>
                      </td>
                      <td colSpan={2} className="py-4 px-4 text-[11.5px] text-muted font-normal whitespace-nowrap">
                        {isNetKreditur
                          ? "Net Hak Tagih (Kreditur)"
                          : isNetDebitur
                          ? "Net Kewajiban (Debitur)"
                          : "Posisi Seimbang"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Cards Grid: Ringkasan Cepat Saldo Netto Per Rekanan */}
            <div>
              <div className="text-[11px] font-bold text-muted-faint uppercase tracking-wider mb-3">
                Ringkasan Cepat Posisi Saldo per Rekanan Afiliasi
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {netting.rows.map((row) => (
                  <button
                    key={row.counterpartyKey}
                    type="button"
                    onClick={() => handleViewCounterpartyLedger(row.counterpartyKey)}
                    className={`p-4 rounded-2xl border text-left transition-all hover:scale-[1.01] cursor-pointer ${
                      row.status === "UTANG"
                        ? "bg-rose-50/40 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/20 hover:border-rose-300"
                        : row.status === "PIUTANG"
                        ? "bg-emerald-50/40 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20 hover:border-emerald-300"
                        : "bg-surface-subtle/40 border-border-soft hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          row.status === "UTANG"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            : row.status === "PIUTANG"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-surface-hover text-muted"
                        }`}
                      >
                        {row.status}
                      </span>
                      <span className="text-[11.5px] font-extrabold text-navy-text uppercase">
                        {row.fullName} ({row.shortName})
                      </span>
                    </div>
                    <div
                      className={`text-[16px] font-extrabold tabular-nums font-mono ${
                        row.status === "UTANG"
                          ? "text-rose-600 dark:text-rose-400"
                          : row.status === "PIUTANG"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-stronger"
                      }`}
                    >
                      {row.netFmt}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted mt-2 pt-2 border-t border-border-soft/60">
                      <span className="truncate">{row.neracaPosition}</span>
                      <span className="text-brand font-bold text-[10.5px] ml-1 shrink-0">
                        Mutasi →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB 2: BUKU PEMBANTU & REKENING KORAN (Statement & Running Balance) */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {activeTab === "buku-pembantu" && (
          <div className="flex flex-col gap-6">
            {/* Filter Pills Rekanan */}
            <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 sm:p-5 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-extrabold text-muted-faint uppercase tracking-wider flex items-center gap-1.5">
                  <Filter size={13} />
                  <span>Pilih Entitas Rekanan:</span>
                </span>
                <span className="text-[11.5px] text-muted">
                  Menampilkan kartu rekening koran &amp; mutasi transaksi berjalan
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilterCp("ALL")}
                  className={`px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterCp === "ALL"
                      ? "bg-navy text-white shadow-xs"
                      : "bg-surface-subtle hover:bg-surface-hover text-navy-text border border-border-soft"
                  }`}
                >
                  <span>Semua Rekanan</span>
                  <span
                    className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-mono ${
                      filterCp === "ALL"
                        ? "bg-white/20 text-white"
                        : "bg-surface-card text-muted-stronger border border-border-soft"
                    }`}
                  >
                    {transactions.length}
                  </span>
                </button>

                {netting.rows.map((r) => {
                  const cpTxCount = transactions.filter(
                    (t) => t.counterpartyKey === r.counterpartyKey
                  ).length;
                  const isActive = filterCp === r.counterpartyKey;
                  return (
                    <button
                      key={r.counterpartyKey}
                      type="button"
                      onClick={() => setFilterCp(r.counterpartyKey)}
                      className={`px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        isActive
                          ? "bg-navy text-white shadow-xs"
                          : "bg-surface-subtle hover:bg-surface-hover text-navy-text border border-border-soft"
                      }`}
                    >
                      <span>
                        {r.fullName} ({r.shortName})
                      </span>
                      {cpTxCount > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-surface-card text-muted-stronger border border-border-soft"
                          }`}
                        >
                          {cpTxCount}
                        </span>
                      )}
                      <span
                        className={`w-2 h-2 rounded-full ${
                          r.status === "PIUTANG"
                            ? "bg-emerald-500"
                            : r.status === "UTANG"
                            ? "bg-rose-500"
                            : "bg-muted-faint"
                        }`}
                        title={`Posisi: ${r.status}`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Banner Statement Kartu Rekening Koran (Jika Memilih Rekanan Tertentu) */}
            {selectedCpRow && (
              <div className="bg-gradient-to-br from-surface-card to-surface-subtle/50 rounded-[20px] border border-border-soft p-5 sm:p-6 shadow-xs flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-soft">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-faint">
                        Kartu Rekening Koran Rekanan:
                      </span>
                      <span className="text-[16px] font-extrabold text-navy-text">
                        {selectedCpRow.fullName} ({selectedCpRow.shortName})
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase ${
                          selectedCpRow.status === "PIUTANG"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : selectedCpRow.status === "UTANG"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            : "bg-surface-hover text-muted"
                        }`}
                      >
                        {selectedCpRow.status === "PIUTANG"
                          ? "Hak Tagih (Piutang Bersih)"
                          : selectedCpRow.status === "UTANG"
                          ? "Kewajiban (Hutang Bersih)"
                          : "Seimbang (Rp 0)"}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted mt-1">
                      {selectedCpRow.status === "PIUTANG"
                        ? `${entity.name} memiliki hak tagih pelunasan dana sebesar ${selectedCpRow.netFmt} dari ${selectedCpRow.fullName}.`
                        : selectedCpRow.status === "UTANG"
                        ? `${entity.name} memiliki kewajiban hutang yang harus dibayarkan sebesar ${selectedCpRow.netFmt} ke ${selectedCpRow.fullName}.`
                        : `Posisi timbal-balik antara ${entity.name} dan ${selectedCpRow.fullName} berada dalam keadaan lunas seimbang.`}
                    </p>
                  </div>

                  <div className="text-[11.5px] text-muted-stronger font-mono bg-surface-card px-3 py-1.5 rounded-xl border border-border-soft w-fit">
                    Akun: Piutang{" "}
                    <strong className="text-navy-text">
                      {selectedCpConfig?.piutangCode || "11x"}
                    </strong>{" "}
                    • Hutang{" "}
                    <strong className="text-navy-text">
                      {selectedCpConfig?.hutangCode || "31x"}
                    </strong>
                  </div>
                </div>

                {/* Formula Berurutan Saldo Awal + Penambahan - Pengurangan = Saldo Akhir */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1 items-center">
                  {/* Step 1: Saldo Awal */}
                  <div className="p-4 rounded-xl bg-surface-card border border-border-soft">
                    <span className="text-[10.5px] font-bold text-muted-faint uppercase block mb-1">
                      1. Saldo Awal per 31 Des {year - 1}
                    </span>
                    <div className="text-[17px] font-extrabold text-navy-text font-mono tabular-nums">
                      {selectedCpRow.saldoAwalNetFmt}
                    </div>
                    <p className="text-[11px] text-muted mt-1">Akumulasi s.d. tahun lalu</p>
                  </div>

                  {/* Step 2: Penambahan (+) */}
                  <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20">
                    <span className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block mb-1">
                      + Penambahan Piutang
                    </span>
                    <div className="text-[17px] font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums whitespace-nowrap">
                      {selectedCpRow.penambahanPiutang > 0
                        ? `+${selectedCpRow.penambahanPiutangFmt}`
                        : "Rp\u00A0-"}
                    </div>
                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">
                      Pengeluaran untuk rekanan
                    </p>
                  </div>

                  {/* Step 3: Pengurangan (-) */}
                  <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-500/5 border border-rose-200 dark:border-rose-500/20">
                    <span className="text-[10.5px] font-bold text-rose-700 dark:text-rose-400 uppercase block mb-1">
                      − Pengurangan / Hutang
                    </span>
                    <div className="text-[17px] font-extrabold text-rose-600 dark:text-rose-400 font-mono tabular-nums whitespace-nowrap">
                      {selectedCpRow.penambahanHutang > 0
                        ? `−${selectedCpRow.penambahanHutangFmt}`
                        : "Rp\u00A0-"}
                    </div>
                    <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80 mt-1">
                      Dana masuk / talangan rekanan
                    </p>
                  </div>

                  {/* Step 4: Saldo Akhir */}
                  <div
                    className={`p-4 rounded-xl border-2 ${
                      selectedCpRow.status === "PIUTANG"
                        ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300"
                        : selectedCpRow.status === "UTANG"
                        ? "bg-rose-50 dark:bg-rose-500/10 border-rose-500 text-rose-800 dark:text-rose-300"
                        : "bg-surface-subtle border-border text-navy-text"
                    }`}
                  >
                    <span className="text-[10.5px] font-extrabold uppercase tracking-wider block mb-1">
                      = Saldo Akhir Berjalan ({year})
                    </span>
                    <div className="text-[18px] font-extrabold font-mono tabular-nums whitespace-nowrap">
                      {selectedCpRow.netFmt}
                    </div>
                    <p className="text-[11px] font-semibold mt-1 truncate">
                      {selectedCpRow.neracaPosition}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Banner Statement Jika Memilih Semua Rekanan */}
            {!selectedCpRow && (
              <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-extrabold text-muted-faint uppercase tracking-wider block">
                    Buku Besar Gabungan Rekanan Afiliasi
                  </span>
                  <div className="text-[16px] font-extrabold text-navy-text mt-0.5">
                    Menampilkan seluruh mutasi piutang &amp; hutang untuk semua entitas afiliasi ({year})
                  </div>
                  <p className="text-[12px] text-muted mt-1">
                    Klik tombol salah satu rekanan di atas jika ingin membedah saldo kartu rekening koran per entitas.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm font-mono shrink-0">
                  <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap">
                    <span className="text-[10px] font-sans uppercase block text-emerald-700/80 dark:text-emerald-400/80">
                      Total Penambahan (+)
                    </span>
                    {totalPenambahanTx > 0 ? `+${formatStandardRupiah(totalPenambahanTx)}` : "Rp\u00A0-"}
                  </div>
                  <div className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap">
                    <span className="text-[10px] font-sans uppercase block text-rose-700/80 dark:text-rose-400/80">
                      Total Pengurangan (−)
                    </span>
                    {totalPenguranganTx > 0 ? `−${formatStandardRupiah(totalPenguranganTx)}` : "Rp\u00A0-"}
                  </div>
                </div>
              </div>
            )}

            {/* Toolbar: Search & Sort */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-faint"
                />
                <input
                  type="text"
                  placeholder="Cari no. bukti, keterangan, atau COA..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-[12.5px] rounded-xl border border-border-soft bg-surface-card text-navy-text placeholder:text-muted focus:outline-none focus:border-brand transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-navy-text"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[12px] text-muted font-mono font-medium">
                  {displayedTx.length} transaksi ditampilkan
                </span>
                <button
                  type="button"
                  onClick={() => setSortAsc(!sortAsc)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-bold rounded-xl border border-border-soft bg-surface-card hover:bg-surface-hover text-navy-text transition-colors cursor-pointer"
                  title="Ubah urutan tanggal transaksi"
                >
                  <ArrowUpDown size={13} className="text-muted-stronger" />
                  <span>{sortAsc ? "Urutan: Terlama Dulu" : "Urutan: Terbaru Dulu"}</span>
                </button>
              </div>
            </div>

            {/* Tabel Mutasi Transaksi dengan Saldo Akhir Berjalan */}
            <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
              {displayedTx.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center gap-2 text-muted">
                  <Receipt size={32} className="text-muted-faint mb-1" />
                  <div className="text-[14px] font-bold text-navy-text">
                    Tidak Ada Mutasi Transaksi
                  </div>
                  <p className="text-[12px] max-w-md">
                    {searchQuery
                      ? `Tidak ditemukan mutasi yang sesuai dengan kata kunci "${searchQuery}".`
                      : `Belum ada mutasi transaksi hutang atau piutang untuk entitas rekanan ini di tahun ${year}.`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface-subtle border-b border-border-soft z-10">
                      <tr className="text-left text-[11px] font-extrabold text-muted-faint uppercase">
                        <th className="py-3 px-4 whitespace-nowrap">Tanggal</th>
                        <th className="py-3 px-3 whitespace-nowrap">No. Bukti</th>
                        <th className="py-3 px-3 whitespace-nowrap">Pihak Rekanan</th>
                        <th className="py-3 px-4 min-w-[280px]">Keterangan &amp; Alokasi Penggunaan Dana</th>
                        <th className="py-3 px-3 text-center whitespace-nowrap">Arus Mutasi</th>
                        <th className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          Penambahan (+)
                        </th>
                        <th className="py-3 px-3 text-right text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          Pengurangan (−)
                        </th>
                        <th className="py-3 px-5 text-right whitespace-nowrap">Saldo Akhir Berjalan</th>
                        <th className="py-3 px-3 text-center whitespace-nowrap">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-subtle text-[12.5px]">
                      {displayedTx.map((tx) => {
                        const isTambah = tx.efekSaldo === "TAMBAH";
                        // Saldo akhir cell color
                        const isPos = tx.saldoAkhir > 0;
                        const isNeg = tx.saldoAkhir < 0;

                        return (
                          <tr
                            key={tx.id}
                            className="hover:bg-surface-hover/30 transition-colors group"
                          >
                            <td className="py-3 px-4 text-muted font-medium whitespace-nowrap">
                              {tx.tanggal}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11.5px] text-navy-text font-semibold whitespace-nowrap">
                              {tx.noBukti}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="font-bold text-navy-text text-[12.5px]">
                                {tx.counterpartyName}
                              </div>
                              <div className="text-[10.5px] text-muted-faint font-mono">
                                Akun {tx.coaCode}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div
                                className="font-semibold text-navy-text text-[12.5px] max-w-[340px]"
                                title={tx.keterangan}
                              >
                                {tx.keterangan}
                              </div>
                              {tx.alokasiPenggunaan && tx.alokasiPenggunaan.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-brand flex items-center gap-1 bg-brand/10 dark:bg-brand/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    <Layers size={10} />
                                    <span>
                                      {tx.accountType === "PIUTANG"
                                        ? `Dipakai di ${tx.counterpartyShortName || tx.counterpartyName}:`
                                        : "Alokasi Belanja:"}
                                    </span>
                                  </span>
                                  {tx.alokasiPenggunaan.map((alk, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setSelectedTxDetail(tx)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-surface-subtle hover:bg-surface-hover border border-border-soft text-navy-text font-mono transition-colors cursor-pointer whitespace-nowrap"
                                      title="Klik untuk melihat rincian alokasi belanja"
                                    >
                                      <span className="text-brand font-bold">{alk.coaCode}</span>
                                      <span className="font-sans font-medium text-muted-stronger">
                                        {alk.coaName}
                                      </span>
                                      <span className="text-[10px] text-muted-faint font-mono">
                                        ({alk.nominalFmt})
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase ${
                                  isTambah
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {isTambah ? "+ Piutang" : "− Hutang"}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {isTambah ? tx.nominalMutasiFmt : "—"}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                              {!isTambah ? tx.nominalMutasiFmt : "—"}
                            </td>
                            <td className="py-3 px-5 text-right tabular-nums font-mono whitespace-nowrap">
                              <span
                                className={`font-extrabold px-2.5 py-1 rounded-md text-[13px] inline-block whitespace-nowrap ${
                                  isPos
                                    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                                    : isNeg
                                    ? "text-rose-600 dark:text-rose-400 bg-rose-500/10"
                                    : "text-muted bg-surface-subtle"
                                }`}
                              >
                                {tx.saldoAkhirFmt}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedTxDetail(tx)}
                                className="p-1.5 rounded-lg border border-border-soft bg-surface-subtle hover:bg-navy hover:text-white text-muted-stronger transition-all cursor-pointer"
                                title="Lihat detail alokasi penggunaan dana"
                              >
                                <Info size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB 3: REKAP AKUN COA (Format Presisi Lembar Kerja Excel)           */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {activeTab === "rekap-akun" && (
          <div className="flex flex-col gap-6">
            <div className="p-4 rounded-2xl bg-surface-card border border-border-soft flex items-center justify-between gap-4">
              <div>
                <h3 className="text-[14px] font-extrabold text-navy-text">
                  Rincian Akun COA Hutang &amp; Piutang (Format Lembar Kerja Excel)
                </h3>
                <p className="text-[12px] text-muted mt-0.5">
                  Rincian saldo akun kewajiban (311–315) dan hak tagih piutang (111–115) per tanggal tutup buku
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("netting")}
                className="text-[12px] font-bold text-brand hover:underline shrink-0"
              >
                Lihat Hasil Netting →
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Table Kiri: REKAP HUTANG */}
              <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-surface-hover bg-surface-subtle/50 flex items-center justify-between">
                  <div>
                    <h3 className="text-[13px] font-extrabold text-navy-text uppercase tracking-wider">
                      Rekap Hutang {entity.name}
                    </h3>
                    <p className="text-[11.5px] text-muted mt-0.5">
                      Kewajiban hutang berjalan &amp; akumulasi tahun sebelumnya
                    </p>
                  </div>
                  <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <ArrowUpCircle size={16} />
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-hover text-left bg-surface-card">
                        <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase whitespace-nowrap">
                          Rekanan / Akun
                        </th>
                        <th className="py-3 px-3 text-[11px] font-extrabold text-muted-faint uppercase text-right whitespace-nowrap">
                          Hutang per {year - 1}
                        </th>
                        <th className="py-3 px-3 text-[11px] font-extrabold text-muted-faint uppercase text-right whitespace-nowrap">
                          Hutang {year}
                        </th>
                        <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right whitespace-nowrap">
                          Total Hutang per {year}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-subtle">
                      {rekapHutang.rows.map((row) => (
                        <tr key={row.code} className="hover:bg-surface-hover/30 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-semibold text-navy-text text-[13px]">
                              Kas dan Bank {row.shortName}
                            </div>
                            <div className="text-[11px] text-muted-faint font-mono">
                              Akun {row.code} · {row.fullName}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right tabular-nums text-muted-stronger text-[12.5px] font-mono whitespace-nowrap">
                            {row.hutangLaluFmt}
                          </td>
                          <td className="py-3.5 px-3 text-right tabular-nums text-muted-stronger text-[12.5px] font-mono whitespace-nowrap">
                            {row.hutangTahunIniFmt}
                          </td>
                          <td className="py-3.5 px-4 text-right tabular-nums font-bold text-navy-text text-[13px] font-mono whitespace-nowrap">
                            {row.totalHutangFmt}
                          </td>
                        </tr>
                      ))}
                      {/* Total Hutang Row */}
                      <tr className="bg-surface-subtle font-extrabold text-navy-text border-t-2 border-border-soft">
                        <td className="py-3.5 px-4 uppercase text-[11px] tracking-wider whitespace-nowrap">
                          Total Hutang per {year}
                        </td>
                        <td className="py-3.5 px-3 text-right tabular-nums text-[12px] font-mono text-muted-stronger whitespace-nowrap">
                          {rekapHutang.totalHutangLaluFmt}
                        </td>
                        <td className="py-3.5 px-3 text-right tabular-nums text-[12px] font-mono text-muted-stronger whitespace-nowrap">
                          {rekapHutang.totalHutangTahunIniFmt}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[13.5px] font-mono text-rose-600 dark:text-rose-400 underline decoration-double whitespace-nowrap">
                          {rekapHutang.totalHutangFmt}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table Kanan: PIUTANG */}
              <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-surface-hover bg-surface-subtle/50 flex items-center justify-between">
                  <div>
                    <h3 className="text-[13px] font-extrabold text-navy-text uppercase tracking-wider">
                      Piutang {entity.name} {year}
                    </h3>
                    <p className="text-[11.5px] text-muted mt-0.5">
                      Hak tagih piutang aktif ke entitas afiliasi
                    </p>
                  </div>
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ArrowDownCircle size={16} />
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-hover text-left bg-surface-card">
                        <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase whitespace-nowrap">
                          Akun Piutang
                        </th>
                        <th className="py-3 px-3 text-[11px] font-extrabold text-muted-faint uppercase text-right whitespace-nowrap">
                          Piutang {year - 1}
                        </th>
                        <th className="py-3 px-3 text-[11px] font-extrabold text-muted-faint uppercase text-right whitespace-nowrap">
                          Piutang {year}
                        </th>
                        <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right whitespace-nowrap">
                          Perubahan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-subtle">
                      {rekapPiutang.rows.map((row) => (
                        <tr key={row.code} className="hover:bg-surface-hover/30 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-semibold text-navy-text text-[13px]">
                              PIUTANG {row.shortName}
                            </div>
                            <div className="text-[11px] text-muted-faint font-mono">
                              Akun {row.code} · {row.fullName}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right tabular-nums text-muted-stronger text-[12.5px] font-mono whitespace-nowrap">
                            {row.piutangLaluFmt}
                          </td>
                          <td className="py-3.5 px-3 text-right tabular-nums font-bold text-navy-text text-[13px] font-mono whitespace-nowrap">
                            {row.piutangBerjalanFmt}
                          </td>
                          <td className="py-3.5 px-4 text-right tabular-nums text-muted-stronger text-[12.5px] font-mono whitespace-nowrap">
                            {row.perubahanFmt}
                          </td>
                        </tr>
                      ))}
                      {/* Total Piutang Row */}
                      <tr className="bg-surface-subtle font-extrabold text-navy-text border-t-2 border-border-soft">
                        <td className="py-3.5 px-4 uppercase text-[11px] tracking-wider whitespace-nowrap">
                          Total Piutang
                        </td>
                        <td className="py-3.5 px-3 text-right tabular-nums text-[12px] font-mono text-muted-stronger whitespace-nowrap">
                          {rekapPiutang.totalPiutangLaluFmt}
                        </td>
                        <td className="py-3.5 px-3 text-right tabular-nums text-[13.5px] font-mono text-emerald-600 dark:text-emerald-400 underline decoration-double whitespace-nowrap">
                          {rekapPiutang.totalPiutangFmt}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[12px] font-mono text-muted-stronger whitespace-nowrap">
                          {rekapPiutang.totalPerubahanFmt}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Rincian Alokasi & Penggunaan Dana Rekanan ── */}
        {selectedTxDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
            <div className="bg-surface-card rounded-[22px] border border-border-soft max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-border-soft flex items-center justify-between bg-surface-subtle/50">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-brand/10 text-brand">
                    <Layers size={18} />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-extrabold text-navy-text">
                      Rincian Alokasi &amp; Penggunaan Dana
                    </h3>
                    <p className="text-[12px] text-muted mt-0.5">
                      No. Bukti:{" "}
                      <strong className="font-mono text-navy-text font-bold">
                        {selectedTxDetail.noBukti}
                      </strong>{" "}
                      • {selectedTxDetail.tanggal}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTxDetail(null)}
                  className="p-1.5 rounded-xl hover:bg-surface-hover text-muted-stronger hover:text-navy-text transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex flex-col gap-4 text-sm">
                {/* Ringkasan Aliran Dana */}
                <div className="p-4 rounded-xl bg-surface-subtle/50 border border-border-soft flex flex-col gap-2.5">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-faint">
                    Aliran Transaksi Antar-Perusahaan
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div className="p-3 rounded-xl bg-surface-card border border-border-soft">
                      <span className="text-[10px] text-muted-faint uppercase font-bold block">
                        {selectedTxDetail.accountType === "PIUTANG"
                          ? "Entitas Sumber (Uang Keluar)"
                          : "Pemberi Pinjaman"}
                      </span>
                      <span className="text-[13px] font-extrabold text-navy-text block mt-0.5">
                        {selectedTxDetail.accountType === "PIUTANG"
                          ? entity.name
                          : selectedTxDetail.counterpartyName}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-card border border-border-soft">
                      <span className="text-[10px] text-muted-faint uppercase font-bold block">
                        {selectedTxDetail.accountType === "PIUTANG"
                          ? "Entitas Penerima (Tujuan)"
                          : "Penerima Pinjaman"}
                      </span>
                      <span className="text-[13px] font-extrabold text-navy-text block mt-0.5">
                        {selectedTxDetail.accountType === "PIUTANG"
                          ? selectedTxDetail.counterpartyName
                          : entity.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-card border border-border-soft">
                    <span className="text-[11px] font-bold text-muted-faint uppercase">
                      Nominal Transaksi:
                    </span>
                    <span className="text-[15px] font-extrabold text-navy-text font-mono">
                      {selectedTxDetail.nominalMutasiFmt}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-muted-faint uppercase font-bold block">
                      Keterangan Asal:
                    </span>
                    <p className="text-[12.5px] font-medium text-navy-text mt-1 bg-surface-card p-2.5 rounded-xl border border-border-soft">
                      {selectedTxDetail.keterangan || "Tidak ada keterangan tertulis."}
                    </p>
                  </div>
                </div>

                {/* Section: Bagaimana Uang Ini Digunakan? */}
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-faint mb-2.5 flex items-center justify-between">
                    <span>
                      {selectedTxDetail.accountType === "PIUTANG"
                        ? `Uang Digunakan di ${selectedTxDetail.counterpartyName} Untuk:`
                        : `Alokasi Penggunaan di ${entity.name}:`}
                    </span>
                    <span className="text-[11px] font-mono text-muted">
                      {selectedTxDetail.alokasiPenggunaan?.length ?? 0} pos belanja
                    </span>
                  </div>

                  {selectedTxDetail.alokasiPenggunaan && selectedTxDetail.alokasiPenggunaan.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {selectedTxDetail.alokasiPenggunaan.map((alk, idx) => {
                        const isDefaultBeban = alk.coaCode === "530";
                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-xl border bg-surface-card border-border-soft flex flex-col gap-2.5 shadow-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-lg font-mono text-[12px] font-extrabold bg-brand/10 text-brand">
                                  Akun {alk.coaCode}
                                </span>
                                <span className="font-extrabold text-navy-text text-[13.5px]">
                                  {alk.coaName}
                                </span>
                              </div>
                              <span className="font-mono font-extrabold text-navy-text text-[14px]">
                                {alk.nominalFmt}
                              </span>
                            </div>

                            <div className="text-[12px] text-muted-stronger bg-surface-subtle/70 p-2.5 rounded-xl">
                              <span className="font-bold text-muted-faint text-[10.5px] uppercase block mb-0.5">
                                Keterangan Belanja / Penggunaan:
                              </span>
                              {alk.keterangan}
                            </div>

                            <div className="text-[11.5px]">
                              {isDefaultBeban ? (
                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                                  <strong>⚠️ Pos Biaya Sementara (Akun 530 By Lain):</strong> Transaksi ini otomatis tercatat di Jurnal Umum &amp; Buku Besar rekanan. Rekanan dapat mengubah kode akun ini ke akun biaya riil (misal 501 Biaya Bahan) di menu Jurnal Transaksi tanpa menghilangkan data di Laporan Hutang Piutang.
                                </div>
                              ) : alk.role === "KAS" ? (
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                                  <strong>✅ Penerimaan Kas / Bank:</strong> Dana diterima ke saldo kas/bank rekanan untuk keperluan operasional.
                                </div>
                              ) : (
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                                  <strong>✅ Telah Teralokasi Spesifik:</strong> Dana telah dicatat pada akun beban operasional / proyek ini pada pembukuan rekanan.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-5 rounded-xl bg-surface-subtle/50 border border-dashed border-border-soft text-center text-muted text-[12px]">
                      Tidak ada rincian crossing otomatis. Transaksi ini dicatat langsung pada buku pembantu akun hutang/piutang afiliasi internal.
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-border-soft bg-surface-subtle/30 flex items-center justify-between">
                <span className="text-[11.5px] text-muted font-mono">
                  Sistem Integrasi Rekonsiliasi Otomatis
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTxDetail(null)}
                  className="px-5 py-2 rounded-xl bg-navy text-white text-[12.5px] font-bold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 2: SEMUA ENTITAS (Konsolidasi & Matriks Antar-Grup)
  // ──────────────────────────────────────────────────────────────────────────
  if (grupData) {
    const {
      entities,
      matrix,
      totalsByEntity,
      grandTotalPiutang,
      grandTotalHutang,
      reconciliations,
    } = grupData;

    return (
      <div className="flex flex-col gap-6">
        {/* Summary Header Grup */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
            <span className="text-[11px] font-bold text-muted-faint uppercase tracking-wider block mb-1">
              Total Piutang Seluruh Entitas
            </span>
            <div className="text-[21px] font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
              {formatStandardRupiah(grandTotalPiutang)}
            </div>
            <p className="text-[11.5px] text-muted mt-1">Akumulasi seluruh akun 111–115</p>
          </div>

          <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
            <span className="text-[11px] font-bold text-muted-faint uppercase tracking-wider block mb-1">
              Total Hutang Seluruh Entitas
            </span>
            <div className="text-[21px] font-extrabold text-rose-600 dark:text-rose-400 tabular-nums font-mono">
              {formatStandardRupiah(grandTotalHutang)}
            </div>
            <p className="text-[11.5px] text-muted mt-1">Akumulasi seluruh akun 311–315</p>
          </div>

          <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
            <span className="text-[11px] font-bold text-muted-faint uppercase tracking-wider block mb-1">
              Status Eliminasi Konsolidasi
            </span>
            <div className="flex items-center gap-2 mt-1">
              {Math.abs(grandTotalPiutang - grandTotalHutang) < 1 ? (
                <>
                  <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[15px] font-extrabold text-emerald-600 dark:text-emerald-400">
                    100% Saling Hapus (Diff Rp 0)
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400" />
                  <span className="text-[14px] font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                    Selisih Rp {Math.abs(grandTotalPiutang - grandTotalHutang).toLocaleString("id-ID")}
                  </span>
                </>
              )}
            </div>
            <p className="text-[11.5px] text-muted mt-1">
              Secara konsolidasi grup, piutang dan hutang internal saling meniadakan.
            </p>
          </div>
        </div>

        {/* Matriks Saldo Silang Antar-Entitas (Inter-Company Grid) */}
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-surface-hover flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Building2 size={18} className="text-brand" />
              <div>
                <h3 className="text-[14px] font-extrabold text-navy-text">
                  Matriks Posisi Saldo Antar-Entitas (Inter-Company Matrix) {year}
                </h3>
                <p className="text-[12px] text-muted mt-0.5">
                  Melihat hubungan timbal-balik piutang &amp; hutang antar setiap entitas grup
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-hover bg-surface-subtle/50 text-left">
                  <th className="py-3 px-5 text-[11px] font-extrabold text-muted-faint uppercase whitespace-nowrap">
                    Entitas
                  </th>
                  {entities.map((e) => (
                    <th
                      key={e.key}
                      className="py-3 px-3 text-[11px] font-extrabold text-muted-faint uppercase text-center whitespace-nowrap"
                    >
                      {e.shortName}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    Total Piutang
                  </th>
                  <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    Total Hutang
                  </th>
                  <th className="py-3 px-5 text-[11px] font-extrabold text-muted-faint uppercase text-right whitespace-nowrap">
                    Posisi Bersih
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-subtle">
                {entities.map((rowEnt) => {
                  const totals = totalsByEntity[rowEnt.key] ?? {
                    totalPiutang: 0,
                    totalHutang: 0,
                    net: 0,
                    status: "NIHIL",
                  };
                  return (
                    <tr key={rowEnt.key} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-navy-text text-[13px] whitespace-nowrap">
                        {rowEnt.name}{" "}
                        <span className="text-[11px] text-muted-faint font-normal">
                          ({rowEnt.shortName})
                        </span>
                      </td>
                      {entities.map((colEnt) => {
                        if (colEnt.key === rowEnt.key) {
                          return (
                            <td
                              key={colEnt.key}
                              className="py-3 px-3 text-center bg-surface-subtle/40 text-muted-faint font-bold whitespace-nowrap"
                            >
                              —
                            </td>
                          );
                        }
                        const cell = matrix[rowEnt.key]?.[colEnt.key] ?? {
                          piutang: 0,
                          hutang: 0,
                          net: 0,
                        };
                        return (
                          <td key={colEnt.key} className="py-3 px-3 text-center tabular-nums whitespace-nowrap">
                            {cell.net === 0 ? (
                              <span className="text-[11.5px] text-muted-faint font-mono whitespace-nowrap">Rp\u00A0-</span>
                            ) : cell.net > 0 ? (
                              <span className="text-[11.5px] font-bold text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
                                +{formatAccountingRupiah(cell.net)}
                              </span>
                            ) : (
                              <span className="text-[11.5px] font-bold text-rose-600 dark:text-rose-400 font-mono whitespace-nowrap">
                                {formatAccountingRupiah(cell.net)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400 text-[12.5px] font-mono whitespace-nowrap">
                        {formatAccountingRupiah(totals.totalPiutang)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-rose-600 dark:text-rose-400 text-[12.5px] font-mono whitespace-nowrap">
                        {formatAccountingRupiah(totals.totalHutang)}
                      </td>
                      <td className="py-3.5 px-5 text-right tabular-nums whitespace-nowrap">
                        <span
                          className={`font-extrabold text-[12.5px] px-2.5 py-1 rounded-md font-mono whitespace-nowrap inline-block ${
                            totals.status === "PIUTANG"
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                              : totals.status === "UTANG"
                              ? "text-rose-600 dark:text-rose-400 bg-rose-500/10"
                              : "text-muted-stronger"
                          }`}
                        >
                          {formatAccountingRupiah(totals.net)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabel Rekonsiliasi Timbal-Balik (A vs B) */}
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-surface-hover flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-extrabold text-navy-text">
                Audit &amp; Rekonsiliasi Timbal-Balik Antar-Pasangan Entitas
              </h3>
              <p className="text-[12px] text-muted mt-0.5">
                Memastikan Piutang yang dicatat Entitas A sama persis dengan Hutang yang dicatat Entitas B
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-hover text-left bg-surface-subtle/40 text-[11px] font-extrabold text-muted-faint uppercase">
                  <th className="py-3 px-6 whitespace-nowrap">Pasangan Entitas</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Piutang A ke B</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Hutang B ke A</th>
                  <th className="py-3 px-6 text-center whitespace-nowrap">Status Rekonsiliasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-subtle text-[12.5px]">
                {reconciliations.map((rec, i) => (
                  <tr key={i} className="hover:bg-surface-hover/20">
                    <td className="py-3 px-6 font-bold text-navy-text whitespace-nowrap">
                      {rec.entityA.name} ({rec.entityA.shortName}){" "}
                      <span className="text-muted-faint">↔</span> {rec.entityB.name} (
                      {rec.entityB.shortName})
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-stronger font-medium font-mono whitespace-nowrap">
                      {formatAccountingRupiah(rec.piutangAB)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-stronger font-medium font-mono whitespace-nowrap">
                      {formatAccountingRupiah(rec.hutangBA)}
                    </td>
                    <td className="py-3 px-6 text-center whitespace-nowrap">
                      {rec.isMatchAB ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          <CheckCircle2 size={13} /> Sinkron
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono whitespace-nowrap">
                          <AlertTriangle size={13} /> Selisih Rp\u00A0
                          {Math.abs(rec.diffAB).toLocaleString("id-ID")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-[20px] border border-border-soft p-12 text-center text-muted">
      Silakan pilih entitas atau tahun untuk menampilkan Laporan Hutang &amp; Piutang.
    </div>
  );
}
