"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { KasTransactionForm } from "./KasTransactionForm";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { deleteKasTransactionGroup } from "@/lib/actions/kas";
import type { RekeningOption } from "@/lib/bank-accounts";
import { Pencil, Trash2, ArrowRightLeft, ArrowUpDown } from "lucide-react";

type CoaOption = { id: string; code: string; name: string };
type CoaRow = { id: string; coaAccountId: string; coaName: string; nominal: number };
type LedgerRow = {
  tanggal: string;
  tanggalRaw: string;
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
};

type ProjectOption = { id: string; code: string; name: string };

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
  allEntities?: { key: string; name: string }[];
  projectOptions?: ProjectOption[];
  defaultArahLaporan?: string[];
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
      {/* Edit modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setEditingRow(null)}
          />
          <div className="relative w-full max-w-2xl my-auto">
            <KasTransactionForm
              entityKey={entityKey}
              jenisInputKey={jenisInputKey}
              pagePath={pagePath}
              coaOptions={coaOptions}
              rekeningOptions={rekeningOptions}
              defaultRekeningId={selectedRekeningId}
              allEntities={allEntities}
              defaultArahLaporan={defaultArahLaporan}
              initialValues={{
                tanggal: editingRow.tanggalRaw,
                noBukti: editingRow.noBukti,
                keterangan: editingRow.keterangan,
                arah: editingRow.masuk > 0 ? "masuk" : "keluar",
                rekeningId: rekeningOptions.find((r) => r.nama === editingRow.rekening)?.id,
                crossingEntityKeys: editingRow.crossingEntityKeys ?? [],
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

      <div className="flex items-center justify-between flex-wrap gap-3.5">
        <div className="flex items-center gap-2 flex-wrap">
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
          allEntities={allEntities}
          projectOptions={projectOptions}
          defaultArahLaporan={defaultArahLaporan}
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
              [...ledger].sort((a, b) => {
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
                    <td className="py-2.5 px-1.5 text-[12.5px] text-muted whitespace-nowrap">{r.tanggal}</td>
                    <td className="py-2.5 px-1.5 text-xs text-muted font-mono">{r.noBukti}</td>
                    <td className="py-2.5 px-1.5 text-[13px] font-semibold text-navy-text">
                      {r.keterangan}
                      {r.rekening && (
                        <span className="ml-2 text-[10.5px] font-bold text-brand bg-blue-50 dark:bg-blue-500/20 px-2 py-0.5 rounded-md">
                          {r.rekening}
                        </span>
                      )}
                      {/* Crossing destination badge — transaksi masuk dari entitas lain */}
                      {isCrossingFrom && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/20 px-2 py-0.5 rounded-md">
                          <ArrowRightLeft size={9} />
                          dari {sourceEntityName}
                        </span>
                      )}
                      {/* Crossing source badges — transaksi dikirim ke entitas lain */}
                      {!isCrossingFrom && (r.crossingEntityKeys ?? []).length > 0 && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/20 px-2 py-0.5 rounded-md">
                          <ArrowRightLeft size={9} />
                          → {(r.crossingEntityKeys ?? [])
                            .map((k) => allEntities.find((e) => e.key === k)?.name ?? k)
                            .join(", ")}
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
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
