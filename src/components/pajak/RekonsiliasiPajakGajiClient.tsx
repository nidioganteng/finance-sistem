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
  Users,
  Award,
  Layers,
  Banknote,
  Calculator,
  X,
  Check,
  Info,
} from "lucide-react";
import {
  type RekonsiliasiPajakGajiData,
  type RekonsiliasiGajiPph21Item,
} from "@/lib/rekonsiliasi-pajak-gaji";
import { saveRekonsiliasiGajiPph21Action } from "@/lib/actions/rekonsiliasi-pajak-gaji";
import { formatRupiah } from "@/lib/dashboard-data";

type ViewMode = "total" | "pegawai" | "tenaga-ahli" | "paralel";

export function RekonsiliasiPajakGajiClient({
  data,
  entityKey,
  canEdit = true,
}: {
  data: RekonsiliasiPajakGajiData;
  entityKey: string;
  canEdit?: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("total");

  // Modal Edit State
  const [editingItem, setEditingItem] = useState<RekonsiliasiGajiPph21Item | null>(null);
  const [gajiPegawaiTerlapor, setGajiPegawaiTerlapor] = useState<string>("");
  const [pph21PegawaiTerlapor, setPph21PegawaiTerlapor] = useState<string>("");
  const [gajiTaTerlapor, setGajiTaTerlapor] = useState<string>("");
  const [pph21TaTerlapor, setPph21TaTerlapor] = useState<string>("");
  const [gajiTerlapor, setGajiTerlapor] = useState<string>("");
  const [pph21Terlapor, setPph21Terlapor] = useState<string>("");
  const [ntpn, setNtpn] = useState<string>("");
  const [keterangan, setKeterangan] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  function openEditModal(item: RekonsiliasiGajiPph21Item) {
    setEditingItem(item);
    setGajiPegawaiTerlapor(item.gajiPegawaiTerlapor > 0 ? String(item.gajiPegawaiTerlapor) : "");
    setPph21PegawaiTerlapor(item.pph21PegawaiTerlapor > 0 ? String(item.pph21PegawaiTerlapor) : "");
    setGajiTaTerlapor(item.gajiTaTerlapor > 0 ? String(item.gajiTaTerlapor) : "");
    setPph21TaTerlapor(item.pph21TaTerlapor > 0 ? String(item.pph21TaTerlapor) : "");
    setGajiTerlapor(item.gajiTerlapor > 0 ? String(item.gajiTerlapor) : "");
    setPph21Terlapor(item.pph21Terlapor > 0 ? String(item.pph21Terlapor) : "");
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

  // Sinkronisasi auto-sum total saat input kategori diubah
  function handleGajiPegawaiChange(val: string) {
    setGajiPegawaiTerlapor(val);
    const peg = Number(val) || 0;
    const ta = Number(gajiTaTerlapor) || 0;
    setGajiTerlapor(String(peg + ta));
  }

  function handleGajiTaChange(val: string) {
    setGajiTaTerlapor(val);
    const peg = Number(gajiPegawaiTerlapor) || 0;
    const ta = Number(val) || 0;
    setGajiTerlapor(String(peg + ta));
  }

  function handlePphPegawaiChange(val: string) {
    setPph21PegawaiTerlapor(val);
    const peg = Number(val) || 0;
    const ta = Number(pph21TaTerlapor) || 0;
    setPph21Terlapor(String(peg + ta));
  }

  function handlePphTaChange(val: string) {
    setPph21TaTerlapor(val);
    const peg = Number(pph21PegawaiTerlapor) || 0;
    const ta = Number(val) || 0;
    setPph21Terlapor(String(peg + ta));
  }

  async function handleSave() {
    if (!editingItem) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await saveRekonsiliasiGajiPph21Action({
      entityId: data.entityId,
      year: data.year,
      month: editingItem.month,
      gajiTerlapor: Number(gajiTerlapor) || 0,
      pph21Terlapor: Number(pph21Terlapor) || 0,
      gajiPegawaiTerlapor: Number(gajiPegawaiTerlapor) || 0,
      gajiTaTerlapor: Number(gajiTaTerlapor) || 0,
      pph21PegawaiTerlapor: Number(pph21PegawaiTerlapor) || 0,
      pph21TaTerlapor: Number(pph21TaTerlapor) || 0,
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

  // Live simulation in modal
  const simGajiPeg = Number(gajiPegawaiTerlapor) || 0;
  const simPphPeg = Number(pph21PegawaiTerlapor) || 0;
  const simSelisihGajiPeg = (editingItem?.gajiPegawaiJurnal ?? 0) - simGajiPeg;
  const simSelisihPphPeg = (editingItem?.pph21PegawaiBasis ?? 0) - simPphPeg;

  const simGajiTa = Number(gajiTaTerlapor) || 0;
  const simPphTa = Number(pph21TaTerlapor) || 0;
  const simSelisihGajiTa = (editingItem?.gajiTaJurnal ?? 0) - simGajiTa;
  const simSelisihPphTa = (editingItem?.pph21TaBasis ?? 0) - simPphTa;

  const simGajiTot = Number(gajiTerlapor) || (simGajiPeg + simGajiTa);
  const simPphTot = Number(pph21Terlapor) || (simPphPeg + simPphTa);
  const simSelisihGajiTot = (editingItem?.gajiTotalJurnal ?? 0) - simGajiTot;
  const simSelisihPphTot = (editingItem?.pph21Basis ?? 0) - simPphTot;

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
                Audit Rekonsiliasi Gaji vs PPh 21 (Format Lapis 3 PPN)
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-surface-subtle text-navy-soft border border-border-soft">
                Tahun Pajak {data.year}
              </span>
            </div>
            <p className="text-xs text-navy-soft mt-1 max-w-3xl leading-relaxed">
              Membandingkan secara paralel antara <strong>Gaji/PPh di Jurnal Umum</strong> versus{" "}
              <strong>Gaji/PPh Terlapor di SPT Pajak (Form 1721)</strong> untuk 2 kategori terpisah:{" "}
              <strong>Pegawai Tetap (Akun 511)</strong> dan <strong>Tenaga Ahli (Akun 612)</strong>.
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isExporting ? "Mengunduh..." : "Ekspor Excel (3 Sheet)"}</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4 CARD RINGKASAN AUDIT (KPI BALANCE CHECK) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pegawai Tetap (Akun 511) */}
        <div className="bg-surface-card rounded-2xl border border-border-soft p-4.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-navy-soft">
            <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              Pegawai Tetap (511)
            </span>
            <span className="font-mono text-[11px] font-bold text-blue-600">Akun 511</span>
          </div>
          <div>
            <div className="text-xl font-extrabold text-navy-text tabular-nums">
              {data.summary.pegawai.totalGajiJurnalFmt}
            </div>
            <div className="text-xs text-navy-soft mt-0.5 flex items-center justify-between">
              <span>SPT Terlapor:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {data.summary.pegawai.totalGajiTerlaporFmt}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-border-soft flex items-center justify-between text-xs">
            <span className="text-navy-soft font-medium">Selisih Gaji:</span>
            <span
              className={`font-bold tabular-nums ${
                Math.abs(data.summary.pegawai.totalSelisihGaji) > 0.01
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {data.summary.pegawai.totalSelisihGajiFmt}
            </span>
          </div>
        </div>

        {/* Card 2: Tenaga Ahli (Akun 612) */}
        <div className="bg-surface-card rounded-2xl border border-border-soft p-4.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-navy-soft">
            <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              Tenaga Ahli (612)
            </span>
            <span className="font-mono text-[11px] font-bold text-amber-600">Akun 612</span>
          </div>
          <div>
            <div className="text-xl font-extrabold text-navy-text tabular-nums">
              {data.summary.tenagaAhli.totalGajiJurnalFmt}
            </div>
            <div className="text-xs text-navy-soft mt-0.5 flex items-center justify-between">
              <span>SPT Terlapor:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {data.summary.tenagaAhli.totalGajiTerlaporFmt}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-border-soft flex items-center justify-between text-xs">
            <span className="text-navy-soft font-medium">Selisih Honor:</span>
            <span
              className={`font-bold tabular-nums ${
                Math.abs(data.summary.tenagaAhli.totalSelisihGaji) > 0.01
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {data.summary.tenagaAhli.totalSelisihGajiFmt}
            </span>
          </div>
        </div>

        {/* Card 3: Total PPh 21 Terutang */}
        <div className="bg-surface-card rounded-2xl border border-border-soft p-4.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-navy-soft">
            <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-purple-600" />
              Total PPh 21 Terutang
            </span>
            <span className="font-mono text-[11px] font-bold text-purple-600">Akun 533</span>
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

        {/* Card 4: Audit Status & Balance Control */}
        <div className="bg-surface-card rounded-2xl border border-border-soft p-4.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-navy-soft">
            <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Kontrol Selisih
            </span>
            <span className="text-[11px] font-bold">12 Bulan</span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-navy-text">
                {data.summary.jumlahBulanMatch}
              </span>
              <span className="text-xs text-navy-soft">/ 12 Bulan Balance</span>
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
                  Semua Sesuai
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
                ? "Audit Balance 100% ✅"
                : data.summary.overallStatus === "HAS_DIFF"
                ? "Ada Selisih Perlu Koreksi ⚠️"
                : "Menunggu Input SPT ⏳"}
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB NAVIGASI 2 KATEGORI TERPISAH */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="border-b border-border-soft flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setViewMode("total")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            viewMode === "total"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-navy-soft hover:text-navy-text"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Total Konsolidasi (Gabungan)</span>
        </button>

        <button
          onClick={() => setViewMode("pegawai")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            viewMode === "pegawai"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-navy-soft hover:text-navy-text"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>1. Pegawai Tetap (Akun 511)</span>
          {data.summary.pegawai.jumlahBulanSelisih > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              {data.summary.pegawai.jumlahBulanSelisih} Selisih
            </span>
          )}
        </button>

        <button
          onClick={() => setViewMode("tenaga-ahli")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            viewMode === "tenaga-ahli"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-navy-soft hover:text-navy-text"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>2. Tenaga Ahli (Akun 612)</span>
          {data.summary.tenagaAhli.jumlahBulanSelisih > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              {data.summary.tenagaAhli.jumlahBulanSelisih} Selisih
            </span>
          )}
        </button>

        <button
          onClick={() => setViewMode("paralel")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            viewMode === "paralel"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-navy-soft hover:text-navy-text"
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Komparasi Paralel Master (Side-by-Side)</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TABEL KOMPARATIF AUDIT */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-surface-card rounded-2xl border border-border-soft p-5 shadow-xs space-y-4">
        {/* Table Legend & Formula Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-subtle border border-border-soft text-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-navy-soft">
              Formula Selisih: <strong className="text-navy-text">Selisih Gaji = Jurnal − SPT Terlapor</strong> |{" "}
              <strong className="text-navy-text">Selisih PPh = Jurnal − SPT Terlapor</strong>. Baris berlatar merah mengindikasikan adanya selisih yang harus ditindaklanjuti.
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

        {/* Tabel */}
        <div className="overflow-x-auto rounded-xl border border-border-soft">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-surface-subtle text-navy-text border-b border-border-soft font-semibold">
              {viewMode === "paralel" ? (
                <>
                  {/* Two-row header for Side-by-Side Paralel View */}
                  <tr className="border-b border-border-soft">
                    <th rowSpan={2} className="p-3 text-center w-10 border-r border-border-soft">Bulan</th>
                    <th rowSpan={2} className="p-3 border-r border-border-soft">Masa Pajak</th>
                    <th colSpan={3} className="p-2.5 text-center bg-blue-50/40 dark:bg-blue-500/10 border-r border-border-soft font-bold text-blue-800 dark:text-blue-300">
                      1. PEGAWAI TETAP (AKUN 511)
                    </th>
                    <th colSpan={3} className="p-2.5 text-center bg-amber-50/40 dark:bg-amber-500/10 border-r border-border-soft font-bold text-amber-800 dark:text-amber-300">
                      2. TENAGA AHLI (AKUN 612)
                    </th>
                    <th colSpan={3} className="p-2.5 text-center bg-purple-50/40 dark:bg-purple-500/10 border-r border-border-soft font-bold text-purple-800 dark:text-purple-300">
                      TOTAL KONSOLIDASI
                    </th>
                    <th rowSpan={2} className="p-3 text-center border-r border-border-soft">Status Audit</th>
                    <th rowSpan={2} className="p-3 border-r border-border-soft">NTPN</th>
                    <th rowSpan={2} className="p-3 border-r border-border-soft">Catatan</th>
                    {canEdit && <th rowSpan={2} className="p-3 text-center w-14">Aksi</th>}
                  </tr>
                  <tr>
                    {/* Pegawai */}
                    <th className="p-2 text-right bg-blue-50/20">Jurnal</th>
                    <th className="p-2 text-right bg-blue-50/30 text-blue-700">SPT</th>
                    <th className="p-2 text-right bg-blue-50/20 border-r border-border-soft">Selisih</th>
                    {/* Tenaga Ahli */}
                    <th className="p-2 text-right bg-amber-50/20">Jurnal</th>
                    <th className="p-2 text-right bg-amber-50/30 text-amber-700">SPT</th>
                    <th className="p-2 text-right bg-amber-50/20 border-r border-border-soft">Selisih</th>
                    {/* Total */}
                    <th className="p-2 text-right bg-purple-50/20">Gaji Jurnal</th>
                    <th className="p-2 text-right bg-purple-50/30 text-purple-700">Gaji SPT</th>
                    <th className="p-2 text-right bg-purple-50/20 border-r border-border-soft">Selisih</th>
                  </tr>
                </>
              ) : (
                /* Single Header for Mode Total, Pegawai, or Tenaga Ahli */
                <tr>
                  <th className="p-3 text-center w-10">Bulan</th>
                  <th className="p-3">Masa Pajak</th>

                  {/* Kolom Gaji */}
                  <th className="p-3 text-right">
                    {viewMode === "pegawai"
                      ? "Gaji Pegawai Jurnal (511)"
                      : viewMode === "tenaga-ahli"
                      ? "Honor Tenaga Ahli Jurnal (612)"
                      : "Total Beban Gaji Jurnal"}
                  </th>
                  <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-300">
                    Gaji Terlapor (SPT 1721)
                  </th>
                  <th className="p-3 text-right">Selisih Gaji</th>

                  {/* Kolom PPh 21 */}
                  <th className="p-3 text-right text-purple-700 dark:text-purple-400">
                    PPh 21 Jurnal/Payroll
                  </th>
                  <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-300">
                    PPh 21 Terlapor (SPT)
                  </th>
                  <th className="p-3 text-right">Selisih PPh 21</th>

                  {/* Status & Kontrol */}
                  <th className="p-3 text-center">Status Audit</th>
                  <th className="p-3">NTPN / Bukti</th>
                  <th className="p-3">Catatan / Tindak Lanjut</th>
                  {canEdit && <th className="p-3 text-center w-14">Aksi</th>}
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-border-soft text-navy-text">
              {data.items.map((row) => {
                const isPeg = viewMode === "pegawai";
                const isTa = viewMode === "tenaga-ahli";

                const currentStatus = isPeg ? row.statusPegawai : isTa ? row.statusTa : row.status;
                const isMatch = currentStatus === "MATCH";
                const isSelisih = currentStatus === "SELISIH";
                const isBelumLapor = currentStatus === "BELUM_DILAPORKAN";

                const rowAlertBg = isSelisih
                  ? "bg-rose-50/40 dark:bg-rose-500/10"
                  : isBelumLapor
                  ? "bg-amber-50/30 dark:bg-amber-500/10"
                  : "";

                if (viewMode === "paralel") {
                  return (
                    <tr key={row.month} className={`hover:bg-surface-hover/50 transition-colors ${rowAlertBg}`}>
                      <td className="p-3 text-center font-mono font-bold text-navy-soft border-r border-border-soft">
                        {String(row.month).padStart(2, "0")}
                      </td>
                      <td className="p-3 font-semibold text-navy-text border-r border-border-soft">
                        {row.namaBulan}
                      </td>

                      {/* Pegawai */}
                      <td className="p-2.5 text-right font-mono">{row.gajiPegawaiJurnalFmt}</td>
                      <td className="p-2.5 text-right font-mono bg-blue-50/30 text-blue-800 dark:text-blue-300">{row.gajiPegawaiTerlaporFmt}</td>
                      <td className={`p-2.5 text-right font-mono font-bold border-r border-border-soft ${Math.abs(row.selisihGajiPegawai) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>
                        {row.selisihGajiPegawaiFmt}
                      </td>

                      {/* Tenaga Ahli */}
                      <td className="p-2.5 text-right font-mono">{row.gajiTaJurnalFmt}</td>
                      <td className="p-2.5 text-right font-mono bg-amber-50/30 text-amber-800 dark:text-amber-300">{row.gajiTaTerlaporFmt}</td>
                      <td className={`p-2.5 text-right font-mono font-bold border-r border-border-soft ${Math.abs(row.selisihGajiTa) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>
                        {row.selisihGajiTaFmt}
                      </td>

                      {/* Total */}
                      <td className="p-2.5 text-right font-mono font-medium">{row.gajiTotalJurnalFmt}</td>
                      <td className="p-2.5 text-right font-mono font-semibold bg-purple-50/30 text-purple-800 dark:text-purple-300">{row.gajiTerlaporFmt}</td>
                      <td className={`p-2.5 text-right font-mono font-bold border-r border-border-soft ${Math.abs(row.selisihGaji) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>
                        {row.selisihGajiFmt}
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center border-r border-border-soft">
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
                          <span className="text-[11px] text-navy-soft italic">Nihil</span>
                        )}
                      </td>

                      <td className="p-3 font-mono text-[11px] text-navy-soft border-r border-border-soft">{row.ntpn || "-"}</td>
                      <td className="p-3 text-navy-soft max-w-xs truncate border-r border-border-soft">{row.keterangan || "-"}</td>

                      {canEdit && (
                        <td className="p-3 text-center">
                          <button
                            onClick={() => openEditModal(row)}
                            className="p-1.5 rounded-lg hover:bg-surface-hover text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                            title="Edit Data SPT"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                }

                // Normal Mode (Total, Pegawai, atau Tenaga Ahli)
                const valGajiJurnal = isPeg ? row.gajiPegawaiJurnalFmt : isTa ? row.gajiTaJurnalFmt : row.gajiTotalJurnalFmt;
                const valGajiSpt = isPeg ? row.gajiPegawaiTerlaporFmt : isTa ? row.gajiTaTerlaporFmt : row.gajiTerlaporFmt;
                const diffGaji = isPeg ? row.selisihGajiPegawai : isTa ? row.selisihGajiTa : row.selisihGaji;
                const diffGajiFmt = isPeg ? row.selisihGajiPegawaiFmt : isTa ? row.selisihGajiTaFmt : row.selisihGajiFmt;

                const valPphJurnal = isPeg ? row.pph21PegawaiBasisFmt : isTa ? row.pph21TaBasisFmt : row.pph21BasisFmt;
                const valPphSpt = isPeg ? row.pph21PegawaiTerlaporFmt : isTa ? row.pph21TaTerlaporFmt : row.pph21TerlaporFmt;
                const diffPph = isPeg ? row.selisihPph21Pegawai : isTa ? row.selisihPph21Ta : row.selisihPph21;
                const diffPphFmt = isPeg ? row.selisihPph21PegawaiFmt : isTa ? row.selisihPph21TaFmt : row.selisihPph21Fmt;

                return (
                  <tr key={row.month} className={`hover:bg-surface-hover/50 transition-colors ${rowAlertBg}`}>
                    <td className="p-3 text-center font-mono font-bold text-navy-soft">
                      {String(row.month).padStart(2, "0")}
                    </td>
                    <td className="p-3 font-semibold text-navy-text">
                      {row.namaBulan}
                    </td>

                    {/* Gaji Jurnal */}
                    <td className="p-3 text-right font-mono font-medium">{valGajiJurnal}</td>

                    {/* Gaji SPT */}
                    <td className="p-3 text-right font-mono font-semibold bg-blue-50/30 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                      {valGajiSpt}
                    </td>

                    {/* Selisih Gaji */}
                    <td className="p-3 text-right font-mono">
                      <span className={`font-semibold ${Math.abs(diffGaji) > 0.01 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {diffGajiFmt}
                      </span>
                    </td>

                    {/* PPh Jurnal */}
                    <td className="p-3 text-right font-mono font-medium text-purple-700 dark:text-purple-400">
                      {valPphJurnal}
                    </td>

                    {/* PPh SPT */}
                    <td className="p-3 text-right font-mono font-semibold bg-blue-50/30 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                      {valPphSpt}
                    </td>

                    {/* Selisih PPh */}
                    <td className="p-3 text-right font-mono">
                      <span className={`font-semibold ${Math.abs(diffPph) > 0.01 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {diffPphFmt}
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
                        <span className="text-[11px] text-navy-soft italic">Nihil</span>
                      )}
                    </td>

                    {/* NTPN & Catatan */}
                    <td className="p-3 font-mono text-[11px] text-navy-soft">{row.ntpn || "-"}</td>
                    <td className="p-3 text-navy-soft max-w-xs truncate">{row.keterangan || "-"}</td>

                    {canEdit && (
                      <td className="p-3 text-center">
                        <button
                          onClick={() => openEditModal(row)}
                          className="p-1.5 rounded-lg hover:bg-surface-hover text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
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

            {/* Footer Summary Row */}
            <tfoot className="bg-surface-subtle font-bold border-t-2 border-border-soft text-navy-text">
              {viewMode === "paralel" ? (
                <tr>
                  <td colSpan={2} className="p-3 text-center uppercase tracking-wider border-r border-border-soft">Total Tahunan</td>
                  <td className="p-2.5 text-right font-mono text-xs">{data.summary.pegawai.totalGajiJurnalFmt}</td>
                  <td className="p-2.5 text-right font-mono text-xs bg-blue-50/50 text-blue-800">{data.summary.pegawai.totalGajiTerlaporFmt}</td>
                  <td className={`p-2.5 text-right font-mono text-xs border-r border-border-soft ${Math.abs(data.summary.pegawai.totalSelisihGaji) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>{data.summary.pegawai.totalSelisihGajiFmt}</td>

                  <td className="p-2.5 text-right font-mono text-xs">{data.summary.tenagaAhli.totalGajiJurnalFmt}</td>
                  <td className="p-2.5 text-right font-mono text-xs bg-amber-50/50 text-amber-800">{data.summary.tenagaAhli.totalGajiTerlaporFmt}</td>
                  <td className={`p-2.5 text-right font-mono text-xs border-r border-border-soft ${Math.abs(data.summary.tenagaAhli.totalSelisihGaji) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>{data.summary.tenagaAhli.totalSelisihGajiFmt}</td>

                  <td className="p-2.5 text-right font-mono text-xs">{data.summary.totalGajiJurnalFmt}</td>
                  <td className="p-2.5 text-right font-mono text-xs bg-purple-50/50 text-purple-800">{data.summary.totalGajiTerlaporFmt}</td>
                  <td className={`p-2.5 text-right font-mono text-xs border-r border-border-soft ${Math.abs(data.summary.totalSelisihGaji) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>{data.summary.totalSelisihGajiFmt}</td>

                  <td className="p-3 text-center text-[11px] border-r border-border-soft">
                    {data.summary.overallStatus === "ALL_BALANCED" ? <span className="text-emerald-600">MATCH</span> : <span className="text-rose-600">{data.summary.jumlahBulanSelisih} SELISIH</span>}
                  </td>
                  <td colSpan={canEdit ? 3 : 2} className="p-3 text-navy-soft text-right text-[11px] font-normal">
                    Akumulasi Jan - Des {data.year}
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={2} className="p-3 text-center uppercase tracking-wider">Total Tahunan</td>
                  <td className="p-3 text-right font-mono text-xs">
                    {viewMode === "pegawai" ? data.summary.pegawai.totalGajiJurnalFmt : viewMode === "tenaga-ahli" ? data.summary.tenagaAhli.totalGajiJurnalFmt : data.summary.totalGajiJurnalFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-xs bg-blue-50/50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                    {viewMode === "pegawai" ? data.summary.pegawai.totalGajiTerlaporFmt : viewMode === "tenaga-ahli" ? data.summary.tenagaAhli.totalGajiTerlaporFmt : data.summary.totalGajiTerlaporFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-xs">
                    <span className={Math.abs(viewMode === "pegawai" ? data.summary.pegawai.totalSelisihGaji : viewMode === "tenaga-ahli" ? data.summary.tenagaAhli.totalSelisihGaji : data.summary.totalSelisihGaji) > 0.01 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                      {viewMode === "pegawai" ? data.summary.pegawai.totalSelisihGajiFmt : viewMode === "tenaga-ahli" ? data.summary.tenagaAhli.totalSelisihGajiFmt : data.summary.totalSelisihGajiFmt}
                    </span>
                  </td>

                  <td className="p-3 text-right font-mono text-xs text-purple-700 dark:text-purple-400">
                    {viewMode === "pegawai" ? data.summary.pegawai.totalPphBasisFmt : viewMode === "tenaga-ahli" ? data.summary.tenagaAhli.totalPphBasisFmt : data.summary.totalPph21BasisFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-xs bg-blue-50/50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                    {viewMode === "pegawai" ? data.summary.pegawai.totalPphTerlaporFmt : viewMode === "tenaga-ahli" ? data.summary.tenagaAhli.totalPphTerlaporFmt : data.summary.totalPph21TerlaporFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-xs">
                    <span className={Math.abs(viewMode === "pegawai" ? data.summary.pegawai.totalSelisihPph : viewMode === "tenaga-ahli" ? data.summary.tenagaAhli.totalSelisihPph : data.summary.totalSelisihPph21) > 0.01 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                      {viewMode === "pegawai" ? data.summary.pegawai.totalSelisihPphFmt : viewMode === "tenaga-ahli" ? data.summary.tenagaAhli.totalSelisihPphFmt : data.summary.totalSelisihPph21Fmt}
                    </span>
                  </td>

                  <td className="p-3 text-center text-[11px]">
                    {data.summary.overallStatus === "ALL_BALANCED" ? <span className="text-emerald-600 font-bold">MATCH</span> : <span className="text-rose-600 font-bold">{data.summary.jumlahBulanSelisih} SELISIH</span>}
                  </td>
                  <td colSpan={canEdit ? 3 : 2} className="p-3 text-navy-soft text-right text-[11px] font-normal">
                    Akumulasi Jan - Des {data.year}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL INPUT / EDIT SPT MASA PPH 21 (2 KATEGORI TERPISAH) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-text/60 backdrop-blur-xs">
          <div className="bg-surface-card rounded-2xl border border-border-soft w-full max-w-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft bg-surface-subtle shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-200 dark:border-blue-500/20">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy-text">
                    Input SPT Masa PPh 21 (Form 1721)
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
            <div className="p-6 space-y-4 text-xs overflow-y-auto">
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

              {/* 1. KATEGORI PEGAWAI TETAP */}
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/20 dark:bg-blue-950/10 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-200/60 dark:border-blue-800/40 pb-2">
                  <span className="font-bold text-blue-900 dark:text-blue-300 text-xs flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    Kategori 1: Pegawai Tetap (Akun 511)
                  </span>
                  <span className="text-[11px] text-navy-soft font-mono">
                    Jurnal: {editingItem.gajiPegawaiJurnalFmt} | PPh: {editingItem.pph21PegawaiBasisFmt}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-navy-text mb-1">
                      Bruto Pegawai di SPT (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-navy-soft font-mono">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={gajiPegawaiTerlapor}
                        onChange={(e) => handleGajiPegawaiChange(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-card border border-border-soft rounded-lg text-navy-text font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-navy-text mb-1">
                      PPh 21 Pegawai di SPT (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-navy-soft font-mono">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={pph21PegawaiTerlapor}
                        onChange={(e) => handlePphPegawaiChange(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-card border border-border-soft rounded-lg text-navy-text font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Simulasi Selisih Pegawai */}
                <div className="flex items-center justify-between text-[11px] pt-1 text-navy-soft border-t border-blue-100 dark:border-blue-900/40">
                  <span>Selisih Gaji: <strong className={Math.abs(simSelisihGajiPeg) > 0.01 ? "text-rose-600" : "text-emerald-600"}>{formatRupiah(simSelisihGajiPeg)}</strong></span>
                  <span>Selisih PPh: <strong className={Math.abs(simSelisihPphPeg) > 0.01 ? "text-rose-600" : "text-emerald-600"}>{formatRupiah(simSelisihPphPeg)}</strong></span>
                </div>
              </div>

              {/* 2. KATEGORI TENAGA AHLI */}
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/20 dark:bg-amber-950/10 space-y-3">
                <div className="flex items-center justify-between border-b border-amber-200/60 dark:border-amber-800/40 pb-2">
                  <span className="font-bold text-amber-900 dark:text-amber-300 text-xs flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600" />
                    Kategori 2: Tenaga Ahli (Akun 612)
                  </span>
                  <span className="text-[11px] text-navy-soft font-mono">
                    Jurnal: {editingItem.gajiTaJurnalFmt} | PPh: {editingItem.pph21TaBasisFmt}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-navy-text mb-1">
                      Honorarium TA di SPT (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-navy-soft font-mono">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={gajiTaTerlapor}
                        onChange={(e) => handleGajiTaChange(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-card border border-border-soft rounded-lg text-navy-text font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-navy-text mb-1">
                      PPh 21 TA di SPT (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-navy-soft font-mono">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={pph21TaTerlapor}
                        onChange={(e) => handlePphTaChange(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-card border border-border-soft rounded-lg text-navy-text font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Simulasi Selisih Tenaga Ahli */}
                <div className="flex items-center justify-between text-[11px] pt-1 text-navy-soft border-t border-amber-100 dark:border-amber-900/40">
                  <span>Selisih Honor: <strong className={Math.abs(simSelisihGajiTa) > 0.01 ? "text-rose-600" : "text-emerald-600"}>{formatRupiah(simSelisihGajiTa)}</strong></span>
                  <span>Selisih PPh: <strong className={Math.abs(simSelisihPphTa) > 0.01 ? "text-rose-600" : "text-emerald-600"}>{formatRupiah(simSelisihPphTa)}</strong></span>
                </div>
              </div>

              {/* 3. TOTAL AKUMULASI SPT */}
              <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/20 dark:bg-purple-950/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-900 dark:text-purple-300">
                    Total SPT Masa 1721 (Induk)
                  </span>
                  <span className="text-[11px] text-navy-soft">
                    Otomatis dijumlahkan dari Pegawai + Tenaga Ahli
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-navy-soft block">Total Bruto Dilaporkan:</span>
                    <strong className="text-navy-text font-mono text-sm">{formatRupiah(simGajiTot)}</strong>
                  </div>
                  <div>
                    <span className="text-navy-soft block">Total PPh 21 Dilaporkan:</span>
                    <strong className="text-purple-700 dark:text-purple-400 font-mono text-sm">{formatRupiah(simPphTot)}</strong>
                  </div>
                </div>
              </div>

              {/* Bukti & Catatan */}
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-navy-text mb-1">
                    No. Bukti Lapor (BPS) / NTPN (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: S-12345/WPJ.01/KP.0203/2026 atau NTPN"
                    value={ntpn}
                    onChange={(e) => setNtpn(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-surface-card border border-border-soft rounded-lg text-navy-text font-mono"
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
                    className="w-full px-3 py-1.5 text-xs bg-surface-card border border-border-soft rounded-lg text-navy-text"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-border-soft bg-surface-subtle shrink-0">
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
