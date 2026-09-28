"use client";

import { useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Scale,
  Building2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Receipt,
  Minus,
} from "lucide-react";
import type {
  LaporanHutangPiutangEntityData,
  LaporanHutangPiutangGrupData,
} from "@/lib/laporan-hutang-piutang";
import { formatAccountingRupiah, formatStandardRupiah } from "@/lib/laporan-hutang-piutang";

interface Props {
  entityData: LaporanHutangPiutangEntityData | null;
  grupData: LaporanHutangPiutangGrupData | null;
  selectedEntityKey?: string;
  year: number;
}

export function LaporanHutangPiutangClient({
  entityData,
  grupData,
  selectedEntityKey,
  year,
}: Props) {
  const [showTxDetail, setShowTxDetail] = useState(false);
  const isGrup = !selectedEntityKey || selectedEntityKey === "grup";

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 1: SINGLE ENTITY (Format Presisi Sesuai Screenshot Excel)
  // ──────────────────────────────────────────────────────────────────────────
  if (entityData && !isGrup) {
    const { rekapHutang, rekapPiutang, netting, entity, transactions } = entityData;
    const isNetKreditur = netting.posisiBersihGlobal > 0;
    const isNetDebitur = netting.posisiBersihGlobal < 0;

    return (
      <div className="flex flex-col gap-6">
        {/* ── Top Metric Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-muted-faint uppercase tracking-wider">
                Total Piutang Afiliasi
              </span>
              <span className="p-1.5 rounded-lg bg-status-green/10 text-status-green">
                <ArrowDownCircle size={16} />
              </span>
            </div>
            <div className="text-[20px] font-extrabold text-navy-text tabular-nums">
              {rekapPiutang.totalPiutangFmt}
            </div>
            <p className="text-[11.5px] text-muted mt-1">Hak tagih ke entitas dalam grup</p>
          </div>

          <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-muted-faint uppercase tracking-wider">
                Total Hutang Afiliasi
              </span>
              <span className="p-1.5 rounded-lg bg-status-red/10 text-status-red">
                <ArrowUpCircle size={16} />
              </span>
            </div>
            <div className="text-[20px] font-extrabold text-navy-text tabular-nums">
              {rekapHutang.totalHutangFmt}
            </div>
            <p className="text-[11.5px] text-muted mt-1">Kewajiban bayar ke entitas grup</p>
          </div>

          <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 sm:p-5 shadow-xs sm:col-span-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-muted-faint uppercase tracking-wider">
                Posisi Bersih Antar-Grup (Netting)
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                  isNetKreditur
                    ? "bg-status-green/15 text-status-green"
                    : isNetDebitur
                    ? "bg-status-red/15 text-status-red"
                    : "bg-surface-hover text-muted-stronger"
                }`}
              >
                {isNetKreditur
                  ? "Net Kreditur (Piutang Bersih)"
                  : isNetDebitur
                  ? "Net Debitur (Hutang Bersih)"
                  : "Seimbang (Rp 0)"}
              </span>
            </div>
            <div
              className={`text-[22px] font-extrabold tabular-nums ${
                isNetKreditur
                  ? "text-status-green"
                  : isNetDebitur
                  ? "text-status-red"
                  : "text-navy-text"
              }`}
            >
              {netting.posisiBersihGlobalFmt}
            </div>
            <p className="text-[11.5px] text-muted mt-1">
              {isNetKreditur
                ? `${entity.name} memiliki hak tagih neto lebih besar dari kewajiban hutangnya ke grup.`
                : isNetDebitur
                ? `${entity.name} memiliki kewajiban hutang neto yang harus dilunasi ke grup.`
                : "Posisi piutang dan hutang antar-grup saling meniadakan secara sempurna."}
            </p>
          </div>
        </div>

        {/* ── Side-by-Side Tables (Format Excel Cipta Asri) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── Table Kiri: REKAP HUTANG ── */}
          <div className="lg:col-span-7 bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-surface-hover bg-surface-subtle/50 flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-extrabold text-navy-text uppercase tracking-wider">
                  Rekap Hutang {entity.name}
                </h3>
                <p className="text-[11.5px] text-muted mt-0.5">
                  Kewajiban hutang berjalan & akumulasi tahun sebelumnya
                </p>
              </div>
              <span className="p-1 rounded-md bg-status-red/10 text-status-red">
                <ArrowUpCircle size={15} />
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-hover text-left bg-surface-card">
                    <th className="py-3 px-5 text-[11px] font-extrabold text-muted-faint uppercase">
                      Rekanan / Akun
                    </th>
                    <th className="py-3 px-3 text-[11px] font-extrabold text-muted-faint uppercase text-right">
                      Hutang per {year - 1}
                    </th>
                    <th className="py-3 px-3 text-[11px] font-extrabold text-muted-faint uppercase text-right">
                      Hutang {year}
                    </th>
                    <th className="py-3 px-5 text-[11px] font-extrabold text-muted-faint uppercase text-right">
                      Total Hutang per {year}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-subtle">
                  {rekapHutang.rows.map((row) => (
                    <tr key={row.code} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-navy-text text-[13px]">
                          Kas dan Bank {row.shortName}
                        </div>
                        <div className="text-[11px] text-muted-faint font-mono">
                          Akun {row.code} · {row.fullName}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-muted-stronger text-[12.5px]">
                        {row.hutangLaluFmt}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-muted-stronger text-[12.5px]">
                        {row.hutangTahunIniFmt}
                      </td>
                      <td className="py-3.5 px-5 text-right tabular-nums font-bold text-navy-text text-[13px]">
                        {row.totalHutangFmt}
                      </td>
                    </tr>
                  ))}
                  {/* Total Hutang Row */}
                  <tr className="bg-surface-subtle font-extrabold text-navy-text border-t-2 border-border-soft">
                    <td colSpan={3} className="py-3.5 px-5 text-right uppercase text-[11.5px] tracking-wider">
                      Total Hutang per {year}
                    </td>
                    <td className="py-3.5 px-5 text-right tabular-nums text-[13.5px] text-status-red underline decoration-double">
                      {rekapHutang.totalHutangFmt}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Table Kanan: PIUTANG ── */}
          <div className="lg:col-span-5 bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-surface-hover bg-surface-subtle/50 flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-extrabold text-navy-text uppercase tracking-wider">
                  Piutang {entity.name} {year}
                </h3>
                <p className="text-[11.5px] text-muted mt-0.5">Saldo piutang aktif per {year}</p>
              </div>
              <span className="p-1 rounded-md bg-status-green/10 text-status-green">
                <ArrowDownCircle size={15} />
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-hover text-left bg-surface-card">
                    <th className="py-3 px-5 text-[11px] font-extrabold text-muted-faint uppercase">
                      Akun Piutang
                    </th>
                    <th className="py-3 px-5 text-[11px] font-extrabold text-muted-faint uppercase text-right">
                      Saldo Piutang
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-subtle">
                  {rekapPiutang.rows.map((row) => (
                    <tr key={row.code} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-navy-text text-[13px]">
                          PIUTANG {row.shortName}
                        </div>
                        <div className="text-[11px] text-muted-faint font-mono">
                          Akun {row.code} · {row.fullName}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right tabular-nums font-bold text-navy-text text-[13px]">
                        {row.piutangFmt}
                      </td>
                    </tr>
                  ))}
                  {/* Total Piutang Row */}
                  <tr className="bg-surface-subtle font-extrabold text-navy-text border-t-2 border-border-soft">
                    <td className="py-3.5 px-5 text-right uppercase text-[11.5px] tracking-wider">
                      Total Piutang
                    </td>
                    <td className="py-3.5 px-5 text-right tabular-nums text-[13.5px] text-status-green underline decoration-double">
                      {rekapPiutang.totalPiutangFmt}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Table Bawah: HASIL NETTING (POSISI BERSIH ANTAR-ENTITAS) ── */}
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-surface-hover flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Scale size={16} className="text-brand" />
                <h3 className="text-[14px] font-extrabold text-navy-text">
                  Hasil Netting Posisi Bersih Antar-Entitas
                </h3>
              </div>
              <p className="text-[12px] text-muted mt-0.5">
                Perhitungan selisih antara Piutang dan Hutang per rekanan afiliasi (Piutang - Hutang)
              </p>
            </div>
            <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-stronger">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-status-red" /> Utang (Negatif)
              </span>
              <span className="flex items-center gap-1 ml-2">
                <span className="w-2.5 h-2.5 rounded-full bg-status-green" /> Piutang (Positif)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-hover text-left bg-surface-subtle/40">
                  <th className="py-3 px-6 text-[11px] font-extrabold text-muted-faint uppercase">
                    Status
                  </th>
                  <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase">
                    Rekanan Afiliasi
                  </th>
                  <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right">
                    Piutang
                  </th>
                  <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right">
                    Total Hutang
                  </th>
                  <th className="py-3 px-6 text-[11px] font-extrabold text-muted-faint uppercase text-right">
                    Posisi Bersih (Netting)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-subtle">
                {netting.rows.map((row) => (
                  <tr
                    key={row.counterpartyKey}
                    className="hover:bg-surface-hover/30 transition-colors"
                  >
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-extrabold uppercase ${
                          row.status === "UTANG"
                            ? "bg-status-red/15 text-status-red"
                            : row.status === "PIUTANG"
                            ? "bg-status-green/15 text-status-green"
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
                    <td className="py-3.5 px-4 font-bold text-navy-text text-[13px]">
                      {row.fullName}{" "}
                      <span className="text-muted-faint font-normal text-[12px]">({row.shortName})</span>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-muted-stronger text-[12.5px]">
                      {row.piutangFmt}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-muted-stronger text-[12.5px]">
                      {row.hutangFmt}
                    </td>
                    <td className="py-3.5 px-6 text-right tabular-nums">
                      <span
                        className={`font-extrabold text-[13px] px-2.5 py-1 rounded-md ${
                          row.status === "UTANG"
                            ? "text-status-red bg-red-500/5 font-mono"
                            : row.status === "PIUTANG"
                            ? "text-status-green bg-green-500/5"
                            : "text-muted-stronger"
                        }`}
                      >
                        {row.netFmt}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Total Netting Row */}
                <tr className="bg-surface-subtle/80 font-extrabold text-navy-text border-t-2 border-border-soft">
                  <td colSpan={2} className="py-3.5 px-6 text-left uppercase text-[12px] tracking-wider">
                    Total Posisi Bersih Antar-Grup
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-[12.5px] text-status-green">
                    {rekapPiutang.totalPiutangFmt}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-[12.5px] text-status-red">
                    {rekapHutang.totalHutangFmt}
                  </td>
                  <td className="py-3.5 px-6 text-right tabular-nums">
                    <span
                      className={`text-[14px] font-extrabold underline decoration-double ${
                        isNetKreditur
                          ? "text-status-green"
                          : isNetDebitur
                          ? "text-status-red font-mono"
                          : "text-navy-text"
                      }`}
                    >
                      {netting.posisiBersihGlobalFmt}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section: Riwayat Transaksi Jurnal Afiliasi ── */}
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
          <button
            onClick={() => setShowTxDetail((prev) => !prev)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-surface-hover/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Receipt size={16} className="text-muted-stronger" />
              <div>
                <div className="text-[13px] font-bold text-navy-text">
                  Buku Pembantu & Riwayat Transaksi Afiliasi ({transactions.length})
                </div>
                <div className="text-[11.5px] text-muted">
                  Klik untuk melihat rincian jurnal mutasi akun 111-115 dan 311-315 di tahun {year}
                </div>
              </div>
            </div>
            <div className="p-1 rounded-lg text-muted-faint">
              {showTxDetail ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </button>

          {showTxDetail && (
            <div className="border-t border-surface-hover">
              {transactions.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted">
                  Belum ada mutasi transaksi pada akun hutang/piutang afiliasi di tahun {year}.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface-subtle border-b border-border-soft">
                      <tr className="text-left text-[11px] font-bold text-muted-faint uppercase">
                        <th className="py-2.5 px-6">Tanggal</th>
                        <th className="py-2.5 px-3">No Bukti</th>
                        <th className="py-2.5 px-3">Pihak Rekanan</th>
                        <th className="py-2.5 px-3">Akun COA</th>
                        <th className="py-2.5 px-4">Keterangan</th>
                        <th className="py-2.5 px-3 text-right">Debit</th>
                        <th className="py-2.5 px-6 text-right">Kredit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-subtle text-[12px]">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-surface-hover/20">
                          <td className="py-2.5 px-6 text-muted font-medium whitespace-nowrap">
                            {tx.tanggal}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-navy-text">
                            {tx.noBukti}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-navy-text whitespace-nowrap">
                            {tx.counterpartyName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-muted-stronger">
                            {tx.coaCode} - {tx.coaName}
                          </td>
                          <td className="py-2.5 px-4 text-muted-stronger max-w-[240px] truncate">
                            {tx.keterangan}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-medium text-navy-text">
                            {tx.debit > 0 ? tx.debitFmt : "-"}
                          </td>
                          <td className="py-2.5 px-6 text-right tabular-nums font-medium text-navy-text">
                            {tx.kredit > 0 ? tx.kreditFmt : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 2: SEMUA ENTITAS (Konsolidasi & Matriks Antar-Grup)
  // ──────────────────────────────────────────────────────────────────────────
  if (grupData) {
    const { entities, matrix, totalsByEntity, grandTotalPiutang, grandTotalHutang, reconciliations } =
      grupData;

    return (
      <div className="flex flex-col gap-6">
        {/* ── Summary Header Grup ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
            <span className="text-[11px] font-bold text-muted-faint uppercase tracking-wider block mb-1">
              Total Piutang Seluruh Entitas
            </span>
            <div className="text-[20px] font-extrabold text-status-green tabular-nums">
              {formatStandardRupiah(grandTotalPiutang)}
            </div>
            <p className="text-[11.5px] text-muted mt-1">Akumulasi seluruh akun 111–115</p>
          </div>

          <div className="bg-surface-card rounded-[20px] border border-border-soft p-5 shadow-xs">
            <span className="text-[11px] font-bold text-muted-faint uppercase tracking-wider block mb-1">
              Total Hutang Seluruh Entitas
            </span>
            <div className="text-[20px] font-extrabold text-status-red tabular-nums">
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
                  <CheckCircle2 size={18} className="text-status-green" />
                  <span className="text-[15px] font-extrabold text-status-green">
                    100% Saling Hapus (Diff Rp 0)
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={18} className="text-status-red" />
                  <span className="text-[14px] font-extrabold text-status-red">
                    Selisih Rp {Math.abs(grandTotalPiutang - grandTotalHutang).toLocaleString("id-ID")}
                  </span>
                </>
              )}
            </div>
            <p className="text-[11.5px] text-muted mt-1">
              Secara konsolidasi grup, piutang dan hutang internal harus saling meniadakan.
            </p>
          </div>
        </div>

        {/* ── Matriks Saldo Silang Antar-Entitas (Inter-Company Grid) ── */}
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-surface-hover flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Building2 size={18} className="text-brand" />
              <div>
                <h3 className="text-[14px] font-extrabold text-navy-text">
                  Matriks Posisi Saldo Antar-Entitas (Inter-Company Matrix) {year}
                </h3>
                <p className="text-[12px] text-muted mt-0.5">
                  Melihat hubungan timbal-balik piutang & hutang antar setiap entitas grup
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-hover bg-surface-subtle/50 text-left">
                  <th className="py-3 px-5 text-[11px] font-extrabold text-muted-faint uppercase">
                    Entitas
                  </th>
                  {entities.map((e) => (
                    <th
                      key={e.key}
                      className="py-3 px-3 text-[11px] font-extrabold text-muted-faint uppercase text-center"
                    >
                      {e.shortName}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right">
                    Total Piutang
                  </th>
                  <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right">
                    Total Hutang
                  </th>
                  <th className="py-3 px-5 text-[11px] font-extrabold text-muted-faint uppercase text-right">
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
                      <td className="py-3.5 px-5 font-bold text-navy-text text-[13px]">
                        {rowEnt.name}{" "}
                        <span className="text-[11px] text-muted-faint font-normal">
                          ({rowEnt.shortName})
                        </span>
                      </td>
                      {entities.map((colEnt) => {
                        if (colEnt.key === rowEnt.key) {
                          return (
                            <td key={colEnt.key} className="py-3 px-3 text-center bg-surface-subtle/40 text-muted-faint font-bold">
                              —
                            </td>
                          );
                        }
                        const cell = matrix[rowEnt.key]?.[colEnt.key] ?? { piutang: 0, hutang: 0, net: 0 };
                        return (
                          <td key={colEnt.key} className="py-3 px-3 text-center tabular-nums">
                            {cell.net === 0 ? (
                              <span className="text-[11.5px] text-muted-faint">Rp 0</span>
                            ) : cell.net > 0 ? (
                              <span className="text-[11.5px] font-bold text-status-green">
                                +{formatAccountingRupiah(cell.net)}
                              </span>
                            ) : (
                              <span className="text-[11.5px] font-bold text-status-red font-mono">
                                {formatAccountingRupiah(cell.net)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-status-green text-[12.5px]">
                        {formatAccountingRupiah(totals.totalPiutang)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-status-red text-[12.5px]">
                        {formatAccountingRupiah(totals.totalHutang)}
                      </td>
                      <td className="py-3.5 px-5 text-right tabular-nums">
                        <span
                          className={`font-extrabold text-[12.5px] px-2 py-0.5 rounded-md ${
                            totals.status === "PIUTANG"
                              ? "text-status-green bg-green-500/10"
                              : totals.status === "UTANG"
                              ? "text-status-red bg-red-500/10 font-mono"
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

        {/* ── Tabel Rekonsiliasi Timbal-Balik (A vs B) ── */}
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-surface-hover flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-extrabold text-navy-text">
                Audit & Rekonsiliasi Timbal-Balik Antar-Pasangan Entitas
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
                  <th className="py-3 px-6">Pasangan Entitas</th>
                  <th className="py-3 px-4 text-right">Piutang A ke B</th>
                  <th className="py-3 px-4 text-right">Hutang B ke A</th>
                  <th className="py-3 px-6 text-center">Status Rekonsiliasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-subtle text-[12.5px]">
                {reconciliations.map((rec, i) => (
                  <tr key={i} className="hover:bg-surface-hover/20">
                    <td className="py-3 px-6 font-bold text-navy-text">
                      {rec.entityA.name} ({rec.entityA.shortName}) <span className="text-muted-faint">↔</span>{" "}
                      {rec.entityB.name} ({rec.entityB.shortName})
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-stronger font-medium">
                      {formatAccountingRupiah(rec.piutangAB)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-stronger font-medium">
                      {formatAccountingRupiah(rec.hutangBA)}
                    </td>
                    <td className="py-3 px-6 text-center">
                      {rec.isMatchAB ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-500/10 text-status-green">
                          <CheckCircle2 size={13} /> Sinkron
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-status-red">
                          <AlertTriangle size={13} /> Selisih Rp {Math.abs(rec.diffAB).toLocaleString("id-ID")}
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
      Silakan pilih entitas atau tahun untuk menampilkan Laporan Hutang & Piutang.
    </div>
  );
}
