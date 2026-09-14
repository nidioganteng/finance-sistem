"use client";

import { useState } from "react";
import { KasTransactionForm } from "./KasTransactionForm";

type CoaOption = { id: string; code: string; name: string };
type LedgerRow = {
  tanggal: string;
  noBukti: string;
  keterangan: string;
  akunTags: string[];
  masukFmt: string;
  keluarFmt: string;
  saldoFmt: string;
};

export function KasScreenClient({
  entityKey,
  jenisInputKey,
  pagePath,
  coaOptions,
  saldoFmt,
  ledger,
}: {
  entityKey: string;
  jenisInputKey: string;
  pagePath: string;
  coaOptions: CoaOption[];
  saldoFmt: string;
  ledger: LedgerRow[];
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3.5">
        <div className="px-3.5 py-2.5 rounded-[11px] border border-border-soft text-[12.5px] font-semibold text-muted-stronger bg-surface-card">
          Saldo Berjalan: <span className="font-extrabold text-navy-text">{saldoFmt}</span>
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
          onClose={() => setPanelOpen(false)}
        />
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
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-muted">
                  Belum ada transaksi.
                </td>
              </tr>
            ) : (
              ledger.map((r, idx) => {
                const shown = r.akunTags.slice(0, 2);
                const rest = r.akunTags.length - shown.length;
                const expanded = expandedIdx === idx;
                return (
                  <tr key={r.noBukti + idx} className="border-b border-surface-subtle align-top">
                    <td className="py-2.5 px-1.5 text-[12.5px] text-muted whitespace-nowrap">{r.tanggal}</td>
                    <td className="py-2.5 px-1.5 text-xs text-muted font-mono">{r.noBukti}</td>
                    <td className="py-2.5 px-1.5 text-[13px] font-semibold text-navy-text">{r.keterangan}</td>
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
