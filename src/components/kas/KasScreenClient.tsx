"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { KasTransactionForm } from "./KasTransactionForm";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { deleteKasTransactionGroup } from "@/lib/actions/kas";
import type { RekeningOption } from "@/lib/bank-accounts";
import { Pencil, Trash2, ArrowRightLeft, ArrowUpDown, ChevronDown, X, Plus, Receipt, Calendar, Check } from "lucide-react";
import { formatRupiah } from "@/lib/dashboard-data";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";
import { DatePicker } from "@/components/shared/DatePicker";

type CoaOption = { id: string; code: string; name: string };
type CoaRow = { id: string; coaAccountId: string; coaName: string; nominal: number; isDebit: boolean; itemDescription?: string };
type LedgerRow = {
  tanggal: string;
  tanggalRaw: string;
  tanggalNota?: string | null;
  noBukti: string;
  keterangan: string;
  akunTags: string[];
  rekening?: string;
  crossingEntityKeys?: string[];
  crossingFromEntityKey?: string;
  masuk: number;
  keluar: number;
  masukFmt: string;
  keluarFmt: string;
  saldoFmt: string;
  allTxIds: string[];
  coaRows: CoaRow[];
  project?: { id: string; code: string; name: string } | null;
};

type ProjectOption = {
  id: string;
  code: string;
  name: string;
  entityId?: string;
  entityKey?: string;
  entityName?: string;
  contractValue?: number;
  contractValueFmt?: string;
  maxPercentage?: number;
  terminCount?: number;
};

