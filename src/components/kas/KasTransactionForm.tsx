"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createKasTransaction, replaceKasTransaction, generateNoBukti } from "@/lib/actions/kas";
import type { RekeningOption } from "@/lib/bank-accounts";
import { CoaCombobox } from "./CoaCombobox";
import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2, Zap } from "lucide-react";

type CoaOption = { id: string; code: string; name: string };
type ProjectOption = { id: string; code: string; name: string };
type Row = { id: number; coaAccountId: string; nominal: string; keterangan?: string };
type InitialValues = {
  tanggal: string;
  noBukti: string;
  keterangan: string;
  arah: "masuk" | "keluar";
  rekeningId?: string;
  crossingEntityKeys?: string[];
  rows: { coaAccountId: string; nominal: string; keterangan?: string }[];
  existingTxIds: string[];
};

const SYSTEM_KEYS = ["kasKecil", "kasBesar", "bankBuku"];

const LAPORAN_OPTIONS = [
  { value: "JURNAL_UMUM", label: "Jurnal Umum" },
  { value: "BUKU_BESAR", label: "Buku Besar" },
  { value: "LAPORAN_KEUANGAN", label: "Laporan Keuangan" },
  { value: "PIUTANG", label: "Piutang" },
  { value: "PAJAK", label: "Laporan Pajak" },
];

let rowIdSeq = 1;

