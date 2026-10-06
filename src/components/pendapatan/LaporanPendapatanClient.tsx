"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  Receipt,
  TrendingUp,
  Wallet,
  Building2,
  Scale,
  Plus,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  X,
  Calculator,
  ChevronDown,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building,
  Sparkles,
} from "lucide-react";
import type {
  LaporanPendapatanData,
  FakturPendapatanItem,
  RekonsiliasiPajakItem,
} from "@/lib/pendapatan";
import {
  NAMA_BULAN,
  hitungPajakFaktur,
  hitungDppDariKwitansi,
  hitungDppNilaiLain,
} from "@/lib/pendapatan";
import {
  createFakturPendapatanAction,
  updateFakturPendapatanAction,
  deleteFakturPendapatanAction,
  upsertRekonsiliasiPajakAction,
  type FakturPendapatanInput,
} from "@/lib/actions/pendapatan";
import { formatRupiah } from "@/lib/dashboard-data";

interface Props {
  data: LaporanPendapatanData;
  canEdit: boolean;
  availableEntities: Array<{ id: string; key: string; name: string }>;
}

type TabType = "faktur" | "rekap-bulanan" | "rekonsiliasi";

export function LaporanPendapatanClient({
  data,
  canEdit,
  availableEntities,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<TabType>("faktur");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterJenisProyek, setFilterJenisProyek] = useState<string>("ALL");

  // Modals state
  const [isFakturModalOpen, setIsFakturModalOpen] = useState(false);
  const [editingFaktur, setEditingFaktur] = useState<FakturPendapatanItem | null>(null);

  const [isReconModalOpen, setIsReconModalOpen] = useState(false);
  const [editingRecon, setEditingRecon] = useState<RekonsiliasiPajakItem | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingFaktur, setDeletingFaktur] = useState<FakturPendapatanItem | null>(null);

  // Form states for Faktur
  const [formFaktur, setFormFaktur] = useState({
    npwp: "",
    noFaktur: "",
    masaPajak: data.masaPajak ?? 1,
    tahunPajak: data.year,
    namaRekanan: "",
    namaJkp: "",
    dpp: 0,
    dppNilaiLain: 0,
    tarifPpnPersen: 12,
    tarifPphPersen: 3.5,
    kodeJenisProyek: 1, // 1 = Perencanaan, 2 = Pengawasan
    pekerjaanPerusahaan: 0,
    pekerjaanYangDipinjam: 0,
    tanggalTerima: new Date().toISOString().split("T")[0],
    bank: data.bankOptions[0]?.nama ?? "BPD",
    nominalDiterima: 0,
    projectId: "",
  });

  // Termin selection state for auto-syncing DPP
  const [selectedTerminId, setSelectedTerminId] = useState<string>("");
  const [showManualDppFallback, setShowManualDppFallback] = useState(false);

  // Form state for Rekonsiliasi
  const [formRecon, setFormRecon] = useState({
    month: 1,
    dppTerlapor: 0,
    pajakTerlapor: 0,
    keterangan: "",
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter faktur list
  const filteredFaktur = data.fakturList.filter((f) => {
    const matchSearch =
      searchQuery === "" ||
      f.noFaktur.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.npwp.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.namaRekanan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.namaJkp.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.bank.toLowerCase().includes(searchQuery.toLowerCase());

    const matchJenis =
      filterJenisProyek === "ALL" ||
      (filterJenisProyek === "1" && f.kodeJenisProyek === 1) ||
      (filterJenisProyek === "2" && f.kodeJenisProyek === 2);

    return matchSearch && matchJenis;
  });

  // Live calculation for Faktur Form
  const liveCalc = hitungPajakFaktur(
    formFaktur.dpp,
    formFaktur.dppNilaiLain,
    formFaktur.tarifPpnPersen,
    formFaktur.tarifPphPersen
  );

  // Selected project & termin helpers for auto-syncing DPP
  const selectedProject = data.projectOptions.find((p) => p.id === formFaktur.projectId);
  const selectedTermin = selectedProject?.termins.find((t) => t.id === selectedTerminId);

  function handleSelectTermin(terminId: string) {
    setSelectedTerminId(terminId);
    if (!terminId || terminId === "manual") {
      setShowManualDppFallback(true);
      return;
    }
    setShowManualDppFallback(false);
    const proj = data.projectOptions.find((x) => x.id === formFaktur.projectId);
    const term = proj?.termins.find((t) => t.id === terminId);
    if (term) {
      const nominal = term.nominal;
      const dpp = hitungDppDariKwitansi(nominal);
      const dppNilaiLain = hitungDppNilaiLain(dpp);
      const pphNominal = Math.round((dpp * formFaktur.tarifPphPersen) / 100);
      const netReceived = dpp - pphNominal;
      setFormFaktur((prev) => ({
        ...prev,
        dpp,
        dppNilaiLain,
        pekerjaanPerusahaan: dpp,
        pekerjaanYangDipinjam: 0,
        namaJkp: proj ? `Jasa Konsultansi ${proj.name} - ${term.name}` : prev.namaJkp,
        nominalDiterima: netReceived,
      }));
    }
  }

  // Navigation handlers
  function handleFilterChange(newEntity?: string, newYear?: number, newMasa?: number | null) {
    const currentYear = newYear !== undefined ? newYear : data.year;
    const currentEntity = newEntity !== undefined ? newEntity : data.entity.key;
    const currentMasa = newMasa !== undefined ? newMasa : data.masaPajak;

    if (newEntity) {
      document.cookie = `lastEntityKey=${newEntity}; path=/; max-age=2592000`;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("entity", currentEntity);
    params.set("year", currentYear.toString());
    if (currentMasa) {
      params.set("masaPajak", currentMasa.toString());
    } else {
      params.delete("masaPajak");
    }

    startTransition(() => {
      router.push(`/pendapatan?${params.toString()}`);
    });
  }

  function openCreateFakturModal() {
    setEditingFaktur(null);
    setSelectedTerminId("");
    setShowManualDppFallback(false);
    setFormFaktur({
      npwp: "",
      noFaktur: "",
      masaPajak: data.masaPajak ?? new Date().getMonth() + 1,
      tahunPajak: data.year,
      namaRekanan: "",
      namaJkp: "",
      dpp: 0,
      dppNilaiLain: 0,
      tarifPpnPersen: 12,
      tarifPphPersen: 3.5,
      kodeJenisProyek: 1,
      pekerjaanPerusahaan: 0,
      pekerjaanYangDipinjam: 0,
      tanggalTerima: new Date().toISOString().split("T")[0],
      bank: data.bankOptions[0]?.nama ?? "BPD",
      nominalDiterima: 0,
      projectId: "",
    });
    setErrorMessage(null);
    setIsFakturModalOpen(true);
  }

  function openEditFakturModal(f: FakturPendapatanItem) {
    setEditingFaktur(f);
    const proj = data.projectOptions.find((p) => p.id === f.projectId);
    const matchedTermin = proj?.termins.find((t) => t.nominal === f.dpp);
    if (matchedTermin) {
      setSelectedTerminId(matchedTermin.id);
      setShowManualDppFallback(false);
    } else {
      setSelectedTerminId("");
      setShowManualDppFallback(true);
    }
    setFormFaktur({
      npwp: f.npwp,
      noFaktur: f.noFaktur,
      masaPajak: f.masaPajak,
      tahunPajak: f.tahunPajak,
      namaRekanan: f.namaRekanan,
      namaJkp: f.namaJkp,
      dpp: f.dpp,
      dppNilaiLain: f.dppNilaiLain,
      tarifPpnPersen: f.tarifPpnPersen,
      tarifPphPersen: f.tarifPphPersen,
      kodeJenisProyek: f.kodeJenisProyek,
      pekerjaanPerusahaan: f.pekerjaanPerusahaan,
      pekerjaanYangDipinjam: f.pekerjaanYangDipinjam,
      tanggalTerima: f.tanggalTerima,
      bank: f.bank,
      nominalDiterima: f.nominalDiterima,
      projectId: f.projectId ?? "",
    });
    setErrorMessage(null);
    setIsFakturModalOpen(true);
  }

  function openReconModal(rec: RekonsiliasiPajakItem) {
    setEditingRecon(rec);
    setFormRecon({
      month: rec.month,
      dppTerlapor: rec.dppTerlapor,
      pajakTerlapor: rec.pajakTerlapor,
      keterangan: rec.keterangan,
    });
    setErrorMessage(null);
    setIsReconModalOpen(true);
  }

  async function handleSaveFaktur(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: FakturPendapatanInput = {
        entityId: data.entity.id,
        npwp: formFaktur.npwp,
        noFaktur: formFaktur.noFaktur,
        masaPajak: Number(formFaktur.masaPajak),
        tahunPajak: Number(formFaktur.tahunPajak),
        namaRekanan: formFaktur.namaRekanan,
        namaJkp: formFaktur.namaJkp,
        dpp: Number(formFaktur.dpp),
        dppNilaiLain: Number(formFaktur.dppNilaiLain),
        tarifPpnPersen: Number(formFaktur.tarifPpnPersen),
        tarifPphPersen: Number(formFaktur.tarifPphPersen),
        kodeJenisProyek: Number(formFaktur.kodeJenisProyek),
        pekerjaanPerusahaan: Number(formFaktur.pekerjaanPerusahaan),
        pekerjaanYangDipinjam: Number(formFaktur.pekerjaanYangDipinjam),
        tanggalTerima: formFaktur.tanggalTerima,
        bank: formFaktur.bank,
        nominalDiterima: Number(formFaktur.nominalDiterima),
        projectId: formFaktur.projectId || null,
      };

      let res;
      if (editingFaktur) {
        res = await updateFakturPendapatanAction(editingFaktur.id, payload);
      } else {
        res = await createFakturPendapatanAction(payload);
      }

      if (res.error) {
        setErrorMessage(res.error);
        setIsSubmitting(false);
        return;
      }

      setIsFakturModalOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteFaktur() {
    if (!deletingFaktur) return;
    setIsSubmitting(true);
    try {
      const res = await deleteFakturPendapatanAction(deletingFaktur.id);
      if (res.error) {
        alert(res.error);
      } else {
        setIsDeleteModalOpen(false);
        setDeletingFaktur(null);
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err: any) {
      alert(err.message || "Gagal menghapus faktur.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveRecon(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRecon) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await upsertRekonsiliasiPajakAction({
        entityId: data.entity.id,
        year: data.year,
        month: formRecon.month,
        dppTerlapor: Number(formRecon.dppTerlapor),
        pajakTerlapor: Number(formRecon.pajakTerlapor),
        keterangan: formRecon.keterangan,
      });

      if (res.error) {
        setErrorMessage(res.error);
        setIsSubmitting(false);
        return;
      }

      setIsReconModalOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const exportUrl = `/api/pendapatan/export?entityId=${data.entity.id}&year=${data.year}${
    data.masaPajak ? `&masaPajak=${data.masaPajak}` : ""
  }`;

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TOOLBAR: FILTERS & ACTIONS */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-surface-card p-3.5 sm:p-4 rounded-2xl border border-border-soft shadow-xs">
        {/* Left: Filter Controls & Audit Status Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Pill: Tahun */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-subtle/80 border border-border-soft text-xs text-navy-text">
            <Calendar className="w-3.5 h-3.5 text-navy-soft" />
            <span className="font-medium text-navy-soft">Tahun:</span>
            <select
              value={data.year}
              onChange={(e) => handleFilterChange(undefined, Number(e.target.value))}
              className="bg-transparent font-bold text-navy-text focus:outline-none cursor-pointer pr-1"
            >
              {[2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr} className="bg-surface-card text-navy-text">
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Pill: Masa Pajak */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-subtle/80 border border-border-soft text-xs text-navy-text">
            <Filter className="w-3.5 h-3.5 text-navy-soft" />
            <span className="font-medium text-navy-soft">Masa Pajak:</span>
            <select
              value={data.masaPajak ?? ""}
              onChange={(e) =>
                handleFilterChange(
                  undefined,
                  undefined,
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="bg-transparent font-bold text-navy-text focus:outline-none cursor-pointer pr-1"
            >
              <option value="" className="bg-surface-card text-navy-text">Semua Masa (12 Bulan)</option>
              {NAMA_BULAN.map((m, idx) => (
                <option key={idx + 1} value={idx + 1} className="bg-surface-card text-navy-text">
                  Bulan {idx + 1} ({m})
                </option>
              ))}
            </select>
          </div>

          <div className="h-5 w-px bg-border-soft hidden sm:block" />

          {/* Audit SPT Status Badge */}
          {data.kpiSummary.statusAudit === "SEMUA_SESUAI" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong className="font-semibold text-navy-soft">Audit SPT:</strong> Match 100% Sesuai
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                <strong className="font-semibold text-navy-soft">Audit SPT:</strong> {data.kpiSummary.jumlahBulanSelisih} Bulan Selisih
              </span>
            </div>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2.5">
          <a
            href={exportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Ekspor Excel</span>
          </a>

          {canEdit && (
            <button
              onClick={openCreateFakturModal}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Input E-Faktur</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 6 KPI SUMMARY METRICS */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1 */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-soft shadow-xs">
          <div className="flex items-center justify-between text-navy-soft mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Nilai Proyek (111%)
            </span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-navy-text truncate">
            {data.kpiSummary.totalNilaiProyekFmt}
          </div>
          <p className="text-[11px] text-navy-soft mt-1">
            Diakui sebagai Pendapatan di Laba Rugi
          </p>
        </div>

        {/* KPI 2 */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-soft shadow-xs">
          <div className="flex items-center justify-between text-navy-soft mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total DPP
            </span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-lg font-bold text-navy-text truncate">
            {data.kpiSummary.totalDppFmt}
          </div>
          <p className="text-[11px] text-navy-soft mt-1">
            DPP Nilai Lain: {data.totalPeriod.dppNilaiLainFmt}
          </p>
        </div>

        {/* KPI 3 */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-soft shadow-xs">
          <div className="flex items-center justify-between text-navy-soft mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Kewajiban Pajak
            </span>
            <Receipt className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-lg font-bold text-navy-text truncate">
            {data.kpiSummary.totalPajakFmt}
          </div>
          <p className="text-[11px] text-navy-soft mt-1">
            PPN: {data.totalPeriod.ppnFmt} | PPh: {data.totalPeriod.pphFmt}
          </p>
        </div>

        {/* KPI 4 */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-soft shadow-xs">
          <div className="flex items-center justify-between text-navy-soft mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Laba Stlh Pajak
            </span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-emerald-600 truncate">
            {data.kpiSummary.totalLabaSetelahPajakFmt}
          </div>
          <p className="text-[11px] text-navy-soft mt-1">
            Margin bersih setelah PPN & PPh
          </p>
        </div>

        {/* KPI 5 */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-soft shadow-xs">
          <div className="flex items-center justify-between text-navy-soft mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Dana Cair
            </span>
            <Building2 className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-lg font-bold text-navy-text truncate">
            {data.kpiSummary.totalNominalDiterimaFmt}
          </div>
          <p className="text-[11px] text-navy-soft mt-1">
            {data.totalPeriod.jumlahFaktur} faktur tercatat
          </p>
        </div>

        {/* KPI 6 */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-soft shadow-xs">
          <div className="flex items-center justify-between text-navy-soft mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Audit SPT Pajak
            </span>
            <Scale className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-navy-text truncate">
            {data.kpiSummary.statusAudit === "SEMUA_SESUAI" ? (
              <span className="text-emerald-600">Match 100%</span>
            ) : (
              <span className="text-rose-600">{data.kpiSummary.jumlahBulanSelisih} Bulan Beda</span>
            )}
          </div>
          <p className="text-[11px] text-navy-soft mt-1">
            Selisih PPN: {data.kpiSummary.totalSelisihPajakFmt}
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3 LAYER TABS NAVIGATION */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-border-soft bg-surface-card rounded-t-2xl px-4 pt-2">
        <button
          onClick={() => setActiveTab("faktur")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "faktur"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-navy-soft hover:text-navy-text"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Lapis 1: Daftar E-Faktur & Total Periode</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
            {filteredFaktur.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("rekap-bulanan")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "rekap-bulanan"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-navy-soft hover:text-navy-text"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Lapis 2: Rekap Bulanan (Jan - Des)</span>
        </button>

        <button
          onClick={() => setActiveTab("rekonsiliasi")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "rekonsiliasi"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-navy-soft hover:text-navy-text"
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Lapis 3: Rekonsiliasi Audit Pajak (Faktur vs SPT)</span>
          {data.kpiSummary.jumlahBulanSelisih > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-rose-100 text-rose-700 font-bold">
              {data.kpiSummary.jumlahBulanSelisih}
            </span>
          )}
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: LAPIS 1 - DAFTAR E-FAKTUR & TOTAL PERIODE */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "faktur" && (
        <div className="bg-surface-card rounded-b-2xl border border-border-soft p-5 shadow-xs space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-navy-soft" />
              <input
                type="text"
                placeholder="Cari no. faktur, rekanan, JKP, bank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-surface-card border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-3 text-navy-soft hover:text-navy-text"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-navy-soft font-medium">Jenis:</span>
              <select
                value={filterJenisProyek}
                onChange={(e) => setFilterJenisProyek(e.target.value)}
                className="px-3 py-2 text-sm bg-surface-card border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="ALL">Semua Jenis Proyek</option>
                <option value="1">Perencanaan</option>
                <option value="2">Pengawasan</option>
              </select>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto rounded-xl border border-border-soft">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-surface-subtle text-navy-text border-b border-border-soft font-semibold">
                <tr>
                  <th className="p-3 text-center w-10">No</th>
                  <th className="p-3 text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10">Kode Proyek</th>
                  <th className="p-3">No. Faktur / NPWP</th>
                  <th className="p-3">Rekanan & Uraian JKP</th>
                  <th className="p-3 text-center">Masa</th>
                  <th className="p-3 text-right">DPP</th>
                  <th className="p-3 text-right">DPP Nilai Lain</th>
                  <th className="p-3 text-right">PPN</th>
                  <th className="p-3 text-right">PPh (3.5%)</th>
                  <th className="p-3 text-right font-bold text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10">
                    Nilai Proyek (111%)
                  </th>
                  <th className="p-3 text-right text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10">
                    Laba Stlh Pajak
                  </th>
                  <th className="p-3 text-right">Dana Cair</th>
                  <th className="p-3">Tgl Terima / Bank</th>
                  <th className="p-3 text-center">Jenis</th>
                  {canEdit && <th className="p-3 text-center w-20">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft text-navy-text">
                {filteredFaktur.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canEdit ? 15 : 14}
                      className="p-8 text-center text-navy-soft"
                    >
                      <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      Tidak ada data e-faktur untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredFaktur.map((f, idx) => (
                    <tr
                      key={f.id}
                      className="hover:bg-surface-hover/50 transition-colors"
                    >
                      <td className="p-3 text-center text-navy-soft">{idx + 1}</td>
                      <td className="p-3">
                        {f.projectCode ? (
                          <div>
                            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                              {f.projectCode}
                            </span>
                            {f.projectName && (
                              <div
                                className="text-[10px] text-navy-soft max-w-[130px] truncate mt-0.5"
                                title={f.projectName}
                              >
                                {f.projectName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-navy-text">
                          {f.noFaktur}
                        </div>
                        <div className="text-[11px] text-navy-soft font-mono">
                          {f.npwp}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-navy-text max-w-xs truncate">
                          {f.namaRekanan}
                        </div>
                        <div className="text-[11px] text-navy-soft max-w-xs truncate">
                          {f.namaJkp}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-1 text-[11px] font-medium rounded-full bg-surface-hover text-muted-stronger">
                          {f.namaBulan}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">{f.dppFmt}</td>
                      <td className="p-3 text-right font-mono text-navy-soft">
                        {f.dppNilaiLainFmt}
                      </td>
                      <td className="p-3 text-right font-mono text-purple-700">
                        <div>{f.ppnFmt}</div>
                        <span className="text-[10px] text-navy-soft">
                          {f.tarifPpnPersen}%
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-amber-700">
                        <div>{f.pphFmt}</div>
                        <span className="text-[10px] text-navy-soft">
                          {f.tarifPphPersen}%
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-500/10">
                        {f.nilaiProyekFmt}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-500/10">
                        {f.labaSetelahPajakFmt}
                      </td>
                      <td className="p-3 text-right font-mono font-medium">
                        {f.nominalDiterimaFmt}
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-xs">{f.tanggalTerima}</div>
                        <div className="text-[11px] font-semibold text-blue-600">
                          {f.bank}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            f.kodeJenisProyek === 2
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {f.jenisProyekLabel}
                        </span>
                        {f.pekerjaanYangDipinjam > 0 && (
                          <div className="text-[10px] text-amber-600 mt-0.5">
                            Dipinjam: {f.pekerjaanYangDipinjamFmt}
                          </div>
                        )}
                      </td>
                      {canEdit && (
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditFakturModal(f)}
                              title="Edit Faktur"
                              className="p-1.5 text-navy-soft hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeletingFaktur(f);
                                setIsDeleteModalOpen(true);
                              }}
                              title="Hapus Faktur"
                              className="p-1.5 text-navy-soft hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {/* Footer Total */}
              <tfoot className="bg-surface-subtle font-bold text-navy-text border-t-2 border-border-soft">
                <tr>
                  <td colSpan={5} className="p-3 text-center uppercase tracking-wider">
                    Total Periode ({data.totalPeriod.jumlahFaktur} Faktur)
                  </td>
                  <td className="p-3 text-right font-mono">
                    {data.totalPeriod.dppFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-navy-soft">
                    {data.totalPeriod.dppNilaiLainFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-purple-700">
                    {data.totalPeriod.ppnFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-amber-700">
                    {data.totalPeriod.pphFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-blue-700 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-500/15">
                    {data.totalPeriod.nilaiProyekFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/15">
                    {data.totalPeriod.labaSetelahPajakFmt}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {data.totalPeriod.nominalDiterimaFmt}
                  </td>
                  <td colSpan={canEdit ? 3 : 2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: LAPIS 2 - REKAP BULANAN */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "rekap-bulanan" && (
        <div className="bg-surface-card rounded-b-2xl border border-border-soft p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-navy-text">
                Rekapitulasi Pendapatan Dinamis Bulanan (Tahun {data.year})
              </h2>
              <p className="text-xs text-navy-soft">
                Agregasi otomatis berdasarkan Masa Pajak (Januari - Desember)
              </p>
            </div>
            <a
              href={exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ekspor Rekap</span>
            </a>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-soft">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-surface-subtle text-navy-text border-b border-border-soft font-semibold">
                <tr>
                  <th className="p-3 text-center w-12">Bulan</th>
                  <th className="p-3">Nama Bulan</th>
                  <th className="p-3 text-center">Jml Faktur</th>
                  <th className="p-3 text-right">Total DPP</th>
                  <th className="p-3 text-right">Total DPP Nilai Lain</th>
                  <th className="p-3 text-right">Total PPN</th>
                  <th className="p-3 text-right">Total PPh (3.5%)</th>
                  <th className="p-3 text-right font-bold text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10">
                    Nilai Proyek (111%)
                  </th>
                  <th className="p-3 text-right text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10">
                    Laba Stlh Pajak
                  </th>
                  <th className="p-3 text-right">Total Cair</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft text-navy-text">
                {data.rekapBulanan.map((b) => (
                  <tr
                    key={b.month}
                    className="hover:bg-surface-hover/50 transition-colors"
                  >
                    <td className="p-3 text-center font-mono font-bold text-navy-soft">
                      {String(b.month).padStart(2, "0")}
                    </td>
                    <td className="p-3 font-semibold text-navy-text">
                      {b.namaBulan}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          b.jumlahFaktur > 0
                            ? "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30"
                            : "bg-surface-hover text-muted-faint"
                        }`}
                      >
                        {b.jumlahFaktur} faktur
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">{b.dppFmt}</td>
                    <td className="p-3 text-right font-mono text-navy-soft">
                      {b.dppNilaiLainFmt}
                    </td>
                    <td className="p-3 text-right font-mono text-purple-700">
                      {b.ppnFmt}
                    </td>
                    <td className="p-3 text-right font-mono text-amber-700">
                      {b.pphFmt}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-blue-700 bg-blue-50/30">
                      {b.nilaiProyekFmt}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-emerald-700 bg-emerald-50/30">
                      {b.labaSetelahPajakFmt}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {b.nominalDiterimaFmt}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          handleFilterChange(undefined, undefined, b.month);
                          setActiveTab("faktur");
                        }}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <span>Lihat Faktur</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-subtle font-bold text-navy-text border-t-2 border-border-soft">
                <tr>
                  <td colSpan={2} className="p-3 text-center uppercase tracking-wider">
                    Total Setahun
                  </td>
                  <td className="p-3 text-center font-mono">
                    {data.totalTahunanRekap.jumlahFaktur} faktur
                  </td>
                  <td className="p-3 text-right font-mono">
                    {data.totalTahunanRekap.dppFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-navy-soft">
                    {data.totalTahunanRekap.dppNilaiLainFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-purple-700">
                    {data.totalTahunanRekap.ppnFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-amber-700">
                    {data.totalTahunanRekap.pphFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-blue-700 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-500/15">
                    {data.totalTahunanRekap.nilaiProyekFmt}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/15">
                    {data.totalTahunanRekap.labaSetelahPajakFmt}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {data.totalTahunanRekap.nominalDiterimaFmt}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: LAPIS 3 - REKONSILIASI AUDIT PAJAK (FAKTUR VS SPT) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "rekonsiliasi" && (
        <div className="bg-surface-card rounded-b-2xl border border-border-soft p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-surface-subtle border border-border-soft">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-navy-text">
                  Audit Kepatuhan & Rekonsiliasi Faktur vs SPT Pajak Resmi
                </h3>
                <p className="text-xs text-navy-soft mt-0.5">
                  Membandingkan DPP dan PPN hasil rekap faktur sistem dengan angka yang dilaporkan resmi ke kantor pajak (SPT Masa).
                  Baris bertanda merah mengindikasikan adanya faktur yang belum atau salah dilaporkan.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Selisih Rp 0 = Sesuai
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                Selisih ≠ 0 = Alert
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-soft">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-surface-subtle text-navy-text border-b border-border-soft font-semibold">
                <tr>
                  <th className="p-3 text-center w-10">Bulan</th>
                  <th className="p-3">Nama Masa</th>
                  <th className="p-3 text-right">DPP Rekap Faktur</th>
                  <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-500/10">DPP Terlapor (SPT)</th>
                  <th className="p-3 text-right">Selisih DPP</th>
                  <th className="p-3 text-right">PPN Rekap Faktur</th>
                  <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-500/10">Pajak Terlapor (SPT)</th>
                  <th className="p-3 text-right">Selisih PPN</th>
                  <th className="p-3 text-center">Status Audit</th>
                  <th className="p-3">Catatan / Tindak Lanjut</th>
                  {canEdit && <th className="p-3 text-center w-16">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft text-navy-text">
                {data.rekonsiliasiList.map((rec) => {
                  const isMatch = rec.status === "MATCH";
                  const isUnreported = rec.status === "BELUM_DILAPORKAN";
                  const rowAlertBg = isMatch
                    ? ""
                    : isUnreported
                    ? "bg-amber-50/30 dark:bg-amber-500/10"
                    : "bg-rose-50/40 dark:bg-rose-500/10";

                  return (
                    <tr
                      key={rec.month}
                      className={`hover:bg-surface-hover/50 transition-colors ${rowAlertBg}`}
                    >
                      <td className="p-3 text-center font-mono font-bold text-navy-soft">
                        {String(rec.month).padStart(2, "0")}
                      </td>
                      <td className="p-3 font-semibold text-navy-text">
                        {rec.namaBulan}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {rec.dppRekapFmt}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold bg-blue-50/30 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                        {rec.dppTerlaporFmt}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            Math.abs(rec.selisihDpp) > 0.01
                              ? "text-rose-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {rec.selisihDppFmt}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-purple-700">
                        {rec.ppnRekapFmt}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold bg-blue-50/30 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">
                        {rec.pajakTerlaporFmt}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            Math.abs(rec.selisihPajak) > 0.01
                              ? "text-rose-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {rec.selisihPajakFmt}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {isMatch ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            SESUAI
                          </span>
                        ) : isUnreported ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            BELUM LAPOR
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            SELISIH
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-navy-soft max-w-xs truncate">
                        {rec.keterangan || "-"}
                      </td>
                      {canEdit && (
                        <td className="p-3 text-center">
                          <button
                            onClick={() => openReconModal(rec)}
                            title="Edit Angka Terlapor SPT"
                            className="p-1.5 text-navy-soft hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: INPUT / EDIT FAKTUR PENDAPATAN */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isFakturModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-surface-card rounded-2xl border border-border-soft shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header (Fixed at top) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft bg-surface-subtle/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy-text">
                    {editingFaktur ? "Edit E-Faktur Pendapatan" : "Input E-Faktur Baru"}
                  </h3>
                  <p className="text-xs text-navy-soft">
                    {data.entity.legalName} • Tahun {formFaktur.tahunPajak}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFakturModalOpen(false)}
                className="p-1.5 text-navy-soft hover:text-navy-text hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                aria-label="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFaktur} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form Section 1: Kode Proyek dari Sidamon */}
              <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-navy-text flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    Pilih Kode Proyek (Master Proyek Sidamon)
                  </label>
                  {formFaktur.projectId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTerminId("");
                        setShowManualDppFallback(false);
                        setFormFaktur((prev) => ({
                          ...prev,
                          projectId: "",
                          dpp: 0,
                          dppNilaiLain: 0,
                          nominalDiterima: 0,
                        }));
                      }}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                    >
                      Batal Pilih Proyek
                    </button>
                  )}
                </div>
                <select
                  value={formFaktur.projectId}
                  onChange={(e) => {
                    const selectedProjId = e.target.value;
                    const p = data.projectOptions.find((x) => x.id === selectedProjId);
                    setSelectedTerminId("");
                    setShowManualDppFallback(false);
                    setFormFaktur((prev) => ({
                      ...prev,
                      projectId: selectedProjId,
                      namaRekanan: prev.namaRekanan || (p ? p.name : ""),
                      namaJkp: prev.namaJkp || (p ? `Jasa Konsultansi ${p.name}` : ""),
                    }));
                  }}
                  className="w-full px-3 py-2 text-xs border border-blue-300 dark:border-blue-500/40 rounded-xl bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                >
                  <option value="">-- Pilih Kode Proyek yang Sesuai --</option>
                  {data.projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name} {p.contractValueFmt ? `• Nilai Kontrak: ${p.contractValueFmt}` : ""}
                    </option>
                  ))}
                </select>
                {formFaktur.projectId ? (
                  (() => {
                    const sel = data.projectOptions.find((x) => x.id === formFaktur.projectId);
                    return sel ? (
                      <div className="space-y-2.5 pt-1">
                        <div className="text-[11px] text-blue-800 dark:text-blue-300 bg-surface-input p-2.5 rounded-lg border border-blue-100 dark:border-blue-500/20 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                          <span>
                            Kode Proyek: <strong className="font-mono">{sel.code}</strong> • {sel.name}
                          </span>
                          <span className="font-semibold text-navy-text">
                            Nilai Kontrak: {sel.contractValueFmt}
                          </span>
                        </div>

                        {/* Dropdown Termin untuk Sinkronisasi DPP */}
                        {sel.termins && sel.termins.length > 0 ? (
                          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200/90 dark:border-emerald-500/20 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Pilih Termin Proyek (Sumber Otomatis Nilai DPP)</span>
                              </label>
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                                {sel.termins.length} Termin Terdaftar
                              </span>
                            </div>
                            <select
                              value={selectedTerminId}
                              onChange={(e) => handleSelectTermin(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-emerald-300 dark:border-emerald-500/40 rounded-lg bg-surface-input text-navy-text focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold cursor-pointer"
                            >
                              <option value="">-- Pilih Termin yang Ditagihkan --</option>
                              {sel.termins.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({t.percentage}% Kontrak) — {t.nominalFmt}
                                </option>
                              ))}
                              <option value="manual">✍️ Input Nilai DPP Manual (Tanpa Termin)</option>
                            </select>
                            {selectedTermin ? (
                              <div className="text-[11px] text-emerald-900 dark:text-emerald-300 bg-surface-input p-2 rounded-lg border border-emerald-100 dark:border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                                <span>
                                  ⚡ Nilai Termin: <strong className="font-mono">{selectedTermin.nominalFmt}</strong> ({selectedTermin.percentage}% dari nilai kontrak)
                                </span>
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded">
                                  DPP otomatis tersinkron
                                </span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-emerald-800">
                                Pilih termin yang sedang ditagihkan agar nilai DPP & DPP Nilai Lain langsung terisi otomatis sesuai termin di Finance.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
                            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Belum ada termin pembayaran tercatat di Finance untuk proyek ini.</span>
                              <p className="text-amber-700 text-[11px] mt-0.5">
                                Proyek telah didaftarkan Sidamon. Anda dapat menginput nilai DPP secara manual pada bagian perhitungan pajak di bawah.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()
                ) : (
                  <p className="text-[11px] text-navy-soft">
                    Pilih proyek dari daftar proyek yang sudah diinput oleh Admin Sidamon untuk entitas ini.
                  </p>
                )}
              </div>

              {/* Form Grid 1: Basic Faktur Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    Nomor E-Faktur <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="010.000-24.00000001"
                    value={formFaktur.noFaktur}
                    onChange={(e) =>
                      setFormFaktur({ ...formFaktur, noFaktur: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    NPWP Rekanan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="00.000.000.0-000.000"
                    value={formFaktur.npwp}
                    onChange={(e) =>
                      setFormFaktur({ ...formFaktur, npwp: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    Masa Pajak <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formFaktur.masaPajak}
                    onChange={(e) =>
                      setFormFaktur({
                        ...formFaktur,
                        masaPajak: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {NAMA_BULAN.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        Bulan {idx + 1} - {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Form Grid 2: Rekanan & JKP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    Nama Rekanan / Klien <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: RSUD dr. Doris Sylvanus"
                    value={formFaktur.namaRekanan}
                    onChange={(e) =>
                      setFormFaktur({ ...formFaktur, namaRekanan: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    Uraian JKP / Pekerjaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Perencanaan Gedung Rawat Inap"
                    value={formFaktur.namaJkp}
                    onChange={(e) =>
                      setFormFaktur({ ...formFaktur, namaJkp: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Form Section 3: Tax Rates & DPP Inputs */}
              <div className="p-4 sm:p-5 rounded-2xl bg-surface-subtle/50 border border-border-soft space-y-4">
                {/* Header Section with Title & Explanation */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border-soft">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-navy-text uppercase tracking-wider">
                        Parameter Nilai & Perhitungan Pajak Otomatis
                      </h4>
                      <p className="text-[11px] text-navy-soft">
                        Masukkan nilai termin dan tentukan tarif. Pajak dan laba bersih dihitung otomatis secara real-time.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 1. KASUS TERSEDIA TERMIN: Tampilan Nilai DPP Otomatis (Tanpa Input Box) */}
                {selectedTermin && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/90 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 text-emerald-950 font-bold">
                        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Nilai DPP Otomatis Tersinkron dari {selectedTermin.name}</span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold self-start sm:self-auto">
                        Otomatis Tanpa Input Manual
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Card DPP Dasar */}
                      <div className="p-4 rounded-xl bg-surface-card border border-emerald-200/80 shadow-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-navy-text">DPP Dasar (Nilai Termin)</span>
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded">
                            Basis PPh Final ({formFaktur.tarifPphPersen}%)
                          </span>
                        </div>
                        <div className="text-xl font-black font-mono text-emerald-800">
                          {selectedTermin.nominalFmt}
                        </div>
                        <span className="text-[11px] text-navy-soft block">
                          Sesuai termin keluar ({selectedTermin.percentage}% dari nilai kontrak)
                        </span>
                      </div>

                      {/* Card DPP Nilai Lain */}
                      <div className="p-4 rounded-xl bg-surface-card border border-emerald-200/80 shadow-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-navy-text">DPP Nilai Lain</span>
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded">
                            Basis PPN ({formFaktur.tarifPpnPersen}%)
                          </span>
                        </div>
                        <div className="text-xl font-black font-mono text-emerald-800">
                          {selectedTermin.nominalFmt}
                        </div>
                        <span className="text-[11px] text-navy-soft block">
                          Otomatis disamakan dengan DPP Dasar termin
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. KASUS BELUM PILIH TERMIN: Informasi untuk memilih termin */}
                {!selectedTermin && !showManualDppFallback && (
                  <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Nilai DPP Tidak Perlu Diinput di Sini</span>
                        <p className="text-blue-800 text-[11.5px] mt-0.5 leading-relaxed">
                          Sistem akan mengambil nilai DPP secara otomatis dari termin proyek. Silakan pilih <strong>Kode Proyek</strong> dan <strong>Termin</strong> pada bagian atas formulir. Nilai DPP, PPh, PPN, dan laba setelah pajak akan langsung terisi otomatis.
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between text-[11px]">
                      <span className="text-blue-700">Tidak ada data termin atau bukan faktur berbasis proyek?</span>
                      <button
                        type="button"
                        onClick={() => setShowManualDppFallback(true)}
                        className="font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                      >
                        Buka Opsi Input Manual
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. KASUS FALLBACK INPUT MANUAL (Hanya jika belum pilih termin & klik opsi manual) */}
                {!selectedTermin && showManualDppFallback && (
                  <div className="p-3.5 rounded-xl bg-surface-card border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-amber-600" />
                        Mode Input DPP Manual (Khusus Non-Termin)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowManualDppFallback(false)}
                        className="text-[10px] text-amber-700 hover:text-amber-900 underline cursor-pointer"
                      >
                        Tutup Input Manual
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* DPP Dasar Input */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-navy-text">
                            DPP Dasar (Manual) <span className="text-rose-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const raw = window.prompt("Masukkan Nilai Kwitansi (Bruto / Akun Pendapatan):");
                              if (raw) {
                                const parsed = Number(raw.replace(/[^\d.-]/g, ""));
                                if (!isNaN(parsed) && parsed > 0) {
                                  const dppVal = hitungDppDariKwitansi(parsed);
                                  const dppNilaiLainVal = hitungDppNilaiLain(dppVal);
                                  setFormFaktur((prev) => ({
                                    ...prev,
                                    dpp: dppVal,
                                    dppNilaiLain: dppNilaiLainVal,
                                    pekerjaanPerusahaan: dppVal,
                                    pekerjaanYangDipinjam: 0,
                                  }));
                                }
                              }
                            }}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 cursor-pointer"
                            title="Hitung DPP = 100/111 x Nilai Kwitansi"
                          >
                            ⚡ 100/111 Kwitansi
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-navy-soft">
                            Rp
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            placeholder="0"
                            value={formFaktur.dpp || ""}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setFormFaktur((prev) => ({
                                ...prev,
                                dpp: val,
                                dppNilaiLain: hitungDppNilaiLain(val),
                                pekerjaanPerusahaan: val,
                              }));
                            }}
                            className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* DPP Nilai Lain Input */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-navy-text">
                            DPP Nilai Lain (Manual) <span className="text-rose-500">*</span>
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setFormFaktur((prev) => ({
                                  ...prev,
                                  dppNilaiLain: hitungDppNilaiLain(prev.dpp),
                                }))
                              }
                              title="Hitung 11/12 x DPP Dasar"
                              className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 cursor-pointer"
                            >
                              ⚡ 11/12 × DPP
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setFormFaktur((prev) => ({
                                  ...prev,
                                  dppNilaiLain: prev.dpp,
                                }))
                              }
                              title="Samakan dengan DPP Dasar"
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 cursor-pointer"
                            >
                              ⚡ Samakan
                            </button>
                          </div>
                        </div>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-navy-soft">
                            Rp
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            placeholder="0"
                            value={formFaktur.dppNilaiLain || ""}
                            onChange={(e) =>
                              setFormFaktur({
                                ...formFaktur,
                                dppNilaiLain: Number(e.target.value),
                              })
                            }
                            className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-grid 2: Tarif Pajak (2 Columns - No truncation!) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tarif PPN */}
                  <div>
                    <label className="block text-xs font-semibold text-navy-text mb-1">
                      Tarif PPN
                    </label>
                    <select
                      value={formFaktur.tarifPpnPersen}
                      onChange={(e) =>
                        setFormFaktur({
                          ...formFaktur,
                          tarifPpnPersen: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                    >
                      <option value={12}>PPN 12% (DPP Nilai Lain 11/12)</option>
                      <option value={11}>PPN 11% (Tarif Standar Lama)</option>
                      <option value={0}>Bebas PPN (0%)</option>
                    </select>
                    <span className="text-[10px] text-navy-soft mt-1 block">
                      Dikalikan terhadap DPP Nilai Lain
                    </span>
                  </div>

                  {/* Tarif PPh Final */}
                  <div>
                    <label className="block text-xs font-semibold text-navy-text mb-1">
                      Tarif PPh Final Jasa Konstruksi
                    </label>
                    <select
                      value={formFaktur.tarifPphPersen}
                      onChange={(e) =>
                        setFormFaktur({
                          ...formFaktur,
                          tarifPphPersen: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                    >
                      <option value={3.5}>PPh Final 3.5% (Standar Konsultansi / Pengawasan)</option>
                      <option value={2.65}>PPh Final 2.65% (Kualifikasi Usaha Kecil)</option>
                      <option value={0}>Tanpa Pemotongan PPh (0%)</option>
                    </select>
                    <span className="text-[10px] text-navy-soft mt-1 block">
                      Dipotong rekanan dari DPP Dasar termin keluar
                    </span>
                  </div>
                </div>

                {/* Sub-grid 3: Live Automatic Calculation Summary Cards */}
                <div className="pt-2">
                  <span className="text-[11px] font-bold text-navy-soft uppercase tracking-wider block mb-2">
                    Hasil Perhitungan Pajak Otomatis (Live):
                  </span>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Card 1: PPN */}
                    <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50">
                      <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 mb-1">
                        <span className="text-[11px] font-semibold">PPN Dipungut</span>
                        <Receipt className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-sm font-bold font-mono text-purple-800 dark:text-purple-200">
                        {formatRupiah(liveCalc.ppn)}
                      </div>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5 block">
                        {formFaktur.tarifPpnPersen}% × DPP Nilai Lain
                      </span>
                    </div>

                    {/* Card 2: PPh */}
                    <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                      <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 mb-1">
                        <span className="text-[11px] font-semibold">PPh Dipotong</span>
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-sm font-bold font-mono text-amber-800 dark:text-amber-200">
                        {formatRupiah(liveCalc.pph)}
                      </div>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 block">
                        {formFaktur.tarifPphPersen}% × DPP Dasar
                      </span>
                    </div>

                    {/* Card 3: Nilai Proyek */}
                    <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
                      <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 mb-1">
                        <span className="text-[11px] font-semibold">Nilai Proyek (111%)</span>
                        <TrendingUp className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-sm font-bold font-mono text-blue-800 dark:text-blue-200">
                        {formatRupiah(liveCalc.nilaiProyek)}
                      </div>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 block">
                        Diakui Pendapatan Laba Rugi
                      </span>
                    </div>

                    {/* Card 4: Laba Bersih Setelah Pajak */}
                    <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 shadow-xs">
                      <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 mb-1">
                        <span className="text-[11px] font-bold">Laba Stlh Pajak</span>
                        <Wallet className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-sm font-extrabold font-mono text-emerald-800 dark:text-emerald-200">
                        {formatRupiah(liveCalc.labaSetelahPajak)}
                      </div>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5 block font-medium">
                        DPP Dasar − PPh Final
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Grid 4: Jenis Proyek & Porsi Pekerjaan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    Jenis Proyek <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formFaktur.kodeJenisProyek}
                    onChange={(e) =>
                      setFormFaktur({
                        ...formFaktur,
                        kodeJenisProyek: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value={1}>1 - Perencanaan</option>
                    <option value={2}>2 - Pengawasan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    Pekerjaan Perusahaan (Sendiri)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={formFaktur.pekerjaanPerusahaan || ""}
                    onChange={(e) =>
                      setFormFaktur({
                        ...formFaktur,
                        pekerjaanPerusahaan: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    Pekerjaan yang Dipinjam
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={formFaktur.pekerjaanYangDipinjam || ""}
                    onChange={(e) =>
                      setFormFaktur({
                        ...formFaktur,
                        pekerjaanYangDipinjam: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Form Grid 5: Realisasi Pencairan Kas Bank */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    Tanggal Terima Dana di Bank <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formFaktur.tanggalTerima}
                    onChange={(e) =>
                      setFormFaktur({
                        ...formFaktur,
                        tanggalTerima: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-text mb-1">
                    Rekening Bank Tujuan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formFaktur.bank}
                    onChange={(e) =>
                      setFormFaktur({ ...formFaktur, bank: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {data.bankOptions.map((b) => (
                      <option key={b.id} value={b.nama}>
                        {b.nama}
                      </option>
                    ))}
                    <option value="KAS BESAR">KAS BESAR</option>
                    <option value="KAS KECIL">KAS KECIL</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-navy-text">
                      Nominal Benar-Benar Cair <span className="text-rose-500">*</span>
                    </label>
                    {liveCalc.labaSetelahPajak > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFormFaktur((prev) => ({
                            ...prev,
                            nominalDiterima: liveCalc.labaSetelahPajak,
                          }))
                        }
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                        title="Klik untuk mengisi nominal cair dengan nilai setelah pemotongan PPh"
                      >
                        ⚡ Isi Net Pajak
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-navy-soft">
                      Rp
                    </span>
                    <input
                      type="number"
                      required
                      min={0}
                      step="any"
                      placeholder="0"
                      value={formFaktur.nominalDiterima || ""}
                      onChange={(e) =>
                        setFormFaktur({
                          ...formFaktur,
                          nominalDiterima: Number(e.target.value),
                        })
                      }
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {formFaktur.nominalDiterima > 0 && (
                    <span className="text-[10px] text-navy-soft font-mono font-semibold mt-1 block">
                      {formatRupiah(formFaktur.nominalDiterima)}
                    </span>
                  )}
                </div>
              </div>

              </div>

              {/* Modal Footer (Fixed at bottom) */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-soft bg-surface-subtle/30 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFakturModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-navy-soft hover:text-navy-text hover:bg-surface-hover rounded-xl border border-border-soft transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Faktur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: EDIT REKONSILIASI SPT */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isReconModalOpen && editingRecon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-surface-card rounded-2xl border border-border-soft shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft bg-surface-subtle/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy-text">
                    Input Data SPT Terlapor (Masa {editingRecon.namaBulan})
                  </h3>
                  <p className="text-xs text-navy-soft">
                    {data.entity.legalName} • Tahun {data.year}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReconModalOpen(false)}
                className="p-1.5 text-navy-soft hover:text-navy-text hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                aria-label="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecon} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Reference from invoices */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-navy-soft block text-[11px]">
                    DPP Rekap Faktur Sistem:
                  </span>
                  <span className="font-mono font-bold text-navy-text">
                    {editingRecon.dppRekapFmt}
                  </span>
                </div>
                <div>
                  <span className="text-navy-soft block text-[11px]">
                    PPN Rekap Faktur Sistem:
                  </span>
                  <span className="font-mono font-bold text-purple-700">
                    {editingRecon.ppnRekapFmt}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-text mb-1">
                  DPP Terlapor di SPT Masa Resmi
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={formRecon.dppTerlapor}
                  onChange={(e) =>
                    setFormRecon({
                      ...formRecon,
                      dppTerlapor: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-mono border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-text mb-1">
                  PPN / Pajak Terlapor di SPT Masa Resmi
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={formRecon.pajakTerlapor}
                  onChange={(e) =>
                    setFormRecon({
                      ...formRecon,
                      pajakTerlapor: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-mono border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Live Preview of Differences */}
              <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-blue-700 block text-[11px]">
                    Selisih DPP:
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      Math.abs(editingRecon.dppRekap - formRecon.dppTerlapor) > 0.01
                        ? "text-rose-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {formatRupiah(editingRecon.dppRekap - formRecon.dppTerlapor)}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700 block text-[11px]">
                    Selisih PPN:
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      Math.abs(editingRecon.ppnRekap - formRecon.pajakTerlapor) > 0.01
                        ? "text-rose-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {formatRupiah(editingRecon.ppnRekap - formRecon.pajakTerlapor)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-text mb-1">
                  Catatan Rekonsiliasi / Keterangan
                </label>
                <textarea
                  rows={2}
                  placeholder="Misal: Faktur 010.xxx belum dilaporkan di SPT Masa bulan ini, akan dilaporkan pembetulan..."
                  value={formRecon.keterangan}
                  onChange={(e) =>
                    setFormRecon({ ...formRecon, keterangan: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-border-soft rounded-xl text-navy-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-soft bg-surface-subtle/30 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsReconModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-navy-soft hover:text-navy-text hover:bg-surface-hover rounded-xl border border-border-soft transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan SPT"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isDeleteModalOpen && deletingFaktur && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-surface-card rounded-2xl border border-border-soft shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-full bg-rose-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-navy-text">
                Hapus Faktur Pendapatan?
              </h3>
            </div>
            <p className="text-xs text-navy-soft leading-relaxed">
              Apakah Anda yakin ingin menghapus faktur nomor{" "}
              <strong className="text-navy-text font-mono">
                {deletingFaktur.noFaktur}
              </strong>{" "}
              atas nama rekanan{" "}
              <strong className="text-navy-text">
                {deletingFaktur.namaRekanan}
              </strong>
              ? Data yang dihapus tidak dapat dipulihkan.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-navy-soft hover:text-navy-text hover:bg-surface-hover rounded-xl border border-border-soft transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteFaktur}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Menghapus..." : "Ya, Hapus Faktur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
