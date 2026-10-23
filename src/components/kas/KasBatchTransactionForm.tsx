"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createKasTransactionBatch, generateNoBukti } from "@/lib/actions/kas";
import { DatePicker } from "@/components/shared/DatePicker";
import { CoaCombobox } from "./CoaCombobox";

type Draft = { id: number; noBukti: string; manualNumber: boolean; projectId: string; keterangan: string; coaAccountId: string; nominal: string };
type Props = {
  entityKey: string;
  jenisInputKey: string;
  pagePath: string;
  coaOptions: { id: string; code: string; name: string }[];
  projectOptions: { id: string; code: string; name: string; entityKey?: string; entityName?: string }[];
  rekeningOptions: { id: string; nama: string }[];
  defaultRekeningId?: string;
  onClose: () => void;
};
const columns = "lg:grid-cols-[8rem_minmax(0,1.5fr)_minmax(0,1.6fr)_minmax(0,1.3fr)_9rem_2rem]";
const input = "w-full min-w-0 rounded-lg border border-border-soft bg-surface-input px-3 py-2.5 text-[12px] text-navy-text placeholder:text-muted focus:outline-none focus:border-brand/60 disabled:opacity-60";
const label = "mb-1 block text-[11px] font-semibold text-muted-stronger lg:sr-only";

