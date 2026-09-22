"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createKasTransaction, replaceKasTransaction, generateNoBukti } from "@/lib/actions/kas";
import type { RekeningOption } from "@/lib/bank-accounts";
import { CoaCombobox } from "./CoaCombobox";

type CoaOption = { id: string; code: string; name: string };
type ProjectOption = { id: string; code: string; name: string };
type Row = { id: number; coaAccountId: string; nominal: string };
type InitialValues = {
  tanggal: string;
  noBukti: string;
  keterangan: string;
  arah: "masuk" | "keluar";
  rekeningId?: string;
  crossingEntityKeys?: string[];
  rows: { coaAccountId: string; nominal: string }[];
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

  // Auto-generate noBukti saat form baru dibuka atau tanggal berubah (kecuali user sudah edit manual)
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
    initialValues?.rows.map((r, i) => ({ id: i, coaAccountId: r.coaAccountId, nominal: r.nominal })) ??
      [{ id: 0, coaAccountId: "", nominal: "" }]
  );
  const [error, setError] = useState<string | null>(null);

  const [syncBukuBank, setSyncBukuBank] = useState(false);
  const [syncRekeningId, setSyncRekeningId] = useState(bukuBankRekeningOptions[0]?.id ?? "");

  const isBankBuku = jenisInputKey === "bankBuku";
  const isKasKecil = jenisInputKey === "kasKecil";
  const rowsTotal = rows.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
  const selectedRekeningNama = rekeningOptions.find((r) => r.id === rekeningId)?.nama;

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    rowIdSeq += 1;
    setRows((prev) => [...prev, { id: rowIdSeq, coaAccountId: "", nominal: "" }]);
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
    if (isBankBuku && !rekeningId) {
      setError("Pilih rekening/bank terlebih dahulu.");
      return;
    }
    const validRows = rows.filter((r) => r.coaAccountId && Number(r.nominal) > 0);
    if (validRows.length === 0) {
      setError("Isi minimal satu baris akun dengan akun dan nominal.");
      return;
    }
    if (!noBukti.trim() || !keterangan.trim()) {
      setError("No. bukti dan keterangan wajib diisi.");
      return;
    }
    const payload = {
      entityKey,
      jenisInputKey,
      tanggal,
      noBukti,
      keterangan,
      arah,
      rows: validRows.map((r) => ({ coaAccountId: r.coaAccountId, nominal: Number(r.nominal) })),
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
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="bg-surface-card border border-border-soft rounded-[20px] p-5 flex flex-col gap-3.5">
      <div className="text-sm font-bold text-navy-text">{isEdit ? "Edit Transaksi" : "Transaksi Baru"}</div>

      <div className="grid grid-cols-2 gap-3.5">
        <div>
          <label className="text-xs font-semibold text-muted-stronger block mb-1.5">Tanggal</label>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] border border-border text-[13.5px]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-stronger block mb-1.5">No. Bukti</label>
          <input
            value={noBukti}
            onChange={(e) => { noBuktiManualRef.current = true; setNoBukti(e.target.value); }}
            className="w-full px-3 py-2.5 rounded-[10px] border border-border text-[13.5px] font-mono bg-surface-input"
            placeholder="Generating..."
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-stronger block mb-1.5">Keterangan</label>
        <input
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          placeholder="mis. Pembayaran vendor proyek"
          className="w-full px-3 py-2.5 rounded-[10px] border border-border text-[13.5px]"
        />
      </div>

      {/* Auto-sync ke Buku Bank — hanya tampil di Kas Kecil + arah masuk */}
      {isKasKecil && arah === "masuk" && bukuBankRekeningOptions.length > 0 && !isEdit && (
        <div className="rounded-[11px] border border-border-soft bg-surface-subtle/50 p-3 space-y-2">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={syncBukuBank}
              onChange={(e) => setSyncBukuBank(e.target.checked)}
              className="accent-navy w-4 h-4"
            />
            <span className="text-[13px] font-semibold text-navy-text">Catat juga keluar di Buku Bank</span>
          </label>
          {syncBukuBank && (
            <select
              value={syncRekeningId}
              onChange={(e) => setSyncRekeningId(e.target.value)}
              className="w-full px-3 py-2 rounded-[9px] border border-border text-[13px] bg-surface-input"
            >
              {bukuBankRekeningOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.nama}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Rekening/Bank — hanya tampil di Buku Bank */}
      {isBankBuku && rekeningOptions.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-muted-stronger block mb-1.5">Rekening / Bank</label>
          <select
            value={rekeningId}
            onChange={(e) => setRekeningId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] border border-border text-[13.5px]"
          >
            {rekeningOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nama}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-muted-stronger block mb-1.5">Arah Dana</label>
        <div className="inline-flex bg-surface-hover rounded-pill p-1 gap-0.5">
          <button
            type="button"
            onClick={() => setArah("masuk")}
            className={`px-4 py-2 rounded-pill text-[12.5px] font-bold transition-colors ${
              arah === "masuk" ? "bg-status-green text-white" : "text-muted-strong"
            }`}
          >
            Uang Masuk
          </button>
          <button
            type="button"
            onClick={() => setArah("keluar")}
            className={`px-4 py-2 rounded-pill text-[12.5px] font-bold transition-colors ${
              arah === "keluar" ? "bg-status-red text-white" : "text-muted-strong"
            }`}
          >
            Uang Keluar
          </button>
        </div>
      </div>

      {/* Proyek Terkait — cuma relevan buat Uang Masuk, otomatis dicatat jadi
          progres termin proyek itu (persentase dihitung sistem, bukan manual) */}
      {arah === "masuk" && projectOptions.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-muted-stronger block mb-1.5">
            Proyek Terkait{" "}
            <span className="text-[10.5px] font-normal text-muted-faint">
              (opsional — otomatis jadi progres termin)
            </span>
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] border border-border text-[13.5px] bg-surface-input text-navy-text"
          >
            <option value="">— Bukan pembayaran termin proyek —</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Crossing Entitas — multi-select */}
      {allEntities.filter((e) => e.key !== entityKey).length > 0 && (
        <div>
          <label className="text-xs font-semibold text-muted-stronger block mb-1.5">
            Juga Catat ke Entitas Lain{" "}
            <span className="text-[10.5px] font-normal text-muted-faint">(opsional — bisa pilih lebih dari satu)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {allEntities
              .filter((e) => e.key !== entityKey)
              .map((e) => {
                const selected = crossingEntityKeys.includes(e.key);
                return (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() =>
                      setCrossingEntityKeys((prev) =>
                        selected ? prev.filter((k) => k !== e.key) : [...prev, e.key]
                      )
                    }
                    className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-colors ${
                      selected
                        ? "bg-navy text-white border-navy"
                        : "bg-surface-card text-muted-stronger border-border hover:border-navy/40 hover:text-navy-text"
                    }`}
                  >
                    {selected && <span className="mr-1">✓</span>}
                    {e.name}
                  </button>
                );
              })}
          </div>
          {crossingEntityKeys.length > 0 && (
            <p className="text-[11px] text-muted-faint mt-1.5">
              Transaksi akan dicatat di Kas Kecil/Besar/Buku Bank masing-masing entitas yang dipilih.
            </p>
          )}
        </div>
      )}

      {/* Output Keuangan — hanya untuk jenis input custom */}
      {isCustomInput && defaultArahLaporan.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-muted-stronger block mb-1.5">
            Output Keuangan{" "}
            <span className="text-[10.5px] font-normal text-muted-faint">(bisa diubah per transaksi)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {LAPORAN_OPTIONS.map((opt) => {
              const selected = arahLaporan.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setArahLaporan((prev) =>
                      prev.includes(opt.value) ? prev.filter((v) => v !== opt.value) : [...prev, opt.value]
                    )
                  }
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-colors ${
                    selected
                      ? "bg-navy text-white border-navy"
                      : "bg-surface-card text-muted-stronger border-border hover:border-navy/40 hover:text-navy-text"
                  }`}
                >
                  {selected && <span className="mr-1">✓</span>}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Baris Akun */}
      <div className="mt-1">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-muted-stronger">Baris Akun</label>
          <button type="button" onClick={addRow} className="text-xs font-bold text-brand">
            + Tambah Akun
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_160px_32px] gap-2.5 items-center">
              <CoaCombobox
                value={r.coaAccountId}
                onChange={(id) => updateRow(r.id, { coaAccountId: id })}
                options={coaOptions}
              />
              <input
                value={r.nominal}
                onChange={(e) => updateRow(r.id, { nominal: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="Nominal"
                className="w-full px-2.5 py-2 rounded-[9px] border border-border text-[13px]"
              />
              <button
                type="button"
                onClick={() => removeRow(r.id)}
                disabled={rows.length === 1}
                className="text-muted-faint text-base disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-surface-hover">
          <div className="text-[12.5px] font-semibold text-muted-stronger">
            Total:{" "}
            <span className={`font-extrabold ${arah === "keluar" ? "text-status-red" : "text-status-green"}`}>
              {arah === "keluar" ? "- " : "+ "}Rp {rowsTotal.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="text-[11px] text-muted-faint">
            Jurnal otomatis:{" "}
            {arah === "keluar"
              ? `Dr. Akun / Cr. ${kasLabel()}`
              : `Dr. ${kasLabel()} / Cr. Akun`}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-status-red">{error}</p>}

      <div className="flex gap-2.5 mt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-[10px] border border-border-soft text-[13px] font-semibold text-muted-stronger"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={isPending || rowsTotal === 0}
          onClick={handleSave}
          className="px-4 py-2.5 rounded-[10px] text-[13px] font-bold bg-navy text-white disabled:opacity-60 active:scale-95 transition-transform"
        >
          {isPending ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Transaksi"}
        </button>
      </div>
    </div>
  );
}
