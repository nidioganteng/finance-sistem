"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { savePtkpSettingsAction } from "@/lib/actions/payroll";

export function PtkpSettingsModal({ entityId, entityName, rates, onClose, onSaved }: {
  entityId: string; entityName: string; rates: Record<string, number>; onClose: () => void; onSaved: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(() => Object.fromEntries(Object.entries(rates).map(([key, value]) => [key, value.toLocaleString("id-ID", { maximumFractionDigits: 0 })])));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onClose={onClose} onCancel={event => { if (pending) event.preventDefault(); }} aria-labelledby="ptkp-settings-title" className="fixed inset-auto left-1/2 top-1/2 !m-0 max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface-card p-0 text-foreground shadow-2xl backdrop:bg-slate-900/60">
    <div className="flex items-center justify-between border-b border-border px-5 py-4"><h3 id="ptkp-settings-title" className="text-sm font-bold text-navy-text">Pengaturan Nominal PTKP</h3><button type="button" disabled={pending} aria-label="Tutup pengaturan PTKP" className="text-muted-faint hover:text-navy-text" onClick={onClose}><X size={16} /></button></div>
    <form className="space-y-4 p-5 text-xs" onSubmit={event => {
      event.preventDefault(); setError("");
      const values = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, Number(value.replace(/\./g, ""))]));
      startTransition(async () => { try { const result = await savePtkpSettingsAction(entityId, values); onSaved(result.message); } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan PTKP."); } });
    }}>
      <div className="rounded-xl border border-border bg-surface-subtle p-3"><p className="font-semibold text-navy-text">{entityName}</p><p className="mt-1 leading-relaxed text-muted-faint">Nominal tahunan diterapkan ke master pegawai sesuai status PTKP. Saat menambah atau mengedit pegawai, nominal mengikuti pengaturan ini.</p></div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
      <div className="space-y-2">{Object.keys(rates).map(status => <label key={status} className="grid grid-cols-[64px_1fr] items-center gap-3"><span className="font-semibold text-navy-text">{status}</span><div className="relative"><span className="pointer-events-none absolute left-3 top-2 text-muted-faint">Rp</span><input required disabled={pending} aria-label={`Nominal PTKP ${status}`} type="text" inputMode="numeric" value={draft[status]} onChange={event => { const raw = event.target.value.replace(/\D/g, ""); setDraft(previous => ({ ...previous, [status]: raw ? Number(raw).toLocaleString("id-ID") : "" })); }} className="h-8 w-full rounded-lg border border-border bg-surface-card py-1 pl-9 pr-3 font-mono text-foreground disabled:opacity-60" /></div></label>)}</div>
      <div className="flex justify-end gap-2 border-t border-border pt-3"><button autoFocus type="button" disabled={pending} onClick={onClose} className="rounded-lg border border-border px-3 py-2 font-semibold text-muted-stronger hover:bg-surface-hover">Batal</button><button disabled={pending} type="submit" className="rounded-lg bg-navy px-3 py-2 font-semibold text-white disabled:opacity-50">{pending ? "Menyimpan…" : "Simpan & terapkan"}</button></div>
    </form>
  </dialog>;
}
