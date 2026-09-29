"use client";

import Link from "next/link";
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
  ArrowRight,
  ExternalLink,
  ArrowUpDown,
  Filter,
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
  const [showTxDetail, setShowTxDetail] = useState(true);
  const [filterCp, setFilterCp] = useState<string>("ALL");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
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

        {/* ── Side-by-Side Tables (Format Presisi Sesuai Excel Tim Finance) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ── Table Kiri: REKAP HUTANG ── */}
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
              <span className="p-1.5 rounded-lg bg-status-red/10 text-status-red">
                <ArrowUpCircle size={16} />
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-hover text-left bg-surface-card">
                    <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase">
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
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-navy-text text-[13px]">
                          Kas dan Bank {row.shortName}
                        </div>
                        <div className="text-[11px] text-muted-faint font-mono">
                          Akun {row.code} · {row.fullName}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-muted-stronger text-[12.5px] font-mono">
                        {row.hutangLaluFmt}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-muted-stronger text-[12.5px] font-mono">
                        {row.hutangTahunIniFmt}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-navy-text text-[13px] font-mono">
                        {row.totalHutangFmt}
                      </td>
                    </tr>
                  ))}
                  {/* Total Hutang Row */}
                  <tr className="bg-surface-subtle font-extrabold text-navy-text border-t-2 border-border-soft">
                    <td className="py-3.5 px-4 uppercase text-[11px] tracking-wider">
                      Total Hutang per {year}
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums text-[12px] font-mono text-muted-stronger">
                      {rekapHutang.totalHutangLaluFmt}
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums text-[12px] font-mono text-muted-stronger">
                      {rekapHutang.totalHutangTahunIniFmt}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-[13.5px] font-mono text-status-red underline decoration-double">
                      {rekapHutang.totalHutangFmt}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Table Kanan: PIUTANG ── */}
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
              <span className="p-1.5 rounded-lg bg-status-green/10 text-status-green">
                <ArrowDownCircle size={16} />
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-hover text-left bg-surface-card">
                    <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase">
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
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-navy-text text-[13px]">
                          PIUTANG {row.shortName}
                        </div>
                        <div className="text-[11px] text-muted-faint font-mono">
                          Akun {row.code} · {row.fullName}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-muted-stronger text-[12.5px] font-mono">
                        {row.piutangLaluFmt}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums font-bold text-navy-text text-[13px] font-mono">
                        {row.piutangBerjalanFmt}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-muted-stronger text-[12.5px] font-mono">
                        {row.perubahanFmt}
                      </td>
                    </tr>
                  ))}
                  {/* Total Piutang Row */}
                  <tr className="bg-surface-subtle font-extrabold text-navy-text border-t-2 border-border-soft">
                    <td className="py-3.5 px-4 uppercase text-[11px] tracking-wider">
                      Total Piutang
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums text-[12px] font-mono text-muted-stronger">
                      {rekapPiutang.totalPiutangLaluFmt}
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums text-[13.5px] font-mono text-status-green underline decoration-double">
                      {rekapPiutang.totalPiutangFmt}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-[12px] font-mono text-muted-stronger">
                      {rekapPiutang.totalPerubahanFmt}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Section Bawah: HASIL NETTING (POSISI YANG MASUK KE NERACA) ── */}
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
          <div className="px-6 py-5 border-b border-surface-hover flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-brand/10 text-brand">
                  <Scale size={18} />
                </span>
                <h3 className="text-[15px] font-extrabold text-navy-text">
                  Hasil Netting Posisi Bersih Antar-Entitas (Masuk ke Neraca)
                </h3>
              </div>
              <p className="text-[12px] text-muted mt-1">
                Format perhitungan selisih antara Piutang dan Hutang per rekanan afiliasi (Piutang − Hutang)
              </p>
            </div>
            <Link
              href={`/neraca?entity=${entity.key}&year=${year}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-subtle hover:bg-surface-hover text-navy-text text-[12px] font-bold border border-border-soft transition-colors w-fit"
            >
              <span>Buka Laporan Neraca</span>
              <ExternalLink size={13} className="text-muted-stronger" />
            </Link>
          </div>

          <div className="p-6 flex flex-col gap-6">

            {/* ── Tabel Utama Netting (Format Lembar Kerja Excel Tim Finance) ── */}
            <div className="overflow-x-auto rounded-xl border border-border-soft">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-hover text-left bg-surface-subtle/50">
                    <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase">
                      Posisi Neraca
                    </th>
                    <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase">
                      Entitas Rekanan
                    </th>
                    <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right">
                      Saldo Awal Lalu
                    </th>
                    <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right text-status-green">
                      Penambahan (+)
                    </th>
                    <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase text-right text-status-red">
                      Pengurangan (−)
                    </th>
                    <th className="py-3 px-5 text-[11px] font-extrabold text-muted-faint uppercase text-right">
                      Saldo Akhir Netto
                    </th>
                    <th className="py-3 px-4 text-[11px] font-extrabold text-muted-faint uppercase">
                      Penempatan di Neraca
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-subtle">
                  {netting.rows.map((row) => (
                    <tr
                      key={row.counterpartyKey}
                      className="hover:bg-surface-hover/30 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-extrabold uppercase tracking-wide ${
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
                      <td className="py-3.5 px-4 font-bold text-navy-text text-[13px] uppercase">
                        {row.fullName}{" "}
                        <span className="text-muted-faint font-normal text-[11.5px]">({row.shortName})</span>
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-muted-stronger text-[12.5px] font-mono">
                        {row.saldoAwalNetFmt}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-status-green text-[12.5px] font-mono">
                        {row.penambahanPiutang > 0 ? `+${row.penambahanPiutangFmt}` : "Rp -"}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-status-red text-[12.5px] font-mono">
                        {row.penambahanHutang > 0 ? `−${row.penambahanHutangFmt}` : "Rp -"}
                      </td>
                      <td className="py-3.5 px-5 text-right tabular-nums">
                        <span
                          className={`font-extrabold text-[13.5px] px-2.5 py-1 rounded-md font-mono ${
                            row.status === "UTANG"
                              ? "text-status-red bg-red-500/5"
                              : row.status === "PIUTANG"
                              ? "text-status-green bg-green-500/5"
                              : "text-muted-stronger"
                          }`}
                        >
                          {row.netFmt}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-semibold ${
                            row.status === "UTANG"
                              ? "bg-status-red/10 text-status-red"
                              : row.status === "PIUTANG"
                              ? "bg-status-green/10 text-status-green"
                              : "bg-surface-subtle text-muted"
                          }`}
                        >
                          {row.neracaPosition}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Total Netting Row */}
                  <tr className="bg-surface-subtle/80 font-extrabold text-navy-text border-t-2 border-border-soft">
                    <td colSpan={2} className="py-3.5 px-4 text-left uppercase text-[11.5px] tracking-wider">
                      Total Posisi Bersih Antar-Grup
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-[12px] text-muted-stronger font-mono">
                      {formatAccountingRupiah(rekapPiutang.totalPiutangLalu - rekapHutang.totalHutangLalu)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-[12px] text-status-green font-mono">
                      {rekapPiutang.totalPerubahan > 0 ? `+${rekapPiutang.totalPerubahanFmt}` : "Rp -"}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-[12px] text-status-red font-mono">
                      {rekapHutang.totalHutangTahunIni > 0 ? `−${rekapHutang.totalHutangTahunIniFmt}` : "Rp -"}
                    </td>
                    <td className="py-3.5 px-5 text-right tabular-nums">
                      <span
                        className={`text-[14px] font-extrabold underline decoration-double font-mono ${
                          isNetKreditur
                            ? "text-status-green"
                            : isNetDebitur
                            ? "text-status-red"
                            : "text-navy-text"
                        }`}
                      >
                        {netting.posisiBersihGlobalFmt}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[11.5px] text-muted">
                      {isNetKreditur ? "Net Hak Tagih (Kreditur)" : isNetDebitur ? "Net Kewajiban (Debitur)" : "Seimbang"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Ringkasan Cepat Posisi Neraca (Sesuai Format 3 Kolom Excel) ── */}
            <div>
              <div className="text-[11px] font-bold text-muted-faint uppercase tracking-wider mb-2.5">
                Ringkasan Cepat Posisi Neraca (Format Templat Excel)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {netting.rows.map((row) => (
                  <div
                    key={row.counterpartyKey}
                    className={`p-3.5 rounded-xl border transition-all ${
                      row.status === "UTANG"
                        ? "bg-status-red/5 border-status-red/20"
                        : row.status === "PIUTANG"
                        ? "bg-status-green/5 border-status-green/20"
                        : "bg-surface-subtle/30 border-border-soft"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          row.status === "UTANG"
                            ? "bg-status-red/15 text-status-red"
                            : row.status === "PIUTANG"
                            ? "bg-status-green/15 text-status-green"
                            : "bg-surface-hover text-muted"
                        }`}
                      >
                        {row.status}
                      </span>
                      <span className="text-[11.5px] font-bold text-navy-text uppercase tracking-tight">
                        {row.fullName}
                      </span>
                    </div>
                    <div
                      className={`text-[15px] font-extrabold tabular-nums font-mono ${
                        row.status === "UTANG"
                          ? "text-status-red"
                          : row.status === "PIUTANG"
                          ? "text-status-green"
                          : "text-muted"
                      }`}
                    >
                      {row.netFmt}
                    </div>
                    <div className="text-[10.5px] text-muted mt-1 truncate">
                      {row.neracaPosition}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Section: Riwayat Transaksi Jurnal Afiliasi (Buku Pembantu Rekanan) ── */}
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden shadow-xs">
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-hover">
            <div className="flex items-center gap-2.5">
              <Receipt size={18} className="text-brand" />
              <div>
                <div className="text-[14px] font-extrabold text-navy-text flex items-center gap-2">
                  <span>Buku Pembantu & Riwayat Transaksi Afiliasi</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-surface-subtle border border-border-soft text-navy-text font-mono">
                    {transactions.length} mutasi
                  </span>
                </div>
                <div className="text-[11.5px] text-muted">
                  Kartu mutasi transaksi piutang & hutang antar-rekanan dengan tampilan Saldo Berjalan (Running Balance)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSortAsc(!sortAsc)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold rounded-xl border border-border-soft bg-surface-subtle hover:bg-surface-hover text-navy-text transition-colors"
                title="Ubah urutan tanggal transaksi"
              >
                <ArrowUpDown size={13} className="text-muted-stronger" />
                <span>{sortAsc ? "Urutan: Terlama Dulu" : "Urutan: Terbaru Dulu"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTxDetail((prev) => !prev)}
                className="p-1.5 rounded-xl border border-border-soft hover:bg-surface-hover text-muted-stronger transition-colors"
                title={showTxDetail ? "Sembunyikan detail" : "Buka detail"}
              >
                {showTxDetail ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>

          {showTxDetail && (
            <div className="p-6 flex flex-col gap-4">
              {/* Filter Tabs Rekanan */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-faint uppercase mr-1 flex items-center gap-1">
                  <Filter size={12} />
                  <span>Filter Rekanan:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFilterCp("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-all ${
                    filterCp === "ALL"
                      ? "bg-brand text-white shadow-xs"
                      : "bg-surface-subtle hover:bg-surface-hover text-navy-text border border-border-soft"
                  }`}
                >
                  Semua Rekanan ({transactions.length})
                </button>
                {netting.rows.map((r) => {
                  const cpTxCount = transactions.filter((t) => t.counterpartyKey === r.counterpartyKey).length;
                  return (
                    <button
                      key={r.counterpartyKey}
                      type="button"
                      onClick={() => setFilterCp(r.counterpartyKey)}
                      className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-all flex items-center gap-1.5 ${
                        filterCp === r.counterpartyKey
                          ? "bg-brand text-white shadow-xs"
                          : "bg-surface-subtle hover:bg-surface-hover text-navy-text border border-border-soft"
                      }`}
                    >
                      <span>{r.fullName} ({r.shortName})</span>
                      {cpTxCount > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            filterCp === r.counterpartyKey
                              ? "bg-white/20 text-white"
                              : "bg-surface-hover text-muted-stronger"
                          }`}
                        >
                          {cpTxCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Banner Ringkasan Kartu Rekanan yang Sedang Dipilih */}
              {filterCp !== "ALL" && (() => {
                const selRow = netting.rows.find((r) => r.counterpartyKey === filterCp);
                if (!selRow) return null;
                return (
                  <div className="bg-surface-subtle/70 rounded-2xl border border-border-soft p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-extrabold text-muted-faint uppercase tracking-wider">
                          Kartu Rekening Koran Rekanan:
                        </span>
                        <span className="text-[13px] font-extrabold text-navy-text">
                          {selRow.fullName} ({selRow.shortName})
                        </span>
                      </div>
                      <p className="text-[11.5px] text-muted mt-0.5">
                        Pengeluaran untuk rekanan menambah piutang (+), talangan/dana masuk dari rekanan mengurangi piutang (−)
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm font-mono">
                      <div>
                        <span className="text-[10px] font-sans font-bold text-muted-faint uppercase block">
                          Saldo Awal Lalu
                        </span>
                        <span className="text-[12.5px] font-bold text-muted-stronger">
                          {selRow.saldoAwalNetFmt}
                        </span>
                      </div>
                      <span className="text-muted-faint font-bold">+</span>
                      <div>
                        <span className="text-[10px] font-sans font-bold text-muted-faint uppercase block text-status-green">
                          Penambahan (+)
                        </span>
                        <span className="text-[12.5px] font-bold text-status-green">
                          {selRow.penambahanPiutangFmt}
                        </span>
                      </div>
                      <span className="text-muted-faint font-bold">−</span>
                      <div>
                        <span className="text-[10px] font-sans font-bold text-muted-faint uppercase block text-status-red">
                          Pengurangan (−)
                        </span>
                        <span className="text-[12.5px] font-bold text-status-red">
                          {selRow.penambahanHutangFmt}
                        </span>
                      </div>
                      <span className="text-muted-faint font-bold">=</span>
                      <div className="px-3 py-1.5 rounded-xl bg-surface-card border border-border-soft">
                        <span className="text-[10px] font-sans font-bold text-muted-faint uppercase block">
                          Saldo Akhir Bersih
                        </span>
                        <span
                          className={`text-[13.5px] font-extrabold ${
                            selRow.status === "PIUTANG"
                              ? "text-status-green"
                              : selRow.status === "UTANG"
                              ? "text-status-red"
                              : "text-navy-text"
                          }`}
                        >
                          {selRow.netFmt} ({selRow.status})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tabel Transaksi dengan Kolom Penambahan, Pengurangan, dan Saldo Akhir */}
              {(() => {
                const displayedTx = transactions
                  .filter((tx) => filterCp === "ALL" || tx.counterpartyKey === filterCp)
                  .sort((a, b) => {
                    const da = new Date(a.tanggalRaw || a.tanggal).getTime();
                    const db = new Date(b.tanggalRaw || b.tanggal).getTime();
                    return sortAsc ? da - db : db - da;
                  });

                if (displayedTx.length === 0) {
                  return (
                    <div className="p-8 text-center text-sm text-muted rounded-xl border border-dashed border-border-soft">
                      Belum ada mutasi transaksi pada akun hutang/piutang untuk rekanan ini di tahun {year}.
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto rounded-xl border border-border-soft max-h-[460px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-surface-subtle border-b border-border-soft z-10">
                        <tr className="text-left text-[11px] font-extrabold text-muted-faint uppercase">
                          <th className="py-2.5 px-4">Tanggal</th>
                          <th className="py-2.5 px-3">No Bukti</th>
                          <th className="py-2.5 px-3">Pihak Rekanan</th>
                          <th className="py-2.5 px-4">Keterangan</th>
                          <th className="py-2.5 px-3 text-center">Efek Saldo</th>
                          <th className="py-2.5 px-3 text-right text-status-green">Penambahan (+)</th>
                          <th className="py-2.5 px-3 text-right text-status-red">Pengurangan (−)</th>
                          <th className="py-2.5 px-4 text-right">Saldo Akhir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-subtle text-[12px]">
                        {displayedTx.map((tx) => {
                          const isTambah = tx.efekSaldo === "TAMBAH";
                          return (
                            <tr key={tx.id} className="hover:bg-surface-hover/30 transition-colors">
                              <td className="py-2.5 px-4 text-muted font-medium whitespace-nowrap">
                                {tx.tanggal}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-navy-text font-semibold">
                                {tx.noBukti}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-navy-text whitespace-nowrap">
                                {tx.counterpartyName}
                              </td>
                              <td className="py-2.5 px-4 text-muted-stronger max-w-[240px] truncate" title={tx.keterangan}>
                                {tx.keterangan}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold uppercase ${
                                    isTambah
                                      ? "bg-status-green/15 text-status-green"
                                      : "bg-status-red/15 text-status-red"
                                  }`}
                                >
                                  {isTambah ? "+ Piutang" : "− Hutang"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums font-mono font-medium text-status-green">
                                {isTambah ? tx.nominalMutasiFmt : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums font-mono font-medium text-status-red">
                                {!isTambah ? tx.nominalMutasiFmt : "—"}
                              </td>
                              <td className="py-2.5 px-4 text-right tabular-nums font-mono">
                                <span
                                  className={`font-bold px-2 py-0.5 rounded text-[12.5px] ${
                                    tx.saldoAkhir > 0
                                      ? "text-status-green bg-green-500/10"
                                      : tx.saldoAkhir < 0
                                      ? "text-status-red bg-red-500/10"
                                      : "text-muted bg-surface-subtle"
                                  }`}
                                >
                                  {tx.saldoAkhirFmt}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
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
