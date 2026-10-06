"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createKasTransaction, replaceKasTransaction, generateNoBukti } from "@/lib/actions/kas";
import type { RekeningOption } from "@/lib/bank-accounts";
import { CoaCombobox } from "./CoaCombobox";
import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2, Zap, Briefcase, TrendingUp, ArrowRightLeft } from "lucide-react";

type CoaOption = { id: string; code: string; name: string };
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
type Row = { id: number; coaAccountId: string; nominal: string; keterangan?: string };
type InitialValues = {
  tanggal: string;
  noBukti: string;
  keterangan: string;
  arah: "masuk" | "keluar";
  rekeningId?: string;
  crossingEntityKeys?: string[];
  projectId?: string;
  rows: { coaAccountId: string; nominal: string; keterangan?: string }[];
  existingTxIds: string[];
};

const SYSTEM_KEYS = ["kasKecil", "kasBesar", "bankBuku"];

const PIUTANG_COA_MAP: Record<string, string> = {
  kencana: "111", gaharu: "112", tataring: "113", ciptaAsri: "114", umum: "115",
};

const HUTANG_COA_MAP: Record<string, string> = {
  kencana: "311", gaharu: "312", tataring: "313", ciptaAsri: "314", umum: "315",
};

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
  const [isNoBuktiManual, setIsNoBuktiManual] = useState(isEdit);

  useEffect(() => {
    if (isEdit || isNoBuktiManual) return;
    generateNoBukti(entityKey, tanggal).then(setNoBukti).catch(() => {});
  }, [entityKey, tanggal, isEdit, isNoBuktiManual]);

  const [keterangan, setKeterangan] = useState(
    initialValues?.keterangan ?? (initialValues?.arah === "masuk" ? "Pendapatan " : "Pengeluaran ")
  );
  const [arah, setArah] = useState<"masuk" | "keluar">(initialValues?.arah ?? "keluar");

  function handleArahChange(newArah: "masuk" | "keluar") {
    setArah(newArah);
    if (newArah === "masuk") {
      // Feature 2/4: clear crossing when switching to masuk
      setCrossingEntityKeys([]);
      // Feature 3: bankBuku masuk → auto-set first row to COA 400
      if (jenisInputKey === "bankBuku") {
        const coa400 = coaOptions.find((c) => c.code === "400");
        if (coa400) {
          setRows((prev) => {
            const rest = prev.slice(1);
            return [{ ...prev[0], coaAccountId: coa400.id }, ...rest];
          });
        }
      }
    }

    // Auto-update teks keterangan: uang masuk jadi Pendapatan, keluar jadi Pengeluaran (tetap bisa diedit manual)
    const sel = projectOptions.find((p) => p.id === projectId);
    if (sel) {
      if (newArah === "masuk") {
        const nextKe = (sel.terminCount ?? 0) + 1;
        setKeterangan(`Pendapatan Termin ${nextKe} - ${sel.name} (${sel.code})`);
      } else {
        const isOther = !!(sel.entityKey && sel.entityKey !== entityKey);
        setKeterangan(
          isOther
            ? `Pengeluaran Proyek ${sel.name} (${sel.code}) - ${sel.entityName ?? sel.entityKey}`
            : `Pengeluaran Proyek ${sel.name} (${sel.code})`
        );
      }
    } else {
      if (keterangan.startsWith("Pengeluaran") && newArah === "masuk") {
        setKeterangan(keterangan.replace(/^Pengeluaran/, "Pendapatan"));
      } else if (keterangan.startsWith("Pendapatan") && newArah === "keluar") {
        setKeterangan(keterangan.replace(/^Pendapatan/, "Pengeluaran"));
      } else if (!keterangan.trim()) {
        setKeterangan(newArah === "masuk" ? "Pendapatan " : "Pengeluaran ");
      }
    }
  }
  const [rekeningId, setRekeningId] = useState(initialValues?.rekeningId ?? defaultRekeningId ?? rekeningOptions[0]?.id ?? "");
  const [crossingEntityKeys, setCrossingEntityKeys] = useState<string[]>(initialValues?.crossingEntityKeys ?? []);
  const [projectId, setProjectId] = useState<string>(initialValues?.projectId ?? "");

  function handleProjectChange(newProjectId: string) {
    setProjectId(newProjectId);
    if (!newProjectId) {
      if (keterangan.startsWith("Pengeluaran Proyek") || keterangan.startsWith("Pendapatan Termin")) {
        setKeterangan(arah === "masuk" ? "Pendapatan " : "Pengeluaran ");
      }
      return;
    }

    const sel = projectOptions.find((p) => p.id === newProjectId);
    if (!sel) return;

    const isOtherEntity = !!(sel.entityKey && sel.entityKey !== entityKey);

    if (arah === "keluar") {
      if (isOtherEntity && sel.entityKey) {
        // Auto-pilih crossing ke entitas proyek tersebut
        setCrossingEntityKeys((prev) =>
          prev.includes(sel.entityKey!) ? prev : [...prev, sel.entityKey!]
        );

        // Auto-pilih COA Piutang ke entitas tujuan (misal Piutang KAK 111 jika bayarin proyek Kencana)
        const piutangCode = PIUTANG_COA_MAP[sel.entityKey];
        if (piutangCode) {
          const piutangCoa = coaOptions.find((c) => c.code === piutangCode);
          if (piutangCoa) {
            setRows((prev) => {
              if (prev.length === 1 && !prev[0].coaAccountId) {
                return [{ ...prev[0], coaAccountId: piutangCoa.id, keterangan: `Pengeluaran Proyek ${sel.code} (${sel.name})` }];
              }
              const emptyIdx = prev.findIndex((r) => !r.coaAccountId);
              if (emptyIdx !== -1) {
                return prev.map((r, i) =>
                  i === emptyIdx
                    ? { ...r, coaAccountId: piutangCoa.id, keterangan: `Pengeluaran Proyek ${sel.code} (${sel.name})` }
                    : r
                );
              }
              return prev;
            });
          }
        }

        setKeterangan(`Pengeluaran Proyek ${sel.name} (${sel.code}) - ${sel.entityName ?? sel.entityKey}`);
      } else {
        setKeterangan(`Pengeluaran Proyek ${sel.name} (${sel.code})`);
      }
    } else {
      // arah === "masuk"
      const nextKe = (sel.terminCount ?? 0) + 1;
      setKeterangan(`Pendapatan Termin ${nextKe} - ${sel.name} (${sel.code})`);
    }
  }

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
  const isKasBesar = jenisInputKey === "kasBesar";
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
      ...(projectId ? { projectId } : {}),
      ...(isCustomInput && arahLaporan.length > 0 ? { arahLaporan } : {}),
      ...((isKasKecil || isKasBesar) && arah === "masuk" && syncBukuBank && syncRekeningId ? { syncBukuBankRekeningId: syncRekeningId } : {}),
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
            onClick={() => handleArahChange("masuk")}
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
            onClick={() => handleArahChange("keluar")}
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide">
                No. Bukti
              </label>
              {isNoBuktiManual && !isEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setIsNoBuktiManual(false);
                    generateNoBukti(entityKey, tanggal).then(setNoBukti).catch(() => {});
                  }}
                  className="text-[10px] text-brand hover:underline font-medium"
                >
                  Reset ke Format Umum
                </button>
              )}
            </div>
            <div className="relative">
              <input
                value={noBukti}
                onChange={(e) => {
                  setIsNoBuktiManual(true);
                  setNoBukti(e.target.value);
                }}
                placeholder="mis. UK09281 atau KC/0002"
                className={`${inputClass} font-mono pr-24`}
              />
              {!isNoBuktiManual && noBukti ? (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-brand bg-blue-50 dark:bg-blue-500/20 px-1.5 py-0.5 rounded-md">
                  auto umum
                </span>
              ) : isNoBuktiManual && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted bg-surface-subtle px-1.5 py-0.5 rounded-md border border-border-subtle">
                  mandiri
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-faint mt-1">
              {isNoBuktiManual
                ? "No. bukti mandiri/proyek aktif (mis. KC/0002). Klik 'Reset ke Format Umum' untuk auto-generate."
                : "Format pengeluaran umum otomatis. Dapat diketik manual untuk pengeluaran proyek (mis. KC/0002)."}
            </p>
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
        {(isKasKecil || isKasBesar) && arah === "masuk" && bukuBankRekeningOptions.length > 0 && !isEdit && (
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

        {/* Integrasi Kode Proyek Sidamon (Semua Transaksi: Masuk & Keluar / Lintas Entitas) */}
        {projectOptions.length > 0 && (() => {
          const selectedProject = projectOptions.find((p) => p.id === projectId);
          const isOtherEntity = selectedProject?.entityKey && selectedProject.entityKey !== entityKey;
          const currentEntityProjects = projectOptions.filter((p) => !p.entityKey || p.entityKey === entityKey);
          const otherEntityProjects = projectOptions.filter((p) => p.entityKey && p.entityKey !== entityKey);

          const contractVal = selectedProject?.contractValue ?? 0;
          const maxPctSoFar = selectedProject?.maxPercentage ?? 0;
          const terminCount = selectedProject?.terminCount ?? 0;
          const nextTerminKe = terminCount + 1;
          const cumulativeBefore = (maxPctSoFar / 100) * contractVal;
          const cumulativeAfter = cumulativeBefore + rowsTotal;
          const newPct = contractVal > 0 ? Math.min(100, Math.round((cumulativeAfter / contractVal) * 100)) : maxPctSoFar;
          const deltaPct = Math.max(0, newPct - maxPctSoFar);

          const autoKeterangan = selectedProject
            ? arah === "masuk"
              ? `Pendapatan Termin ${nextTerminKe} - ${selectedProject.name} (${selectedProject.code})`
              : isOtherEntity
              ? `Pengeluaran Proyek ${selectedProject.name} (${selectedProject.code}) - ${selectedProject.entityName ?? selectedProject.entityKey}`
              : `Pengeluaran Proyek ${selectedProject.name} (${selectedProject.code})`
            : arah === "masuk"
            ? "Pendapatan "
            : "Pengeluaran ";

          return (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide flex items-center gap-1.5">
                  <Briefcase size={12} className="text-muted-faint" />
                  Proyek Terkait (Sidamon)
                  {isOtherEntity && (
                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-200/60 dark:border-purple-800/40">
                      Lintas Entitas
                    </span>
                  )}
                </label>
                {selectedProject && (
                  <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                    arah === "masuk"
                      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40"
                      : isOtherEntity
                      ? "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40"
                      : "text-muted-stronger bg-surface-subtle border border-border-subtle"
                  }`}>
                    {arah === "masuk"
                      ? `Termin Ke-${nextTerminKe}`
                      : isOtherEntity
                      ? `Milik ${selectedProject.entityName ?? selectedProject.entityKey}`
                      : "Biaya Proyek"}
                  </span>
                )}
              </div>

              <select
                value={projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className={inputClass}
              >
                <option value="">— Bukan transaksi proyek —</option>
                {currentEntityProjects.length > 0 && (
                  <optgroup label="Proyek Entitas Ini">
                    {currentEntityProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherEntityProjects.length > 0 && (
                  <optgroup label="Proyek Entitas Lain (Lintas Entitas)">
                    {otherEntityProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name} ({p.entityName ?? p.entityKey})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {!selectedProject ? (
                <p className="text-[10.5px] text-muted-faint mt-1">
                  Opsional. Hubungkan transaksi ke proyek Sidamon untuk sinkronisasi termin atau talangan lintas entitas.
                </p>
              ) : (
                <div className={`mt-2.5 rounded-[12px] border p-3.5 flex flex-col gap-3 ${
                  arah === "masuk"
                    ? "border-emerald-200/80 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10"
                    : isOtherEntity
                    ? "border-purple-200/80 dark:border-purple-800/40 bg-purple-50/30 dark:bg-purple-950/10"
                    : "border-border-subtle bg-surface-subtle/50"
                }`}>
                  {/* Top Header Row of Project Info */}
                  <div className="flex items-center justify-between flex-wrap gap-2 text-[12px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold font-mono text-[11.5px] px-1.5 py-0.5 rounded ${
                        arah === "masuk"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : isOtherEntity
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                          : "bg-surface-hover text-navy-text"
                      }`}>
                        {selectedProject.code}
                      </span>
                      <span className="font-semibold text-navy-text">
                        {selectedProject.name}
                      </span>
                      {selectedProject.entityName && (
                        <span className="text-[10px] font-bold text-muted-faint bg-surface-card px-1.5 py-0.5 rounded border border-border-subtle">
                          {selectedProject.entityName}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-faint text-[11px]">
                      Nilai Kontrak: <span className="font-bold text-navy-text">{selectedProject.contractValueFmt ?? `Rp ${contractVal.toLocaleString("id-ID")}`}</span>
                    </div>
                  </div>

                  {/* Kasus 1: PENGELUARAN LINTAS ENTITAS (misal Gaharu bayarin proyek Kencana) */}
                  {arah === "keluar" && isOtherEntity && (
                    <div className="flex flex-col gap-1.5 p-2.5 rounded-[9px] bg-purple-100/50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 text-[11px]">
                      <div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-200">
                        <ArrowRightLeft size={13} />
                        Pencatatan Otomatis Antar Entitas (Crossing Journal):
                      </div>
                      <div className="text-muted-stronger space-y-1">
                        <p>• <b>Entitas Ini ({allEntities.find(e => e.key === entityKey)?.name ?? entityKey}):</b> Dicatat sebagai <b>Piutang ke {selectedProject.entityName ?? selectedProject.entityKey} (Akun {PIUTANG_COA_MAP[selectedProject.entityKey!] ?? "11x"})</b>.</p>
                        <p>• <b>Entitas Tujuan ({selectedProject.entityName ?? selectedProject.entityKey}):</b> Otomatis dicatat sebagai <b>Hutang ke {allEntities.find(e => e.key === entityKey)?.name ?? entityKey} (Akun {HUTANG_COA_MAP[entityKey] ?? "31x"})</b> dan beban proyek <b>[{selectedProject.code}]</b>.</p>
                      </div>
                    </div>
                  )}

                  {/* Kasus 2: PENGELUARAN PROYEK ENTITAS SENDIRI */}
                  {arah === "keluar" && !isOtherEntity && (
                    <div className="text-[11.5px] text-muted-strong bg-surface-card border border-border-subtle rounded-[9px] p-2.5">
                      Pengeluaran biaya/operasional proyek. Transaksi ini akan tercatat dan terhubung ke proyek <b className="text-navy-text">[{selectedProject.code}]</b> di Buku Bank & Laporan Keuangan.
                    </div>
                  )}

                  {/* Kasus 3: PENERIMAAN TERMIN (Uang Masuk) */}
                  {arah === "masuk" && (
                    rowsTotal === 0 ? (
                      <div className="text-[11.5px] text-muted-strong bg-surface-card border border-border-subtle rounded-[9px] p-2.5">
                        Progres saat ini: <b className="text-navy-text">{maxPctSoFar}%</b> ({terminCount} termin tercatat). Masukkan nominal uang masuk pada Rincian Akun di bawah untuk melihat simulasi termin ke-{nextTerminKe}.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5 bg-surface-card border border-border-subtle rounded-[10px] p-3">
                        <div className="flex items-center justify-between text-[11.5px] font-semibold">
                          <span className="flex items-center gap-1.5 text-navy-text">
                            <TrendingUp size={13} className="text-emerald-500" />
                            Simulasi Progres Termin:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-faint">{maxPctSoFar}%</span>
                            <span className="text-muted-faint">→</span>
                            <span className="text-status-green font-bold text-[12.5px]">{newPct}%</span>
                            <span className="text-[10.5px] font-bold text-brand bg-blue-50 dark:bg-blue-500/20 px-1.5 py-0.5 rounded">
                              +{deltaPct}%
                            </span>
                          </div>
                        </div>

                        {/* Visual 2-color Progress Bar */}
                        <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-status-green transition-all"
                            style={{ width: `${Math.min(maxPctSoFar, 100)}%` }}
                            title={`Progres sebelumnya: ${maxPctSoFar}%`}
                          />
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${Math.min(deltaPct, 100 - maxPctSoFar)}%` }}
                            title={`Penambahan transaksi ini: +${deltaPct}%`}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[10.5px] pt-2 border-t border-border-subtle">
                          <div>
                            <span className="text-muted-faint block">Sebelumnya</span>
                            <span className="font-bold text-navy-text">Rp {Math.round(cumulativeBefore).toLocaleString("id-ID")}</span>
                          </div>
                          <div>
                            <span className="text-muted-faint block">Termin {nextTerminKe}</span>
                            <span className="font-bold text-status-green">+Rp {Math.round(rowsTotal).toLocaleString("id-ID")}</span>
                          </div>
                          <div>
                            <span className="text-muted-faint block">Sisa Kontrak</span>
                            <span className="font-bold text-muted-stronger">Rp {Math.round(Math.max(0, contractVal - cumulativeAfter)).toLocaleString("id-ID")}</span>
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  {keterangan !== autoKeterangan && autoKeterangan && (
                    <button
                      type="button"
                      onClick={() => setKeterangan(autoKeterangan)}
                      className="self-start text-left text-[11px] font-semibold text-brand hover:underline flex items-center gap-1"
                    >
                      ⚡ Gunakan keterangan: &quot;{autoKeterangan}&quot;
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Crossing Entitas — hanya tampil saat keluar */}
        {arah === "keluar" && allEntities.filter((e) => e.key !== entityKey).length > 0 && (
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
                    onClick={() => {
                      const isAdding = !selected;
                      setCrossingEntityKeys((prev) =>
                        selected ? prev.filter((k) => k !== e.key) : [...prev, e.key]
                      );
                      // Auto-add PIUTANG COA row for the added crossing entity
                      if (isAdding) {
                        const piutangCode = PIUTANG_COA_MAP[e.key];
                        if (piutangCode) {
                          const piutangCoa = coaOptions.find((c) => c.code === piutangCode);
                          if (piutangCoa) {
                            setRows((prev) => {
                              const emptyIdx = prev.findIndex((r) => !r.coaAccountId);
                              if (emptyIdx !== -1) {
                                return prev.map((r, i) => i === emptyIdx ? { ...r, coaAccountId: piutangCoa.id } : r);
                              }
                              rowIdSeq += 1;
                              return [...prev, { id: rowIdSeq, coaAccountId: piutangCoa.id, nominal: "", keterangan: "" }];
                            });
                          }
                        }
                      }
                    }}
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
                  <div className="flex-1 min-w-0">
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
                    className="w-[150px] flex-none px-3 py-2 rounded-[9px] border border-border-soft bg-surface-input text-[13px] text-right font-mono text-navy-text placeholder:text-muted-faint focus:outline-none focus:border-brand/60"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    disabled={rows.length === 1}
                    className="p-1 rounded text-muted-faint hover:text-status-red hover:bg-surface-hover transition-colors disabled:opacity-20 flex-none"
                  >
                    <Trash2 size={14} />
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
