"use client";

import { Fragment, useState, useCallback, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { KasTransactionForm } from "./KasTransactionForm";
import { KasBatchTransactionForm } from "./KasBatchTransactionForm";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { deleteKasTransactionGroup } from "@/lib/actions/kas";
import type { RekeningOption } from "@/lib/bank-accounts";
import { Pencil, Trash2, ArrowRightLeft, ArrowUpDown, ChevronDown, X, Plus, Receipt, Calendar } from "lucide-react";
import { formatRupiah } from "@/lib/dashboard-data";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";
import { DatePicker } from "@/components/shared/DatePicker";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

type CoaOption = { id: string; code: string; name: string };
type CoaRow = { id: string; coaAccountId: string; coaName: string; nominal: number; isDebit: boolean; itemDescription?: string };
type LedgerRow = {
  tanggal: string;
  tanggalRaw: string;
  tanggalNota?: string | null;
  periodeBulanGaji?: number | null;
  periodeTahunGaji?: number | null;
  noBukti: string;
  keterangan: string;
  akunTags: string[];
  rekening?: string;
  sourceJurnal?: boolean;
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
  const [batchMode, setBatchMode] = useState(true);
  const supportsBatch = ["kasKecil", "kasBesar", "bankBuku"].includes(jenisInputKey);
  const EditTransactionForm = supportsBatch ? KasBatchTransactionForm : KasTransactionForm;
  const transactionFormRef = useRef<HTMLDivElement>(null);

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<LedgerRow | null>(null);
  useEffect(() => {
    if (panelOpen || editingRow) transactionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [panelOpen, editingRow]);
  const [deletingRow, setDeletingRow] = useState<LedgerRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteInFlight = useRef(false);
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

  const [activePreset, setActivePreset] = useState<string>(() => {
    if (!dari && !sampai) return "bulan-ini";
    const t = new Date();
    const fmt = (d: Date) => toDateStr(d);
    const presetRanges: Record<string, [string, string]> = {
      "bulan-ini":  [fmt(new Date(t.getFullYear(), t.getMonth(), 1)),     fmt(new Date(t.getFullYear(), t.getMonth() + 1, 0))],
      "bulan-lalu": [fmt(new Date(t.getFullYear(), t.getMonth() - 1, 1)), fmt(new Date(t.getFullYear(), t.getMonth(), 0))],
      "3-bulan":    [fmt(new Date(t.getFullYear(), t.getMonth() - 3, t.getDate())), fmt(t)],
      "6-bulan":    [fmt(new Date(t.getFullYear(), t.getMonth() - 6, t.getDate())), fmt(t)],
    };
    const matched = Object.entries(presetRanges).find(([, [d, s]]) => d === dari && s === sampai);
    return matched ? matched[0] : "custom";
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

  // Auto-apply bulan ini kalau halaman dibuka tanpa filter
  useEffect(() => {
    if (!dari && !sampai && searchParams.get("periode") !== "semua") {
      const t = new Date();
      const d = toDateStr(new Date(t.getFullYear(), t.getMonth(), 1));
      const s = toDateStr(new Date(t.getFullYear(), t.getMonth() + 1, 0));
      const params = new URLSearchParams(searchParams.toString());
      params.set("dari", d);
      params.set("sampai", s);
      router.replace(`${pathname}?${params.toString()}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date();
  const PRESET_OPTIONS = [
    { key: "bulan-ini", label: "Bulan Ini" },
    { key: "bulan-lalu", label: "1 Bulan Lalu" },
    { key: "3-bulan", label: "3 Bulan Lalu" },
    { key: "6-bulan", label: "6 Bulan Lalu" },
    { key: "custom", label: "Custom..." },
  ];

  function applyPreset(preset: string) {
    let d = "";
    let s = "";

    if (preset === "bulan-ini") {
      d = toDateStr(new Date(today.getFullYear(), today.getMonth(), 1));
      s = toDateStr(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    } else if (preset === "bulan-lalu") {
      d = toDateStr(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      s = toDateStr(new Date(today.getFullYear(), today.getMonth(), 0));
    } else if (preset === "2-bulan") {
      d = toDateStr(new Date(today.getFullYear(), today.getMonth() - 2, 1));
      s = toDateStr(new Date(today.getFullYear(), today.getMonth() - 1, 0));
    } else if (preset === "3-bulan") {
      d = toDateStr(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()));
      s = toDateStr(today);
    } else if (preset === "6-bulan") {
      d = toDateStr(new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()));
      s = toDateStr(today);
    } else if (preset === "tahun-ini") {
      d = toDateStr(new Date(today.getFullYear(), 0, 1));
      s = toDateStr(new Date(today.getFullYear(), 11, 31));
    }

    setActivePreset(preset);
    setDropdownOpen(false);

    if (preset === "custom") return;

    setFilterDari(d);
    setFilterSampai(s);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("periode");
    params.delete("page");
    if (d) params.set("dari", d); else params.delete("dari");
    if (s) params.set("sampai", s); else params.delete("sampai");
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyDateFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("periode");
    params.delete("page");
    if (filterDari) params.set("dari", filterDari); else params.delete("dari");
    if (filterSampai) params.set("sampai", filterSampai); else params.delete("sampai");
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetToDefault() {
    applyPreset("bulan-ini");
  }

  const isNonDefault = activePreset !== "bulan-ini" || searchParams.get("periode") === "semua";
  const activeLabel = PRESET_OPTIONS.find((o) => o.key === activePreset)?.label ?? "Bulan Ini";


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

  async function handleDelete() {
    if (!deletingRow || deleteInFlight.current) return;
    deleteInFlight.current = true;
    setIsDeleting(true);
    setActionError(null);
    try {
      const res = await deleteKasTransactionGroup(deletingRow.allTxIds, pagePath);
      if (res?.error) { setActionError(res.error); return; }
      setDeletingRow(null);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Gagal menghapus transaksi. Silakan coba lagi.");
    } finally {
      deleteInFlight.current = false;
      setIsDeleting(false);
    }
  }

  return (
    <>
      {/* Delete confirm modal */}
      {deletingRow && (
        <DeleteConfirmModal
          noBukti={deletingRow.noBukti}
          keterangan={deletingRow.keterangan}
          onConfirm={handleDelete}
          onCancel={() => { if (!deleteInFlight.current) setDeletingRow(null); }}
          isPending={isDeleting}
          error={actionError}
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
          {/* Dropdown filter periode (ASLI) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-[11px] border border-border-soft bg-surface-input text-[12.5px] font-semibold text-muted-stronger hover:bg-surface-hover transition-colors min-w-[140px] justify-between"
            >
              <span>{activeLabel}</span>
              <ChevronDown size={13} className={`text-muted-faint transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-[calc(100%+6px)] left-0 z-30 bg-surface-card border border-border-soft rounded-[12px] shadow-lg py-1.5 min-w-[160px]">
                {PRESET_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => applyPreset(opt.key)}
                    className={`w-full text-left px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
                      activePreset === opt.key
                        ? "text-brand bg-blue-50 dark:bg-blue-500/10"
                        : "text-muted-stronger hover:bg-surface-hover"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
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

          {isNonDefault && activePreset !== "custom" && (
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
          onClick={() => { setEditingRow(null); setPanelOpen(!(panelOpen || editingRow)); }}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[11px] bg-navy text-white text-[13px] font-bold hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
        >
          {panelOpen || editingRow ? <X className="w-4 h-4 flex-none" /> : <Plus className="w-4 h-4 flex-none" />}
          <span>{panelOpen || editingRow ? "Tutup Form" : "Transaksi Baru"}</span>
        </button>
      </div>

      {/* Form melebar di atas riwayat transaksi, sama seperti Entry Jurnal. */}
      {(panelOpen || editingRow) && (
        <div ref={transactionFormRef} className="scroll-mt-6">
          {!editingRow && supportsBatch && <div className="mb-3 inline-flex gap-1 rounded-xl border border-border-soft bg-surface-card p-1">
            <button type="button" onClick={() => setBatchMode(true)} className={`rounded-lg px-4 py-2 text-xs font-bold ${batchMode ? "bg-navy text-white" : "text-muted-stronger"}`}>Input Banyak Transaksi</button>
            <button type="button" onClick={() => setBatchMode(false)} className={`rounded-lg px-4 py-2 text-xs font-bold ${!batchMode ? "bg-navy text-white" : "text-muted-stronger"}`}>Form Lengkap</button>
          </div>}
          {editingRow ? (
            <EditTransactionForm
              key={`edit-${editingRow.allTxIds.join("-")}`}
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
                periodeBulanGaji: editingRow.periodeBulanGaji ?? null,
                periodeTahunGaji: editingRow.periodeTahunGaji ?? null,
                rows: editingRow.coaRows.map((cr) => ({
                  coaAccountId: cr.coaAccountId,
                  nominal: String(cr.nominal),
                  keterangan: cr.itemDescription ?? "",
                })),
                existingTxIds: editingRow.allTxIds,
              }}
              onClose={() => setEditingRow(null)}
            />
          ) : supportsBatch && batchMode ? (
            <KasBatchTransactionForm
              entityKey={entityKey}
              jenisInputKey={jenisInputKey}
              pagePath={pagePath}
              coaOptions={coaOptions}
              projectOptions={projectOptions}
              rekeningOptions={rekeningOptions}
              defaultRekeningId={selectedRekeningId}
              onClose={() => setPanelOpen(false)}
            />
          ) : (
              <KasTransactionForm
                key="create"
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
          )}
        </div>
      )}

      {actionError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-status-red text-sm">
          {actionError}
        </div>
      )}

      <div className="relative bg-surface-card border border-border-soft rounded-[20px] p-5 overflow-x-auto">
        <LoadingOverlay visible={isDeleting} />
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
              <td className="py-2 px-1.5">SUMBER</td>
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
                    <td className="py-2.5 px-1.5 text-xs text-muted">—</td>
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
                  <td colSpan={9} className="py-6 text-center text-sm text-muted">
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
                    <td className="py-2.5 px-1.5 text-xs text-muted">—</td>
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
                  const expanded = expandedIdx === idx;
                  const visibleAccounts: (CoaRow | null)[] = r.coaRows.length
                    ? (expanded ? r.coaRows : r.coaRows.slice(0, 2)) : [null];
                  const remainingAccounts = r.coaRows.length - visibleAccounts.length;
                  const sharedAlignment = visibleAccounts.length === 1 ? "align-middle" : "align-top";

                  const isCrossingFrom = !!r.crossingFromEntityKey;
                  const sourceEntityName = isCrossingFrom
                    ? (allEntities.find((e) => e.key === r.crossingFromEntityKey)?.name ?? r.crossingFromEntityKey)
                    : null;

                  return (
                    <Fragment key={r.noBukti + idx}>
                    {visibleAccounts.map((cr, accountIndex) => <tr key={cr?.id || accountIndex} className="border-b border-surface-subtle align-middle hover:bg-surface-hover/30 group">
                      {accountIndex === 0 && <>
                      <td rowSpan={visibleAccounts.length} className={`py-2.5 px-1.5 ${sharedAlignment} text-[12.5px] text-muted whitespace-nowrap`}>
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
                      <td rowSpan={visibleAccounts.length} className={`py-2.5 px-1.5 ${sharedAlignment} text-xs text-muted font-mono whitespace-nowrap`}>{r.noBukti}</td>
                      <td rowSpan={visibleAccounts.length} className={`py-2.5 px-1.5 ${sharedAlignment}`}>
                        <span className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-[10.5px] font-bold text-brand whitespace-nowrap dark:bg-blue-500/20">
                          {r.rekening || (r.sourceJurnal ? "Entry Jurnal" : jenisInputKey === "bankBuku" ? "Buku Bank" : jenisInputKey === "kasBesar" ? "Kas Besar" : jenisInputKey === "kasKecil" ? "Kas Kecil" : "—")}
                        </span>
                      </td>
                      </>}
                      <td className="py-2.5 px-1.5 align-middle text-[13px] text-navy-text">
                        <div className="min-w-[220px] max-w-sm whitespace-normal break-words leading-5">
                          {cr?.itemDescription && cr.itemDescription !== r.keterangan ? <>
                            {accountIndex === 0 && <><span className="font-medium text-muted-stronger">{r.keterangan}</span><span aria-hidden="true" className="mx-2 text-muted-faint">·</span></>}
                            <span>{cr.itemDescription}</span>
                          </> : <span className="font-medium">{r.keterangan}</span>}
                        </div>
                        {accountIndex === 0 && r.periodeBulanGaji && (
                          <span
                            className="ml-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 px-2 py-0.5 rounded-md whitespace-nowrap"
                            title={`Beban Gaji Bulan ${MONTH_NAMES[(r.periodeBulanGaji || 1) - 1]} ${r.periodeTahunGaji ?? ""}`}
                          >
                            <Calendar size={10} className="text-blue-500 flex-none" />
                            Akrual: {MONTH_NAMES[(r.periodeBulanGaji || 1) - 1].slice(0, 3)} {r.periodeTahunGaji ?? ""}
                          </span>
                        )}
                        {accountIndex === 0 && r.project && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-md whitespace-nowrap" title={`${r.project.code} — ${r.project.name}`}>
                            {r.project.code}
                          </span>
                        )}
                        {/* Crossing destination badge — transaksi masuk dari entitas lain */}
                        {accountIndex === 0 && isCrossingFrom && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/20 px-2 py-0.5 rounded-md whitespace-nowrap">
                            <ArrowRightLeft size={9} />
                            dari {sourceEntityName}
                          </span>
                        )}
                        {/* Crossing source badges — transaksi dikirim ke entitas lain */}
                        {accountIndex === 0 && !isCrossingFrom && (r.crossingEntityKeys ?? []).length > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/20 px-2 py-0.5 rounded-md whitespace-nowrap">
                            <ArrowRightLeft size={9} />
                            → {(r.crossingEntityKeys ?? [])
                              .map((k) => allEntities.find((e) => e.key === k)?.name ?? k)
                              .join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-1.5 align-middle">
                        <span className="inline-flex min-h-7 items-center text-[10.5px] font-bold text-muted-strong bg-surface-hover px-2.5 py-1 rounded-md whitespace-nowrap">{cr?.coaName || "—"}</span>
                      </td>
                      <td className="py-2.5 px-1.5 text-right align-middle whitespace-nowrap">
                        <span className={`text-[13px] font-bold tabular-nums ${r.masuk > 0 ? "text-status-green" : "text-muted-faint"}`}>{cr ? (r.masuk > 0 ? formatRupiah(cr.nominal) : "—") : r.masukFmt}</span>
                      </td>
                      <td className="py-2.5 px-1.5 text-right align-middle whitespace-nowrap">
                        <span className={`text-[13px] font-bold tabular-nums ${r.keluar > 0 ? "text-status-red" : "text-muted-faint"}`}>{cr ? (r.keluar > 0 ? formatRupiah(cr.nominal) : "—") : r.keluarFmt}</span>
                      </td>
                      {accountIndex === 0 && <>
                      <td rowSpan={visibleAccounts.length} className={`py-2.5 px-1.5 ${sharedAlignment} text-[13px] font-bold text-navy-text text-right tabular-nums whitespace-nowrap`}>{r.saldoFmt}</td>
                      <td rowSpan={visibleAccounts.length} className={`py-2.5 px-1.5 ${sharedAlignment} text-right`}>
                        {r.sourceJurnal ? (
                          <span className="text-[10px] text-muted" title="Kelola transaksi dari Entry Jurnal">Entry Jurnal</span>
                        ) : isCrossingFrom ? (
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
                      </>}
                    </tr>)}
                    {!expanded && remainingAccounts > 0 && <tr className="border-b border-surface-subtle"><td colSpan={9} className="px-1.5 py-2"><button onClick={() => setExpandedIdx(idx)} className="text-[10.5px] font-bold text-brand">+{remainingAccounts} akun lainnya</button></td></tr>}
                    </Fragment>
                  );
                })}
                {!sortAsc && saldoAwal !== 0 && (
                  <tr className="border-b border-surface-subtle bg-surface-subtle/40">
                    <td className="py-2.5 px-1.5 text-[12px] font-semibold text-muted whitespace-nowrap italic">
                      {dari ? `Per ${dari}` : `Awal ${currentYear ?? new Date().getFullYear()}`}
                    </td>
                    <td className="py-2.5 px-1.5 text-xs text-muted font-mono whitespace-nowrap">—</td>
                    <td className="py-2.5 px-1.5 text-xs text-muted">—</td>
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
