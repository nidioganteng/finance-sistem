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
type Row = {
  uid: string;
  noBukti: string;
  tanggal: string;
  keterangan: string;
  coaAccountId: string;
  debitRaw: string;
  kreditRaw: string;
};

let _counter = 0;
function uid() { return `r${++_counter}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function makeRow(): Row {
  return { uid: uid(), noBukti: "", tanggal: todayStr(), keterangan: "", coaAccountId: "", debitRaw: "", kreditRaw: "" };
}
function parseNum(s: string) { return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0; }
function fmtDisplay(n: number) { return n > 0 ? n.toLocaleString("id-ID") : ""; }

export function JurnalTransaksiClient({
  entityKey,
  coa,
  history,
  page,
  totalPages,
  dari = "",
  sampai = "",
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

  const [rows, setRows] = useState<Row[]>([makeRow()]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const validCount = rows.filter(
    (r) => r.coaAccountId && r.noBukti && r.tanggal && r.keterangan && (parseNum(r.debitRaw) > 0 || parseNum(r.kreditRaw) > 0)
  ).length;
  const canSubmit = validCount >= 1 && !isPending;

  function resetForm() {
    setRows([makeRow()]);
    setFeedback(null);
    setEditingGroup(null);
  }

  function openPanel() {
    resetForm();
    setPanelOpen(true);
  }

  function openEdit(group: JurnalTransaksiGroup) {
    setEditingGroup(group);
    setRows(group.rows.map((r) => ({
      uid: uid(),
      noBukti: group.noBukti,
      tanggal: group.tanggalRaw.slice(0, 10),
      keterangan: group.keterangan,
      coaAccountId: r.coaAccountId,
      debitRaw: r.debit > 0 ? fmtDisplay(r.debit) : "",
      kreditRaw: r.kredit > 0 ? fmtDisplay(r.kredit) : "",
    })));
    setFeedback(null);
    setPanelOpen(true);
  }

  function updateRow(rowUid: string, field: keyof Omit<Row, "uid">, value: string) {
    setRows((prev) => prev.map((r) => {
      if (r.uid !== rowUid) return r;
      const updated = { ...r, [field]: value };
      if (field === "debitRaw" && value) updated.kreditRaw = "";
      if (field === "kreditRaw" && value) updated.debitRaw = "";
      return updated;
    }));
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
    if (editingGroup) {
      fd.set("editNoBuktis", JSON.stringify([editingGroup.noBukti]));
    } else {
      fd.set("editNoBuktis", "[]");
    }
    fd.set("rows", JSON.stringify(
      rows
        .filter((r) => r.coaAccountId && r.noBukti && r.tanggal && r.keterangan)
        .map((r) => ({
          coaAccountId: r.coaAccountId,
          debit: parseNum(r.debitRaw),
          kredit: parseNum(r.kreditRaw),
          noBukti: r.noBukti,
          tanggal: r.tanggal,
          keterangan: r.keterangan,
        }))
    ));
    startTransition(async () => {
      const result = await saveJurnalTransaksi(fd);
      if (result.error) {
        setFeedback({ type: "error", msg: result.error });
      } else {
        setFeedback({ type: "success", msg: editingGroup ? "Jurnal berhasil diperbarui." : `${validCount} baris jurnal berhasil disimpan.` });
        if (!editingGroup) { resetForm(); setPanelOpen(false); }
        router.refresh();
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
        <button onClick={applyDateFilter} className="px-3 py-2 rounded-[9px] bg-navy text-white text-[12px] font-bold">
          Terapkan
        </button>
        {isFiltered && (
          <button onClick={resetDateFilter}
            className="flex items-center gap-1 px-2.5 py-2 rounded-[9px] border border-border-soft text-[12px] font-semibold text-muted-stronger hover:bg-surface-hover">
            <X size={11} /> Reset
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[11px] border border-border-soft bg-surface-card text-[12.5px] font-semibold text-muted-stronger">
          <PenLine size={13} className="text-brand" />
          Jurnal transaksi manual
        </div>
        <button
          onClick={() => { if (panelOpen && !editingGroup) { setPanelOpen(false); resetForm(); } else openPanel(); }}
          className="px-7 py-2.5 rounded-[11px] bg-navy text-white text-[13px] font-bold hover:opacity-90 transition-opacity"
        >
          {panelOpen && !editingGroup ? "Tutup Form" : "+ Entry Jurnal"}
        </button>
      </div>

      {/* Inline form panel */}
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
                <p className="text-[11.5px] text-muted">Setiap baris adalah satu pencatatan transaksi</p>
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
            {/* Per-row input table */}
            <div className="rounded-[12px] border border-border-soft overflow-x-auto mb-4">
              <table className="w-full text-[13px] min-w-[900px]">
                <thead>
                  <tr className="bg-surface-subtle border-b border-border-soft">
                    <th className="text-left px-2.5 py-2.5 text-[10.5px] font-bold text-muted-faint w-6">#</th>
                    <th className="text-left px-2.5 py-2.5 text-[10.5px] font-bold text-muted-faint w-32">NO. BUKTI</th>
                    <th className="text-left px-2.5 py-2.5 text-[10.5px] font-bold text-muted-faint w-36">TANGGAL</th>
                    <th className="text-left px-2.5 py-2.5 text-[10.5px] font-bold text-muted-faint">KETERANGAN</th>
                    <th className="text-left px-2.5 py-2.5 text-[10.5px] font-bold text-muted-faint w-52">AKUN COA</th>
                    <th className="text-right px-2.5 py-2.5 text-[10.5px] font-bold text-muted-faint w-36">DEBIT (Rp)</th>
                    <th className="text-right px-2.5 py-2.5 text-[10.5px] font-bold text-muted-faint w-36">KREDIT (Rp)</th>
                    <th className="px-2 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.uid} className="border-b border-border-soft last:border-0 hover:bg-surface-hover/40 transition-colors">
                      <td className="px-2.5 py-2 text-muted text-[12px]">{idx + 1}</td>
                      {/* No. Bukti */}
                      <td className="px-2 py-2">
                        <input type="text" value={row.noBukti} onChange={(e) => updateRow(row.uid, "noBukti", e.target.value)}
                          placeholder="JU/0922-1" required
                          className="w-full h-8 px-2 rounded-[8px] border border-border-soft bg-surface-input text-[12px] text-navy-text font-mono placeholder:text-muted focus:outline-none focus:border-brand transition-colors" />
                      </td>
                      {/* Tanggal */}
                      <td className="px-2 py-2">
                        <input type="date" value={row.tanggal} onChange={(e) => updateRow(row.uid, "tanggal", e.target.value)} required
                          className="w-full h-8 px-2 rounded-[8px] border border-border-soft bg-surface-input text-[12px] text-navy-text focus:outline-none focus:border-brand transition-colors" />
                      </td>
                      {/* Keterangan */}
                      <td className="px-2 py-2">
                        <input type="text" value={row.keterangan} onChange={(e) => updateRow(row.uid, "keterangan", e.target.value)}
                          placeholder="Keterangan transaksi…" required
                          className="w-full h-8 px-2 rounded-[8px] border border-border-soft bg-surface-input text-[12px] text-navy-text placeholder:text-muted focus:outline-none focus:border-brand transition-colors" />
                      </td>
                      {/* COA */}
                      <td className="px-2 py-2">
                        <CoaCombobox
                          value={row.coaAccountId}
                          onChange={(id) => updateRow(row.uid, "coaAccountId", id)}
                          options={coa}
                        />
                      </td>
                      {/* Debit */}
                      <td className="px-2 py-2">
                        <input type="text" inputMode="numeric" value={row.debitRaw}
                          onChange={(e) => updateRow(row.uid, "debitRaw", e.target.value.replace(/[^0-9]/g, ""))}
                          onFocus={(e) => updateRow(row.uid, "debitRaw", String(parseNum(e.target.value) || ""))}
                          onBlur={(e) => { const n = parseNum(e.target.value); updateRow(row.uid, "debitRaw", n > 0 ? fmtDisplay(n) : ""); }}
                          placeholder="0"
                          className="w-full h-8 px-2 rounded-[8px] border border-border-soft bg-surface-input text-[12px] text-navy-text text-right placeholder:text-muted focus:outline-none focus:border-brand transition-colors" />
                      </td>
                      {/* Kredit */}
                      <td className="px-2 py-2">
                        <input type="text" inputMode="numeric" value={row.kreditRaw}
                          onChange={(e) => updateRow(row.uid, "kreditRaw", e.target.value.replace(/[^0-9]/g, ""))}
                          onFocus={(e) => updateRow(row.uid, "kreditRaw", String(parseNum(e.target.value) || ""))}
                          onBlur={(e) => { const n = parseNum(e.target.value); updateRow(row.uid, "kreditRaw", n > 0 ? fmtDisplay(n) : ""); }}
                          placeholder="0"
                          className="w-full h-8 px-2 rounded-[8px] border border-border-soft bg-surface-input text-[12px] text-navy-text text-right placeholder:text-muted focus:outline-none focus:border-brand transition-colors" />
                      </td>
                      {/* Delete */}
                      <td className="px-2 py-2 text-center">
                        {rows.length > 1 && (
                          <button type="button" onClick={() => setRows((p) => p.filter((r) => r.uid !== row.uid))}
                            className="p-1 rounded-[6px] text-muted hover:text-status-red hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button type="button" onClick={() => {
                const last = rows[rows.length - 1];
                setRows((p) => [...p, { ...makeRow(), noBukti: last?.noBukti ?? "", tanggal: last?.tanggal ?? todayStr(), keterangan: last?.keterangan ?? "" }]);
              }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-border-soft text-[12.5px] font-semibold text-muted-stronger hover:bg-surface-hover hover:text-navy-text transition-colors">
                <Plus size={14} /> Tambah Baris
              </button>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-muted">{validCount} baris siap disimpan</span>
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
                <button onClick={() => setSortAsc((v) => !v)}
                  className="flex items-center gap-1 hover:text-navy-text transition-colors">
                  TANGGAL <ArrowUpDown size={10} />
                </button>
              </td>
              <td className="py-2 px-1.5">NO. BUKTI</td>
              <td className="py-2 px-1.5">KETERANGAN</td>
              <td className="py-2 px-1.5">AKUN</td>
              <td className="py-2 px-1.5 text-right">DEBIT</td>
              <td className="py-2 px-1.5 text-right">KREDIT</td>
              <td className="py-2 px-1.5 text-right">AKSI</td>
            </tr>
          </thead>
          <tbody>
            {sortedHistory.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[13px] text-muted">
                  Belum ada entri jurnal.
                </td>
              </tr>
            ) : (
              sortedHistory.map((group) =>
                group.rows.map((row, rowIdx) => (
                  <tr key={`${group.noBukti}-${rowIdx}`}
                    className={`border-b align-top hover:bg-surface-hover/30 group transition-colors ${
                      rowIdx === group.rows.length - 1 ? "border-border" : "border-surface-subtle"
                    }`}>
                    {rowIdx === 0 ? (
                      <>
                        <td className="py-2.5 px-1.5 text-[12.5px] text-muted whitespace-nowrap">{group.tanggal}</td>
                        <td className="py-2.5 px-1.5 text-xs text-muted font-mono">{group.noBukti}</td>
                        <td className="py-2.5 px-1.5 text-[13px] font-semibold text-navy-text max-w-[180px] truncate">{group.keterangan}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 px-1.5" />
                        <td className="py-2.5 px-1.5" />
                        <td className="py-2.5 px-1.5" />
                      </>
                    )}
                    <td className="py-2.5 px-1.5 text-[12.5px] text-muted-stronger">
                      <span className="font-mono text-[11px] text-muted mr-1.5">{row.coaCode}</span>
                      {row.coaName}
                    </td>
                    <td className="py-2.5 px-1.5 text-[13px] font-bold text-navy-text text-right tabular-nums">
                      {row.debit > 0 ? formatRupiah(row.debit) : <span className="text-muted-faint font-normal">—</span>}
                    </td>
                    <td className="py-2.5 px-1.5 text-[13px] font-bold text-navy-text text-right tabular-nums">
                      {row.kredit > 0 ? formatRupiah(row.kredit) : <span className="text-muted-faint font-normal">—</span>}
                    </td>
                    {rowIdx === 0 ? (
                      <td className="py-2.5 px-1.5 text-right">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(group)}
                            className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-stronger" title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(group)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-muted-stronger hover:text-status-red" title="Hapus">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    ) : (
                      <td className="py-2.5 px-1.5" />
                    )}
                  </tr>
                ))
              )
            )}
          </tbody>
        </table>
      </div>

      <PaginationNav
        page={page}
        totalPages={totalPages}
        buildHref={(p) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("page", String(p));
          return `${pathname}?${params.toString()}`;
        }}
      />
    </div>
  );
}
