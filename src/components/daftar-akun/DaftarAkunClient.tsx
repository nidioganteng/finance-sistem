"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { upsertSaldoAwal } from "@/lib/actions/saldo-awal";

type Row = {
  coaId: string;
  code: string;
  name: string;
  kategori: string;
  saldoAwal: number;
  saldoAwalFmt: string;
  totalDebetFmt: string;
  totalKreditFmt: string;
  saldoAkhirFmt: string;
  saldoAkhirNegatif: boolean;
  punyaTransaksi: boolean;
};

const KATEGORI_BADGE: Record<string, string> = {
  PENDAPATAN: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  BEBAN: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
  ASET: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  KEWAJIBAN: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  MODAL: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400",
};

export function DaftarAkunClient({
  rows,
  entityId,
  year,
  canEdit,
}: {
  rows: Row[];
  entityId: string;
  year: number;
  canEdit: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(coaId: string, formData: FormData) {
    const raw = (formData.get("saldoAwal") as string)?.trim().replace(/[^0-9-]/g, "");
    const nominal = raw ? parseInt(raw, 10) : 0;
    if (Number.isNaN(nominal)) return;
    setError(null);
    startTransition(async () => {
      try {
        await upsertSaldoAwal(entityId, coaId, year, nominal);
        setEditingId(null);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div className="bg-surface-card border border-border-soft rounded-[20px] overflow-hidden">
      {error && (
        <div className="mx-5 mt-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-status-red text-sm">{error}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint">
              <th className="py-3 px-5">KODE AKUN</th>
              <th className="py-3 px-3">NAMA AKUN</th>
              <th className="py-3 px-3">KATEGORI</th>
              <th className="py-3 px-3 text-right">SALDO AWAL</th>
              <th className="py-3 px-3 text-right">TOTAL DEBET</th>
              <th className="py-3 px-3 text-right">TOTAL KREDIT</th>
              <th className="py-3 px-5 text-right">SALDO AKHIR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.coaId} className="border-b border-surface-subtle hover:bg-surface-hover/40">
                <td className="py-3 px-5 font-mono font-bold text-navy-text text-[13px]">{r.code}</td>
                <td className="py-3 px-3 text-[13px] font-semibold text-navy-text">
                  {r.name}
                  {!r.punyaTransaksi && (
                    <span className="ml-1.5 text-[10px] font-bold text-muted-faint bg-surface-hover px-1.5 py-0.5 rounded">
                      belum ada transaksi
                    </span>
                  )}
                </td>
                <td className="py-3 px-3">
                  <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${KATEGORI_BADGE[r.kategori] ?? "bg-surface-hover text-muted"}`}>
                    {r.kategori}
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  {editingId === r.coaId ? (
                    <form action={(fd) => handleSave(r.coaId, fd)} className="flex items-center justify-end gap-1">
                      <input
                        name="saldoAwal"
                        required
                        autoFocus
                        inputMode="numeric"
                        defaultValue={r.saldoAwal}
                        className="w-28 px-2 py-1 rounded-md border border-border text-[12.5px] text-right bg-surface-card"
                      />
                      <button type="submit" disabled={isPending} className="p-1 rounded hover:bg-surface-hover text-status-green" title="Simpan">
                        <Check size={13} />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-surface-hover text-muted-stronger" title="Batal">
                        <X size={13} />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="tabular-nums text-[13px] text-muted">{r.saldoAwalFmt}</span>
                      {canEdit && (
                        <button onClick={() => setEditingId(r.coaId)} className="p-0.5 rounded hover:bg-surface-hover text-muted-faint hover:text-navy-text" title="Edit saldo awal">
                          <Pencil size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-[13px] text-navy-text">{r.totalDebetFmt}</td>
                <td className="py-3 px-3 text-right tabular-nums text-[13px] text-navy-text">{r.totalKreditFmt}</td>
                <td className="py-3 px-5 text-right tabular-nums text-[13px] font-bold">
                  <span className={r.saldoAkhirNegatif ? "text-status-red" : "text-navy-text"}>
                    {r.saldoAkhirNegatif ? "-" : ""}{r.saldoAkhirFmt}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
