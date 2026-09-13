"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createKasTransaction } from "@/lib/actions/kas";

type CoaOption = { id: string; code: string; name: string };
type Row = { id: number; coaAccountId: string; nominal: string };

let rowIdSeq = 2;

export function KasTransactionForm({
  entityKey,
  jenisInputKey,
  pagePath,
  coaOptions,
  onClose,
}: {
  entityKey: string;
  jenisInputKey: string;
  pagePath: string;
  coaOptions: CoaOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [noBukti, setNoBukti] = useState(`BKT/${Date.now().toString().slice(-6)}`);
  const [keterangan, setKeterangan] = useState("");
  const [arah, setArah] = useState<"masuk" | "keluar">("masuk");
  const [nominalUtama, setNominalUtama] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { id: 0, coaAccountId: "", nominal: "" },
    { id: 1, coaAccountId: "", nominal: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const rowsTotal = rows.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
  const target = Number(nominalUtama) || 0;
  const matched = target > 0 && rowsTotal === target;

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    rowIdSeq += 1;
    setRows((prev) => [...prev, { id: rowIdSeq, coaAccountId: "", nominal: "" }]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function handleSave() {
    setError(null);
    if (!matched) {
      setError("Total baris akun harus sama dengan nominal transaksi.");
      return;
    }
    startTransition(async () => {
      const result = await createKasTransaction({
        entityKey,
        jenisInputKey,
        tanggal,
        noBukti,
        keterangan,
        arah,
        rows: rows.map((r) => ({ coaAccountId: r.coaAccountId, nominal: Number(r.nominal) || 0 })),
        pagePath,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="bg-white border border-black/[.06] rounded-[20px] p-5 flex flex-col gap-3.5">
      <div className="text-sm font-bold text-navy-text">Transaksi Baru</div>

      <div className="grid grid-cols-2 gap-3.5">
        <div>
          <label className="text-xs font-semibold text-muted-stronger block mb-1.5">Tanggal</label>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] border border-border text-[13.5px]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-stronger block mb-1.5">No. Bukti</label>
          <input
            value={noBukti}
            onChange={(e) => setNoBukti(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] border border-border text-[13.5px] font-mono"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-stronger block mb-1.5">Keterangan</label>
        <input
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          placeholder="mis. Pembelian material proyek"
          className="w-full px-3 py-2.5 rounded-[10px] border border-border text-[13.5px]"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-stronger block mb-1.5">Arah Dana</label>
        <div className="inline-flex bg-surface-hover rounded-pill p-1 gap-0.5">
          <button
            type="button"
            onClick={() => setArah("masuk")}
            className={`px-4 py-2 rounded-pill text-[12.5px] font-bold ${
              arah === "masuk" ? "bg-status-green text-white" : "text-muted-strong"
            }`}
          >
            Uang Masuk
          </button>
          <button
            type="button"
            onClick={() => setArah("keluar")}
            className={`px-4 py-2 rounded-pill text-[12.5px] font-bold ${
              arah === "keluar" ? "bg-status-red text-white" : "text-muted-strong"
            }`}
          >
            Uang Keluar
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-stronger block mb-1.5">Nominal Transaksi (Rp)</label>
        <input
          value={nominalUtama}
          onChange={(e) => setNominalUtama(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="0"
          className="w-full max-w-[260px] px-3 py-2.5 rounded-[10px] border border-border text-[13.5px]"
        />
      </div>

      <div className="mt-1.5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-muted-stronger">Baris Akun</label>
          <button type="button" onClick={addRow} className="text-xs font-bold text-brand">
            + Tambah Akun
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_160px_32px] gap-2.5 items-center">
              <select
                value={r.coaAccountId}
                onChange={(e) => updateRow(r.id, { coaAccountId: e.target.value })}
                className="w-full px-2.5 py-2 rounded-[9px] border border-border text-[13px]"
              >
                <option value="">Pilih akun...</option>
                {coaOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
              <input
                value={r.nominal}
                onChange={(e) => updateRow(r.id, { nominal: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="Nominal"
                className="w-full px-2.5 py-2 rounded-[9px] border border-border text-[13px]"
              />
              <button type="button" onClick={() => removeRow(r.id)} className="text-muted-faint text-base">
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-surface-hover">
          <div className="text-[12.5px] font-semibold text-muted-stronger">
            Total Baris Akun: <span className="font-extrabold text-navy-text">Rp {rowsTotal.toLocaleString("id-ID")}</span>
          </div>
          {target > 0 && (matched ? (
            <div className="text-xs font-bold text-status-green">✓ Sesuai</div>
          ) : (
            <div className="text-xs font-bold text-status-red">⚠ Belum sama dengan nominal transaksi</div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-status-red">{error}</p>}

      <div className="flex gap-2.5 mt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-4.5 py-2.5 rounded-[10px] border border-border-soft text-[13px] font-semibold text-muted-stronger"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="px-4.5 py-2.5 rounded-[10px] text-[13px] font-bold bg-navy text-white disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Simpan Transaksi"}
        </button>
      </div>
    </div>
  );
}
