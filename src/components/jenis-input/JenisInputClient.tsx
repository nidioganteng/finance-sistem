"use client";

import { useState, useTransition } from "react";
import { Plus, X, Check, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { createJenisInput, toggleJenisInput, deleteJenisInput } from "@/lib/actions/jenis-input";

type JenisInputItem = {
  id: string;
  key: string;
  nama: string;
  active: boolean;
  createdBy: { name: string } | null;
  createdAt: Date;
};

const SYSTEM_KEYS = ["kasKecil", "kasBesar", "bankBuku"];

export function JenisInputClient({
  initialData,
  userRole,
}: {
  initialData: JenisInputItem[];
  userRole: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canManage = userRole === "SUPER_ADMIN" || userRole === "MANAJER_KEUANGAN";

  async function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createJenisInput(formData);
        setShowAdd(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  async function handleToggle(id: string, active: boolean) {
    startTransition(async () => {
      try {
        await toggleJenisInput(id, active);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus jenis input ini?")) return;
    startTransition(async () => {
      try {
        await deleteJenisInput(id);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div className="bg-white rounded-[20px] border border-black/[.06] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-subtle">
        <span className="text-sm font-bold text-navy-text">{initialData.length} Jenis Input</span>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-navy text-white text-[13px] font-semibold"
        >
          <Plus size={15} /> Tambah Baru
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-50 text-status-red text-sm">{error}</div>
      )}

      {showAdd && (
        <form action={handleCreate} className="px-6 py-4 border-b border-surface-subtle bg-surface-subtle">
          <div className="flex items-center gap-3">
            <input
              name="nama"
              required
              placeholder="Nama jenis input baru (mis. Petty Cash)"
              className="px-3 py-2 rounded-xl border border-border text-sm flex-1 bg-white"
            />
            <button type="submit" disabled={isPending} className="px-3.5 py-2 rounded-[10px] bg-navy text-white text-sm font-semibold flex items-center gap-1">
              <Check size={14} /> Simpan
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-2 rounded-[10px] border border-border text-sm">
              <X size={14} />
            </button>
          </div>
          <p className="text-[11.5px] text-muted mt-2">
            Key akan di-generate otomatis. Super Admin dan Manajer akan mendapat notifikasi.
          </p>
        </form>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-hover text-left">
            <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Nama</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Key</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Status</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Dibuat Oleh</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Tanggal</th>
            {canManage && (
              <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase text-right">Aksi</th>
            )}
          </tr>
        </thead>
        <tbody>
          {initialData.map((item) => (
            <tr key={item.id} className="border-b border-surface-subtle hover:bg-surface-hover/50 transition-colors">
              <td className="py-3 px-6">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-navy-text">{item.nama}</span>
                  {SYSTEM_KEYS.includes(item.key) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-hover text-muted-faint">
                      Bawaan Sistem
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 px-3 font-mono text-[12px] text-muted">{item.key}</td>
              <td className="py-3 px-3">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${item.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {item.active ? "Aktif" : "Nonaktif"}
                </span>
              </td>
              <td className="py-3 px-3 text-[12.5px] text-muted">
                {item.createdBy?.name ?? "Bawaan Sistem"}
              </td>
              <td className="py-3 px-3 text-[12.5px] text-muted">
                {new Date(item.createdAt).toLocaleDateString("id-ID")}
              </td>
              {canManage && (
                <td className="py-3 px-6 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => handleToggle(item.id, item.active)}
                      disabled={isPending}
                      className="p-2 rounded-lg hover:bg-surface-hover text-muted-stronger"
                      title={item.active ? "Nonaktifkan" : "Aktifkan"}
                    >
                      {item.active ? <ToggleRight size={16} className="text-green-600" /> : <ToggleLeft size={16} />}
                    </button>
                    {!SYSTEM_KEYS.includes(item.key) && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isPending}
                        className="p-2 rounded-lg hover:bg-red-50 text-status-red"
                        title="Hapus"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
