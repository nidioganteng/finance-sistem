"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDownLeft, ChevronDown, ChevronRight, Plus, Search, ShieldCheck, Undo2, X } from "lucide-react";
import { saveKasTransitory } from "@/lib/actions/kas-transitory";
import { TRANSITORY_CATEGORIES, type TransitoryData, type TransitoryItem } from "@/lib/kas-transitory";

const rp = (value: number) => `Rp ${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
const date = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const input = "h-9 w-full rounded-lg border border-border bg-surface-card px-3 text-xs text-foreground disabled:opacity-50";
const buttonBase = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold disabled:opacity-50";
const button = `${buttonBase} text-navy-text hover:bg-surface-hover`;
const primaryButton = `${buttonBase} bg-navy text-white hover:brightness-110`;
const statuses = { HELD: "Ditahan", OVERDUE: "Lewat target", RELEASED: "Diserahkan", REVERSED: "Dibatalkan" };
type DialogState = { action: "hold" | "release" | "reversal"; item?: TransitoryItem; requestId: string };

export function KasTransitoryClient({ data, canReverse }: { data: TransitoryData; canReverse: boolean }) {
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("ALL"); const [expanded, setExpanded] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null); const [success, setSuccess] = useState("");
  const filtered = data.items.filter(item => (status === "ALL" || item.status === status || status === "UNBALANCED" && !item.balanced) && `${item.recipient} ${item.projectCode || ""} ${item.projectName || ""} ${item.sourceNoBukti} ${item.location} ${item.reason}`.toLowerCase().includes(search.toLowerCase()));
  function open(action: DialogState["action"], item?: TransitoryItem) { setSuccess(""); setDialog({ action, item, requestId: crypto.randomUUID() }); }
  return <div className="mt-5 space-y-4">
    <div className="flex items-start gap-2 rounded-xl border border-border bg-surface-subtle px-4 py-3 text-xs leading-relaxed text-muted-strong"><ShieldCheck className="mt-0.5 shrink-0 text-status-green" size={17} /><p>Dana ditahan khusus untuk penerima yang tercatat dan tidak tersedia untuk operasional. Cash out sudah mengurangi kas utama. Penyerahan dana tidak memotong kas utama atau mencatat beban lagi.</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Saldo ditahan", rp(data.summary.held)], ["Sudah diserahkan", rp(data.summary.released)], ["Dikembalikan ke kas utama", rp(data.summary.reversed)], ["Lewat target", `${data.summary.overdue} dana`]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-surface-card px-4 py-3"><p className="text-[11px] text-muted">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-navy-text">{value}</p></div>)}</div>
    {success && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-2 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{success}</p>}
    <div className="overflow-hidden rounded-xl border border-border bg-surface-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
        <div><h2 className="text-sm font-semibold text-navy-text">Dana ditahan</h2><p className={`mt-0.5 text-[11px] ${data.summary.unbalanced ? "text-status-red" : "text-muted"}`}>{data.summary.unbalanced ? `${data.summary.unbalanced} Unbalanced — periksa sumber cash out/payroll` : "Balance Check: sumber cash out dan rincian saldo sesuai"}</p></div>
        <div className="flex flex-wrap gap-2"><div className="relative"><Search size={14} className="absolute left-2.5 top-2.5 text-muted" /><input aria-label="Cari dana ditahan" className={`${input} !w-56 !pl-8`} placeholder="Nama, proyek, atau bukti…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <select aria-label="Status dana" className={`${input} !w-auto`} value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">Semua status</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="UNBALANCED">Unbalanced</option></select>
          <button className={`${primaryButton} !h-9`} onClick={() => open("hold")}><Plus size={14} />Tambah dana ditahan</button>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-xs"><thead className="bg-surface-subtle text-muted"><tr>{["Penerima / tujuan", "Cash out / proyek", "Posisi uang", "Target", "Saldo ditahan", "Status / balance", "Tindak lanjut"].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody>
        {filtered.map(item => <TransitoryRow key={item.id} item={item} expanded={expanded === item.id} onExpand={() => setExpanded(expanded === item.id ? null : item.id)} canReverse={canReverse} onAction={action => open(action, item)} />)}
        {!filtered.length && <tr><td colSpan={7} className="p-8 text-center text-muted">{data.items.length ? "Tidak ada dana yang cocok dengan pencarian." : "Belum ada dana ditahan. Catat cash out di kas/bank terlebih dahulu, lalu tambahkan di sini."}</td></tr>}
      </tbody></table></div>
      <div className="border-t border-border px-3 py-2 text-[11px] text-muted">{filtered.length} dari {data.items.length} dana · Ringkasan mencakup seluruh status pada entitas ini, termasuk periode sebelumnya.</div>
    </div>
    {dialog && <TransitoryDialog key={dialog.requestId} state={dialog} data={data} onClose={() => setDialog(null)} onSaved={() => { setSuccess(dialog.action === "hold" ? "Dana ditahan berhasil dicatat." : dialog.action === "release" ? "Penyerahan dana berhasil dicatat tanpa pengeluaran ganda." : "Reversal berhasil dicatat. Saldo kas dan koreksi biaya mengikuti bukti reversal."); setDialog(null); }} />}
  </div>;
}

function TransitoryRow({ item, expanded, onExpand, canReverse, onAction }: { item: TransitoryItem; expanded: boolean; onExpand: () => void; canReverse: boolean; onAction: (action: "release" | "reversal") => void }) {
  const statusStyle = item.status === "OVERDUE" ? "text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-200" : item.status === "HELD" ? "text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-200" : "text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-200";
  return <>
    <tr className="border-t border-border">
      <td className="px-3 py-3"><button aria-expanded={expanded} onClick={onExpand} className="flex items-center gap-1.5 text-left font-semibold text-navy-text">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{item.recipient}</button><p className="ml-5 mt-1 text-[11px] text-muted">{TRANSITORY_CATEGORIES[item.category]}</p></td>
      <td className="px-3 py-3"><span className="font-medium">{item.sourceNoBukti}</span><p className="mt-1 text-[11px] text-muted">{item.projectCode ? `${item.projectCode} · ${item.projectName}` : "Non-proyek"}</p><p className="mt-1 text-[11px] text-muted">{date(item.sourceDate)}</p></td>
      <td className="max-w-[190px] px-3 py-3"><p className="break-words">{item.location}</p></td><td className="whitespace-nowrap px-3 py-3">{date(item.targetDate)}</td>
      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">{rp(item.remaining)}<p className="mt-1 text-[10px] font-normal text-muted">Awal {rp(item.amount)}</p></td>
      <td className="px-3 py-3"><span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-semibold ${statusStyle}`}>{statuses[item.status]}</span><p className={`mt-1 flex items-center gap-1 text-[10px] ${item.balanced ? "text-muted" : "text-status-red"}`}>{!item.balanced && <AlertTriangle size={11} />}{item.balanced ? "Balance" : "Unbalanced"}</p></td>
      <td className="px-3 py-3">{item.remaining > 0 ? <div className="flex flex-col items-start gap-1.5"><button disabled={!item.balanced} className={button} onClick={() => onAction("release")}><ArrowDownLeft size={13} />Cairkan</button>{canReverse && <button disabled={!item.balanced} className="text-[11px] text-muted-strong underline underline-offset-2 disabled:opacity-40" onClick={() => onAction("reversal")}>Reversal</button>}</div> : <span className="text-muted">Selesai</span>}</td>
    </tr>
    {expanded && <tr className="border-t border-border bg-surface-subtle"><td colSpan={7} className="px-5 py-4"><div className="grid gap-3 md:grid-cols-3"><div><p className="text-[10px] font-semibold uppercase text-muted">Alasan penahanan</p><p className="mt-1 whitespace-pre-wrap break-words">{item.reason}</p></div><div><p className="text-[10px] font-semibold uppercase text-muted">Rekonsiliasi dana</p><p className="mt-1">Awal {rp(item.amount)} − diserahkan {rp(item.released)} − reversal {rp(item.reversed)} = {rp(item.remaining)}</p>{item.payrollId && <p className="mt-1 text-muted">Terhubung ke payroll {item.payrollType === "HONOR" ? "tenaga ahli" : "pegawai tetap"}.</p>}</div><div><p className="text-[10px] font-semibold uppercase text-muted">Balance Check</p><p className={`mt-1 ${!item.balanced ? "text-status-red" : ""}`}>{item.balanced ? "Rincian bukti cash out tetap sesuai dan alokasi tidak melebihi nominal sumber." : item.balanceIssue}</p></div></div>
      <h3 className="mb-2 mt-4 font-semibold">Riwayat penyerahan / reversal</h3>{!item.events.length ? <p className="text-muted">Belum ada penyerahan dana.</p> : <div className="space-y-2">{item.events.map(event => <div key={event.id} className="rounded-lg border border-border bg-surface-card px-3 py-2"><div className="flex flex-wrap gap-x-4 gap-y-1"><span className="font-semibold">{event.kind === "RELEASE" ? "Penyerahan" : "Reversal"} · {rp(event.amount)}</span><span>{date(event.eventDate)}</span><span>Bukti: {event.receipt}</span></div><p className="mt-1 whitespace-pre-wrap break-words text-muted-strong">{event.note}</p>{event.reversalNoBukti && <p className="mt-1 break-all text-muted">Bukti koreksi kas/jurnal: {event.reversalNoBukti}</p>}</div>)}</div>}
    </td></tr>}
  </>;
}

