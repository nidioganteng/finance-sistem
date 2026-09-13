"use client";

import { useState, useTransition } from "react";
import { CoaKategori } from "@prisma/client";
import { createCOA, updateCOA, deleteCOA } from "@/lib/actions/coa";
import { Pencil, Trash2, Plus, X, Check } from "lucide-react";

type COAItem = {
  id: string;
  code: string;
  name: string;
  kategori: CoaKategori;
  createdAt: Date;
};

const KATEGORI_OPTS: CoaKategori[] = ["PENDAPATAN", "BEBAN", "ASET", "KEWAJIBAN", "MODAL"];

const KATEGORI_BADGE: Record<CoaKategori, string> = {
  PENDAPATAN: "bg-green-100 text-green-700",
  BEBAN: "bg-red-100 text-red-700",
  ASET: "bg-blue-100 text-blue-700",
  KEWAJIBAN: "bg-orange-100 text-orange-700",
  MODAL: "bg-purple-100 text-purple-700",
};

export function CoaClient({ initialCoa }: { initialCoa: COAItem[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createCOA(formData);
        setShowAdd(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  async function handleUpdate(id: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateCOA(id, formData);
        setEditingId(null);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus akun COA ini?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteCOA(id);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div className="bg-white rounded-[20px] border border-black/[.06] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-subtle">
        <span className="text-sm font-bold text-navy-text">{initialCoa.length} Akun Terdaftar</span>
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-navy text-white text-[13px] font-semibold"
        >
          <Plus size={15} /> Tambah Akun
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-50 text-status-red text-sm">{error}</div>
      )}

      {showAdd && (
        <form action={handleCreate} className="px-6 py-4 border-b border-surface-subtle bg-surface-subtle">
          <div className="flex items-center gap-3 flex-wrap">
            <input name="code" required placeholder="Kode (mis. 4-001)" className="px-3 py-2 rounded-xl border border-border text-sm w-36 bg-white" />
            <input name="name" required placeholder="Nama Akun" className="px-3 py-2 rounded-xl border border-border text-sm flex-1 min-w-40 bg-white" />
            <select name="kategori" required className="px-3 py-2 rounded-xl border border-border text-sm bg-white">
              <option value="">Pilih Kategori</option>
              {KATEGORI_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <button type="submit" disabled={isPending} className="px-3.5 py-2 rounded-[10px] bg-navy text-white text-sm font-semibold flex items-center gap-1">
              <Check size={14} /> Simpan
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-2 rounded-[10px] border border-border text-sm text-muted-stronger">
              <X size={14} />
            </button>
          </div>
        </form>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-hover text-left">
            <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Kode</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Nama Akun</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Kategori</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Dibuat</th>
            <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {initialCoa.length === 0 && (
            <tr>
              <td colSpan={5} className="py-10 text-center text-sm text-muted">
                Belum ada akun COA. Klik &quot;Tambah Akun&quot; untuk memulai.
              </td>
            </tr>
          )}
          {initialCoa.map((item) =>
            editingId === item.id ? (
              <tr key={item.id} className="border-b border-surface-subtle bg-surface-subtle">
                <td colSpan={5} className="px-6 py-3">
                  <form action={(fd) => handleUpdate(item.id, fd)} className="flex items-center gap-3 flex-wrap">
                    <input name="code" required defaultValue={item.code} className="px-3 py-2 rounded-xl border border-border text-sm w-36 bg-white" />
                    <input name="name" required defaultValue={item.name} className="px-3 py-2 rounded-xl border border-border text-sm flex-1 min-w-40 bg-white" />
                    <select name="kategori" required defaultValue={item.kategori} className="px-3 py-2 rounded-xl border border-border text-sm bg-white">
                      {KATEGORI_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <button type="submit" disabled={isPending} className="px-3.5 py-2 rounded-[10px] bg-navy text-white text-sm font-semibold flex items-center gap-1">
                      <Check size={14} /> Simpan
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="px-3 py-2 rounded-[10px] border border-border text-sm">
                      <X size={14} />
                    </button>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={item.id} className="border-b border-surface-subtle hover:bg-surface-hover/50 transition-colors">
                <td className="py-3 px-6 font-mono text-[13px] font-semibold text-navy-text">{item.code}</td>
                <td className="py-3 px-3 text-[13.5px] text-muted-stronger">{item.name}</td>
                <td className="py-3 px-3">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${KATEGORI_BADGE[item.kategori]}`}>
                    {item.kategori}
                  </span>
                </td>
                <td className="py-3 px-3 text-[12.5px] text-muted">
                  {new Date(item.createdAt).toLocaleDateString("id-ID")}
                </td>
                <td className="py-3 px-6 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => { setEditingId(item.id); setShowAdd(false); }} className="p-2 rounded-lg hover:bg-surface-hover text-muted-stronger" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} disabled={isPending} className="p-2 rounded-lg hover:bg-red-50 text-status-red" title="Hapus">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
