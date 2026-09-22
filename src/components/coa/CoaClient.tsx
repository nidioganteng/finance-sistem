"use client";

import { useState, useTransition } from "react";
import { CoaKategori, ReportType } from "@prisma/client";
import { createCOA, updateCOA, deleteCOA } from "@/lib/actions/coa";
import { Pencil, Trash2, Plus, X, Check } from "lucide-react";

type COAItem = {
  id: string;
  code: string;
  name: string;
  kategori: CoaKategori;
  reportType: ReportType;
  scope: string;
  createdAt: Date;
};

const SCOPE_OPTS = ["KAS", "BANK"] as const;

const SCOPE_LABEL: Record<string, string> = {
  KAS: "Kas Kecil/Besar",
  BANK: "Bank Buku",
};

const SCOPE_BADGE: Record<string, string> = {
  KAS: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400",
  BANK: "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400",
};

const KATEGORI_OPTS: CoaKategori[] = ["PENDAPATAN", "BEBAN", "ASET", "KEWAJIBAN", "MODAL"];

const KATEGORI_BADGE: Record<CoaKategori, string> = {
  PENDAPATAN: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  BEBAN: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
  ASET: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  KEWAJIBAN: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  MODAL: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400",
};

const REPORT_TYPE_OPTS: ReportType[] = ["NERACA", "LABA_RUGI", "ARUS_KAS"];

const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  NERACA: "Neraca",
  LABA_RUGI: "Laba Rugi",
  ARUS_KAS: "Arus Kas",
};

export function CoaClient({ initialCoa, canDelete }: { initialCoa: COAItem[]; canDelete: boolean }) {
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
    <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
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
        <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-status-red text-sm">{error}</div>
      )}

      {showAdd && (
        <form action={handleCreate} className="px-6 py-4 border-b border-surface-subtle bg-surface-subtle">
          <div className="flex items-center gap-3 flex-wrap">
            <input name="code" required placeholder="Kode (mis. 4-001)" className="px-3 py-2 rounded-xl border border-border text-sm w-36 bg-surface-card" />
            <input name="name" required placeholder="Nama Akun" className="px-3 py-2 rounded-xl border border-border text-sm flex-1 min-w-40 bg-surface-card" />
            <select name="kategori" required className="px-3 py-2 rounded-xl border border-border text-sm bg-surface-card">
              <option value="">Pilih Kategori</option>
              {KATEGORI_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <select name="reportType" required defaultValue="" className="px-3 py-2 rounded-xl border border-border text-sm bg-surface-card">
              <option value="" disabled>Rumah Akun</option>
              {REPORT_TYPE_OPTS.map((r) => <option key={r} value={r}>{REPORT_TYPE_LABEL[r]}</option>)}
            </select>
            <select name="scope" required defaultValue="KAS" className="px-3 py-2 rounded-xl border border-border text-sm bg-surface-card">
              {SCOPE_OPTS.map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
            </select>
            <button type="submit" disabled={isPending} className="px-3.5 py-2 rounded-[10px] bg-navy text-white text-sm font-semibold flex items-center gap-1">
              <Check size={14} /> Simpan
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-2 rounded-[10px] border border-border text-sm text-muted-stronger">
              <X size={14} />
            </button>
          </div>
          <p className="text-[11.5px] text-muted mt-2">
            Kas Kecil/Besar dan Bank Buku dianggap 2 akun terpisah walau kode &amp; namanya sama — pilih modul yang akan pakai akun ini.
          </p>
        </form>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-hover text-left">
            <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Kode</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Nama Akun</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Kategori</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Rumah Akun</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Scope</th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Dibuat</th>
            <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {initialCoa.length === 0 && (
            <tr>
              <td colSpan={7} className="py-10 text-center text-sm text-muted">
                Belum ada akun COA. Klik &quot;Tambah Akun&quot; untuk memulai.
              </td>
            </tr>
          )}
          {initialCoa.map((item) =>
            editingId === item.id ? (
              <tr key={item.id} className="border-b border-surface-subtle bg-surface-subtle">
                <td colSpan={7} className="px-6 py-3">
                  <form action={(fd) => handleUpdate(item.id, fd)} className="flex items-center gap-3 flex-wrap">
                    <input name="code" required defaultValue={item.code} className="px-3 py-2 rounded-xl border border-border text-sm w-36 bg-surface-card" />
                    <input name="name" required defaultValue={item.name} className="px-3 py-2 rounded-xl border border-border text-sm flex-1 min-w-40 bg-surface-card" />
                    <select name="kategori" required defaultValue={item.kategori} className="px-3 py-2 rounded-xl border border-border text-sm bg-surface-card">
                      {KATEGORI_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <select name="reportType" required defaultValue={item.reportType} className="px-3 py-2 rounded-xl border border-border text-sm bg-surface-card">
                      {REPORT_TYPE_OPTS.map((r) => <option key={r} value={r}>{REPORT_TYPE_LABEL[r]}</option>)}
                    </select>
                    <select name="scope" required defaultValue={item.scope} className="px-3 py-2 rounded-xl border border-border text-sm bg-surface-card">
                      {SCOPE_OPTS.map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
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
                <td className="py-3 px-3 text-[12.5px] text-muted-stronger">
                  {REPORT_TYPE_LABEL[item.reportType]}
                </td>
                <td className="py-3 px-3">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md whitespace-nowrap ${SCOPE_BADGE[item.scope] ?? ""}`}>
                    {SCOPE_LABEL[item.scope] ?? item.scope}
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
                    {canDelete && (
                      <button onClick={() => handleDelete(item.id)} disabled={isPending} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/15 text-status-red" title="Hapus">
                        <Trash2 size={14} />
                      </button>
                    )}
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