function MoneyInput({ name, initial = "", max, label }: { name: string; initial?: string; max?: number; label: string }) {
  const [value, setValue] = useState(initial);
  return <><input required aria-label={label} className={`${input} font-mono`} inputMode="numeric" value={value ? Number(value).toLocaleString("id-ID") : ""} onChange={event => setValue(event.target.value.replace(/\D/g, "").slice(0, 12))} /><input type="hidden" name={name} value={value} />{max !== undefined && <p className="mt-1 text-[10px] text-muted">Maksimal {rp(max)}</p>}</>;
}

function TransitoryDialog({ state, data, onClose, onSaved }: { state: DialogState; data: TransitoryData; onClose: () => void; onSaved: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const router = useRouter(); const [pending, start] = useTransition(); const [error, setError] = useState("");
  const [sourceId, setSourceId] = useState(""); const [category, setCategory] = useState("GAJI_HOLD"); const [payrollKey, setPayrollKey] = useState("");
  useEffect(() => { ref.current?.showModal(); }, []);
  const hold = state.action === "hold"; const reversal = state.action === "reversal"; const source = data.sources.find(item => item.id === sourceId);
  const payroll = data.payroll.find(item => `${item.type}:${item.id}` === payrollKey);
  const title = hold ? "Tambah dana ditahan" : reversal ? "Reversal dana ditahan" : "Penyerahan dana";
  return <dialog ref={ref} onClose={onClose} onCancel={event => { if (pending) event.preventDefault(); }} aria-labelledby="transitory-dialog-title" className="fixed inset-auto left-1/2 top-1/2 !m-0 max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface-card p-0 text-foreground shadow-2xl backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm">
    <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 id="transitory-dialog-title" className="text-sm font-bold">{title}</h2><button type="button" disabled={pending} aria-label="Tutup" onClick={onClose}><X size={16} /></button></div>
    <form className="space-y-3 p-5 text-xs" onSubmit={event => {
      event.preventDefault(); setError(""); const form = new FormData(event.currentTarget); const body: Record<string, unknown> = Object.fromEntries(form.entries());
      body.amount = Number(body.amount); body.requestId = state.requestId;
      if (!Number.isFinite(body.amount) || Number(body.amount) <= 0) { setError("Nominal wajib lebih dari nol."); return; }
      if (hold) { body.sourceTransactionId = sourceId; body.category = category; if (category === "GAJI_HOLD" && payroll) { body.payrollId = payroll.id; body.payrollType = payroll.type; } }
      else body.revision = state.item!.revision;
      start(async () => { try { await saveKasTransitory(state.action, state.item?.id || "", body); router.refresh(); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan."); } });
    }}>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
      {hold ? <>
        <label className="block space-y-1"><span>Cash out asal *</span><select autoFocus required disabled={pending} className={input} value={sourceId} onChange={event => setSourceId(event.target.value)}><option value="">Pilih bukti kas/bank…</option>{data.sources.map(item => <option key={item.id} value={item.id}>{item.noBukti} · {date(item.date)} · sisa {rp(item.available)} · {item.description}</option>)}</select></label>
        {!data.sources.length && <p className="text-status-amber">Belum ada cash out yang dapat dialokasikan. Catat pembayaran di kas/bank atau Entry Jurnal terlebih dahulu. Transfer internal/crossing tidak dipakai sebagai sumber.</p>}
        {source && <div className="rounded-lg bg-surface-subtle p-3 leading-relaxed text-muted-strong">{source.description}<br />{source.projectCode ? `${source.projectCode} · ${source.projectName}` : "Non-proyek"} · Cash out {rp(source.amount)} · Tersedia untuk hold {rp(source.available)}</div>}
        <label className="block space-y-1"><span>Kategori dana *</span><select disabled={pending} className={input} value={category} onChange={event => { setCategory(event.target.value); setPayrollKey(""); }}>{Object.entries(TRANSITORY_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {category === "GAJI_HOLD" && <label className="block space-y-1"><span>Hubungkan payroll (opsional)</span><select disabled={pending} className={input} value={payrollKey} onChange={event => setPayrollKey(event.target.value)}><option value="">Tanpa tautan payroll</option>{data.payroll.map(item => <option key={`${item.type}:${item.id}`} value={`${item.type}:${item.id}`}>{item.name} · {item.month}/{item.year} · {rp(item.amount)}</option>)}</select><p className="text-[10px] text-muted">Tautan ini memeriksa nominal hold terhadap gaji yang sudah tercatat.</p></label>}
        <label className="block space-y-1"><span>Nama penerima hak *</span><input key={payrollKey} defaultValue={payroll?.name || ""} required maxLength={255} disabled={pending} name="recipient" className={input} /></label>
        <label className="block space-y-1"><span>Nominal ditahan (Rp) *</span><MoneyInput name="amount" label="Nominal ditahan" max={source?.available} /></label>
        <label className="block space-y-1"><span>Posisi fisik uang *</span><input required disabled={pending} maxLength={500} name="location" className={input} placeholder="Contoh: Brankas Keuangan lantai 2 / rekening penampungan" /></label>
        <label className="block space-y-1"><span>Alasan penahanan / tujuan pembayaran *</span><textarea required disabled={pending} maxLength={1000} name="reason" className={`${input} !h-20 py-2`} placeholder="Jelaskan tujuan pembayaran dan alasan dana belum diserahkan." /></label>
        <label className="block space-y-1"><span>Target tanggal penyerahan *</span><input required disabled={pending} name="targetDate" type="date" min={source?.date} defaultValue={data.today} className={input} /></label>
      </> : <>
        <div className="rounded-xl border border-border bg-surface-subtle p-3"><p className="font-semibold">{state.item!.recipient}</p><p className="mt-1 text-muted">{state.item!.sourceNoBukti} · {state.item!.projectCode || "Non-proyek"}</p><p className="mt-2 font-semibold">Saldo ditahan {rp(state.item!.remaining)}</p></div>
        <p className="leading-relaxed text-muted-strong">{reversal ? "Reversal mengembalikan sisa dana ke kas utama dan membalik pencatatan asal secara proporsional. Pastikan pembatalan hak pembayaran sudah disetujui. Riwayat tidak dihapus." : "Catat penyerahan kepada penerima yang tertera. Pencairan sebagian diperbolehkan; sisa tetap ditahan. Tidak ada beban atau cash out baru."}</p>
        <label className="block space-y-1"><span>{reversal ? "Nominal dibatalkan" : "Nominal diserahkan"} (Rp) *</span><MoneyInput name="amount" initial={String(state.item!.remaining)} max={state.item!.remaining} label="Nominal penyerahan atau reversal" /></label>
        <label className="block space-y-1"><span>Tanggal {reversal ? "reversal" : "penyerahan"} *</span><input required disabled={pending} type="date" name="eventDate" defaultValue={data.today} min={state.item!.sourceDate} max={data.today} className={input} /></label>
        <label className="block space-y-1"><span>Nomor bukti {reversal ? "pengembalian / persetujuan" : "transfer / tanda terima"} *</span><input required disabled={pending} name="receipt" maxLength={255} className={input} /></label>
        <label className="block space-y-1"><span>{reversal ? "Alasan dan persetujuan pembatalan" : "Catatan akhir / penyerahan"} *</span><textarea required disabled={pending} name="note" maxLength={1000} className={`${input} !h-20 py-2`} /></label>
      </>}
      <div className="flex justify-end gap-2 border-t border-border pt-3"><button type="button" disabled={pending} className={button} onClick={onClose}>Batal</button><button disabled={pending || hold && !source} className={reversal ? `${buttonBase} bg-rose-600 text-white hover:bg-rose-700` : primaryButton} type="submit">{reversal && <Undo2 size={13} />}{pending ? "Menyimpan…" : hold ? "Simpan dana ditahan" : reversal ? "Simpan reversal" : "Catat penyerahan"}</button></div>
    </form>
  </dialog>;
}
