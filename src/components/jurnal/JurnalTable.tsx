"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, CalendarDays, Receipt } from "lucide-react";
import { updateKodeAkunJurnal, updateProyekJurnal, updateAkrualJurnal } from "@/lib/actions/jurnal";
import { CoaCombobox } from "@/components/kas/CoaCombobox";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";

type JurnalRow = {
  id: string;
  tanggal: string;
  noBukti: string;
  keterangan: string;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  sumberBg: string;
  sumberColor: string;
  sumberLabel: string;
  isKasEntry: boolean;
  isKredit: boolean;
  kodeAkun: string;
  namaAkun: string;
  canEditKodeAkun: boolean;
  debitFmt: string;
  kreditFmt: string;
  staffName: string;
  staffInitial: string;
  arahLaporan: string[];
  periodeBulanGaji?: number | null;
  periodeTahunGaji?: number | null;
  tanggalNota?: string | null;
};

function fmtDateShort(s: string) {
  if (!s) return "—";
  const d = new Date(s.includes("T") || s.includes(" ") ? s : s + "T00:00:00");
  return isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
function fmtDateFull(s: string) {
  if (!s) return "";
  const d = new Date(s.includes("T") || s.includes(" ") ? s : s + "T00:00:00");
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) +
    (d.getHours() || d.getMinutes() ? ", " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "");
}

const BULAN_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const ARAH_LABEL: Record<string, string> = {
  JURNAL_UMUM: "Jurnal", BUKU_BESAR: "Buku Besar",
  LAPORAN_KEUANGAN: "Lap. Keuangan", PIUTANG: "Piutang", PAJAK: "Pajak",
};

