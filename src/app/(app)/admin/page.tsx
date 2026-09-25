"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Trash2, AlertTriangle } from "lucide-react";

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; deleted?: Record<string, number>; error?: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleReset() {
    if (!confirmed) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reset-financial-data", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, error: "Gagal menghubungi server." });
    } finally {
      setLoading(false);
      setConfirmed(false);
    }
  }

  return (
    <>
      <PageHeader title="Admin — Reset Data" subtitle="Operasi berbahaya khusus Super Admin" />
      <div className="max-w-lg">
        <div className="bg-surface-card rounded-[20px] border border-red-300 dark:border-red-700 p-6 flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-status-red mt-0.5 flex-none" size={20} />
            <div>
              <div className="font-bold text-navy-text text-[14px]">Reset Semua Data Keuangan</div>
              <div className="text-[12.5px] text-muted mt-1">
                Menghapus seluruh transaksi (kas kecil, besar, buku bank, jurnal), termin proyek, loading dock, notifikasi, dan log aktivitas.
                Data master (user, entitas, COA, jenis input) <strong>tidak</strong> dihapus.
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="w-4 h-4 accent-red-500"
            />
            <span className="text-[13px] text-muted-stronger">
              Saya mengerti data yang dihapus <strong>tidak bisa dikembalikan</strong>
            </span>
          </label>

          <button
            onClick={handleReset}
            disabled={!confirmed || loading}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[13.5px] disabled:opacity-40 transition-colors"
          >
            <Trash2 size={15} />
            {loading ? "Menghapus..." : "Hapus Semua Data Keuangan"}
          </button>

          {result && (
            <div className={`px-4 py-3 rounded-xl text-[13px] ${result.ok ? "bg-green-50 dark:bg-green-500/10 text-status-green" : "bg-red-50 dark:bg-red-500/10 text-status-red"}`}>
              {result.ok ? (
                <div className="flex flex-col gap-1">
                  <div className="font-bold">Berhasil dihapus:</div>
                  {Object.entries(result.deleted ?? {}).map(([k, v]) => (
                    <div key={k} className="font-mono text-[12px]">{k}: {v} baris</div>
                  ))}
                </div>
              ) : (
                <div>{result.error ?? "Terjadi kesalahan."}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