export function KasScreenClient({
  entityKey,
  jenisInputKey,
  pagePath,
  coaOptions,
  saldoFmt,
  saldoLabel = "Saldo Berjalan",
  ledger,
  rekeningOptions = [],
  selectedRekeningId,
  allEntities = [],
  projectOptions = [],
  defaultArahLaporan = [],
  bukuBankRekeningOptions = [],
  dari = "",
  sampai = "",
  saldoAwal = 0,
  totalMasuk = 0,
  totalKeluar = 0,
  selectedRekeningNama,
  currentYear,
}: {
  entityKey: string;
  jenisInputKey: string;
  pagePath: string;
  coaOptions: CoaOption[];
  saldoFmt: string;
  saldoLabel?: string;
  ledger: LedgerRow[];
  rekeningOptions?: RekeningOption[];
  selectedRekeningId?: string;
  selectedRekeningNama?: string;
  allEntities?: { key: string; name: string }[];
  projectOptions?: ProjectOption[];
  defaultArahLaporan?: string[];
  bukuBankRekeningOptions?: RekeningOption[];
  dari?: string;
  sampai?: string;
  saldoAwal?: number;
  totalMasuk?: number;
  totalKeluar?: number;
  currentYear?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [panelOpen, setPanelOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<LedgerRow | null>(null);
  const [deletingRow, setDeletingRow] = useState<LedgerRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [filterDari, setFilterDari] = useState(dari);
  const [filterSampai, setFilterSampai] = useState(sampai);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  function toDateStr(d: Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const today = new Date();
  const nowYear = today.getFullYear();

  const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // Daftar 12 bulan terakhir untuk dropdown filter
  const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthKey = `month-${y}-${String(m + 1).padStart(2, "0")}`;
    const startStr = toDateStr(new Date(y, m, 1));
    const endStr = toDateStr(new Date(y, m + 1, 0));
    const isCurrent = i === 0;
    return {
      key: monthKey,
      label: `${MONTH_NAMES[m]} ${y}${isCurrent ? " (Bulan Ini)" : ""}`,
      shortLabel: `${MONTH_NAMES[m]} ${y}`,
      start: startStr,
      end: endStr,
    };
  });

  const defaultMonthKey = MONTH_OPTIONS[0]?.key ?? "bulan-ini";

  const [activePreset, setActivePreset] = useState<string>(() => {
    if (searchParams.get("periode") === "semua" || (!dari && !sampai && searchParams.has("periode"))) {
      return "semua";
    }
    if (!dari && !sampai) return defaultMonthKey;
    const matchedMonth = MONTH_OPTIONS.find((m) => m.start === dari && m.end === sampai);
    if (matchedMonth) return matchedMonth.key;
    if (dari === `${nowYear}-01-01` && sampai === `${nowYear}-12-31`) {
      return "tahun-ini";
    }
    return "custom";
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  function parseLocalDate(s: string): Date {
    if (s.includes("T") || s.includes(" ")) return new Date(s);
    const parts = s.split("-");
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(s);
  }

  function fmtDateShort(s: string) {
    if (!s) return "—";
    const d = parseLocalDate(s);
    return isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  }
  function fmtDateFull(s: string) {
    if (!s) return "";
    const d = parseLocalDate(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) +
      (d.getHours() || d.getMinutes() ? ", " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "");
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync activePreset kalau query params di URL berubah
  useEffect(() => {
    if (searchParams.get("periode") === "semua") {
      setActivePreset("semua");
      setFilterDari("");
      setFilterSampai("");
      return;
    }
    if (!dari && !sampai) {
      return;
    }
    const matchedMonth = MONTH_OPTIONS.find((m) => m.start === dari && m.end === sampai);
    if (matchedMonth) {
      setActivePreset(matchedMonth.key);
      setFilterDari(dari);
      setFilterSampai(sampai);
    } else if (dari === `${nowYear}-01-01` && sampai === `${nowYear}-12-31`) {
      setActivePreset("tahun-ini");
      setFilterDari(dari);
      setFilterSampai(sampai);
    } else {
      setActivePreset("custom");
      setFilterDari(dari);
      setFilterSampai(sampai);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dari, sampai, searchParams]);

  // Auto-apply bulan ini kalau halaman dibuka tanpa filter
  useEffect(() => {
    if (!dari && !sampai && searchParams.get("periode") !== "semua") {
      const t = new Date();
      const d = toDateStr(new Date(t.getFullYear(), t.getMonth(), 1));
      const s = toDateStr(new Date(t.getFullYear(), t.getMonth() + 1, 0));
      const params = new URLSearchParams(searchParams.toString());
      params.set("dari", d);
      params.set("sampai", s);
      params.delete("periode");
      router.replace(`${pathname}?${params.toString()}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(preset: string) {
    setActivePreset(preset);
    setDropdownOpen(false);

    if (preset === "custom") return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    if (preset === "semua") {
      params.delete("dari");
      params.delete("sampai");
      params.set("periode", "semua");
      setFilterDari("");
      setFilterSampai("");
      router.push(`${pathname}?${params.toString()}`);
      return;
    }

    let d = "";
    let s = "";

    if (preset === "tahun-ini") {
      d = `${nowYear}-01-01`;
      s = `${nowYear}-12-31`;
    } else {
      const matched = MONTH_OPTIONS.find((m) => m.key === preset);
      if (matched) {
        d = matched.start;
        s = matched.end;
      }
    }

    params.delete("periode");
    if (d) params.set("dari", d); else params.delete("dari");
    if (s) params.set("sampai", s); else params.delete("sampai");

    setFilterDari(d);
    setFilterSampai(s);
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyDateFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("periode");
    if (filterDari) params.set("dari", filterDari); else params.delete("dari");
    if (filterSampai) params.set("sampai", filterSampai); else params.delete("sampai");
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetToDefault() {
    applyPreset(defaultMonthKey);
  }

  const isNonDefault = activePreset !== defaultMonthKey;

  let activeLabel = "Pilih Periode";
  if (activePreset === "semua") {
    activeLabel = "Semua Tanggal";
  } else if (activePreset === "tahun-ini") {
    activeLabel = `Tahun Ini (${nowYear})`;
  } else {
    const matchedMonth = MONTH_OPTIONS.find((m) => m.key === activePreset);
    if (matchedMonth) {
      activeLabel = matchedMonth.shortLabel;
    } else if (activePreset === "custom") {
      if (filterDari && filterSampai) {
        activeLabel = `${fmtDateShort(filterDari)} – ${fmtDateShort(filterSampai)}`;
      } else if (filterDari) {
        activeLabel = `Dari ${fmtDateShort(filterDari)}`;
      } else if (filterSampai) {
        activeLabel = `Sampai ${fmtDateShort(filterSampai)}`;
      } else {
        activeLabel = "Rentang Khusus";
      }
    }
  }

  const switchRekening = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("rekening", id);
      router.push(`${pathname}?${params.toString()}`);
      setPanelOpen(false);
    },
    [router, pathname, searchParams]
  );

  function openEdit(row: LedgerRow) {
    setEditingRow(row);
    setActionError(null);
    setPanelOpen(false);
  }

  function confirmDelete(row: LedgerRow) {
    setDeletingRow(row);
    setActionError(null);
  }

  function handleDelete() {
    if (!deletingRow) return;
    startTransition(async () => {
      const res = await deleteKasTransactionGroup(deletingRow.allTxIds, pagePath);
      setDeletingRow(null);
      if (res?.error) setActionError(res.error);
      else router.refresh();
    });
  }

  return (
    <>
      {/* Edit drawer */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/10"
            onClick={() => setEditingRow(null)}
          />
          <div className="relative w-full max-w-xl h-full bg-surface-card shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft flex-none">
              <h2 className="text-[15px] font-bold text-navy-text">Edit Transaksi</h2>
              <button
                onClick={() => setEditingRow(null)}
                className="p-2 rounded-lg hover:bg-surface-hover text-muted-stronger"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
            <KasTransactionForm
              entityKey={entityKey}
              jenisInputKey={jenisInputKey}
              pagePath={pagePath}
              coaOptions={coaOptions}
              rekeningOptions={rekeningOptions}
              defaultRekeningId={selectedRekeningId}
              allEntities={allEntities}
              projectOptions={projectOptions}
              defaultArahLaporan={defaultArahLaporan}
              bukuBankRekeningOptions={bukuBankRekeningOptions}
              initialValues={{
                tanggal: editingRow.tanggalRaw,
                tanggalNota: editingRow.tanggalNota ?? null,
                noBukti: editingRow.noBukti,
                keterangan: editingRow.keterangan,
                arah: editingRow.masuk > 0 ? "masuk" : "keluar",
                rekeningId: rekeningOptions.find((r) => r.nama === editingRow.rekening)?.id,
                crossingEntityKeys: editingRow.crossingEntityKeys ?? [],
                projectId: editingRow.project?.id,
                rows: editingRow.coaRows.map((cr) => ({
                  coaAccountId: cr.coaAccountId,
                  nominal: String(cr.nominal),
                })),
                existingTxIds: editingRow.allTxIds,
              }}
              onClose={() => setEditingRow(null)}
            />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deletingRow && (
        <DeleteConfirmModal
          noBukti={deletingRow.noBukti}
          keterangan={deletingRow.keterangan}
          onConfirm={handleDelete}
          onCancel={() => setDeletingRow(null)}
          isPending={isPending}
        />
      )}

      {/* Ringkasan saldo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Saldo Awal", value: saldoAwal, color: "text-muted-stronger" },
          { label: "Mutasi Masuk", value: totalMasuk, color: "text-status-green" },
          { label: "Mutasi Keluar", value: totalKeluar, color: "text-status-red" },
          { label: "Saldo Akhir", value: saldoAwal + totalMasuk - totalKeluar, color: "text-navy-text" },
        ].map((s) => (
          <div key={s.label} className="bg-surface-card border border-border-soft rounded-[14px] px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10.5px] font-bold text-muted-faint uppercase tracking-wide">{s.label}</p>
              {s.label === "Saldo Awal" && (
                <a
                  href={`/daftar-akun?entity=${entityKey}&year=${currentYear ?? new Date().getFullYear()}`}
                  className="text-[10px] font-bold text-brand hover:underline"
                  title="Atur Saldo Awal di Daftar Akun"
                >
                  Atur di COA
                </a>
              )}
            </div>
            <p className={`text-[15px] font-extrabold tabular-nums ${s.color}`}>{formatRupiah(s.value)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Dropdown filter periode */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-[11px] border border-border-soft bg-surface-input text-[12.5px] font-semibold text-muted-stronger hover:bg-surface-hover hover:border-border transition-colors min-w-[160px] justify-between shadow-xs"
              title="Pilih tanggal atau bulan untuk melihat transaksi"
            >
              <div className="flex items-center gap-2 truncate">
                <Calendar size={14} className="text-brand shrink-0" />
                <span className="truncate">{activeLabel}</span>
              </div>
              <ChevronDown size={13} className={`text-muted-faint shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-[calc(100%+6px)] left-0 z-30 bg-surface-card border border-border-soft rounded-[13px] shadow-xl py-1.5 w-[240px] max-h-[380px] overflow-y-auto">
                <div className="px-3.5 py-1 text-[10px] font-bold tracking-wider text-muted-faint uppercase">
                  Tampilan Keseluruhan
                </div>
                <button
                  type="button"
                  onClick={() => applyPreset("semua")}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-[12px] transition-colors ${
                    activePreset === "semua"
                      ? "text-brand bg-blue-50/70 dark:bg-blue-500/10 font-bold"
                      : "text-muted-stronger hover:bg-surface-hover font-medium"
                  }`}
                >
                  <span>Semua Tanggal (Lihat Semua)</span>
                  {activePreset === "semua" && <Check size={14} className="text-brand shrink-0" />}
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("tahun-ini")}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-[12px] transition-colors ${
                    activePreset === "tahun-ini"
                      ? "text-brand bg-blue-50/70 dark:bg-blue-500/10 font-bold"
                      : "text-muted-stronger hover:bg-surface-hover font-medium"
                  }`}
                >
                  <span>Sepanjang Tahun {nowYear}</span>
                  {activePreset === "tahun-ini" && <Check size={14} className="text-brand shrink-0" />}
                </button>

                <div className="my-1 border-t border-border-soft" />

                <div className="px-3.5 py-1 text-[10px] font-bold tracking-wider text-muted-faint uppercase">
                  Pilih Bulan
                </div>
                {MONTH_OPTIONS.map((opt) => {
                  const isSelected = activePreset === opt.key;
                  return (
                    <button
                      type="button"
                      key={opt.key}
                      onClick={() => applyPreset(opt.key)}
                      className={`w-full flex items-center justify-between px-3.5 py-2 text-[12px] transition-colors ${
                        isSelected
                          ? "text-brand bg-blue-50/70 dark:bg-blue-500/10 font-bold"
                          : "text-muted-stronger hover:bg-surface-hover font-medium"
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Check size={14} className="text-brand shrink-0" />}
                    </button>
                  );
                })}

                <div className="my-1 border-t border-border-soft" />

                <div className="px-3.5 py-1 text-[10px] font-bold tracking-wider text-muted-faint uppercase">
                  Kustom
                </div>
                <button
                  type="button"
                  onClick={() => applyPreset("custom")}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-[12px] transition-colors ${
                    activePreset === "custom"
                      ? "text-brand bg-blue-50/70 dark:bg-blue-500/10 font-bold"
                      : "text-muted-stronger hover:bg-surface-hover font-medium"
                  }`}
                >
                  <span>Pilih Tanggal Khusus...</span>
                  {activePreset === "custom" && <Check size={14} className="text-brand shrink-0" />}
                </button>
              </div>
            )}
          </div>

          {activePreset === "custom" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <DatePicker value={filterDari} onChange={setFilterDari} placeholder="Dari" className="w-[140px]" />
              <span className="text-muted-faint text-[12px]">s/d</span>
              <DatePicker value={filterSampai} onChange={setFilterSampai} placeholder="Sampai" className="w-[140px]" />
              <button
                type="button"
                onClick={applyDateFilter}
                className="px-3 py-2 rounded-[9px] bg-navy text-white text-[12px] font-bold hover:bg-navy/90 transition-colors shadow-xs"
              >
                Terapkan
              </button>
            </div>
          )}

          {isNonDefault && (
            <button
              type="button"
              onClick={resetToDefault}
              className="flex items-center gap-1 px-2.5 py-2 rounded-[9px] border border-border-soft text-[12px] font-semibold text-muted-stronger hover:bg-surface-hover transition-colors"
              title="Reset kembali ke Bulan Ini"
            >
              <X size={11} /> Reset
            </button>
          )}

          <div className="px-3.5 py-2.5 rounded-[11px] border border-border-soft text-[12.5px] font-semibold text-muted-stronger bg-surface-card">
            {saldoLabel}: <span className="font-extrabold text-navy-text">{saldoFmt}</span>
          </div>

          {/* Rekening switcher — hanya tampil di Buku Bank */}
          {rekeningOptions.length > 1 && (
            <div className="flex items-center gap-1 bg-surface-hover rounded-pill p-1">
              {rekeningOptions.map((r) => (
                <button
                  key={r.id}
                  onClick={() => switchRekening(r.id)}
                  className={`px-3 py-1.5 rounded-pill text-[12px] font-bold transition-colors ${
                    r.id === selectedRekeningId
                      ? "bg-surface-card text-navy-text shadow-sm"
                      : "text-muted-strong hover:text-navy-text"
                  }`}
                >
                  {r.nama}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setPanelOpen(true)}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[11px] bg-navy text-white text-[13px] font-bold hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4 flex-none" />
          <span>Transaksi Baru</span>
        </button>
      </div>

      {/* Drawer kanan */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/10"
            onClick={() => setPanelOpen(false)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-xl h-full bg-surface-card shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft flex-none">
              <h2 className="text-[15px] font-bold text-navy-text">Transaksi Baru</h2>
              <button
                onClick={() => setPanelOpen(false)}
                className="p-2 rounded-lg hover:bg-surface-hover text-muted-stronger"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <KasTransactionForm
                entityKey={entityKey}
                jenisInputKey={jenisInputKey}
                pagePath={pagePath}
                coaOptions={coaOptions}
                rekeningOptions={rekeningOptions}
                defaultRekeningId={selectedRekeningId}
                allEntities={allEntities}
                projectOptions={projectOptions}
                defaultArahLaporan={defaultArahLaporan}
                bukuBankRekeningOptions={bukuBankRekeningOptions}
                onClose={() => setPanelOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-status-red text-sm">
          {actionError}
        </div>
      )}

      <div className="relative bg-surface-card border border-border-soft rounded-[20px] p-5 overflow-x-auto">
        <LoadingOverlay visible={isPending} />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint">
              <td className="py-2 px-1.5">
                <button
                  onClick={() => setSortAsc((v) => !v)}
                  className="flex items-center gap-1 hover:text-navy-text transition-colors"
                  title={sortAsc ? "Urutkan terbaru dulu" : "Urutkan terlama dulu"}
                >
                  TANGGAL <ArrowUpDown size={10} />
                </button>
              </td>
              <td className="py-2 px-1.5">NO. BUKTI</td>
              <td className="py-2 px-1.5">KETERANGAN</td>
              <td className="py-2 px-1.5">AKUN</td>
              <td className="py-2 px-1.5 text-right whitespace-nowrap">MASUK</td>
              <td className="py-2 px-1.5 text-right whitespace-nowrap">KELUAR</td>
              <td className="py-2 px-1.5 text-right whitespace-nowrap">SALDO BERJALAN</td>
              <td className="py-2 px-1.5 text-right">AKSI</td>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 ? (
              <>
                {saldoAwal !== 0 && (
                  <tr className="border-b border-surface-subtle bg-surface-subtle/50">
                    <td className="py-2.5 px-1.5 text-[12.5px] font-semibold text-muted whitespace-nowrap italic">
                      {dari ? `Per ${dari}` : `Awal ${currentYear ?? new Date().getFullYear()}`}
                    </td>
                    <td className="py-2.5 px-1.5 text-xs text-muted font-mono whitespace-nowrap">—</td>
                    <td className="py-2.5 px-1.5 text-[13px] font-semibold text-muted italic">
                      Saldo Awal {selectedRekeningNama ? `(${selectedRekeningNama})` : ""}
                    </td>
                    <td className="py-2.5 px-1.5"></td>
                    <td className="py-2.5 px-1.5 text-right whitespace-nowrap text-muted-faint text-[12px]">—</td>
                    <td className="py-2.5 px-1.5 text-right whitespace-nowrap text-muted-faint text-[12px]">—</td>
                    <td className="py-2.5 px-1.5 text-[13px] font-bold text-navy-text text-right tabular-nums whitespace-nowrap">
                      {formatRupiah(saldoAwal)}
                    </td>
                    <td className="py-2.5 px-1.5 text-right"></td>
                  </tr>
                )}
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-muted">
                    {saldoAwal !== 0 ? "Belum ada transaksi mutasi untuk periode ini." : "Belum ada transaksi."}
                  </td>
                </tr>
              </>
            ) : (
              <>
                {sortAsc && saldoAwal !== 0 && (
                  <tr className="border-b border-surface-subtle bg-surface-subtle/40">
                    <td className="py-2.5 px-1.5 text-[12px] font-semibold text-muted whitespace-nowrap italic">
                      {dari ? `Per ${dari}` : `Awal ${currentYear ?? new Date().getFullYear()}`}
                    </td>
                    <td className="py-2.5 px-1.5 text-xs text-muted font-mono whitespace-nowrap">—</td>
                    <td className="py-2.5 px-1.5 text-[12.5px] font-semibold text-muted italic">
                      Saldo Awal {selectedRekeningNama ? `(${selectedRekeningNama})` : ""}
                    </td>
                    <td className="py-2.5 px-1.5"></td>
                    <td className="py-2.5 px-1.5 text-right whitespace-nowrap text-muted-faint text-[12px]">—</td>
                    <td className="py-2.5 px-1.5 text-right whitespace-nowrap text-muted-faint text-[12px]">—</td>
                    <td className="py-2.5 px-1.5 text-[13px] font-bold text-navy-text text-right tabular-nums whitespace-nowrap">
                      {formatRupiah(saldoAwal)}
                    </td>
                    <td className="py-2.5 px-1.5 text-right"></td>
                  </tr>
                )}
                {[...ledger].sort((a, b) => {
                  const diff = new Date(a.tanggalRaw).getTime() - new Date(b.tanggalRaw).getTime();
                  return sortAsc ? diff : -diff;
                }).map((r, idx) => {
                  const shown = r.akunTags.slice(0, 2);
                  const rest = r.akunTags.length - shown.length;
                  const expanded = expandedIdx === idx;

                  const isCrossingFrom = !!r.crossingFromEntityKey;
                  const sourceEntityName = isCrossingFrom
                    ? (allEntities.find((e) => e.key === r.crossingFromEntityKey)?.name ?? r.crossingFromEntityKey)
                    : null;

                  return (
                    <tr key={r.noBukti + idx} className="border-b border-surface-subtle align-top hover:bg-surface-hover/30 group">
                      <td className="py-2.5 px-1.5 text-[12.5px] text-muted whitespace-nowrap">
                        <div className="relative group/dt inline-block">
                          <span>{fmtDateShort(r.tanggalRaw || r.tanggal)}</span>
                          <div className="absolute bottom-full left-0 mb-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] whitespace-nowrap opacity-0 group-hover/dt:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                            {fmtDateFull(r.tanggalRaw || r.tanggal)}
                          </div>
                        </div>
                        {r.tanggalNota && r.tanggalNota !== (r.tanggalRaw || r.tanggal).slice(0, 10) && (
                          <div className="mt-0.5">
                            <span
                              className="inline-flex items-center gap-1 text-[9.5px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 px-1 py-0.2 rounded"
                              title={`Tanggal Nota / Kuitansi Riil: ${r.tanggalNota}`}
                            >
                              <Receipt size={9} className="text-blue-500 flex-none" />
                              Nota: {fmtDateShort(r.tanggalNota)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-1.5 text-xs text-muted font-mono whitespace-nowrap">{r.noBukti}</td>
                      <td className="py-2.5 px-1.5 text-[13px] font-semibold text-navy-text">
                        {r.keterangan}
                        {r.project && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-md whitespace-nowrap" title={`${r.project.code} — ${r.project.name}`}>
                            {r.project.code}
                          </span>
                        )}
                        {r.rekening && (
                          <span className="ml-2 text-[10.5px] font-bold text-brand bg-blue-50 dark:bg-blue-500/20 px-2 py-0.5 rounded-md whitespace-nowrap">
                            {r.rekening}
                          </span>
                        )}
                        {/* Crossing destination badge — transaksi masuk dari entitas lain */}
                        {isCrossingFrom && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/20 px-2 py-0.5 rounded-md whitespace-nowrap">
                            <ArrowRightLeft size={9} />
                            dari {sourceEntityName}
                          </span>
                        )}
                        {/* Crossing source badges — transaksi dikirim ke entitas lain */}
                        {!isCrossingFrom && (r.crossingEntityKeys ?? []).length > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/20 px-2 py-0.5 rounded-md whitespace-nowrap">
                            <ArrowRightLeft size={9} />
                            → {(r.crossingEntityKeys ?? [])
                              .map((k) => allEntities.find((e) => e.key === k)?.name ?? k)
                              .join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-1.5">
                        <div className="flex flex-col gap-1">
                          {(expanded ? r.coaRows : r.coaRows.slice(0, 2)).map((cr, i) => (
                            <div key={i} className="flex flex-col">
                              <span className="text-[10.5px] font-bold text-muted-strong bg-surface-hover px-2.5 py-1 rounded-md whitespace-nowrap">
                                {cr.coaName}
                              </span>
                              {cr.itemDescription && (
                                <span className="text-[10px] text-muted px-1 mt-0.5 italic">{cr.itemDescription}</span>
                              )}
                            </div>
                          ))}
                          {!expanded && r.coaRows.length > 2 && (
                            <button onClick={() => setExpandedIdx(idx)} className="text-[10.5px] font-bold text-brand px-1 text-left whitespace-nowrap">
                              +{r.coaRows.length - 2} lagi
                            </button>
                          )}
                        </div>
                      </td>
                      {/* MASUK — per baris akun */}
                      <td className="py-2.5 px-1.5 text-right align-top whitespace-nowrap">
                        {r.coaRows.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {(expanded ? r.coaRows : r.coaRows.slice(0, 2)).map((cr, i) => (
                              <span key={i} className={`text-[13px] font-bold tabular-nums whitespace-nowrap leading-[28px] ${r.masuk > 0 ? "text-status-green" : "text-muted-faint"}`}>
                                {r.masuk > 0 ? formatRupiah(cr.nominal) : "—"}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[13px] font-bold text-status-green tabular-nums whitespace-nowrap">{r.masukFmt}</span>
                        )}
                      </td>
                      {/* KELUAR — per baris akun */}
                      <td className="py-2.5 px-1.5 text-right align-top whitespace-nowrap">
                        {r.coaRows.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {(expanded ? r.coaRows : r.coaRows.slice(0, 2)).map((cr, i) => (
                              <span key={i} className={`text-[13px] font-bold tabular-nums whitespace-nowrap leading-[28px] ${r.keluar > 0 ? "text-status-red" : "text-muted-faint"}`}>
                                {r.keluar > 0 ? formatRupiah(cr.nominal) : "—"}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[13px] font-bold text-status-red tabular-nums whitespace-nowrap">{r.keluarFmt}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-1.5 text-[13px] font-bold text-navy-text text-right tabular-nums whitespace-nowrap">{r.saldoFmt}</td>
                      <td className="py-2.5 px-1.5 text-right">
                        {isCrossingFrom ? (
                          <span className="text-[10px] text-muted-faint px-1" title="Kelola dari entitas sumber">—</span>
                        ) : (
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(r)}
                              className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-stronger"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => confirmDelete(r)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/15 text-status-red"
                              title="Hapus"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!sortAsc && saldoAwal !== 0 && (
                  <tr className="border-b border-surface-subtle bg-surface-subtle/40">
                    <td className="py-2.5 px-1.5 text-[12px] font-semibold text-muted whitespace-nowrap italic">
                      {dari ? `Per ${dari}` : `Awal ${currentYear ?? new Date().getFullYear()}`}
                    </td>
                    <td className="py-2.5 px-1.5 text-xs text-muted font-mono whitespace-nowrap">—</td>
                    <td className="py-2.5 px-1.5 text-[12.5px] font-semibold text-muted italic">
                      Saldo Awal {selectedRekeningNama ? `(${selectedRekeningNama})` : ""}
                    </td>
                    <td className="py-2.5 px-1.5"></td>
                    <td className="py-2.5 px-1.5 text-right whitespace-nowrap text-muted-faint text-[12px]">—</td>
                    <td className="py-2.5 px-1.5 text-right whitespace-nowrap text-muted-faint text-[12px]">—</td>
                    <td className="py-2.5 px-1.5 text-[13px] font-bold text-navy-text text-right tabular-nums whitespace-nowrap">
                      {formatRupiah(saldoAwal)}
                    </td>
                    <td className="py-2.5 px-1.5 text-right"></td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