export function JurnalTable({
  rows,
  entityId,
  isBalanced,
  totalDebitFmt,
  totalKreditFmt,
  canEditAkun,
  coaOptions,
  projectOptions = [],
}: {
  rows: JurnalRow[];
  entityId: string;
  isBalanced: boolean;
  totalDebitFmt: string;
  totalKreditFmt: string;
  canEditAkun: boolean;
  coaOptions: { code: string; name: string }[];
  projectOptions?: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState("");
  const [editingAkrualRow, setEditingAkrualRow] = useState<JurnalRow | null>(null);
  const [editBulan, setEditBulan] = useState<number>(0);
  const [editTahun, setEditTahun] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEditAkrual(r: JurnalRow) {
    setError(null);
    setEditBulan(r.periodeBulanGaji ?? (new Date(r.tanggal).getMonth() + 1));
    setEditTahun(r.periodeTahunGaji ?? (new Date(r.tanggal).getFullYear()));
    setEditingAkrualRow(r);
  }

  function handleSaveAkrual() {
    if (!editingAkrualRow) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateAkrualJurnal(editingAkrualRow.id, entityId, editBulan || null, editTahun || null);
        router.refresh();
        setEditingAkrualRow(null);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function startEditProject(r: JurnalRow) {
    setError(null);
    setEditProjectId(r.projectId ?? "");
    setEditingProjectId(r.id);
  }

  function handleSaveProject(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await updateProyekJurnal(id, entityId, editProjectId || null);
        router.refresh();
        setEditingProjectId(null);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  // CoaCombobox butuh field "id" — di sini kode akun itu sendiri yang jadi id,
  // karena tujuan akhirnya memang milih salah satu kode yang sudah terdaftar.
  const comboOptions = coaOptions.map((c) => ({ id: c.code, code: c.code, name: c.name }));

  function startEdit(r: JurnalRow) {
    setError(null);
    setEditCode(r.kodeAkun);
    setEditingId(r.id);
  }

  function handleSave(id: string) {
    if (!editCode) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateKodeAkunJurnal(id, entityId, editCode);
        router.refresh();
        setEditingId(null);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div className="relative bg-surface-card border border-border-soft rounded-[20px] p-5 overflow-x-auto">
      <LoadingOverlay visible={isPending} />
      {error && (
        <div className="mb-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-status-red text-sm">{error}</div>
      )}
      <table className="w-full text-sm min-w-[860px]">
        <thead>
          <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint">
            <td className="py-2 px-1.5 whitespace-nowrap">TANGGAL</td>
            <td className="py-2 px-1.5 whitespace-nowrap">NO. BUKTI</td>
            <td className="py-2 px-1.5">SUMBER</td>
            <td className="py-2 px-1.5 whitespace-nowrap">PROYEK</td>
            <td className="py-2 px-1.5">KETERANGAN</td>
            <td className="py-2 px-1.5 whitespace-nowrap">KODE AKUN</td>
            <td className="py-2 px-1.5">NAMA AKUN</td>
            <td className="py-2 px-1.5 text-right whitespace-nowrap">DEBET</td>
            <td className="py-2 px-1.5 text-right whitespace-nowrap">KREDIT</td>
            <td className="py-2 px-1.5">DIINPUT OLEH</td>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="py-8 text-center text-sm text-muted">
                Belum ada transaksi untuk filter yang dipilih.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-surface-subtle ${r.isKasEntry ? "bg-surface-subtle/40" : ""}`}
              >
                <td className="py-2.5 px-1.5 text-[12.5px] text-muted whitespace-nowrap">
                  <div className="relative group/dt inline-block">
                    <span>{fmtDateShort(r.tanggal)}</span>
                    <div className="absolute bottom-full left-0 mb-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] whitespace-nowrap opacity-0 group-hover/dt:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                      {fmtDateFull(r.tanggal)}
                    </div>
                  </div>
                  {r.tanggalNota && r.tanggalNota !== r.tanggal.slice(0, 10) && (
                    <div className="mt-0.5">
                      <span
                        className="inline-flex items-center gap-1 text-[9.5px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 px-1 py-0.2 rounded"
                        title={`Tanggal Nota / Kuitansi Riil: ${r.tanggalNota}`}
                      >
                        <Receipt size={8} className="text-blue-500 flex-none" />
                        Nota: {fmtDateShort(r.tanggalNota)}
                      </span>
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-1.5 text-[11.5px] text-muted font-mono whitespace-nowrap">{r.noBukti}</td>
                <td className="py-2.5 px-1.5">
                  <span
                    className="text-[10.5px] font-bold px-2.5 py-1 rounded-md whitespace-nowrap"
                    style={{ background: r.sumberBg, color: r.sumberColor }}
                  >
                    {r.sumberLabel}
                  </span>
                </td>
                <td className="py-2.5 px-1.5 whitespace-nowrap">
                  {editingProjectId === r.id ? (
                    <div className="flex items-center gap-1 min-w-[190px]">
                      <select
                        value={editProjectId}
                        onChange={(e) => setEditProjectId(e.target.value)}
                        className="h-7 px-1.5 text-[11.5px] rounded-[7px] border border-border-soft bg-surface-input text-navy-text focus:outline-none focus:border-brand flex-1 truncate"
                      >
                        <option value="">— Bukan Proyek —</option>
                        {projectOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.code}] {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleSaveProject(r.id)}
                        disabled={isPending}
                        className="p-1 rounded hover:bg-surface-hover text-status-green disabled:opacity-40 flex-none"
                        title="Simpan"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingProjectId(null)}
                        className="p-1 rounded hover:bg-surface-hover text-muted-stronger flex-none"
                        title="Batal"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {r.projectCode ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10.5px] font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-md"
                          title={r.projectName ? `${r.projectCode} — ${r.projectName}` : r.projectCode}
                        >
                          {r.projectCode}
                        </span>
                      ) : (
                        <span className="text-muted-faint text-[12px]">—</span>
                      )}
                      {canEditAkun && (
                        <button
                          onClick={() => startEditProject(r)}
                          className="p-0.5 rounded hover:bg-surface-hover text-muted-faint hover:text-navy-text"
                          title="Pilih / ubah kode proyek"
                        >
                          <Pencil size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-1.5 text-[13px] text-navy-text max-w-[220px]">
                  {r.isKasEntry ? (
                    <span className="text-muted-faint italic text-[12px]">{r.keterangan}</span>
                  ) : (
                    <>
                      {r.keterangan}
                      {r.arahLaporan.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.arahLaporan.map((a) => (
                            <span key={a} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-navy/10 dark:bg-navy/30 text-navy dark:text-blue-300">
                              {ARAH_LABEL[a] ?? a}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Badge & Editor Periode Akrual Beban Gaji */}
                  {r.periodeBulanGaji && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 text-blue-700 dark:text-blue-300"
                        title={`Beban Gaji Bulan ${BULAN_NAMES[(r.periodeBulanGaji || 1) - 1]} ${r.periodeTahunGaji ?? ""}`}
                      >
                        <CalendarDays size={10} className="text-blue-500 flex-none" />
                        Akrual: {BULAN_NAMES[(r.periodeBulanGaji || 1) - 1].slice(0, 3)} {r.periodeTahunGaji ?? ""}
                      </span>
                      {canEditAkun && (
                        <button
                          onClick={() => startEditAkrual(r)}
                          className="p-0.5 rounded hover:bg-surface-hover text-muted-faint hover:text-navy-text cursor-pointer transition-colors"
                          title="Ubah periode akrual gaji"
                        >
                          <Pencil size={11} />
                        </button>
                      )}
                    </div>
                  )}

                  {!r.periodeBulanGaji && canEditAkun && (r.kodeAkun === "511" || r.kodeAkun === "612" || r.kodeAkun.startsWith("511") || r.kodeAkun.startsWith("612") || /gaji|honor|upah|tenaga ahli/i.test(r.namaAkun)) && (
                    <div className="mt-1">
                      <button
                        onClick={() => startEditAkrual(r)}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand hover:text-navy-text border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 px-2 py-0.5 rounded transition-colors cursor-pointer"
                        title="Tentukan periode akrual gaji jika transaksi ini untuk beban bulan lain"
                      >
                        + Atur Bulan Gaji
                      </button>
                    </div>
                  )}
                </td>
                <td className={`py-2.5 px-1.5 text-[12px] font-mono text-muted ${r.isKredit ? "pl-6" : ""}`}>
                  {editingId === r.id ? (
                    <div className="flex items-center gap-1 w-52">
                      <div className="flex-1">
                        <CoaCombobox value={editCode} onChange={setEditCode} options={comboOptions} placeholder="Ketik kode akun..." />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSave(r.id)}
                        disabled={isPending || !comboOptions.some((o) => o.code === editCode)}
                        className="p-1 rounded hover:bg-surface-hover text-status-green disabled:opacity-40"
                        title="Simpan"
                      >
                        <Check size={13} />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-surface-hover text-muted-stronger" title="Batal">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {r.isKredit && <span className="text-muted-faint select-none">↳</span>}
                      {r.kodeAkun}
                      {canEditAkun && r.canEditKodeAkun && (
                        <button onClick={() => startEdit(r)} className="p-0.5 rounded hover:bg-surface-hover text-muted-faint hover:text-navy-text" title="Edit kode akun">
                          <Pencil size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className={`py-2.5 px-1.5 text-[13px] font-semibold text-navy-text ${r.isKredit ? "pl-6 italic" : ""}`}>
                  {r.namaAkun}
                  {r.isKasEntry && (
                    <span className="ml-1.5 text-[10px] font-bold text-muted-faint bg-surface-hover px-1.5 py-0.5 rounded">
                      auto
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-1.5 text-[13px] text-navy-text text-right tabular-nums font-medium whitespace-nowrap">
                  {r.debitFmt}
                </td>
                <td className="py-2.5 px-1.5 text-[13px] text-navy-text text-right tabular-nums font-medium whitespace-nowrap">
                  {r.kreditFmt}
                </td>
                <td className="py-2.5 px-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-[22px] h-[22px] rounded-full bg-navy text-white text-[9.5px] font-bold flex items-center justify-center flex-none">
                      {r.staffInitial}
                    </div>
                    <span className="text-[12px] text-muted-strong whitespace-nowrap">{r.staffName}</span>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className={`border-t-2 ${isBalanced ? "border-border" : "border-red-300"}`}>
              <td colSpan={7} className="py-3.5 px-1.5 text-[13px] font-extrabold text-navy-text">
                Total Periode Berjalan
                {!isBalanced && (
                  <span className="ml-2 text-[11px] font-bold text-red-500 normal-case">
                    ⚠ tidak seimbang
                  </span>
                )}
              </td>
              <td
                className={`py-3.5 px-1.5 text-[13.5px] font-extrabold text-right tabular-nums whitespace-nowrap ${
                  isBalanced ? "text-navy-text" : "text-red-600 dark:text-red-400"
                }`}
              >
                {totalDebitFmt}
              </td>
              <td
                className={`py-3.5 px-1.5 text-[13.5px] font-extrabold text-right tabular-nums whitespace-nowrap ${
                  isBalanced ? "text-navy-text" : "text-red-600 dark:text-red-400"
                }`}
              >
                {totalKreditFmt}
              </td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>

      {/* Modal Dialog Ubah Periode Akrual Gaji */}
      {editingAkrualRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-[16px] bg-surface-card border border-border-soft shadow-2xl p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-bold text-navy-text">
                  Periode Beban Gaji (Akrual)
                </h3>
                <p className="text-[11.5px] text-muted-faint mt-0.5 font-mono">
                  {editingAkrualRow.noBukti} · {editingAkrualRow.namaAkun}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingAkrualRow(null)}
                className="p-1 rounded-lg hover:bg-surface-hover text-muted-stronger cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide block mb-1">
                  Bulan Gaji
                </label>
                <select
                  value={editBulan}
                  onChange={(e) => setEditBulan(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-9 px-2.5 rounded-[9px] border border-border-soft bg-surface-input text-[12.5px] text-navy-text focus:outline-none focus:border-brand"
                >
                  <option value={0}>Sesuai Tanggal</option>
                  {BULAN_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>
                      Bulan {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-stronger uppercase tracking-wide block mb-1">
                  Tahun Gaji
                </label>
                <input
                  type="number"
                  value={editTahun || ""}
                  onChange={(e) => setEditTahun(parseInt(e.target.value, 10) || 0)}
                  placeholder="Tahun"
                  className="w-full h-9 px-2.5 rounded-[9px] border border-border-soft bg-surface-input text-[12.5px] text-navy-text font-mono focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-faint leading-relaxed">
              Beban gaji akan diakui pada laporan operasional & pajak bulan yang dipilih secara akrual.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setEditingAkrualRow(null)}
                className="px-3.5 py-2 text-[12px] font-semibold rounded-[9px] border border-border-soft hover:bg-surface-hover text-muted-stronger cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveAkrual}
                disabled={isPending}
                className="px-4 py-2 text-[12px] font-bold rounded-[9px] bg-navy text-white hover:bg-navy/90 disabled:opacity-40 cursor-pointer shadow-xs transition-colors"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
