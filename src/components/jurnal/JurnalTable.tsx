"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { updateKodeAkunJurnal } from "@/lib/actions/jurnal";

type JurnalRow = {
  id: string;
  tanggal: string;
  noBukti: string;
  keterangan: string;
  sumberBg: string;
  sumberColor: string;
  sumberLabel: string;
  isKasEntry: boolean;
  kodeAkun: string;
  namaAkun: string;
  canEditKodeAkun: boolean;
  debitFmt: string;
  kreditFmt: string;
  staffName: string;
  staffInitial: string;
  arahLaporan: string[];
};

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
}: {
  rows: JurnalRow[];
  entityId: string;
  isBalanced: boolean;
  totalDebitFmt: string;
  totalKreditFmt: string;
  canEditAkun: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(id: string, formData: FormData) {
    const kode = (formData.get("kodeAkun") as string)?.trim();
    if (!kode) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateKodeAkunJurnal(id, entityId, kode);
        setEditingId(null);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div className="bg-surface-card border border-border-soft rounded-[20px] p-5 overflow-x-auto">
      {error && (
        <div className="mb-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-status-red text-sm">{error}</div>
      )}
      <table className="w-full text-sm min-w-[860px]">
        <thead>
          <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint">
            <td className="py-2 px-1.5 whitespace-nowrap">TANGGAL</td>
            <td className="py-2 px-1.5 whitespace-nowrap">NO. BUKTI</td>
            <td className="py-2 px-1.5">SUMBER</td>
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
              <td colSpan={9} className="py-8 text-center text-sm text-muted">
                Belum ada transaksi untuk filter yang dipilih.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-surface-subtle ${r.isKasEntry ? "bg-surface-subtle/40" : ""}`}
              >
                <td className="py-2.5 px-1.5 text-[12.5px] text-muted whitespace-nowrap">{r.tanggal}</td>
                <td className="py-2.5 px-1.5 text-[11.5px] text-muted font-mono whitespace-nowrap">{r.noBukti}</td>
                <td className="py-2.5 px-1.5">
                  <span
                    className="text-[10.5px] font-bold px-2.5 py-1 rounded-md whitespace-nowrap"
                    style={{ background: r.sumberBg, color: r.sumberColor }}
                  >
                    {r.sumberLabel}
                  </span>
                </td>
                <td className="py-2.5 px-1.5 text-[13px] text-navy-text max-w-[200px]">
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
                </td>
                <td className="py-2.5 px-1.5 text-[12px] font-mono text-muted">
                  {editingId === r.id ? (
                    <form action={(fd) => handleSave(r.id, fd)} className="flex items-center gap-1">
                      <input
                        name="kodeAkun"
                        required
                        autoFocus
                        defaultValue={r.kodeAkun}
                        className="w-20 px-1.5 py-1 rounded-md border border-border text-[12px] font-mono bg-surface-card"
                      />
                      <button type="submit" disabled={isPending} className="p-1 rounded hover:bg-surface-hover text-status-green" title="Simpan">
                        <Check size={13} />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-surface-hover text-muted-stronger" title="Batal">
                        <X size={13} />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {r.kodeAkun}
                      {canEditAkun && r.canEditKodeAkun && (
                        <button onClick={() => setEditingId(r.id)} className="p-0.5 rounded hover:bg-surface-hover text-muted-faint hover:text-navy-text" title="Edit kode akun">
                          <Pencil size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-1.5 text-[13px] font-semibold text-navy-text">
                  {r.namaAkun}
                  {r.isKasEntry && (
                    <span className="ml-1.5 text-[10px] font-bold text-muted-faint bg-surface-hover px-1.5 py-0.5 rounded">
                      auto
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-1.5 text-[13px] text-navy-text text-right tabular-nums font-medium">
                  {r.debitFmt}
                </td>
                <td className="py-2.5 px-1.5 text-[13px] text-navy-text text-right tabular-nums font-medium">
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
              <td colSpan={6} className="py-3.5 px-1.5 text-[13px] font-extrabold text-navy-text">
                Total Periode Berjalan
                {!isBalanced && (
                  <span className="ml-2 text-[11px] font-bold text-red-500 normal-case">
                    ⚠ tidak seimbang
                  </span>
                )}
              </td>
              <td
                className={`py-3.5 px-1.5 text-[13.5px] font-extrabold text-right tabular-nums ${
                  isBalanced ? "text-navy-text" : "text-red-600 dark:text-red-400"
                }`}
              >
                {totalDebitFmt}
              </td>
              <td
                className={`py-3.5 px-1.5 text-[13.5px] font-extrabold text-right tabular-nums ${
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
    </div>
  );
}
