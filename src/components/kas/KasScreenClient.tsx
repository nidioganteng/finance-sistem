"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { KasTransactionForm } from "./KasTransactionForm";
import { deleteKasTransactionGroup, updateKasTransactionGroup } from "@/lib/actions/kas";
import type { RekeningOption } from "@/lib/bank-accounts";
import { Pencil, Trash2, Check, X } from "lucide-react";

type CoaOption = { id: string; code: string; name: string };
type CoaRow = { id: string; coaAccountId: string; coaName: string; nominal: number };
type LedgerRow = {
  tanggal: string;
  noBukti: string;
  keterangan: string;
  akunTags: string[];
  rekening?: string;
  masukFmt: string;
  keluarFmt: string;
  saldoFmt: string;
  allTxIds: string[];
  coaRows: CoaRow[];
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
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [panelOpen, setPanelOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  // Edit state
  const [editNoBukti, setEditNoBukti] = useState("");
  const [editKeterangan, setEditKeterangan] = useState("");
  const [editCoaMap, setEditCoaMap] = useState<Record<string, string>>({}); // txId → newCoaAccountId

  const switchRekening = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("rekening", id);
      router.push(`${pathname}?${params.toString()}`);
      setPanelOpen(false);
    },
    [router, pathname, searchParams]
  );

  function openEdit(idx: number, row: LedgerRow) {
    setEditingIdx(idx);
    setEditNoBukti(row.noBukti);
    setEditKeterangan(row.keterangan);
    const map: Record<string, string> = {};
    for (const cr of row.coaRows) map[cr.id] = cr.coaAccountId;
    setEditCoaMap(map);
    setActionError(null);
  }

  function cancelEdit() {
    setEditingIdx(null);
    setActionError(null);
  }

  function handleDelete(row: LedgerRow) {
    if (!confirm(`Hapus transaksi "${row.noBukti}" — ${row.keterangan}?`)) return;
    setActionError(null);
    startTransition(async () => {
      const res = await deleteKasTransactionGroup(row.allTxIds, pagePath);
      if (res?.error) setActionError(res.error);
      else router.refresh();
    });
  }

  function handleSaveEdit(row: LedgerRow) {
    setActionError(null);
    startTransition(async () => {
      const coaUpdates = row.coaRows
        .filter((cr) => editCoaMap[cr.id] && editCoaMap[cr.id] !== cr.coaAccountId)
        .map((cr) => ({ txId: cr.id, newCoaAccountId: editCoaMap[cr.id] }));
      const res = await updateKasTransactionGroup({
        txIds: row.allTxIds,
        newNoBukti: editNoBukti,
        newKeterangan: editKeterangan,
        coaUpdates,
        pagePath,
      });
      if (res?.error) setActionError(res.error);
      else {
        setEditingIdx(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3.5 py-2.5 rounded-[11px] border border-border-soft text-[12.5px] font-semibold text-muted-stronger bg-surface-card">
            {saldoLabel}: <span className="font-extrabold text-navy-text">{saldoFmt}</span>
          </div>

          {/* Rekening switcher — hanya tampil di Bank Buku */}
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
          onClick={() => setPanelOpen((v) => !v)}
          className="px-4.5 py-2.5 rounded-[11px] bg-navy text-white text-[13px] font-bold"
        >
          {panelOpen ? "Tutup Form" : "+ Transaksi Baru"}
        </button>
      </div>

      {panelOpen && (
        <KasTransactionForm
          entityKey={entityKey}
          jenisInputKey={jenisInputKey}
          pagePath={pagePath}
          coaOptions={coaOptions}
          rekeningOptions={rekeningOptions}
          defaultRekeningId={selectedRekeningId}
          onClose={() => setPanelOpen(false)}
        />
      )}

      {actionError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-status-red text-sm">
          {actionError}
        </div>
      )}

      <div className="bg-surface-card border border-border-soft rounded-[20px] p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint">
              <td className="py-2 px-1.5">TANGGAL</td>
              <td className="py-2 px-1.5">NO. BUKTI</td>
              <td className="py-2 px-1.5">KETERANGAN</td>
              <td className="py-2 px-1.5">AKUN</td>
              <td className="py-2 px-1.5 text-right">MASUK</td>
              <td className="py-2 px-1.5 text-right">KELUAR</td>
              <td className="py-2 px-1.5 text-right">SALDO BERJALAN</td>
              <td className="py-2 px-1.5 text-right">AKSI</td>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-sm text-muted">
                  Belum ada transaksi.
                </td>
              </tr>
            ) : (
              ledger.map((r, idx) => {
                const shown = r.akunTags.slice(0, 2);
                const rest = r.akunTags.length - shown.length;
                const expanded = expandedIdx === idx;
                const isEditing = editingIdx === idx;

                if (isEditing) {
                  return (
                    <tr key={r.noBukti + idx + "-edit"} className="border-b border-surface-subtle align-top bg-surface-subtle/60">
                      <td className="py-3 px-1.5 text-[12.5px] text-muted whitespace-nowrap">{r.tanggal}</td>
                      <td className="py-3 px-1.5">
                        <input
                          value={editNoBukti}
                          onChange={(e) => setEditNoBukti(e.target.value)}
                          className="w-full px-2 py-1 rounded-[8px] border border-border text-[12.5px] font-mono bg-surface-input"
                        />
                      </td>
                      <td className="py-3 px-1.5">
                        <input
                          value={editKeterangan}
                          onChange={(e) => setEditKeterangan(e.target.value)}
                          className="w-full px-2 py-1 rounded-[8px] border border-border text-[12.5px] bg-surface-input"
                        />
                      </td>
                      <td className="py-3 px-1.5" colSpan={4}>
                        {r.coaRows.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {r.coaRows.map((cr) => (
                              <div key={cr.id} className="flex items-center gap-2">
                                <select
                                  value={editCoaMap[cr.id] ?? cr.coaAccountId}
                                  onChange={(e) => setEditCoaMap((prev) => ({ ...prev, [cr.id]: e.target.value }))}
                                  className="px-2 py-1 rounded-[8px] border border-border text-[12px] bg-surface-input flex-1"
                                >
                                  {coaOptions.map((c) => (
                                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                                  ))}
                                </select>
                                <span className="text-[12px] text-muted-faint whitespace-nowrap">
                                  Rp {cr.nominal.toLocaleString("id-ID")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-1.5 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => handleSaveEdit(r)}
                            disabled={isPending}
                            className="p-1.5 rounded-lg bg-navy text-white hover:opacity-80 disabled:opacity-50"
                            title="Simpan"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg border border-border text-muted-stronger hover:bg-surface-hover"
                            title="Batal"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={r.noBukti + idx} className="border-b border-surface-subtle align-top hover:bg-surface-hover/30 group">
                    <td className="py-2.5 px-1.5 text-[12.5px] text-muted whitespace-nowrap">{r.tanggal}</td>
                    <td className="py-2.5 px-1.5 text-xs text-muted font-mono">{r.noBukti}</td>
                    <td className="py-2.5 px-1.5 text-[13px] font-semibold text-navy-text">
                      {r.keterangan}
                      {r.rekening && (
                        <span className="ml-2 text-[10.5px] font-bold text-brand bg-blue-50 dark:bg-blue-500/20 px-2 py-0.5 rounded-md">
                          {r.rekening}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-1.5">
                      <div className="flex gap-1 flex-wrap">
                        {(expanded ? r.akunTags : shown).map((tag, i) => (
                          <span key={i} className="text-[10.5px] font-bold text-muted-strong bg-surface-hover px-2.5 py-1 rounded-md">
                            {tag}
                          </span>
                        ))}
                        {!expanded && rest > 0 && (
                          <button onClick={() => setExpandedIdx(idx)} className="text-[10.5px] font-bold text-brand px-1">
                            +{rest} lagi
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-1.5 text-[13px] font-bold text-status-green text-right tabular-nums">{r.masukFmt}</td>
                    <td className="py-2.5 px-1.5 text-[13px] font-bold text-status-red text-right tabular-nums">{r.keluarFmt}</td>
                    <td className="py-2.5 px-1.5 text-[13px] font-bold text-navy-text text-right tabular-nums">{r.saldoFmt}</td>
                    <td className="py-2.5 px-1.5 text-right">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(idx, r)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-stronger"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/15 text-status-red"
                          title="Hapus"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
