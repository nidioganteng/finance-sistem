"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  Download,
  FileSpreadsheet,
  Building2,
  Banknote,
  Calculator,
  X,
  Check,
  Info,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import {
  type RekonsiliasiPajakGajiData,
  type RekonsiliasiGajiPph21Item,
} from "@/lib/rekonsiliasi-pajak-gaji";
import { saveRekonsiliasiGajiPph21Action } from "@/lib/actions/rekonsiliasi-pajak-gaji";
import { formatRupiah } from "@/lib/dashboard-data";

export function RekonsiliasiPajakGajiClient({
  data,
  entityKey,
  canEdit = true,
}: {
  data: RekonsiliasiPajakGajiData;
  entityKey: string;
  canEdit?: boolean;
}) {
  // Modal Edit state
  const [editingItem, setEditingItem] = useState<RekonsiliasiGajiPph21Item | null>(null);
  const [gajiTerlapor, setGajiTerlapor] = useState<string>("");
  const [pph21Terlapor, setPph21Terlapor] = useState<string>("");
  const [gajiPegawaiTerlapor, setGajiPegawaiTerlapor] = useState<string>("");
  const [gajiTaTerlapor, setGajiTaTerlapor] = useState<string>("");
  const [ntpn, setNtpn] = useState<string>("");
  const [keterangan, setKeterangan] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  function openEditModal(item: RekonsiliasiGajiPph21Item) {
    setEditingItem(item);
    setGajiTerlapor(item.gajiTerlapor > 0 ? String(item.gajiTerlapor) : "");
    setPph21Terlapor(item.pph21Terlapor > 0 ? String(item.pph21Terlapor) : "");
    setGajiPegawaiTerlapor(
      item.gajiPegawaiTerlapor > 0 ? String(item.gajiPegawaiTerlapor) : ""
    );
    setGajiTaTerlapor(item.gajiTaTerlapor > 0 ? String(item.gajiTaTerlapor) : "");
    setNtpn(item.ntpn ?? "");
    setKeterangan(item.keterangan ?? "");
    setErrorMsg(null);
    setSuccessMsg(null);
  }

  function closeEditModal() {
    setEditingItem(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  }

  // Auto kalkulasi total gaji jika mengisi rincian pegawai & TA
  function handleGajiPegawaiChange(val: string) {
    setGajiPegawaiTerlapor(val);
    const nPeg = Number(val) || 0;
    const nTa = Number(gajiTaTerlapor) || 0;
    if (nPeg > 0 || nTa > 0) {
      setGajiTerlapor(String(nPeg + nTa));
    }
  }

  function handleGajiTaChange(val: string) {
    setGajiTaTerlapor(val);
    const nPeg = Number(gajiPegawaiTerlapor) || 0;
    const nTa = Number(val) || 0;
    if (nPeg > 0 || nTa > 0) {
      setGajiTerlapor(String(nPeg + nTa));
    }
  }

  async function handleSave() {
    if (!editingItem) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    const inputGaji = Number(gajiTerlapor) || 0;
    const inputPph = Number(pph21Terlapor) || 0;
    const inputPeg = Number(gajiPegawaiTerlapor) || 0;
    const inputTa = Number(gajiTaTerlapor) || 0;

    const res = await saveRekonsiliasiGajiPph21Action({
      entityId: data.entityId,
      year: data.year,
      month: editingItem.month,
      gajiTerlapor: inputGaji,
      pph21Terlapor: inputPph,
      gajiPegawaiTerlapor: inputPeg,
      gajiTaTerlapor: inputTa,
      ntpn: ntpn.trim() || undefined,
      keterangan: keterangan.trim() || undefined,
    });

    setIsSubmitting(false);

    if (res?.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg("Data SPT berhasil disimpan!");
      setTimeout(() => {
        closeEditModal();
        window.location.reload();
      }, 700);
    }
  }

  async function handleExportExcel() {
    try {
      setIsExporting(true);
      const url = `/api/pajak/export-gaji?entityKey=${encodeURIComponent(
        entityKey
      )}&year=${data.year}`;
      window.location.href = url;
    } catch {
      alert("Gagal mengunduh file Excel");
    } finally {
      setTimeout(() => setIsExporting(false), 2000);
    }
  }

  // Kalkulasi selisih simulasi live preview di modal
  const simGaji = Number(gajiTerlapor) || 0;
  const simPph = Number(pph21Terlapor) || 0;
  const simSelisihGaji = (editingItem?.gajiTotalJurnal ?? 0) - simGaji;
  const simSelisihPph = (editingItem?.pph21Basis ?? 0) - simPph;

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* AUDIT STATUS BANNER & KONTROL */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-surface-card border border-border-soft shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-500/20">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-navy-text">
                Audit Rekonsiliasi Pajak Gaji & PPh 21 (SPT Masa 1721)
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-surface-subtle text-navy-soft border border-border-soft">
                Tahun Pajak {data.year}
              </span>
            </div>
            <p className="text-xs text-navy-soft mt-1 max-w-3xl leading-relaxed">
              Membandingkan realisasi beban biaya gaji dan potongan PPh 21 di Jurnal Umum
              (Akun 511, 612 & 533) terhadap nilai objek bruto dan pajak terutang yang
              dilaporkan pada SPT Masa PPh 21 resmi kantor pajak.
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          <label className="flex items-center gap-2 text-xs font-semibold text-navy-soft cursor-pointer px-3 py-2 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border-soft transition-colors select-none">
            <input
              type="checkbox"
              checked={showBreakdown}
              onChange={(e) => setShowBreakdown(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span>Rincian Pegawai & TA</span>
          </label>

          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isExporting ? "Mengunduh..." : "Ekspor Excel"}</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4 CARD RINGKASAN AUDIT (KPI BALANCE CHECK) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gaji Jurnal vs SPT */}
        <div className="bg-surface-card rounded-2xl border border-border-soft p-4.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-navy-soft">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Beban Gaji (Bruto)
            </span>
            <Banknote className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-navy-text tabular-nums">
              {data.summary.totalGajiJurnalFmt}
            </div>
            <div className="text-xs text-navy-soft mt-0.5 flex items-center justify-between">
              <span>SPT Terlapor:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {data.summary.totalGajiTerlaporFmt}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-border-soft flex items-center justify-between text-xs">
            <span className="text-navy-soft font-medium">Selisih Bruto:</span>
            <span
              className={`font-bold tabular-nums ${
                Math.abs(data.summary.totalSelisihGaji) > 0.01
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {data.summary.totalSelisihGajiFmt}
            </span>
          </div>
        </div>

        {/* Card 2: PPh 21 Terutang */}
        <div className="bg-surface-card rounded-2xl border border-border-soft p-4.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-navy-soft">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              PPh 21 Jurnal / Payroll
            </span>
            <Calculator className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-navy-text tabular-nums text-purple-700 dark:text-purple-400">
              {data.summary.totalPph21BasisFmt}
            </div>
            <div className="text-xs text-navy-soft mt-0.5 flex items-center justify-between">
              <span>SPT Terlapor:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {data.summary.totalPph21TerlaporFmt}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-border-soft flex items-center justify-between text-xs">
            <span className="text-navy-soft font-medium">Selisih PPh 21:</span>
            <span
              className={`font-bold tabular-nums ${
                Math.abs(data.summary.totalSelisihPph21) > 0.01
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {data.summary.totalSelisihPph21Fmt}
            </span>
          </div>
        </div>

        {/* Card 3: Status Balance Audit */}
        <div className="bg-surface-card rounded-2xl border border-border-soft p-4.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-navy-soft">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Audit Kepatuhan
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-navy-text">
                {data.summary.jumlahBulanMatch}
              </span>
              <span className="text-xs text-navy-soft">/ 12 Bulan Sesuai</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs">
              {data.summary.jumlahBulanSelisih > 0 ? (
                <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {data.summary.jumlahBulanSelisih} Bulan Selisih
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  0 Selisih
                </span>
              )}
              {data.summary.jumlahBulanBelumLapor > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {data.summary.jumlahBulanBelumLapor} Belum Lapor
                </span>
              )}
            </div>
          </div>
          <div className="pt-2 border-t border-border-soft">
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                data.summary.overallStatus === "ALL_BALANCED"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : data.summary.overallStatus === "HAS_DIFF"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              }`}
            >
              {data.summary.overallStatus === "ALL_BALANCED"
                ? "Semua Periode Balance ✅"
                : data.summary.overallStatus === "HAS_DIFF"
                ? "Perlu Audit / Revisi SPT ⚠️"
                : "Ada SPT Belum Dilaporkan ⏳"}
            </span>
          </div>
        </div>

        {/* Card 4: Jurnal vs Modul Payroll */}
        <div className="bg-surface-card rounded-2xl border border-border-soft p-4.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-navy-soft">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Verifikasi Payroll Internal
            </span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-navy-text flex items-center justify-between">
              <span>Total Payroll:</span>
              <span className="tabular-nums font-extrabold text-navy-text">
                {data.summary.totalGajiPayrollFmt}
              </span>
            </div>
            <div className="text-xs text-navy-soft mt-1 flex items-center justify-between">
              <span>Beban Jurnal:</span>
              <span className="tabular-nums font-semibold">
                {data.summary.totalGajiJurnalFmt}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-border-soft flex items-center justify-between text-xs">
            <span className="text-navy-soft font-medium">Sinkronisasi:</span>
            {Math.abs(data.summary.totalGajiJurnal - data.summary.totalGajiPayroll) <
            1 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> 100% Sinkron
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                Selisih Rp{" "}
                {Math.abs(
                  data.summary.totalGajiJurnal - data.summary.totalGajiPayroll
                ).toLocaleString("id-ID")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TABEL KOMPARATIF PARALEL JURNAL VS SPT (LAPIS 3 FORMAT) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-surface-card rounded-2xl border border-border-soft p-5 shadow-xs space-y-4">
        {/* Table Legend */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-subtle border border-border-soft text-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-navy-soft">
              Kolom berlatar <strong className="text-blue-700 dark:text-blue-300">biru</strong> menunjukkan angka resmi SPT Masa yang dilaporkan. Kolom selisih berwarna <strong className="text-rose-600 dark:text-rose-400">merah</strong> mengindikasikan adanya selisih yang harus ditindaklanjuti.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Selisih Rp 0 = Balance
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-semibold">
              <AlertTriangle className="w-3 h-3 text-rose-600" /> Selisih ≠ 0 = Alert
            </span>
          </div>
        </div>

        {/* The Comparative Table */}
        <div className="overflow-x-auto rounded-xl border border-border-soft">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-surface-subtle text-navy-text border-b border-border-soft font-semibold">
              <tr>
                <th className="p-3 text-center w-10">Bulan</th>
                <th className="p-3">Masa Pajak</th>

                {/* Sub-group 1: Komparasi Gaji Bruto */}
                <th className="p-3 text-right">Gaji di Jurnal</th>
                {showBreakdown && (
                  <>
                    <th className="p-3 text-right text-navy-soft">Pegawai (511)</th>
                    <th className="p-3 text-right text-navy-soft">Tenaga Ahli (612)</th>
                  </>
                )}
                <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-300">
                  Gaji Terlapor (SPT)
                </th>
                <th className="p-3 text-right">Selisih Gaji</th>

                {/* Sub-group 2: Komparasi PPh 21 */}
                <th className="p-3 text-right text-purple-700 dark:text-purple-400">
                  PPh 21 Jurnal
                </th>
                <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-300">
                  PPh 21 Terlapor (SPT)
                </th>
                <th className="p-3 text-right">Selisih PPh 21</th>

                {/* Status & Kontrol */}
                <th className="p-3 text-center">Status Audit</th>
                <th className="p-3">Bukti / NTPN</th>
                <th className="p-3">Catatan / Tindak Lanjut</th>
                {canEdit && <th className="p-3 text-center w-14">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft text-navy-text">
              {data.items.map((row) => {
                const isMatch = row.status === "MATCH";
                const isSelisih = row.status === "SELISIH";
                const isBelumLapor = row.status === "BELUM_DILAPORKAN";

                const rowBg = isSelisih
                  ? "bg-rose-50/40 dark:bg-rose-500/10"
                  : isBelumLapor
                  ? "bg-amber-50/30 dark:bg-amber-500/10"
                  : "";

                return (
                  <tr
                    key={row.month}
                    className={`hover:bg-surface-hover/50 transition-colors ${rowBg}`}
                  >
                    <td className="p-3 text-center font-mono font-bold text-navy-soft">
                      {String(row.month).padStart(2, "0")}
                    </td>
                    <td className="p-3 font-semibold text-navy-text">
                      {row.namaBulan}
                    </td>

                    {/* Gaji di Jurnal */}
                    <td className="p-3 text-right font-mono font-medium">
                      {row.gajiTotalJurnalFmt}
                    </td>
                    {showBreakdown && (
                      <>
                        <td className="p-3 text-right font-mono text-navy-soft">
                          {formatRupiah(row.gajiPegawaiJurnal)}
                        </td>
                        <td className="p-3 text-right font-mono text-navy-soft">
                          {formatRupiah(row.gajiTaJurnal)}
                        </td>
                      </>
                    )}

                    {/* Gaji Terlapor (SPT) */}
                    <td className="p-3 text-right font-mono font-semibold bg-blue-50/30 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                      {row.gajiTerlaporFmt}
                    </td>

                    {/* Selisih Gaji */}
                    <td className="p-3 text-right font-mono">
                      <span
                        className={`font-semibold ${
                          Math.abs(row.selisihGaji) > 0.01
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {row.selisihGajiFmt}
                      </span>
                    </td>

                    {/* PPh 21 Jurnal */}
                    <td className="p-3 text-right font-mono font-medium text-purple-700 dark:text-purple-400">
                      {row.pph21BasisFmt}
                    </td>

                    {/* PPh 21 Terlapor (SPT) */}
                    <td className="p-3 text-right font-mono font-semibold bg-blue-50/30 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                      {row.pph21TerlaporFmt}
                    </td>

                    {/* Selisih PPh 21 */}
                    <td className="p-3 text-right font-mono">
                      <span
                        className={`font-semibold ${
                          Math.abs(row.selisihPph21) > 0.01
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {row.selisihPph21Fmt}
                      </span>
                    </td>

                    {/* Status Audit */}
                    <td className="p-3 text-center">
                      {isMatch ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> Balance
                        </span>
                      ) : isSelisih ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                          <AlertTriangle className="w-3 h-3" /> Selisih
                        </span>
                      ) : isBelumLapor ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          <Clock className="w-3 h-3" /> Belum Lapor
                        </span>
                      ) : (
                        <span className="text-[11px] text-navy-soft italic">
                          Nihil
                        </span>
                      )}
                    </td>

                    {/* NTPN / Bukti */}
                    <td className="p-3 font-mono text-[11px] text-navy-soft">
                      {row.ntpn || "-"}
                    </td>

                    {/* Catatan / Tindak Lanjut */}
                    <td className="p-3 text-navy-soft max-w-xs truncate">
                      {row.keterangan || "-"}
                    </td>

                    {/* Aksi Edit */}
                    {canEdit && (
                      <td className="p-3 text-center">
                        <button
                          onClick={() => openEditModal(row)}
                          className="p-1.5 rounded-lg hover:bg-surface-hover text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors cursor-pointer"
                          title="Input / Edit Data SPT Masa"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>

            {/* Total Row (Lapis 3 Footer) */}
            <tfoot className="bg-surface-subtle font-bold border-t-2 border-border-soft text-navy-text">
              <tr>
                <td colSpan={2} className="p-3 text-center uppercase tracking-wider">
                  Total Tahunan
                </td>

                {/* Total Jurnal */}
                <td className="p-3 text-right font-mono text-xs">
                  {data.summary.totalGajiJurnalFmt}
                </td>
                {showBreakdown && (
                  <>
                    <td className="p-3 text-right font-mono text-xs text-navy-soft">
                      {formatRupiah(
                        data.items.reduce((s, r) => s + r.gajiPegawaiJurnal, 0)
                      )}
                    </td>
                    <td className="p-3 text-right font-mono text-xs text-navy-soft">
                      {formatRupiah(
                        data.items.reduce((s, r) => s + r.gajiTaJurnal, 0)
                      )}
                    </td>
                  </>
                )}

                {/* Total SPT */}
                <td className="p-3 text-right font-mono text-xs text-blue-800 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-500/10">
                  {data.summary.totalGajiTerlaporFmt}
                </td>

                {/* Total Selisih Gaji */}
                <td className="p-3 text-right font-mono text-xs">
                  <span
                    className={
                      Math.abs(data.summary.totalSelisihGaji) > 0.01
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    {data.summary.totalSelisihGajiFmt}
                  </span>
                </td>

                {/* Total PPh 21 Jurnal */}
                <td className="p-3 text-right font-mono text-xs text-purple-700 dark:text-purple-400">
                  {data.summary.totalPph21BasisFmt}
                </td>

                {/* Total PPh 21 SPT */}
                <td className="p-3 text-right font-mono text-xs text-blue-800 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-500/10">
                  {data.summary.totalPph21TerlaporFmt}
                </td>

                {/* Total Selisih PPh 21 */}
                <td className="p-3 text-right font-mono text-xs">
                  <span
                    className={
                      Math.abs(data.summary.totalSelisihPph21) > 0.01
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    {data.summary.totalSelisihPph21Fmt}
                  </span>
                </td>

                {/* Status Overall */}
                <td className="p-3 text-center text-[11px]">
                  {data.summary.overallStatus === "ALL_BALANCED" ? (
                    <span className="text-emerald-600 font-bold">MATCH</span>
                  ) : (
                    <span className="text-rose-600 font-bold">
                      {data.summary.jumlahBulanSelisih} SELISIH
                    </span>
                  )}
                </td>

                <td colSpan={canEdit ? 3 : 2} className="p-3 text-navy-soft text-right text-[11px] font-normal">
                  Akumulasi Jan - Des {data.year}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL INPUT / EDIT DATA SPT PAJAK BULANAN */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-text/60 backdrop-blur-xs">
          <div className="bg-surface-card rounded-2xl border border-border-soft w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft bg-surface-subtle">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-200 dark:border-blue-500/20">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy-text">
                    Input SPT Masa PPh 21
                  </h3>
                  <p className="text-xs text-navy-soft">
                    Masa {editingItem.namaBulan} {data.year} — {data.entityName}
                  </p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                className="p-1 rounded-lg hover:bg-surface-hover text-navy-soft hover:text-navy-text transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Info Angka Sistem (Jurnal) */}
              <div className="p-3.5 rounded-xl bg-surface-subtle border border-border-soft space-y-1.5">
                <div className="font-bold text-navy-text text-[11px] uppercase tracking-wider">
                  Angka Tercatat di Sistem (Jurnal Umum)
                </div>
                <div className="grid grid-cols-2 gap-2 text-navy-soft">
                  <div>
                    <span>Total Beban Gaji:</span>{" "}
                    <strong className="text-navy-text font-mono">
                      {editingItem.gajiTotalJurnalFmt}
                    </strong>
                  </div>
                  <div>
                    <span>PPh 21 Jurnal/Payroll:</span>{" "}
                    <strong className="text-navy-text font-mono">
                      {editingItem.pph21BasisFmt}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Form Input SPT */}
              <div className="space-y-3.5">
                <div>
                  <label className="block font-semibold text-navy-text mb-1">
                    Penghasilan Bruto Dilaporkan (SPT Masa 1721) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-navy-soft font-mono">
                      Rp
                    </span>
                    <input
                      type="number"
                      placeholder="0"
                      value={gajiTerlapor}
                      onChange={(e) => setGajiTerlapor(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 text-sm bg-surface-card border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <span className="text-[11px] text-navy-soft mt-0.5 block">
                    Total seluruh objek penghasilan bruto yang tercantum pada Induk SPT.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-navy-text mb-1">
                    PPh Pasal 21 Terutang / Dilaporkan (Rp) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-navy-soft font-mono">
                      Rp
                    </span>
                    <input
                      type="number"
                      placeholder="0"
                      value={pph21Terlapor}
                      onChange={(e) => setPph21Terlapor(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 text-sm bg-surface-card border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <span className="text-[11px] text-navy-soft mt-0.5 block">
                    Pajak PPh 21 terutang yang disetor atau ditanggung pada masa ini.
                  </span>
                </div>

                {/* Rincian Opsional Pegawai & TA */}
                <div className="p-3 rounded-xl border border-border-soft bg-surface-card space-y-2">
                  <span className="text-[11px] font-bold text-navy-soft block">
                    Rincian SPT (Opsional):
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-navy-soft block mb-0.5">
                        Bruto Pegawai Tetap
                      </label>
                      <input
                        type="number"
                        placeholder="Rp 0"
                        value={gajiPegawaiTerlapor}
                        onChange={(e) => handleGajiPegawaiChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-surface-subtle border border-border-soft rounded-lg text-navy-text font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-navy-soft block mb-0.5">
                        Bruto Tenaga Ahli
                      </label>
                      <input
                        type="number"
                        placeholder="Rp 0"
                        value={gajiTaTerlapor}
                        onChange={(e) => handleGajiTaChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-surface-subtle border border-border-soft rounded-lg text-navy-text font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-navy-text mb-1">
                    No. Bukti Penerimaan Surat (BPS) / NTPN (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: S-12345/WPJ.01/KP.0203/2026 atau NTPN"
                    value={ntpn}
                    onChange={(e) => setNtpn(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-card border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-navy-text mb-1">
                    Catatan / Penjelasan Selisih Audit (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Ada selisih pembetulan gaji masa sebelumnya dilaporkan di masa ini..."
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-card border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Live Preview Selisih */}
              <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 space-y-1">
                <div className="font-bold text-blue-900 dark:text-blue-300 text-[11px] flex items-center justify-between">
                  <span>Simulasi Selisih Hasil Input:</span>
                  <span
                    className={
                      Math.abs(simSelisihGaji) <= 0.01 && Math.abs(simSelisihPph) <= 0.01
                        ? "text-emerald-600 font-bold"
                        : "text-rose-600 font-bold"
                    }
                  >
                    {Math.abs(simSelisihGaji) <= 0.01 &&
                    Math.abs(simSelisihPph) <= 0.01
                      ? "Balance (Sesuai) ✅"
                      : "Ada Selisih ⚠️"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-navy-soft text-[11px]">
                  <div>
                    Selisih Bruto:{" "}
                    <strong
                      className={`font-mono ${
                        Math.abs(simSelisihGaji) > 0.01
                          ? "text-rose-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {formatRupiah(simSelisihGaji)}
                    </strong>
                  </div>
                  <div>
                    Selisih PPh 21:{" "}
                    <strong
                      className={`font-mono ${
                        Math.abs(simSelisihPph) > 0.01
                          ? "text-rose-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {formatRupiah(simSelisihPph)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-border-soft bg-surface-subtle">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-navy-soft hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan Data SPT"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