function formatRupiahInput(val: string) {
  const num = val.replace(/[^0-9]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("id-ID");
}

export function KasTransactionForm({
  entityKey,
  jenisInputKey,
  pagePath,
  coaOptions,
  rekeningOptions = [],
  defaultRekeningId,
  allEntities = [],
  projectOptions = [],
  defaultArahLaporan = [],
  bukuBankRekeningOptions = [],
  initialValues,
  onClose,
}: {
  entityKey: string;
  jenisInputKey: string;
  pagePath: string;
  coaOptions: CoaOption[];
  rekeningOptions?: RekeningOption[];
  defaultRekeningId?: string;
  allEntities?: { key: string; name: string }[];
  bukuBankRekeningOptions?: RekeningOption[];
  projectOptions?: ProjectOption[];
  defaultArahLaporan?: string[];
  initialValues?: InitialValues;
  onClose: () => void;
}) {
  const isEdit = !!initialValues;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tanggal, setTanggal] = useState(initialValues?.tanggal ?? new Date().toISOString().slice(0, 10));
  const [noBukti, setNoBukti] = useState(initialValues?.noBukti ?? "");
  const noBuktiManualRef = useRef(false);

  useEffect(() => {
    if (isEdit || noBuktiManualRef.current) return;
    generateNoBukti(entityKey, tanggal).then(setNoBukti).catch(() => {});
  }, [entityKey, tanggal, isEdit]);

  const [keterangan, setKeterangan] = useState(initialValues?.keterangan ?? "");
  const [arah, setArah] = useState<"masuk" | "keluar">(initialValues?.arah ?? "keluar");
  const [rekeningId, setRekeningId] = useState(initialValues?.rekeningId ?? defaultRekeningId ?? rekeningOptions[0]?.id ?? "");
  const [crossingEntityKeys, setCrossingEntityKeys] = useState<string[]>(initialValues?.crossingEntityKeys ?? []);
  const [projectId, setProjectId] = useState<string>("");
  const [arahLaporan, setArahLaporan] = useState<string[]>(defaultArahLaporan);
  const isCustomInput = !SYSTEM_KEYS.includes(jenisInputKey);
  const [rows, setRows] = useState<Row[]>(
    initialValues?.rows.map((r, i) => ({ id: i, coaAccountId: r.coaAccountId, nominal: r.nominal, keterangan: r.keterangan ?? "" })) ??
      [{ id: 0, coaAccountId: "", nominal: "", keterangan: "" }]
  );
  const [error, setError] = useState<string | null>(null);
  const [syncBukuBank, setSyncBukuBank] = useState(false);
  const [syncRekeningId, setSyncRekeningId] = useState(bukuBankRekeningOptions[0]?.id ?? "");

  const isBankBuku = jenisInputKey === "bankBuku";
  const isKasKecil = jenisInputKey === "kasKecil";
  const rowsTotal = rows.reduce((sum, r) => sum + (Number(r.nominal.replace(/[^0-9]/g, "")) || 0), 0);
  const selectedRekeningNama = rekeningOptions.find((r) => r.id === rekeningId)?.nama;

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    rowIdSeq += 1;
    setRows((prev) => [...prev, { id: rowIdSeq, coaAccountId: "", nominal: "", keterangan: "" }]);
  }

  function removeRow(id: number) {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function kasLabel() {
    if (isBankBuku) return selectedRekeningNama ?? "Rekening Bank";
    if (jenisInputKey === "kasBesar") return "Kas";
    return "Kas Kecil";
  }

  function handleSave() {
    setError(null);
    if (isBankBuku && !rekeningId) { setError("Pilih rekening/bank terlebih dahulu."); return; }
    const validRows = rows.filter((r) => r.coaAccountId && Number(r.nominal.replace(/[^0-9]/g, "")) > 0);
    if (validRows.length === 0) { setError("Isi minimal satu baris akun dengan akun dan nominal."); return; }
    if (!noBukti.trim() || !keterangan.trim()) { setError("No. bukti dan keterangan wajib diisi."); return; }
    const payload = {
      entityKey, jenisInputKey, tanggal, noBukti, keterangan, arah,
      rows: validRows.map((r) => ({
        coaAccountId: r.coaAccountId,
        nominal: Number(r.nominal.replace(/[^0-9]/g, "")),
        ...(r.keterangan?.trim() ? { keterangan: r.keterangan.trim() } : {}),
      })),
      pagePath,
      ...(isBankBuku ? { rekeningId } : {}),
      ...(crossingEntityKeys.length > 0 ? { crossingEntityKeys } : {}),
      ...(arah === "masuk" && projectId ? { projectId } : {}),
      ...(isCustomInput && arahLaporan.length > 0 ? { arahLaporan } : {}),
      ...(isKasKecil && arah === "masuk" && syncBukuBank && syncRekeningId ? { syncBukuBankRekeningId: syncRekeningId } : {}),
    };
    startTransition(async () => {
      const result = isEdit
        ? await replaceKasTransaction({ ...payload, existingTxIds: initialValues!.existingTxIds })
        : await createKasTransaction(payload);
      if (result?.error) { setError(result.error); return; }
      router.refresh();
      onClose();
    });
  }

  const inputClass = "w-full px-3.5 py-2.5 rounded-[10px] border border-border-soft bg-surface-input text-[13.5px] text-navy-text placeholder:text-muted-faint focus:outline-none focus:border-brand/60 transition-colors";

  return (
    <div className="bg-surface-card border border-border-soft rounded-[22px] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-soft flex items-center justify-between">
        <div>
          <div className="text-[15px] font-bold text-navy-text">{isEdit ? "Edit Transaksi" : "Transaksi Baru"}</div>
          <div className="text-[11.5px] text-muted-faint mt-0.5">
            {arah === "masuk" ? "Dana masuk ke" : "Dana keluar dari"} {kasLabel()}
          </div>
        </div>
        {/* Arah Dana toggle — di header */}
        <div className="flex items-center bg-surface-hover rounded-[12px] p-1 gap-1">
          <button
            type="button"
            onClick={() => setArah("masuk")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] text-[12.5px] font-bold transition-all ${
              arah === "masuk"
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-muted-strong hover:text-navy-text"
            }`}
          >
            <ArrowDownCircle size={13} />
            Masuk
          </button>
          <button
            type="button"
            onClick={() => setArah("keluar")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] text-[12.5px] font-bold transition-all ${
              arah === "keluar"
                ? "bg-red-500 text-white shadow-sm"
                : "text-muted-strong hover:text-navy-text"
            }`}
          >
            <ArrowUpCircle size={13} />
            Keluar
          </button>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-5">
        {/* Row 1: Tanggal + No Bukti */}
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide block mb-1.5">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide block mb-1.5">
              No. Bukti
            </label>
            <div className="relative">
              <input
                value={noBukti}
                onChange={(e) => { noBuktiManualRef.current = true; setNoBukti(e.target.value); }}
                placeholder="Generating..."
                className={`${inputClass} font-mono pr-16`}
              />
              {!noBuktiManualRef.current && noBukti && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-brand bg-blue-50 dark:bg-blue-500/20 px-1.5 py-0.5 rounded-md">
                  auto
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Keterangan */}
        <div>
          <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide block mb-1.5">Keterangan</label>
          <input
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="mis. Pembayaran vendor proyek"
            className={inputClass}
          />
        </div>

        {/* Rekening — Buku Bank */}
        {isBankBuku && rekeningOptions.length > 0 && (
          <div>
            <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide block mb-1.5">Rekening / Bank</label>
            <select value={rekeningId} onChange={(e) => setRekeningId(e.target.value)} className={inputClass}>
              {rekeningOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.nama}</option>
              ))}
            </select>
          </div>
        )}

        {/* Auto-sync ke Buku Bank */}
        {isKasKecil && arah === "masuk" && bukuBankRekeningOptions.length > 0 && !isEdit && (
          <div className={`rounded-[12px] border p-3.5 transition-colors ${syncBukuBank ? "border-brand/40 bg-blue-50/50 dark:bg-blue-500/10" : "border-border-soft bg-surface-subtle/40"}`}>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={syncBukuBank}
                onChange={(e) => setSyncBukuBank(e.target.checked)}
                className="accent-navy w-4 h-4 rounded"
              />
              <div className="flex items-center gap-1.5">
                <Zap size={12} className="text-brand" />
                <span className="text-[13px] font-semibold text-navy-text">Catat juga keluar di Buku Bank</span>
              </div>
            </label>
            {syncBukuBank && (
              <select
                value={syncRekeningId}
                onChange={(e) => setSyncRekeningId(e.target.value)}
                className={`${inputClass} mt-2.5`}
              >
                {bukuBankRekeningOptions.map((r) => (
                  <option key={r.id} value={r.id}>{r.nama}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Proyek Terkait */}
        {arah === "masuk" && projectOptions.length > 0 && (
          <div>
            <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide block mb-1.5">
              Proyek Terkait{" "}
              <span className="text-[10px] font-normal text-muted-faint normal-case">(opsional — otomatis jadi progres termin)</span>
            </label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
              <option value="">— Bukan pembayaran termin proyek —</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Crossing Entitas */}
        {allEntities.filter((e) => e.key !== entityKey).length > 0 && (
          <div>
            <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide block mb-2">
              Juga Catat ke Entitas Lain{" "}
              <span className="text-[10px] font-normal text-muted-faint normal-case">(opsional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {allEntities.filter((e) => e.key !== entityKey).map((e) => {
                const selected = crossingEntityKeys.includes(e.key);
                return (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => setCrossingEntityKeys((prev) =>
                      selected ? prev.filter((k) => k !== e.key) : [...prev, e.key]
                    )}
                    className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-all ${
                      selected
                        ? "bg-navy text-white border-navy"
                        : "bg-surface-card text-muted-stronger border-border-soft hover:border-navy/40 hover:text-navy-text"
                    }`}
                  >
                    {selected && "✓ "}{e.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Output Keuangan — custom input */}
        {isCustomInput && defaultArahLaporan.length > 0 && (
          <div>
            <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide block mb-2">Output Keuangan</label>
            <div className="flex flex-wrap gap-2">
              {LAPORAN_OPTIONS.map((opt) => {
                const selected = arahLaporan.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setArahLaporan((prev) =>
                      prev.includes(opt.value) ? prev.filter((v) => v !== opt.value) : [...prev, opt.value]
                    )}
                    className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-all ${
                      selected
                        ? "bg-navy text-white border-navy"
                        : "bg-surface-card text-muted-stronger border-border-soft hover:border-navy/40 hover:text-navy-text"
                    }`}
                  >
                    {selected && "✓ "}{opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Baris Akun */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide">Rincian Akun</label>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 text-[12px] font-bold text-brand hover:text-brand/80 transition-colors"
            >
              <Plus size={12} />
              Tambah Baris
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            {rows.map((r, idx) => (
              <div key={r.id} className="bg-surface-subtle/60 border border-border-soft rounded-[12px] p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-faint w-4 flex-none">{idx + 1}</span>
                  <div className="flex-1">
                    <CoaCombobox
                      value={r.coaAccountId}
                      onChange={(id) => updateRow(r.id, { coaAccountId: id })}
                      options={coaOptions}
                    />
                  </div>
                  <input
                    value={r.nominal ? formatRupiahInput(r.nominal) : ""}
                    onChange={(e) => updateRow(r.id, { nominal: e.target.value.replace(/[^0-9]/g, "") })}
                    placeholder="0"
                    className="w-[140px] flex-none px-3 py-2 rounded-[9px] border border-border-soft bg-surface-input text-[13px] text-right font-mono text-navy-text placeholder:text-muted-faint focus:outline-none focus:border-brand/60"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    disabled={rows.length === 1}
                    className="text-muted-faint hover:text-status-red transition-colors disabled:opacity-20 flex-none"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="pl-6">
                  <input
                    value={r.keterangan ?? ""}
                    onChange={(e) => updateRow(r.id, { keterangan: e.target.value })}
                    placeholder="Keterangan item (opsional)"
                    className="w-full px-3 py-1.5 rounded-[8px] border border-border-soft bg-surface-input text-[12px] text-muted-stronger placeholder:text-muted-faint focus:outline-none focus:border-brand/60"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border-soft bg-surface-subtle/40">
        {/* Total */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11.5px] text-muted-faint">
            Jurnal otomatis: {arah === "keluar" ? `Dr. Akun / Cr. ${kasLabel()}` : `Dr. ${kasLabel()} / Cr. Akun`}
          </div>
          <div className="text-right">
            <div className="text-[10.5px] font-semibold text-muted-faint mb-0.5">TOTAL</div>
            <div className={`text-[18px] font-extrabold tabular-nums ${arah === "keluar" ? "text-red-500" : "text-emerald-500"}`}>
              {arah === "keluar" ? "−" : "+"} Rp {rowsTotal.toLocaleString("id-ID")}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-3 px-3.5 py-2.5 rounded-[10px] bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-status-red text-[13px]">
            {error}
          </div>
        )}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-[10px] border border-border-soft text-[13px] font-semibold text-muted-stronger hover:bg-surface-hover transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isPending || rowsTotal === 0}
            onClick={handleSave}
            className={`flex-1 py-2.5 rounded-[10px] text-[13.5px] font-bold transition-all disabled:opacity-50 ${
              arah === "keluar"
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-emerald-500 hover:bg-emerald-600 text-white"
            }`}
          >
            {isPending ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : arah === "masuk" ? "Catat Pemasukan" : "Catat Pengeluaran"}
          </button>
        </div>
      </div>
    </div>
  );
}
