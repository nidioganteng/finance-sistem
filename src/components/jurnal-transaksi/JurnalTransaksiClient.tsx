"use client";

import { useState, useTransition, useId } from "react";
import { PenLine, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { saveJurnalTransaksi } from "@/lib/actions/jurnal-transaksi";
import { PaginationNav } from "@/components/shared/PaginationNav";
import type { JurnalTransaksiGroup } from "@/lib/jurnal-transaksi";

type CoaOption = { id: string; code: string; name: string };

type Row = {
  uid: string;
  coaAccountId: string;
  debitRaw: string;
  kreditRaw: string;
};

function parseRupiah(str: string): number {
  return parseFloat(str.replace(/[^0-9,]/g, "").replace(",", ".")) || 0;
}

function formatRupiahDisplay(n: number): string {
  if (n === 0) return "";
  return n.toLocaleString("id-ID");
}

function makeRow(uid: string): Row {
  return { uid, coaAccountId: "", debitRaw: "", kreditRaw: "" };
}

let _counter = 0;
function uid() {
  return `r${++_counter}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  entityKey: string;
  coa: CoaOption[];
  history: JurnalTransaksiGroup[];
  page: number;
  totalPages: number;
  searchParams: Record<string, string>;
};

export function JurnalTransaksiClient({
  entityKey,
  coa,
  history,
  page,
  totalPages,
  searchParams,
}: Props) {
  const formId = useId();
  const [isPending, startTransition] = useTransition();

  const [keterangan, setKeterangan] = useState("");
  const [tanggal, setTanggal] = useState(todayStr());
  const [rows, setRows] = useState<Row[]>([makeRow(uid()), makeRow(uid())]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Derived totals
  const totalDebit = rows.reduce((s, r) => s + parseRupiah(r.debitRaw), 0);
  const totalKredit = rows.reduce((s, r) => s + parseRupiah(r.kreditRaw), 0);
  const isBalanced =
    totalDebit > 0 &&
    totalKredit > 0 &&
    Math.round(totalDebit * 100) === Math.round(totalKredit * 100);

  const canSubmit =
    isBalanced &&
    keterangan.trim().length > 0 &&
    tanggal.length > 0 &&
    rows.filter((r) => r.coaAccountId && (parseRupiah(r.debitRaw) > 0 || parseRupiah(r.kreditRaw) > 0)).length >= 2 &&
    !isPending;

  function addRow() {
    setRows((prev) => [...prev, makeRow(uid())]);
  }

  function removeRow(rowUid: string) {
    setRows((prev) => prev.filter((r) => r.uid !== rowUid));
  }

  function updateRow(rowUid: string, field: keyof Omit<Row, "uid">, value: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.uid !== rowUid) return r;
        const updated = { ...r, [field]: value };
        // Mutual exclusivity: isi debit → clear kredit, dan sebaliknya
        if (field === "debitRaw" && value) updated.kreditRaw = "";
        if (field === "kreditRaw" && value) updated.debitRaw = "";
        return updated;
      })
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);

    const fd = new FormData();
    fd.set("keterangan", keterangan);
    fd.set("tanggal", tanggal);
    fd.set("entityKey", entityKey);
    fd.set(
      "rows",
      JSON.stringify(
        rows
          .filter((r) => r.coaAccountId)
          .map((r) => ({
            coaAccountId: r.coaAccountId,
            debit: parseRupiah(r.debitRaw),
            kredit: parseRupiah(r.kreditRaw),
          }))
      )
    );

    startTransition(async () => {
      const result = await saveJurnalTransaksi(fd);
      if (result.error) {
        setFeedback({ type: "error", msg: result.error });
      } else {
        setFeedback({ type: "success", msg: "Jurnal berhasil disimpan." });
        setKeterangan("");
        setTanggal(todayStr());
        setRows([makeRow(uid()), makeRow(uid())]);
      }
    });
  }

  function buildPaginationHref(p: number) {
    const params = new URLSearchParams(searchParams as Record<string, string>);
    params.set("page", String(p));
    return `/jurnal-transaksi?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Form Card ─── */}
      <div className="bg-surface-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-[10px] bg-brand/10 flex items-center justify-center flex-none">
            <PenLine size={16} className="text-brand" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-navy-text">Entry Jurnal Transaksi</h2>
            <p className="text-[12px] text-muted">Input jurnal double-entry manual – total Debit harus sama dengan total Kredit</p>
          </div>
        </div>

        {feedback && (
          <div
            className={`flex items-start gap-2.5 rounded-[12px] px-4 py-3 mb-4 text-[13px] ${
              feedback.type === "success"
                ? "bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-status-green"
                : "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-status-red"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 size={15} className="mt-0.5 flex-none" />
            ) : (
              <AlertTriangle size={15} className="mt-0.5 flex-none" />
            )}
            <span>{feedback.msg}</span>
          </div>
        )}

        <form id={formId} onSubmit={handleSubmit}>
          {/* Keterangan & Tanggal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-muted-stronger">
                Keterangan <span className="text-status-red">*</span>
              </label>
              <input
                type="text"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Misal: Pembayaran gaji bulan Juli"
                required
                className="h-9 px-3 rounded-[10px] border border-border-soft bg-surface-input text-[13px] text-navy-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-muted-stronger">
                Tanggal <span className="text-status-red">*</span>
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                required
                className="h-9 px-3 rounded-[10px] border border-border-soft bg-surface-input text-[13px] text-navy-text focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
              />
            </div>
          </div>

          {/* Tabel baris akun */}
          <div className="rounded-[12px] border border-border-soft overflow-hidden mb-4">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-surface-subtle border-b border-border-soft">
                  <th className="text-left px-3 py-2.5 text-[11.5px] font-bold text-muted-stronger w-8">#</th>
                  <th className="text-left px-3 py-2.5 text-[11.5px] font-bold text-muted-stronger">Akun COA</th>
                  <th className="text-right px-3 py-2.5 text-[11.5px] font-bold text-muted-stronger w-40">Debit (Rp)</th>
                  <th className="text-right px-3 py-2.5 text-[11.5px] font-bold text-muted-stronger w-40">Kredit (Rp)</th>
                  <th className="px-2 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.uid} className="border-b border-border-soft last:border-0 hover:bg-surface-hover transition-colors">
                    <td className="px-3 py-2 text-muted text-[12px]">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <select
                        value={row.coaAccountId}
                        onChange={(e) => updateRow(row.uid, "coaAccountId", e.target.value)}
                        className="w-full h-8 px-2 rounded-[8px] border border-border-soft bg-surface-input text-[12.5px] text-navy-text focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
                      >
                        <option value="">— Pilih Akun —</option>
                        {coa.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} – {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.debitRaw}
                        onChange={(e) => updateRow(row.uid, "debitRaw", e.target.value.replace(/[^0-9]/g, ""))}
                        onBlur={(e) => {
                          const n = parseRupiah(e.target.value);
                          updateRow(row.uid, "debitRaw", n > 0 ? formatRupiahDisplay(n) : "");
                        }}
                        placeholder="0"
                        className="w-full h-8 px-2 rounded-[8px] border border-border-soft bg-surface-input text-[12.5px] text-navy-text text-right placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.kreditRaw}
                        onChange={(e) => updateRow(row.uid, "kreditRaw", e.target.value.replace(/[^0-9]/g, ""))}
                        onBlur={(e) => {
                          const n = parseRupiah(e.target.value);
                          updateRow(row.uid, "kreditRaw", n > 0 ? formatRupiahDisplay(n) : "");
                        }}
                        placeholder="0"
                        className="w-full h-8 px-2 rounded-[8px] border border-border-soft bg-surface-input text-[12.5px] text-navy-text text-right placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      {rows.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.uid)}
                          className="p-1 rounded-[6px] text-muted hover:text-status-red hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          title="Hapus baris"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Total row */}
              <tfoot>
                <tr className="bg-surface-subtle border-t border-border">
                  <td colSpan={2} className="px-3 py-2.5 text-[12.5px] font-bold text-muted-stronger">
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`text-[13px] font-bold tabular-nums ${
                        totalDebit > 0 ? (isBalanced ? "text-status-green" : "text-status-red") : "text-muted"
                      }`}
                    >
                      {totalDebit > 0 ? totalDebit.toLocaleString("id-ID") : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`text-[13px] font-bold tabular-nums ${
                        totalKredit > 0 ? (isBalanced ? "text-status-green" : "text-status-red") : "text-muted"
                      }`}
                    >
                      {totalKredit > 0 ? totalKredit.toLocaleString("id-ID") : "—"}
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-border-soft text-[12.5px] font-semibold text-muted-stronger hover:bg-surface-hover hover:text-navy-text transition-colors"
            >
              <Plus size={14} /> Tambah Baris
            </button>

            <div className="flex items-center gap-3">
              {totalDebit > 0 && totalKredit > 0 && !isBalanced && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-[11.5px] font-bold">
                  <AlertTriangle size={12} /> TIDAK SEIMBANG
                </span>
              )}
              {isBalanced && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-[11.5px] font-bold">
                  <CheckCircle2 size={12} /> SEIMBANG
                </span>
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-5 py-2 rounded-[10px] bg-navy text-white text-[13px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                {isPending ? "Menyimpan…" : "Simpan Jurnal"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ─── History Card ─── */}
      <div className="bg-surface-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border-soft">
          <h2 className="text-[14px] font-bold text-navy-text">Riwayat Entri</h2>
          <p className="text-[12px] text-muted mt-0.5">Semua jurnal transaksi yang sudah disimpan</p>
        </div>

        {history.length === 0 ? (
          <div className="flex items-center justify-center py-14 text-muted text-[13px]">
            Belum ada entri jurnal.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-surface-subtle border-b border-border-soft">
                  <th className="text-left px-4 py-3 text-[11.5px] font-bold text-muted-stronger whitespace-nowrap">TANGGAL</th>
                  <th className="text-left px-4 py-3 text-[11.5px] font-bold text-muted-stronger whitespace-nowrap">NO. BUKTI</th>
                  <th className="text-left px-4 py-3 text-[11.5px] font-bold text-muted-stronger">KETERANGAN</th>
                  <th className="text-left px-4 py-3 text-[11.5px] font-bold text-muted-stronger">AKUN</th>
                  <th className="text-right px-4 py-3 text-[11.5px] font-bold text-muted-stronger whitespace-nowrap">DEBIT</th>
                  <th className="text-right px-4 py-3 text-[11.5px] font-bold text-muted-stronger whitespace-nowrap">KREDIT</th>
                </tr>
              </thead>
              <tbody>
                {history.map((group) =>
                  group.rows.map((row, rowIdx) => (
                    <tr
                      key={`${group.noBukti}-${rowIdx}`}
                      className={`border-b border-border-soft hover:bg-surface-hover transition-colors ${
                        rowIdx === group.rows.length - 1 ? "border-b-2 border-border" : ""
                      }`}
                    >
                      {rowIdx === 0 ? (
                        <>
                          <td className="px-4 py-2.5 text-muted-stronger whitespace-nowrap align-top">
                            {group.tanggal}
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <span className="font-mono text-[12px] text-navy-text font-semibold">
                              {group.noBukti}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-navy-text align-top max-w-[200px] truncate">
                            {group.keterangan}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5" />
                          <td className="px-4 py-2.5" />
                          <td className="px-4 py-2.5" />
                        </>
                      )}
                      <td className="px-4 py-2.5 text-muted-stronger">
                        <span className="font-mono text-[11.5px]">{row.coaCode}</span>
                        <span className="ml-1.5">{row.coaName}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-navy-text">
                        {row.debit > 0 ? row.debit.toLocaleString("id-ID") : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-navy-text">
                        {row.kredit > 0 ? row.kredit.toLocaleString("id-ID") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-border-soft">
            <PaginationNav
              page={page}
              totalPages={totalPages}
              buildHref={buildPaginationHref}
            />
          </div>
        )}
      </div>
    </div>
  );
}
