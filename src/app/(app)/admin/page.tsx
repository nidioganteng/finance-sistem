"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Trash2, AlertTriangle, Wrench } from "lucide-react";

function AdminCard({
  icon, title, description, confirmLabel, buttonLabel, endpoint, destructive,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  buttonLabel: string;
  endpoint: string;
  destructive?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message?: string; deleted?: Record<string, number>; error?: string } | null>(null);

  async function handle() {
    if (confirmLabel && !confirmed) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
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
    <div className={`bg-surface-card rounded-[20px] border p-6 flex flex-col gap-4 ${destructive ? "border-red-300 dark:border-red-700" : "border-border-soft"}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex-none ${destructive ? "text-status-red" : "text-brand"}`}>{icon}</div>
        <div>
          <div className="font-bold text-navy-text text-[14px]">{title}</div>
          <div className="text-[12.5px] text-muted mt-1" dangerouslySetInnerHTML={{ __html: description }} />
        </div>
      </div>

      {confirmLabel && (
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4 h-4 accent-red-500"
          />
          <span className="text-[13px] text-muted-stronger">{confirmLabel}</span>
        </label>
      )}

      <button
        onClick={handle}
        disabled={(confirmLabel ? !confirmed : false) || loading}
        className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-bold text-[13.5px] disabled:opacity-40 transition-colors ${
          destructive ? "bg-red-600 hover:bg-red-700" : "bg-navy hover:bg-navy/90"
        }`}
      >
        {loading ? "Memproses..." : buttonLabel}
      </button>

      {result && (
        <div className={`px-4 py-3 rounded-xl text-[13px] ${result.ok ? "bg-green-50 dark:bg-green-500/10 text-status-green" : "bg-red-50 dark:bg-red-500/10 text-status-red"}`}>
          {result.ok ? (
            <div className="flex flex-col gap-1">
              {result.message && <div className="font-bold">{result.message}</div>}
              {result.deleted && Object.entries(result.deleted).map(([k, v]) => (
                <div key={k} className="font-mono text-[12px]">{k}: {v} baris dihapus</div>
              ))}
            </div>
          ) : (
            <div>{result.error ?? "Terjadi kesalahan."}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Admin — Operasi Data" subtitle="Operasi database khusus Super Admin" />
      <div className="max-w-lg flex flex-col gap-4">
        <AdminCard
          icon={<Wrench size={20} />}
          title="Sync Daftar Akun (COA) dari Master"
          description="Hapus semua COA lama dan insert ulang dari master list yang benar. <strong>Jalankan ini setelah reset data keuangan.</strong>"
          buttonLabel="Sync COA dari Master"
          endpoint="/api/admin/sync-coa"
        />

        <AdminCard
          icon={<Wrench size={20} />}
          title="Fix Duplikat Daftar Akun (COA)"
          description="Menghapus entri COA yang duplikat (kode sama). Entri pertama dipertahankan."
          buttonLabel="Hapus Duplikat COA"
          endpoint="/api/admin/fix-duplicate-coa"
        />

        <AdminCard
          icon={<AlertTriangle size={20} />}
          title="Reset Semua Data Keuangan"
          description="Menghapus seluruh transaksi (kas kecil, besar, buku bank, jurnal), termin proyek, loading dock, notifikasi, dan log aktivitas. Data master (user, entitas, COA, jenis input) <strong>tidak</strong> dihapus."
          confirmLabel="Saya mengerti data yang dihapus tidak bisa dikembalikan"
          buttonLabel="Hapus Semua Data Keuangan"
          endpoint="/api/admin/reset-financial-data"
          destructive
        />
      </div>
    </>
  );
}
