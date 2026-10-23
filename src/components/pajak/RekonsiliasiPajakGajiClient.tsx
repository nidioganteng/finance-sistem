"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  FileSpreadsheet,
  Users,
  Award,
  Calculator,
  X,
  ExternalLink,
  Zap,
} from "lucide-react";
import Link from "next/link";
import {
  type RekonsiliasiPajakGajiData,
  type RekonsiliasiGajiPph21Item,
} from "@/lib/rekonsiliasi-pajak-gaji";
import { saveRekonsiliasiGajiPph21Action } from "@/lib/actions/rekonsiliasi-pajak-gaji";
import { formatRupiah } from "@/lib/dashboard-data";
import { useAuth } from "@/context/AuthContext";

type ViewMode = "pegawai" | "tenaga-ahli" | "paralel";

export function RekonsiliasiPajakGajiClient({
  data,
  entityKey,
  canEdit = true,
}: {
  data: RekonsiliasiPajakGajiData;
  entityKey: string;
  canEdit?: boolean;
}) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("pegawai");

  const [editingItem, setEditingItem] = useState<RekonsiliasiGajiPph21Item | null>(null);
  const [gajiPegawaiTerlapor, setGajiPegawaiTerlapor] = useState<string>("0");
  const [pph21PegawaiTerlapor, setPph21PegawaiTerlapor] = useState<string>("0");
  const [gajiTaTerlapor, setGajiTaTerlapor] = useState<string>("0");
  const [pph21TaTerlapor, setPph21TaTerlapor] = useState<string>("0");
  const [gajiTerlapor, setGajiTerlapor] = useState<string>("0");
  const [pph21Terlapor, setPph21Terlapor] = useState<string>("0");
  const [ntpn, setNtpn] = useState<string>("");
  const [keterangan, setKeterangan] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  function openEditModal(item: RekonsiliasiGajiPph21Item) {
    setEditingItem(item);
    setGajiPegawaiTerlapor(String(item.gajiPegawaiTerlapor || 0));
    setPph21PegawaiTerlapor(String(item.pph21PegawaiTerlapor || 0));
    setGajiTaTerlapor(String(item.gajiTaTerlapor || 0));
    setPph21TaTerlapor(String(item.pph21TaTerlapor || 0));
    setGajiTerlapor(String(item.gajiTerlapor || 0));
    setPph21Terlapor(String(item.pph21Terlapor || 0));
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

  function handleAutoFillAll() {
    if (!editingItem) return;
    const gPeg = String(editingItem.gajiPegawaiJurnal || 0);
    const pPeg = String(editingItem.pph21PegawaiBasis || 0);
    const gTa = String(editingItem.gajiTaJurnal || 0);
    const pTa = String(editingItem.pph21TaBasis || 0);
    const gTot = String(editingItem.gajiTotalJurnal || 0);
    const pTot = String(editingItem.pph21Basis || 0);

    setGajiPegawaiTerlapor(gPeg);
    setPph21PegawaiTerlapor(pPeg);
    setGajiTaTerlapor(gTa);
    setPph21TaTerlapor(pTa);
    setGajiTerlapor(gTot);
    setPph21Terlapor(pTot);
  }

  function handleAutoFillPegawai() {
    if (!editingItem) return;
    handleGajiPegawaiChange(String(editingItem.gajiPegawaiJurnal || 0));
    handlePphPegawaiChange(String(editingItem.pph21PegawaiBasis || 0));
  }

  function handleAutoFillTa() {
    if (!editingItem) return;
    handleGajiTaChange(String(editingItem.gajiTaJurnal || 0));
    handlePphTaChange(String(editingItem.pph21TaBasis || 0));
  }

  async function handleSave() {
    if (!editingItem) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await saveRekonsiliasiGajiPph21Action(
      {
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
      },
      user?.id ?? "",
      user?.role ?? ""
    );

    setIsSubmitting(false);

    if (res?.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg("Data SPT Masa berhasil disimpan!");
      setTimeout(() => {
        closeEditModal();
        window.location.reload();
      }, 600);
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
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-card p-4 rounded-2xl border border-border-soft shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-500/20">
            <Scale className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-navy-text">
                Rekonsiliasi Pajak Gaji vs PPh 21 (SPT Masa 1721)
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-surface-subtle text-navy-soft border border-border-soft">
                Tahun {data.year}
              </span>
            </div>
            <p className="text-xs text-navy-soft mt-0.5">
              Komparasi Laporan Gaji (Bruto Payroll) vs Nilai Terlapor SPT Pajak Masa (1721) per bulan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Link
            href={`/pendapatan?entity=${entityKey}&year=${data.year}&tab=rekonsiliasi`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 transition-colors border border-blue-200/60 dark:border-blue-800/40"
          >
            <span>Lapis 3: PPN Faktur</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </Link>

          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isExporting ? "Mengunduh..." : "Ekspor Excel"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-surface-card rounded-2xl border border-border-soft p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-navy-text flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              Pegawai Tetap (Bruto)
            </span>
            <span className="text-[10.5px] font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">Laporan Gaji</span>
          </div>
          <div>
            <div className="text-lg font-extrabold text-navy-text tabular-nums">
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
              className={`font-bold tabular-nums px-2 py-0.5 rounded-md text-[11px] ${
                Math.abs(data.summary.pegawai.totalSelisihGaji) > 0.01
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              }`}
            >
              {data.summary.pegawai.totalSelisihGajiFmt}
            </span>
          </div>
        </div>

        <div className="bg-surface-card rounded-2xl border border-border-soft p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-navy-text flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              Tenaga Ahli (Bruto)
            </span>
            <span className="text-[10.5px] font-mono font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">Honorarium</span>
          </div>
          <div>
            <div className="text-lg font-extrabold text-navy-text tabular-nums">
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
              className={`font-bold tabular-nums px-2 py-0.5 rounded-md text-[11px] ${
                Math.abs(data.summary.tenagaAhli.totalSelisihGaji) > 0.01
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              }`}
            >
              {data.summary.tenagaAhli.totalSelisihGajiFmt}
            </span>
          </div>
        </div>

        <div className="bg-surface-card rounded-2xl border border-border-soft p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-navy-text flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-purple-600" />
              Total PPh 21 Terutang
            </span>
            <span className="text-[10.5px] font-mono font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded">Akun 533</span>
          </div>
          <div>
            <div className="text-lg font-extrabold text-purple-700 dark:text-purple-400 tabular-nums">
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
              className={`font-bold tabular-nums px-2 py-0.5 rounded-md text-[11px] ${
                Math.abs(data.summary.totalSelisihPph21) > 0.01
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              }`}
            >
              {data.summary.totalSelisihPph21Fmt}
            </span>
          </div>
        </div>

        <div className="bg-surface-card rounded-2xl border border-border-soft p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-navy-text flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Kontrol Selisih
            </span>
            <span className="text-[11px] text-navy-soft font-semibold">12 Bulan</span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-navy-text">
                {data.summary.jumlahBulanMatch}
              </span>
              <span className="text-xs text-navy-soft">/ 12 Bulan Balance</span>
            </div>
            <div className="text-xs mt-0.5 flex items-center gap-2">
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
            </div>
          </div>
          <div className="pt-2 border-t border-border-soft flex items-center justify-between">
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
                ? "Semua Sesuai ✅"
                : data.summary.overallStatus === "HAS_DIFF"
                ? "Ada Selisih ⚠️"
                : "Menunggu Input SPT ⏳"}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-surface-card rounded-2xl border border-border-soft p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border-soft pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setViewMode("pegawai")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                viewMode === "pegawai"
                  ? "bg-navy text-white font-bold shadow-2xs"
                  : "text-navy-soft hover:text-navy-text hover:bg-surface-subtle"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Pegawai Tetap (Bruto)</span>
              {data.summary.pegawai.jumlahBulanSelisih > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                  {data.summary.pegawai.jumlahBulanSelisih}
                </span>
              )}
            </button>

            <button
              onClick={() => setViewMode("tenaga-ahli")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                viewMode === "tenaga-ahli"
                  ? "bg-navy text-white font-bold shadow-2xs"
                  : "text-navy-soft hover:text-navy-text hover:bg-surface-subtle"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Tenaga Ahli (Bruto)</span>
              {data.summary.tenagaAhli.jumlahBulanSelisih > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                  {data.summary.tenagaAhli.jumlahBulanSelisih}
                </span>
              )}
            </button>

            <button
              onClick={() => setViewMode("paralel")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                viewMode === "paralel"
                  ? "bg-navy text-white font-bold shadow-2xs"
                  : "text-navy-soft hover:text-navy-text hover:bg-surface-subtle"
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Tabel Paralel Side-by-Side</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-medium text-navy-soft shrink-0">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Sesuai = Rp 0
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Selisih ≠ Rp 0
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border-soft">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-surface-subtle text-navy-text border-b border-border-soft font-semibold">
              {viewMode === "paralel" ? (
                <>
                  <tr className="border-b border-border-soft">
                    <th rowSpan={2} className="p-2.5 text-center w-10 border-r border-border-soft">Bulan</th>
                    <th rowSpan={2} className="p-2.5 border-r border-border-soft">Masa</th>
                    <th colSpan={3} className="p-2 text-center bg-blue-50/40 dark:bg-blue-500/10 border-r border-border-soft font-bold text-blue-800 dark:text-blue-300">
                      1. PEGAWAI TETAP (BRUTO PAYROLL)
                    </th>
                    <th colSpan={3} className="p-2 text-center bg-amber-50/40 dark:bg-amber-500/10 border-r border-border-soft font-bold text-amber-800 dark:text-amber-300">
                      2. TENAGA AHLI (BRUTO HONOR)
                    </th>
                    <th colSpan={3} className="p-2 text-center bg-purple-50/40 dark:bg-purple-500/10 border-r border-border-soft font-bold text-purple-800 dark:text-purple-300">
                      TOTAL KONSOLIDASI
                    </th>
                    <th rowSpan={2} className="p-2.5 text-center border-r border-border-soft">Status</th>
                    <th rowSpan={2} className="p-2.5 border-r border-border-soft">NTPN</th>
                    <th rowSpan={2} className="p-2.5 border-r border-border-soft">Catatan</th>
                    {canEdit && <th rowSpan={2} className="p-2.5 text-center w-12">Aksi</th>}
                  </tr>
                  <tr>
                    <th className="p-2 text-right bg-blue-50/20">Bruto Payroll</th>
                    <th className="p-2 text-right bg-blue-50/30 text-blue-700">SPT</th>
                    <th className="p-2 text-right bg-blue-50/20 border-r border-border-soft">Selisih</th>

                    <th className="p-2 text-right bg-amber-50/20">Bruto Honor</th>
                    <th className="p-2 text-right bg-amber-50/30 text-amber-700">SPT</th>
                    <th className="p-2 text-right bg-amber-50/20 border-r border-border-soft">Selisih</th>

                    <th className="p-2 text-right bg-purple-50/20">Total Bruto</th>
                    <th className="p-2 text-right bg-purple-50/30 text-purple-700">Gaji SPT</th>
                    <th className="p-2 text-right bg-purple-50/20 border-r border-border-soft">Selisih</th>
                  </tr>
                </>
              ) : (
                <tr>
                  <th className="p-2.5 text-center w-10">Bulan</th>
                  <th className="p-2.5">Masa Pajak</th>
                  <th className="p-2.5 text-right">
                    {viewMode === "pegawai"
                      ? "Gaji Bruto Pegawai (Payroll)"
                      : "Honor Bruto Tenaga Ahli"}
                  </th>
                  <th className="p-2.5 text-right bg-blue-50/50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-300">
                    {viewMode === "pegawai"
                      ? "Gaji Pegawai Terlapor (SPT)"
                      : "Honor TA Terlapor (SPT)"}
                  </th>
                  <th className="p-2.5 text-right">
                    {viewMode === "pegawai"
                      ? "Selisih Gaji Pegawai"
                      : "Selisih Honor TA"}
                  </th>

                  <th className="p-2.5 text-right text-purple-700 dark:text-purple-400">
                    {viewMode === "pegawai"
                      ? "PPh 21 Pegawai Jurnal"
                      : "PPh 21 TA Jurnal"}
                  </th>
                  <th className="p-2.5 text-right bg-blue-50/50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-300">
                    {viewMode === "pegawai"
                      ? "PPh 21 Pegawai Terlapor (SPT)"
                      : "PPh 21 TA Terlapor (SPT)"}
                  </th>
                  <th className="p-2.5 text-right">
                    {viewMode === "pegawai"
                      ? "Selisih PPh Pegawai"
                      : "Selisih PPh TA"}
                  </th>

                  <th className="p-2.5 text-center">Status Audit</th>
                  <th className="p-2.5">NTPN / Bukti</th>
                  <th className="p-2.5">Catatan</th>
                  {canEdit && <th className="p-2.5 text-center w-24">Aksi</th>}
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
                  ? "bg-rose-50/50 dark:bg-rose-950/20"
                  : isBelumLapor
                  ? "bg-amber-50/30 dark:bg-amber-950/20"
                  : "";

                if (viewMode === "paralel") {
                  return (
                    <tr key={row.month} className={`hover:bg-surface-hover/50 transition-colors ${rowAlertBg}`}>
                      <td className="p-2.5 text-center font-mono font-bold text-navy-soft border-r border-border-soft">
                        {String(row.month).padStart(2, "0")}
                      </td>
                      <td className="p-2.5 font-semibold text-navy-text border-r border-border-soft">
                        {row.namaBulan}
                      </td>

                      <td className="p-2 text-right font-mono">{row.gajiPegawaiJurnalFmt}</td>
                      <td className="p-2 text-right font-mono bg-blue-50/30 text-blue-800 dark:text-blue-300">{row.gajiPegawaiTerlaporFmt}</td>
                      <td className={`p-2 text-right font-mono font-bold border-r border-border-soft ${Math.abs(row.selisihGajiPegawai) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>
                        {row.selisihGajiPegawaiFmt}
                      </td>

                      <td className="p-2 text-right font-mono">{row.gajiTaJurnalFmt}</td>
                      <td className="p-2 text-right font-mono bg-amber-50/30 text-amber-800 dark:text-amber-300">{row.gajiTaTerlaporFmt}</td>
                      <td className={`p-2 text-right font-mono font-bold border-r border-border-soft ${Math.abs(row.selisihGajiTa) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>
                        {row.selisihGajiTaFmt}
                      </td>

                      <td className="p-2 text-right font-mono font-medium">{row.gajiTotalJurnalFmt}</td>
                      <td className="p-2 text-right font-mono font-semibold bg-purple-50/30 text-purple-800 dark:text-purple-300">{row.gajiTerlaporFmt}</td>
                      <td className={`p-2 text-right font-mono font-bold border-r border-border-soft ${Math.abs(row.selisihGaji) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>
                        {row.selisihGajiFmt}
                      </td>

                      <td className="p-2.5 text-center border-r border-border-soft">
                        {isMatch ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Balance
                          </span>
                        ) : isSelisih ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            <AlertTriangle className="w-3 h-3" /> Selisih
                          </span>
                        ) : isBelumLapor ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <Clock className="w-3 h-3" /> Belum Lapor
                          </span>
                        ) : (
                          <span className="text-[10.5px] text-navy-soft italic">Nihil</span>
                        )}
                      </td>

                      <td className="p-2.5 font-mono text-[11px] text-navy-soft border-r border-border-soft">{row.ntpn || "-"}</td>
                      <td className="p-2.5 text-navy-soft max-w-xs truncate border-r border-border-soft">{row.keterangan || "-"}</td>

                      {canEdit && (
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => openEditModal(row)}
                            className="p-1 rounded-lg hover:bg-surface-hover text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                            title="Edit Data SPT"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                }

                const valGajiJurnal = isPeg ? row.gajiPegawaiJurnalFmt : row.gajiTaJurnalFmt;
                const valGajiSpt = isPeg ? row.gajiPegawaiTerlaporFmt : row.gajiTaTerlaporFmt;
                const diffGaji = isPeg ? row.selisihGajiPegawai : row.selisihGajiTa;
                const diffGajiFmt = isPeg ? row.selisihGajiPegawaiFmt : row.selisihGajiTaFmt;

                const valPphJurnal = isPeg ? row.pph21PegawaiBasisFmt : row.pph21TaBasisFmt;
                const valPphSpt = isPeg ? row.pph21PegawaiTerlaporFmt : row.pph21TaTerlaporFmt;
                const diffPph = isPeg ? row.selisihPph21Pegawai : row.selisihPph21Ta;
                const diffPphFmt = isPeg ? row.selisihPph21PegawaiFmt : row.selisihPph21TaFmt;

                return (
                  <tr key={row.month} className={`hover:bg-surface-hover/50 transition-colors ${rowAlertBg}`}>
                    <td className="p-2.5 text-center font-mono font-bold text-navy-soft">
                      {String(row.month).padStart(2, "0")}
                    </td>
                    <td className="p-2.5 font-semibold text-navy-text">
                      {row.namaBulan}
                    </td>

                    <td className="p-2.5 text-right font-mono font-medium">{valGajiJurnal}</td>
                    <td className="p-2.5 text-right font-mono font-semibold bg-blue-50/30 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                      {valGajiSpt}
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      <span className={`font-semibold ${Math.abs(diffGaji) > 0.01 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {diffGajiFmt}
                      </span>
                    </td>

                    <td className="p-2.5 text-right font-mono font-medium text-purple-700 dark:text-purple-400">
                      {valPphJurnal}
                    </td>
                    <td className="p-2.5 text-right font-mono font-semibold bg-blue-50/30 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                      {valPphSpt}
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      <span className={`font-semibold ${Math.abs(diffPph) > 0.01 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {diffPphFmt}
                      </span>
                    </td>

                    <td className="p-2.5 text-center">
                      {isMatch ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> Balance
                        </span>
                      ) : isSelisih ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                          <AlertTriangle className="w-3 h-3" /> Selisih
                        </span>
                      ) : isBelumLapor ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          <Clock className="w-3 h-3" /> Belum Lapor
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-navy-soft italic">Nihil</span>
                      )}
                    </td>

                    <td className="p-2.5 font-mono text-[11px] text-navy-soft">{row.ntpn || "-"}</td>
                    <td className="p-2.5 text-navy-soft max-w-xs truncate">{row.keterangan || "-"}</td>

                    {canEdit && (
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => openEditModal(row)}
                          className="px-2 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-blue-600 hover:text-blue-700 font-semibold text-[11px] inline-flex items-center gap-1 transition-all border border-border-soft cursor-pointer shadow-2xs whitespace-nowrap"
                          title={
                            isPeg
                              ? "Input / Koreksi SPT Pegawai Tetap"
                              : "Input / Koreksi SPT Tenaga Ahli"
                          }
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>{isPeg ? "Input Pegawai" : "Input TA"}</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="bg-surface-subtle font-bold border-t-2 border-border-soft text-navy-text">
              {viewMode === "paralel" ? (
                <tr>
                  <td colSpan={2} className="p-2.5 text-center uppercase tracking-wider border-r border-border-soft">Total Tahunan</td>
                  <td className="p-2 text-right font-mono text-xs">{data.summary.pegawai.totalGajiJurnalFmt}</td>
                  <td className="p-2 text-right font-mono text-xs bg-blue-50/50 text-blue-800">{data.summary.pegawai.totalGajiTerlaporFmt}</td>
                  <td className={`p-2 text-right font-mono text-xs border-r border-border-soft ${Math.abs(data.summary.pegawai.totalSelisihGaji) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>{data.summary.pegawai.totalSelisihGajiFmt}</td>

                  <td className="p-2 text-right font-mono text-xs">{data.summary.tenagaAhli.totalGajiJurnalFmt}</td>
                  <td className="p-2 text-right font-mono text-xs bg-amber-50/50 text-amber-800">{data.summary.tenagaAhli.totalGajiTerlaporFmt}</td>
                  <td className={`p-2 text-right font-mono text-xs border-r border-border-soft ${Math.abs(data.summary.tenagaAhli.totalSelisihGaji) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>{data.summary.tenagaAhli.totalSelisihGajiFmt}</td>

                  <td className="p-2 text-right font-mono text-xs">{data.summary.totalGajiJurnalFmt}</td>
                  <td className="p-2 text-right font-mono text-xs bg-purple-50/50 text-purple-800">{data.summary.totalGajiTerlaporFmt}</td>
                  <td className={`p-2 text-right font-mono text-xs border-r border-border-soft ${Math.abs(data.summary.totalSelisihGaji) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>{data.summary.totalSelisihGajiFmt}</td>

                  <td className="p-2.5 text-center text-[11px] border-r border-border-soft">
                    {data.summary.overallStatus === "ALL_BALANCED" ? <span className="text-emerald-600">MATCH</span> : <span className="text-rose-600">{data.summary.jumlahBulanSelisih} SELISIH</span>}
                  </td>
                  <td colSpan={canEdit ? 3 : 2} className="p-2.5 text-navy-soft text-right text-[11px] font-normal">
                    Akumulasi Jan - Des {data.year}
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={2} className="p-2.5 text-center uppercase tracking-wider">Total Tahunan</td>
                  <td className="p-2.5 text-right font-mono text-xs">
                    {viewMode === "pegawai" ? data.summary.pegawai.totalGajiJurnalFmt : data.summary.tenagaAhli.totalGajiJurnalFmt}
                  </td>
                  <td className="p-2.5 text-right font-mono text-xs bg-blue-50/50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                    {viewMode === "pegawai" ? data.summary.pegawai.totalGajiTerlaporFmt : data.summary.tenagaAhli.totalGajiTerlaporFmt}
                  </td>
                  <td className="p-2.5 text-right font-mono text-xs">
                    <span className={Math.abs(viewMode === "pegawai" ? data.summary.pegawai.totalSelisihGaji : data.summary.tenagaAhli.totalSelisihGaji) > 0.01 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                      {viewMode === "pegawai" ? data.summary.pegawai.totalSelisihGajiFmt : data.summary.tenagaAhli.totalSelisihGajiFmt}
                    </span>
                  </td>

                  <td className="p-2.5 text-right font-mono text-xs text-purple-700 dark:text-purple-400">
                    {viewMode === "pegawai" ? data.summary.pegawai.totalPphBasisFmt : data.summary.tenagaAhli.totalPphBasisFmt}
                  </td>
                  <td className="p-2.5 text-right font-mono text-xs bg-blue-50/50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                    {viewMode === "pegawai" ? data.summary.pegawai.totalPphTerlaporFmt : data.summary.tenagaAhli.totalPphTerlaporFmt}
                  </td>
                  <td className="p-2.5 text-right font-mono text-xs">
                    <span className={Math.abs(viewMode === "pegawai" ? data.summary.pegawai.totalSelisihPph : data.summary.tenagaAhli.totalSelisihPph) > 0.01 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                      {viewMode === "pegawai" ? data.summary.pegawai.totalSelisihPphFmt : data.summary.tenagaAhli.totalSelisihPphFmt}
                    </span>
                  </td>

                  <td className="p-2.5 text-center text-[11px]">
                    {viewMode === "pegawai"
                      ? (data.summary.pegawai.jumlahBulanSelisih === 0 ? <span className="text-emerald-600 font-bold">MATCH</span> : <span className="text-rose-600 font-bold">{data.summary.pegawai.jumlahBulanSelisih} SELISIH</span>)
                      : (data.summary.tenagaAhli.jumlahBulanSelisih === 0 ? <span className="text-emerald-600 font-bold">MATCH</span> : <span className="text-rose-600 font-bold">{data.summary.tenagaAhli.jumlahBulanSelisih} SELISIH</span>)}
                  </td>
                  <td colSpan={canEdit ? 3 : 2} className="p-2.5 text-navy-soft text-right text-[11px] font-normal">
                    Akumulasi Jan - Des {data.year}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {editingItem && (() => {
        const isModalPegawai = viewMode === "pegawai";
        const isModalTa = viewMode === "tenaga-ahli";
        const isModalTotal = viewMode === "paralel";

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-text/60 backdrop-blur-xs">
            <div className="bg-surface-card rounded-2xl border border-border-soft w-full max-w-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft bg-surface-subtle shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                    isModalPegawai
                      ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-500/20"
                      : isModalTa
                      ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-500/20"
                      : "bg-purple-50 dark:bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-500/20"
                  }`}>
                    {isModalPegawai ? (
                      <Users className="w-4 h-4" />
                    ) : isModalTa ? (
                      <Award className="w-4 h-4" />
                    ) : (
                      <Edit3 className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-navy-text">
                      {isModalPegawai
                        ? "Input SPT Masa PPh 21 — Pegawai Tetap (Bruto)"
                        : isModalTa
                        ? "Input SPT Masa PPh 21 — Tenaga Ahli (Bruto)"
                        : "Input SPT Masa 1721 — Konsolidasi Induk"}
                    </h3>
                    <p className="text-xs text-navy-soft">
                      Masa {editingItem.namaBulan} {data.year} — {data.entityName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={
                      isModalPegawai
                        ? handleAutoFillPegawai
                        : isModalTa
                        ? handleAutoFillTa
                        : handleAutoFillAll
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition-all cursor-pointer shadow-2xs"
                    title="Salin nilai dari Laporan Penggajian internal agar status langsung Balance"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>
                      {isModalPegawai
                        ? "Salin Payroll Pegawai"
                        : isModalTa
                        ? "Salin Honor Tenaga Ahli"
                        : "Salin dari Laporan Gaji"}
                    </span>
                  </button>
                  <button
                    onClick={closeEditModal}
                    className="p-1 rounded-lg hover:bg-surface-hover text-navy-soft hover:text-navy-text transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4 text-xs overflow-y-auto">
                <div className="p-2.5 rounded-xl bg-surface-subtle border border-border-soft text-navy-soft text-[11px]">
                  <span>
                    {isModalPegawai
                      ? "💡 Masukkan nilai Bruto & PPh 21 Pegawai Tetap yang dilaporkan pada formulir SPT 1721-I (Bagian A). Gunakan tombol Salin Payroll Pegawai jika pelaporan sesuai pembukuan internal."
                      : isModalTa
                      ? "💡 Masukkan nilai Honorarium & PPh 21 Tenaga Ahli yang dilaporkan pada Bukti Potong 1721-VI. Gunakan tombol Salin Honor Tenaga Ahli jika pelaporan sesuai pembukuan internal."
                      : "💡 Masukkan nilai SPT Masa 1721 resmi DJP Online untuk masa pajak ini."}
                  </span>
                </div>

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

                {(isModalPegawai || isModalTotal) && (
                  <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/20 dark:bg-blue-950/10 space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-200/60 dark:border-blue-800/40 pb-2">
                      <span className="font-bold text-blue-900 dark:text-blue-300 text-xs flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-blue-600" />
                        Pegawai Tetap (Bruto Payroll)
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-navy-soft font-mono">
                          Bruto: {editingItem.gajiPegawaiJurnalFmt} | PPh: {editingItem.pph21PegawaiBasisFmt}
                        </span>
                        <button
                          type="button"
                          onClick={handleAutoFillPegawai}
                          className="px-2 py-0.5 rounded text-[10px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 transition-colors cursor-pointer"
                        >
                          Salin Jurnal
                        </button>
                      </div>
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

                    <div className="flex items-center justify-between text-[11px] pt-1 text-navy-soft border-t border-blue-100 dark:border-blue-900/40">
                      <span>Selisih Gaji Pegawai: <strong className={Math.abs(simSelisihGajiPeg) > 0.01 ? "text-rose-600" : "text-emerald-600"}>{formatRupiah(simSelisihGajiPeg)}</strong></span>
                      <span>Selisih PPh Pegawai: <strong className={Math.abs(simSelisihPphPeg) > 0.01 ? "text-rose-600" : "text-emerald-600"}>{formatRupiah(simSelisihPphPeg)}</strong></span>
                    </div>
                  </div>
                )}

                {(isModalTa || isModalTotal) && (
                  <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/20 dark:bg-amber-950/10 space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200/60 dark:border-amber-800/40 pb-2">
                      <span className="font-bold text-amber-900 dark:text-amber-300 text-xs flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-600" />
                        Tenaga Ahli (Bruto Honor)
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-navy-soft font-mono">
                          Bruto: {editingItem.gajiTaJurnalFmt} | PPh: {editingItem.pph21TaBasisFmt}
                        </span>
                        <button
                          type="button"
                          onClick={handleAutoFillTa}
                          className="px-2 py-0.5 rounded text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 transition-colors cursor-pointer"
                        >
                          Salin Honor
                        </button>
                      </div>
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

                    <div className="flex items-center justify-between text-[11px] pt-1 text-navy-soft border-t border-amber-100 dark:border-amber-900/40">
                      <span>Selisih Honor TA: <strong className={Math.abs(simSelisihGajiTa) > 0.01 ? "text-rose-600" : "text-emerald-600"}>{formatRupiah(simSelisihGajiTa)}</strong></span>
                      <span>Selisih PPh TA: <strong className={Math.abs(simSelisihPphTa) > 0.01 ? "text-rose-600" : "text-emerald-600"}>{formatRupiah(simSelisihPphTa)}</strong></span>
                    </div>
                  </div>
                )}

                {isModalTotal && (
                  <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/20 dark:bg-purple-950/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-purple-900 dark:text-purple-300">
                        Total SPT Masa 1721 (Formulir Induk)
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
                )}

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
                      placeholder="Contoh: Ada selisih pembetulan masa sebelumnya dilaporkan di masa ini..."
                      value={keterangan}
                      onChange={(e) => setKeterangan(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-surface-card border border-border-soft rounded-lg text-navy-text"
                    />
                  </div>
                </div>
              </div>

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
                  {isSubmitting
                    ? "Menyimpan..."
                    : isModalPegawai
                    ? "Simpan SPT Pegawai Tetap"
                    : isModalTa
                    ? "Simpan SPT Tenaga Ahli"
                    : "Simpan Data SPT"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
