"use client";

import { useState, useTransition } from "react";
import { Plus, X, Check, ToggleLeft, ToggleRight, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { createJenisInput, toggleJenisInput, deleteJenisInput } from "@/lib/actions/jenis-input";

type JenisInputItem = {
  id: string;
  key: string;
  nama: string;
  active: boolean;
  createdBy: { name: string } | null;
  createdAt: Date;
  arahLaporan: string[];
};

const LAPORAN_OPTIONS = [
  { value: "JURNAL_UMUM", label: "Jurnal Umum" },
  { value: "BUKU_BESAR", label: "Buku Besar" },
  { value: "LAPORAN_KEUANGAN", label: "Laporan Keuangan" },
  { value: "PIUTANG", label: "Piutang" },
  { value: "PAJAK", label: "Laporan Pajak" },
];

const LAPORAN_BADGE: Record<string, string> = {
  JURNAL_UMUM: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  BUKU_BESAR: "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400",
  LAPORAN_KEUANGAN: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  PIUTANG: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400",
  PAJAK: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
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
  const [nama, setNama] = useState("");
  const [arahLaporan, setArahLaporan] = useState<string[]>(["JURNAL_UMUM"]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canManage = userRole === "STAF_KEUANGAN";

  function toggleLaporan(val: string) {
    setArahLaporan((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      try {
        await createJenisInput({ nama, arahLaporan });
        setShowAdd(false);
        setNama("");
        setArahLaporan(["JURNAL_UMUM"]);
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
    <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-subtle">
        <span className="text-sm font-bold text-navy-text">{initialData.length} Jenis Input</span>
        {canManage && (
          <button
            onClick={() => { setShowAdd(true); setError(null); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-navy text-white text-[13px] font-semibold"
          >
            <Plus size={15} /> Tambah Baru
          </button>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-status-red text-sm">{error}</div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="px-6 py-5 border-b border-surface-subtle bg-surface-subtle">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-navy-text">Tambah Jenis Input Baru</span>
            <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-faint">
              <X size={15} />
            </button>
          </div>

          <div className="flex flex-col gap-3.5">
            <div>
              <label className="text-xs font-semibold text-muted-stronger block mb-1.5">Nama Jenis Input</label>
              <input
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="mis. Dana Operasional, Petty Cash Proyek"
                className="w-full px-3 py-2.5 rounded-[10px] border border-border text-[13.5px] bg-surface-card"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-stronger block mb-1.5">
                Dicatat ke{" "}
                <span className="text-[10.5px] font-normal text-muted-faint">(pilih semua yang relevan)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {LAPORAN_OPTIONS.map((opt) => {
                  const selected = arahLaporan.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleLaporan(opt.value)}
                      className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-colors ${
                        selected
                          ? "bg-navy text-white border-navy"
                          : "bg-surface-card text-muted-stronger border-border hover:border-navy/40 hover:text-navy-text"
                      }`}
                    >
                      {selected && <span className="mr-1">✓</span>}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-faint mt-1.5">
                Setelah disimpan, jenis input ini akan muncul di sidebar dan memiliki halaman input tersendiri.
              </p>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2.5 rounded-[10px] border border-border-soft text-[13px] font-semibold text-muted-stronger"
              >
                Batal
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending || !nama.trim() || arahLaporan.length === 0}
                className="px-4 py-2.5 rounded-[10px] bg-navy text-white text-[13px] font-bold flex items-center gap-1.5 disabled:opacity-60"
              >
                <Check size={14} /> {isPending ? "Menyimpan..." : "Simpan & Buat Halaman"}
              </button>
            </div>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-hover text-left">
            <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Nama</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Key / Halaman</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Dicatat ke</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Status</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Dibuat Oleh</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Tanggal</th>
            {canManage && (
              <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase text-right">Aksi</th>
            )}
          </tr>
        </thead>
        <tbody>
          {initialData.map((item) => {
            const isSystem = SYSTEM_KEYS.includes(item.key);
            return (
              <tr key={item.id} className="border-b border-surface-subtle hover:bg-surface-hover/50 transition-colors">
                <td className="py-3 px-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-navy-text">{item.nama}</span>
                    {isSystem && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-hover text-muted-faint">
                        Bawaan Sistem
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[12px] text-muted">{item.key}</span>
                    {!isSystem && item.active && (
                      <Link
                        href={`/input/${item.key}`}
                        className="p-1 rounded-md hover:bg-surface-hover text-brand"
                        title={`Buka halaman /input/${item.key}`}
                      >
                        <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex flex-wrap gap-1">
                    {item.arahLaporan.length > 0 ? (
                      item.arahLaporan.map((a) => {
                        const opt = LAPORAN_OPTIONS.find((o) => o.value === a);
                        return (
                          <span
                            key={a}
                            className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${LAPORAN_BADGE[a] ?? "bg-surface-hover text-muted"}`}
                          >
                            {opt?.label ?? a}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[11px] text-muted-faint">—</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${item.active ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-400"}`}>
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
                      {!isSystem && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={isPending}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/15 text-status-red"
                          title="Hapus"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