export function KasBatchTransactionForm({ entityKey, jenisInputKey, pagePath, coaOptions, projectOptions, rekeningOptions, defaultRekeningId, onClose }: Props) {
  const router = useRouter();
  const sequence = useRef(1);
  const baseNumber = useRef("");
  const savingRef = useRef(false);
  const today = new Date();
  const [tanggal, setTanggal] = useState(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`);
  const [arah, setArah] = useState<"masuk" | "keluar">("keluar");
  const [rekeningId, setRekeningId] = useState(defaultRekeningId ?? rekeningOptions[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Draft[]>([{ id: 1, noBukti: "", manualNumber: false, projectId: "", keterangan: "", coaAccountId: "", nominal: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numberLoading, setNumberLoading] = useState(true);
  const bank = jenisInputKey === "bankBuku";
  const total = drafts.reduce((sum,d) => sum + Number(d.nominal || 0),0);

  useEffect(() => {
    let active = true;
    setNumberLoading(true);
    baseNumber.current = "";
    generateNoBukti(entityKey, tanggal).then((number) => {
      if (!active) return;
      baseNumber.current = number;
      setDrafts((current) => current.map((d) => d.manualNumber ? d : { ...d, noBukti: d.id === 1 ? number : `${number}-${d.id}` }));
    }).catch(() => {
      if (active) setError("Nomor bukti otomatis belum tersedia. Isi nomor bukti secara manual.");
    }).finally(() => { if (active) setNumberLoading(false); });
    return () => { active = false; };
  }, [entityKey, tanggal]);

  function update(id: number, patch: Partial<Draft>) {
    setDrafts((current) => current.map((d) => d.id === id ? { ...d, ...patch } : d));
  }
  function addTransaction() {
    const id = ++sequence.current;
    setDrafts((current) => [...current, { id, noBukti: baseNumber.current ? `${baseNumber.current}-${id}` : "", manualNumber: false, projectId: "", keterangan: "", coaAccountId: "", nominal: "" }]);
  }
  async function save() {
    if (savingRef.current) return;
    setError(null);
    const numbers = new Set<string>();
    for (const [i,d] of drafts.entries()) {
      if (!d.noBukti.trim() || !d.keterangan.trim() || (!d.coaAccountId || Number(d.nominal) <= 0 || !Number.isFinite(Number(d.nominal)))) {
        setError(`Transaksi ${i+1}: lengkapi nomor bukti, keterangan, akun, dan nominal.`); return;
      }
      if (numbers.has(d.noBukti.trim())) { setError(`Nomor bukti ${d.noBukti.trim()} dipakai lebih dari satu transaksi.`); return; }
      numbers.add(d.noBukti.trim());
    }
    if (bank && !rekeningId) { setError("Pilih rekening bank terlebih dahulu."); return; }
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await createKasTransactionBatch(drafts.map((d) => ({
        entityKey, jenisInputKey, pagePath, tanggal, arah,
        noBukti: d.noBukti.trim(), keterangan: d.keterangan.trim(),
        ...(bank ? { rekeningId } : {}),
        ...(d.projectId ? { projectId: d.projectId } : {}),
        ...(coaOptions.some((c) => c.id === d.coaAccountId && ["511", "612"].includes(c.code)) ? { periodeBulanGaji: Number(tanggal.slice(5,7)), periodeTahunGaji: Number(tanggal.slice(0,4)) } : {}),
        rows: [{ coaAccountId: d.coaAccountId, nominal: Number(d.nominal) }],
      })));
      if (result.error) { setError(result.error); return; }
      const params = new URLSearchParams(window.location.search);
      const ym = tanggal.slice(0,7);
      if ((params.get("dari") && tanggal < params.get("dari")!) || (params.get("sampai") && tanggal > params.get("sampai")!)) {
        const [y,m] = ym.split("-").map(Number);
        params.set("dari",`${ym}-01`);
        params.set("sampai",`${ym}-${new Date(y,m,0).getDate()}`);
      }
      if (bank) params.set("rekening",rekeningId);
      router.push(`${pagePath}?${params.toString()}`);
      router.refresh();
      onClose();
    } catch {
      setError("Penyimpanan belum dapat dipastikan. Periksa riwayat transaksi sebelum mencoba lagi dengan nomor bukti yang sama.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[20px] border border-border-soft bg-surface-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft p-5">
        <div><h2 className="text-[15px] font-bold text-navy-text">Transaksi Baru</h2><p className="mt-1 text-xs text-muted">Tambahkan transaksi, lalu simpan sekaligus.</p></div>
        <div className="flex gap-1 rounded-xl bg-surface-hover p-1">
          {(["masuk","keluar"] as const).map((a) => <button key={a} type="button" disabled={saving} onClick={() => setArah(a)} className={`rounded-lg px-4 py-2 text-xs font-bold ${arah === a ? a === "masuk" ? "bg-emerald-500 text-white" : "bg-red-500 text-white" : "text-muted-stronger"}`}>{a === "masuk" ? "Masuk" : "Keluar"}</button>)}
        </div>
      </div>
      <fieldset disabled={saving} className="min-w-0 p-5">
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1.5 block text-xs font-bold text-muted-stronger">Tanggal transaksi</label><DatePicker value={tanggal} onChange={setTanggal} required /></div>
          {bank && <label className="text-xs font-bold text-muted-stronger">Rekening / Bank<select className={`${input} mt-1.5`} value={rekeningId} onChange={(e) => setRekeningId(e.target.value)}>{rekeningOptions.map((r) => <option key={r.id} value={r.id}>{r.nama}</option>)}</select></label>}
        </div>
        <div className="rounded-xl border border-border-soft">
          <div className={`hidden lg:grid ${columns} gap-3 rounded-t-xl border-b border-border-soft bg-surface-subtle px-4 py-3 text-[11px] font-bold uppercase text-muted-stronger`}><span>Nomor Bukti</span><span>Kode Proyek</span><span>Keterangan</span><span>Akun</span><span className="text-right">Nominal (Rp)</span><span /></div>
          {drafts.map((d,i) => <div key={d.id} className={`grid ${columns} grid-cols-1 items-start gap-3 border-b border-border-soft p-4 last:border-b-0`}>
            <label className="min-w-0"><span className={label}>Nomor Bukti · Transaksi {i+1}</span><input aria-label={`Nomor bukti transaksi ${i+1}`} className={`${input} font-mono`} value={d.noBukti} placeholder={numberLoading ? "Menyiapkan nomor…" : "Nomor bukti"} onChange={(e) => update(d.id,{noBukti:e.target.value,manualNumber:true})} /></label>
            <label className="min-w-0"><span className={label}>Kode Proyek</span><select aria-label={`Proyek transaksi ${i+1}`} className={input} value={d.projectId} onChange={(e) => update(d.id,{projectId:e.target.value})}><option value="">Tanpa proyek</option>{projectOptions.map((p) => <option key={p.id} value={p.id}>[{p.code}] {p.name}{p.entityKey && p.entityKey !== entityKey ? ` · ${p.entityName ?? p.entityKey}` : ""}</option>)}</select>
              {d.projectId && <p className="mt-2 whitespace-normal break-words text-[12px] leading-relaxed text-navy-text">{projectOptions.find((p) => p.id === d.projectId)?.name}</p>}
            </label>
            <label className="min-w-0"><span className={label}>Keterangan</span><textarea rows={2} aria-label={`Keterangan transaksi ${i+1}`} className={`${input} resize-y leading-relaxed`} value={d.keterangan} placeholder="Uraian transaksi" onChange={(e) => update(d.id,{keterangan:e.target.value})} /></label>
            <div className="min-w-0"><span className={label}>Akun</span><CoaCombobox value={d.coaAccountId} placeholder="Cari akun…" options={coaOptions} onChange={(coaAccountId) => update(d.id,{coaAccountId})} />
              {d.coaAccountId && <p className="mt-2 whitespace-normal break-words text-[12px] leading-relaxed text-navy-text">{coaOptions.find((c) => c.id === d.coaAccountId)?.name}</p>}
            </div>
            <label className="min-w-0"><span className={label}>Nominal (Rp)</span><input inputMode="numeric" aria-label={`Nominal transaksi ${i+1}`} className={`${input} text-right font-mono tabular-nums`} placeholder="0" value={d.nominal ? Number(d.nominal).toLocaleString("id-ID") : ""} onChange={(e) => update(d.id,{nominal:e.target.value.replace(/[^0-9]/g,"")})} /></label>
            <button type="button" aria-label={`Hapus transaksi ${i+1}`} disabled={drafts.length === 1} className="justify-self-end rounded-lg p-2 text-muted-faint hover:text-status-red disabled:opacity-20" onClick={() => setDrafts((current) => current.filter((r) => r.id !== d.id))}><Trash2 size={15} /></button>
          </div>)}
        </div>
        <button type="button" disabled={drafts.length >= 50} onClick={addTransaction} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border-soft px-4 py-2 text-xs font-bold text-brand disabled:opacity-50"><Plus size={14} />Tambah Transaksi</button>
      </fieldset>
      <div className="rounded-b-[20px] border-t border-border-soft bg-surface-subtle/40 p-5">
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-status-red dark:border-red-500/30 dark:bg-red-500/10">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-4"><div className="text-xs text-muted">{drafts.length} transaksi · Total <strong className="ml-1 text-base tabular-nums text-navy-text">Rp {total.toLocaleString("id-ID")}</strong></div><div className="flex gap-2"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-border-soft px-4 py-2.5 text-xs font-semibold text-muted-stronger">Batal</button><button type="button" disabled={saving || !total} onClick={() => void save()} className="rounded-lg bg-navy px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? "Menyimpan…" : "Simpan Semua"}</button></div></div>
      </div>
    </section>
  );
}
