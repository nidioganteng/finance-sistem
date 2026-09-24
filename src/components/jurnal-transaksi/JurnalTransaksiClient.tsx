"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PenLine, Plus, Trash2, AlertTriangle, CheckCircle2, CalendarDays, X, ArrowUpDown, Pencil } from "lucide-react";
import { saveJurnalTransaksi, deleteJurnalTransaksi } from "@/lib/actions/jurnal-transaksi";
import { PaginationNav } from "@/components/shared/PaginationNav";
import { CoaCombobox } from "@/components/shared/CoaCombobox";
import { formatRupiah } from "@/lib/dashboard-data";
import type { JurnalTransaksiGroup } from "@/lib/jurnal-transaksi";

type CoaOption = { id: string; code: string; name: string };

type CoaRow = {
  uid: string;
  coaAccountId: string;
  keterangan: string;
  arah: "debit" | "kredit";
  nominalRaw: string;
};

let _counter = 0;
function uid() { return `r${++_counter}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function makeCoaRow(): CoaRow { return { uid: uid(), coaAccountId: "", keterangan: "", arah: "debit", nominalRaw: "" }; }
function parseNum(s: string) { return parseInt(s.replace(/\./g, "").replace(/[^0-9]/g, ""), 10) || 0; }
function fmtNum(raw: string) {
  const n = parseInt(raw.replace(/\./g, "").replace(/[^0-9]/g, ""), 10);
  return n > 0 ? n.toLocaleString("id-ID") : "";
}

export function JurnalTransaksiClient({
  entityKey, coa, history, page, totalPages, dari = "", sampai = "",
}: {
  entityKey: string;
  coa: CoaOption[];
  history: JurnalTransaksiGroup[];
  page: number;
  totalPages: number;
  dari?: string;
  sampai?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<JurnalTransaksiGroup | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const [filterDari, setFilterDari] = useState(dari);
  const [filterSampai, setFilterSampai] = useState(sampai);
  const isFiltered = !!dari || !!sampai;

  const [noBukti, setNoBukti] = useState("");
  const [tanggal, setTanggal] = useState(todayStr());
  const [coaRows, setCoaRows] = useState<CoaRow[]>([makeCoaRow()]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const totalDebit = coaRows.reduce((s, r) => s + (r.arah === "debit" ? parseNum(r.nominalRaw) : 0), 0);
  const totalKredit = coaRows.reduce((s, r) => s + (r.arah === "kredit" ? parseNum(r.nominalRaw) : 0), 0);
  const isBalanced = totalDebit > 0 && totalKredit > 0 && totalDebit === totalKredit;
  const validRowCount = coaRows.filter((r) => r.coaAccountId && parseNum(r.nominalRaw) > 0).length;
  const canSubmit = noBukti.trim().length > 0 && tanggal.length > 0 && validRowCount >= 1 && !isPending;

  function resetForm() {
    setNoBukti(""); setTanggal(todayStr());
    setCoaRows([makeCoaRow()]); setFeedback(null); setEditingGroup(null);
  }

  function openPanel() { resetForm(); setPanelOpen(true); }

  function openEdit(group: JurnalTransaksiGroup) {
    setEditingGroup(group);
    setNoBukti(group.noBukti);
    setTanggal(group.tanggalRaw.slice(0, 10));
    setCoaRows(group.rows.map((r) => ({
      uid: uid(),
      coaAccountId: r.coaAccountId,
      keterangan: r.keterangan,
      arah: r.debit > 0 ? "debit" : "kredit",
      nominalRaw: r.debit > 0 ? r.debit.toLocaleString("id-ID") : r.kredit.toLocaleString("id-ID"),
    })));
    setFeedback(null);
    setPanelOpen(true);
  }

  function updateRow(rowUid: string, patch: Partial<Omit<CoaRow, "uid">>) {
    setCoaRows((prev) => prev.map((r) => r.uid === rowUid ? { ...r, ...patch } : r));
  }

  function applyDateFilter() {
    const params = new URLSearchParams(searchParams.toString());
    if (filterDari) params.set("dari", filterDari); else params.delete("dari");
    if (filterSampai) params.set("sampai", filterSampai); else params.delete("sampai");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetDateFilter() {
    setFilterDari(""); setFilterSampai("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("dari"); params.delete("sampai"); params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const fd = new FormData();
    fd.set("entityKey", entityKey);
    fd.set("noBukti", noBukti);
    fd.set("tanggal", tanggal);
    if (editingGroup) fd.set("editNoBukti", editingGroup.noBukti);
    fd.set("rows", JSON.stringify(
      coaRows
        .filter((r) => r.coaAccountId && parseNum(r.nominalRaw) > 0)
        .map((r) => ({
          coaAccountId: r.coaAccountId,
          keterangan: r.keterangan,
          debit: r.arah === "debit" ? parseNum(r.nominalRaw) : 0,
          kredit: r.arah === "kredit" ? parseNum(r.nominalRaw) : 0,
        }))
    ));
    startTransition(async () => {
      try {
        const result = await saveJurnalTransaksi(fd);
        if (result?.error) {
          setFeedback({ type: "error", msg: result.error });
        } else {
          setFeedback({ type: "success", msg: editingGroup ? "Jurnal berhasil diperbarui." : "Jurnal berhasil disimpan." });
          if (!editingGroup) { resetForm(); setPanelOpen(false); }
          router.refresh();
        }
      } catch (err) {
        setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Terjadi kesalahan tak terduga." });
      }
    });
  }

  function handleDelete(group: JurnalTransaksiGroup) {
    if (!confirm(`Hapus jurnal ${group.noBukti}?`)) return;
    startTransition(async () => {
      const res = await deleteJurnalTransaksi(group.allTxIds);
      if (res?.error) setActionError(res.error);
      else router.refresh();
    });
  }

  const sortedHistory = [...history].sort((a, b) => {
    const diff = new Date(a.tanggalRaw).getTime() - new Date(b.tanggalRaw).getTime();
    return sortAsc ? diff : -diff;
  });

  return (
    <div className="flex flex-col gap-5">

      {/* Filter tanggal */}
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarDays size={14} className="text-muted-faint flex-none" />
        <input type="date" value={filterDari} onChange={(e) => setFilterDari(e.target.value)}
          className="text-[12.5px] font-semibold text-muted-stronger border border-border-soft rounded-[9px] px-2.5 py-2 bg-surface-input focus:outline-none" />
        <span className="text-[12px] text-muted-faint">—</span>
        <input type="date" value={filterSampai} onChange={(e) => setFilterSampai(e.target.value)}
          className="text-[12.5px] font-semibold text-muted-stronger border border-border-soft rounded-[9px] px-2.5 py-2 bg-surface-input focus:outline-none" />
        <button onClick={applyDateFilter} className="px-3 py-2 rounded-[9px] bg-navy text-white text-[12px] font-bold">Terapkan</button>
        {isFiltered && (
          <button onClick={resetDateFilter} className="flex items-center gap-1 px-2.5 py-2 rounded-[9px] border border-border-soft text-[12px] font-semibold text-muted-stronger hover:bg-surface-hover">
            <X size={11} /> Reset
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[11px] border border-border-soft bg-surface-card text-[12.5px] font-semibold text-muted-stronger">
          <PenLine size={13} className="text-brand" /> Jurnal transaksi manual
        </div>
        <button
          onClick={() => { if (panelOpen && !editingGroup) { setPanelOpen(false); resetForm(); } else openPanel(); }}
          className="px-7 py-2.5 rounded-[11px] bg-navy text-white text-[13px] font-bold hover:opacity-90 transition-opacity">
          {panelOpen && !editingGroup ? "Tutup Form" : "+ Entry Jurnal"}
        </button>
      </div>

      {/* Form panel */}
      {panelOpen && (
        <div className="bg-surface-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[10px] bg-brand/10 flex items-center justify-center flex-none">
                <PenLine size={15} className="text-brand" />
              </div>
              <div>
                <h2 className="text-[14.5px] font-bold text-navy-text">
                  {editingGroup ? `Edit Jurnal – ${editingGroup.noBukti}` : "Entry Jurnal Baru"}
                </h2>
                <p className="text-[11.5px] text-muted">Tambah baris akun sesuai kebutuhan jurnal</p>
              </div>
            </div>
            <button onClick={() => { setPanelOpen(false); resetForm(); }}
              className="p-1.5 rounded-lg text-muted-faint hover:text-navy-text hover:bg-surface-hover transition-colors">
              <X size={16} />
            </button>
          </div>

          {feedback && (
            <div className={`flex items-start gap-2.5 rounded-[12px] px-4 py-3 mb-4 text-[13px] ${
              feedback.type === "success"
                ? "bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-status-green"
                : "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-status-red"
            }`}>
              {feedback.type === "success" ? <CheckCircle2 size={15} className="mt-0.5 flex-none" /> : <AlertTriangle size={15} className="mt-0.5 flex-none" />}
              <span>{feedback.msg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Header: No. Bukti + Tanggal */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-bold text-muted-faint uppercase tracking-widest">No. Bukti</label>
                <input type="text" value={noBukti} onChange={(e) => setNoBukti(e.target.value)}
                  placeholder="JU/0922-001" required
                  className="h-9 px-3 rounded-[9px] border border-border-soft bg-surface-input text-[13px] text-navy-text font-mono placeholder:text-muted focus:outline-none focus:border-brand transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-bold text-muted-faint uppercase tracking-widest">Tanggal</label>
                <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required
                  className="h-9 px-3 rounded-[9px] border border-border-soft bg-surface-input text-[13px] text-navy-text focus:outline-none focus:border-brand transition-colors" />
              </div>
            </div>

            {/* Tabel baris COA */}
            <div className="rounded-[12px] border border-border-soft overflow-hidden mb-4">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-surface-subtle border-b border-border-soft">
                    <th className="text-left px-3 py-2.5 text-[10.5px] font-bold text-muted-faint w-7">#</th>
                    <th className="text-left px-3 py-2.5 text-[10.5px] font-bold text-muted-faint w-[28%]">AKUN COA</th>
                    <th className="text-left px-3 py-2.5 text-[10.5px] font-bold text-muted-faint">KETERANGAN</th>
                    <th className="text-center px-3 py-2.5 text-[10.5px] font-bold text-muted-faint w-36">DEBIT / KREDIT</th>
                    <th className="text-right px-3 py-2.5 text-[10.5px] font-bold text-muted-faint w-36">NOMINAL (Rp)</th>
                    <th className="px-2 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {coaRows.map((row, idx) => (
                    <tr key={row.uid} className="border-b border-border-soft last:border-0 hover:bg-surface-hover/40 transition-colors">
                      <td className="px-3 py-2 text-[12px] text-muted">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <CoaCombobox
                          value={row.coaAccountId}
                          onChange={(id) => updateRow(row.uid, { coaAccountId: id })}
                          options={coa}
                          className="h-8"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={row.keterangan}
                          onChange={(e) => updateRow(row.uid, { keterangan: e.target.value })}
                          placeholder="Deskripsi transaksi…"
                          className="w-full h-8 px-2 rounded-[8px] border border-border-soft bg-surface-input text-[12.5px] text-navy-text placeholder:text-muted-faint focus:outline-none focus:border-brand transition-colors" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex rounded-[8px] border border-border-soft overflow-hidden h-8 w-full">
                          <button type="button"
                            onClick={() => updateRow(row.uid, { arah: "debit" })}
                            className={`flex-1 text-[11.5px] font-bold transition-colors ${
                              row.arah === "debit"
                                ? "bg-blue-500 text-white"
                                : "bg-surface-input text-muted hover:bg-surface-hover"
                            }`}>
                            Debit
                          </button>
                          <button type="button"
                            onClick={() => updateRow(row.uid, { arah: "kredit" })}
                            className={`flex-1 text-[11.5px] font-bold transition-colors border-l border-border-soft ${
                              row.arah === "kredit"
                                ? "bg-status-green text-white"
                                : "bg-surface-input text-muted hover:bg-surface-hover"
                            }`}>
                            Kredit
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" inputMode="numeric" value={row.nominalRaw}
                          onChange={(e) => updateRow(row.uid, { nominalRaw: fmtNum(e.target.value) })}
                          placeholder="—"
                          className={`w-full h-8 px-2 rounded-[8px] border border-border-soft bg-surface-input text-[12.5px] text-navy-text text-right placeholder:text-muted-faint focus:outline-none transition-colors ${
                            row.arah === "debit" ? "focus:border-blue-400" : "focus:border-green-400"
                          }`} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        {coaRows.length > 1 && (
                          <button type="button" onClick={() => setCoaRows((p) => p.filter((r) => r.uid !== row.uid))}
                            className="p-1 rounded-[6px] text-muted hover:text-status-red hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-subtle border-t border-border-soft">
                    <td colSpan={4} className="px-3 py-2.5 text-[12px] font-bold text-muted-stronger">Total</td>
                    <td className="px-3 py-2.5 text-right">
                      {totalDebit > 0 || totalKredit > 0 ? (
                        <div className="flex flex-col items-end gap-0.5">
                          {totalDebit > 0 && (
                            <span className={`text-[12px] font-bold tabular-nums ${isBalanced ? "text-status-green" : "text-blue-500"}`}>
                              D {formatRupiah(totalDebit)}
                            </span>
                          )}
                          {totalKredit > 0 && (
                            <span className={`text-[12px] font-bold tabular-nums ${isBalanced ? "text-status-green" : "text-status-amber"}`}>
                              K {formatRupiah(totalKredit)}
                            </span>
                          )}
                        </div>
                      ) : <span className="text-muted text-[13px]">—</span>}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button type="button" onClick={() => setCoaRows((p) => [...p, makeCoaRow()])}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-border-soft text-[12.5px] font-semibold text-muted-stronger hover:bg-surface-hover hover:text-navy-text transition-colors">
                <Plus size={14} /> Tambah Baris Akun
              </button>
              <div className="flex items-center gap-3">
                {totalDebit > 0 && totalKredit > 0 && !isBalanced && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[11.5px] font-bold">
                    <AlertTriangle size={12} /> Tidak seimbang
                  </span>
                )}
                {isBalanced && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-[11.5px] font-bold">
                    <CheckCircle2 size={12} /> Seimbang
                  </span>
                )}
                <button type="submit" disabled={!canSubmit}
                  className="px-5 py-2 rounded-[10px] bg-navy text-white text-[13px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
                  {isPending ? "Menyimpan…" : editingGroup ? "Simpan Perubahan" : "Simpan Jurnal"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {actionError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-status-red text-[13px]">
          {actionError}
        </div>
      )}

      {/* Tabel history */}
      <div className="bg-surface-card border border-border-soft rounded-[20px] p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint">
              <td className="py-2 px-1.5">
                <button onClick={() => setSortAsc((v) => !v)} className="flex items-center gap-1 hover:text-navy-text transition-colors">
                  TANGGAL <ArrowUpDown size={10} />
                </button>
              </td>
              <td className="py-2 px-1.5">NO. BUKTI</td>
              <td className="py-2 px-1.5">AKUN</td>
              <td className="py-2 px-1.5">KETERANGAN</td>
              <td className="py-2 px-1.5 text-right text-blue-500">DEBIT</td>
              <td className="py-2 px-1.5 text-right text-status-green">KREDIT</td>
              <td className="py-2 px-1.5 text-right">AKSI</td>
            </tr>
          </thead>
          <tbody>
            {sortedHistory.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-[13px] text-muted">Belum ada entri jurnal.</td></tr>
            ) : (
              sortedHistory.map((group) =>
                group.rows.map((row, rowIdx) => (
                  <tr key={`${group.noBukti}-${rowIdx}`}
                    className={`border-b align-top hover:bg-surface-hover/30 group transition-colors ${rowIdx === group.rows.length - 1 ? "border-border" : "border-surface-subtle"}`}>
                    {rowIdx === 0 ? (
                      <>
                        <td className="py-2.5 px-1.5 text-[12.5px] text-muted whitespace-nowrap">{group.tanggal}</td>
                        <td className="py-2.5 px-1.5 text-xs text-muted font-mono">{group.noBukti}</td>
                      </>
                    ) : (
                      <><td className="py-2.5 px-1.5" /><td className="py-2.5 px-1.5" /></>
                    )}
                    <td className="py-2.5 px-1.5 text-[12.5px] text-muted-stronger">
                      <span className="font-mono text-[11px] text-muted mr-1.5">{row.coaCode}</span>{row.coaName}
                    </td>
                    <td className="py-2.5 px-1.5 text-[13px] text-navy-text max-w-[200px] truncate">{row.keterangan || <span className="text-muted-faint">—</span>}</td>
                    <td className="py-2.5 px-1.5 text-[13px] font-bold text-right tabular-nums text-blue-600 dark:text-blue-400">
                      {row.debit > 0 ? formatRupiah(row.debit) : <span className="text-muted-faint font-normal">—</span>}
                    </td>
                    <td className="py-2.5 px-1.5 text-[13px] font-bold text-right tabular-nums text-status-green">
                      {row.kredit > 0 ? formatRupiah(row.kredit) : <span className="text-muted-faint font-normal">—</span>}
                    </td>
                    {rowIdx === 0 ? (
                      <td className="py-2.5 px-1.5 text-right">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(group)} className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-stronger" title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(group)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-muted-stronger hover:text-status-red" title="Hapus">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    ) : <td className="py-2.5 px-1.5" />}
                  </tr>
                ))
              )
            )}
          </tbody>
        </table>
      </div>

      <PaginationNav
        page={page} totalPages={totalPages}
        buildHref={(p) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("page", String(p));
          return `${pathname}?${params.toString()}`;
        }}
      />
    </div>
  );
}
