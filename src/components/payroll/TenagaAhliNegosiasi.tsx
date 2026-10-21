"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Plus, Save, Trash2, UserPlus } from "lucide-react";
import type { RekananTenagaAhliItem, TenagaAhliProjectAssignment } from "@/lib/payroll";
import { saveGajiTenagaAhliKontrakAction } from "@/lib/actions/payroll";
import {
  bulanBerikutnya, bulanDariSpmk, penugasanPadaEntitas, ringkasanGajiTenagaAhli,
  type GajiTenagaAhliBulan, type ReferensiGajiTenagaAhli, type GajiTenagaAhliKontrak,
} from "@/lib/tenaga-ahli-gaji";

const inputClass = "w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground disabled:opacity-60";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50 hover:bg-surface-hover";
const rp = (value: number | null | undefined) => value == null ? "Belum tersedia" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const monthLabel = (value: string) => new Date(`${value}-01T12:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
const dateLabel = (value: string | null) => value ? value.split("-").reverse().join("/") : "Belum tersedia";

function assignments(person: RekananTenagaAhliItem): TenagaAhliProjectAssignment[] {
  if (person.proyekList?.length) return person.proyekList;
  return person.projectId ? [{ projectId: person.projectId, projectCode: person.projectCode, projectName: person.projectName,
    projectEntityId: person.projectEntityId || person.entityId, tanggalMulaiTugas: person.tanggalMulaiTugas,
    tanggalSelesaiTugas: person.tanggalSelesaiTugas, nominalHonorBulanan: person.nominalHonorBulanan || 0, isTurunLapangan: person.isTurunLapangan ?? true }] : [];
}

function referensiPenugasan(person: RekananTenagaAhliItem, project: TenagaAhliProjectAssignment): ReferensiGajiTenagaAhli {
  const contract = project.gajiKontrak;
  return {
    namaPekerjaan: contract?.namaPekerjaan ?? person.kategori ?? project.projectName ?? null,
    manMonth: contract?.manMonth ?? null,
    gajiRab: contract?.gajiRab ?? (project.nominalHonorBulanan || null),
    spmkMulai: contract?.spmkMulai ?? project.spmkMulai ?? project.tanggalMulaiTugas?.slice(0, 10) ?? null,
    spmkSelesai: contract?.spmkSelesai ?? project.spmkSelesai ?? project.tanggalSelesaiTugas?.slice(0, 10) ?? null,
  };
}

function jadwalPenugasan(person: RekananTenagaAhliItem, project: TenagaAhliProjectAssignment) {
  const ref = referensiPenugasan(person, project);
  const rows = project.gajiKontrak?.jadwal ?? bulanDariSpmk(ref.spmkMulai, ref.spmkSelesai);
  const byMonth = new Map(rows.map(row => [row.bulan, row]));
  for (const item of person.riwayatGaji || []) {
    if (item.projectId !== project.projectId) continue;
    const month = `${item.tahun}-${String(item.bulan).padStart(2, "0")}`;
    if (!byMonth.has(month)) byMonth.set(month, { bulan: month, nominal: null, catatan: "" });
  }
  return [...byMonth.values()].sort((a, b) => a.bulan.localeCompare(b.bulan));
}

export function TenagaAhliNegosiasi({ people, entityId, canEdit, search, onAddManual, onRecord }: {
  people: RekananTenagaAhliItem[];
  entityId?: string;
  canEdit: boolean;
  search: string;
  onAddManual: () => void;
  onRecord: (person: RekananTenagaAhliItem, project: TenagaAhliProjectAssignment, row: GajiTenagaAhliBulan) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [overrides, setOverrides] = useState<Record<string, GajiTenagaAhliKontrak>>({});
  function onSaved(contract: GajiTenagaAhliKontrak) {
    setOverrides(previous => ({ ...previous, [`${contract.rekananId}:${contract.projectId}`]: contract }));
  }
  const personId = params.get("ahliId");
  const projectId = params.get("proyekAhliId");
  const available = people.flatMap(person => assignments(person)
    .filter(project => penugasanPadaEntitas(person, project, entityId))
    .map(project => ({ person, project: { ...project, gajiKontrak: overrides[`${person.id}:${project.projectId}`] ?? project.gajiKontrak } })));

  const selected = available.find(item => item.person.id === personId && item.project.projectId === projectId);
  function navigate(person?: RekananTenagaAhliItem, project?: TenagaAhliProjectAssignment) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", "tenaga-ahli");
    if (person && project) { next.set("ahliId", person.id); next.set("proyekAhliId", project.projectId); }
    else { next.delete("ahliId"); next.delete("proyekAhliId"); }
    router.push(`${pathname}?${next}`, { scroll: false });
  }
  if (personId) {
    if (!selected) return <div className="rounded-xl border border-border bg-surface-card p-6 space-y-3"><p>Penugasan tenaga ahli tidak ditemukan pada entitas ini.</p><button className={buttonClass} onClick={() => navigate()}>Kembali ke daftar</button></div>;
    return <DetailGaji key={`${personId}:${projectId}`} {...selected} canEdit={canEdit} onSaved={onSaved} onBack={() => navigate()} onRecord={row => onRecord(selected.person, selected.project, row)} />;
  }
  const filtered = available.filter(({ person, project }) => `${person.nama} ${person.nik} ${person.kategori} ${project.projectCode} ${project.projectName}`.toLowerCase().includes(search.toLowerCase()));
  const warningCount = available.reduce((sum, { project }) => sum + (project.gajiKontrak?.jadwal?.filter(row => row.catatan.trim()).length || 0), 0);
  return <section className="rounded-2xl border border-border bg-surface-card overflow-hidden">
    <div className="p-5 border-b border-border flex flex-wrap gap-4 items-start justify-between">
      <div><h2 className="font-bold text-navy-text">Pengisian Gaji & Negosiasi</h2><p className="text-xs text-muted-faint mt-1">Pilih tenaga ahli, isi gaji negosiasi, lalu kelola gaji bulanan pada halaman pribadinya.</p></div>
      {canEdit && <button className={buttonClass} onClick={onAddManual}><UserPlus size={14} />Tambah tenaga ahli manual</button>}
    </div>
    {warningCount > 0 && <div role="status" className="m-5 flex gap-2 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 p-3 text-sm"><AlertTriangle size={18} className="shrink-0" />{warningCount} bulan memiliki catatan kendala. Buka rincian tenaga ahli untuk memeriksa alasannya.</div>}
    <div className="overflow-x-auto"><table className="w-full text-sm text-left">
      <thead className="bg-surface-subtle text-xs text-muted-faint"><tr><th className="p-4">Tenaga ahli / data diri</th><th className="p-4">Nama pekerjaan / proyek</th><th className="p-4">Menman / Gaji RAB</th><th className="p-4 min-w-[180px]">Gaji negosiasi</th><th className="p-4">Gaji & pembayaran (bruto)</th><th className="p-4">Tindak lanjut</th></tr></thead>
      <tbody>{filtered.map(({ person, project }) => <NegosiasiRow key={`${person.id}:${project.projectId}`} person={person} project={project} canEdit={canEdit} onSaved={onSaved} onNavigate={() => navigate(person, project)} />)}
        {filtered.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-muted-faint">{available.length ? "Tidak ada tenaga ahli yang cocok dengan pencarian." : "Belum ada tenaga ahli pada entitas ini. Tambahkan tenaga ahli secara manual beserta penugasan proyeknya."}</td></tr>}
      </tbody>
    </table></div>
  </section>;
}

function NegosiasiRow({ person, project, canEdit, onSaved, onNavigate }: {
  person: RekananTenagaAhliItem; project: TenagaAhliProjectAssignment; canEdit: boolean;
  onSaved: (contract: GajiTenagaAhliKontrak) => void; onNavigate: () => void;
}) {
  const router = useRouter();
  const contract = project.gajiKontrak;
  const ref = referensiPenugasan(person, project);
  const [editing, setEditing] = useState(!contract?.gajiNegosiasi);
  const [nominal, setNominal] = useState<number | null>(contract?.gajiNegosiasi ?? null);
  const [basis, setBasis] = useState<"BULAN" | "KONTRAK">(contract?.basisNegosiasi ?? "BULAN");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const rows = jadwalPenugasan(person, project);
  const summary = ringkasanGajiTenagaAhli(rows, person.riwayatGaji || [], project.projectId);
  const notes = rows.filter(row => row.catatan.trim()).length;
  function save() {
    setError("");
    if (!nominal || nominal <= 0) { setError("Isi gaji negosiasi lebih dari nol."); return; }
    if (!rows.length) { setError("Lengkapi tanggal kontrak terlebih dahulu."); return; }
    startTransition(async () => {
      try {
        const result = await saveGajiTenagaAhliKontrakAction({ rekananId: person.id, projectId: project.projectId,
          gajiNegosiasi: nominal, basisNegosiasi: basis, referensi: ref, jadwal: rows, revision: contract?.revision ?? 0 });
        onSaved(result.data); setEditing(false); router.refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan negosiasi."); }
    });
  }
  return <tr className="border-t border-border align-top">
    <td className="p-4"><div className="font-semibold text-navy-text">{person.nama}</div><div className="text-xs text-muted-faint mt-1">NIK: {person.nik || "—"}<br />NPWP: {person.npwp || "—"}</div><div className="mt-1 text-xs text-muted-faint">Terdaftar: {person.entityName || "—"}</div></td>
    <td className="p-4"><div className="font-medium">{ref.namaPekerjaan || "Belum diisi"}</div><div className="text-xs text-muted-faint mt-1">{project.projectCode} · {project.projectName}</div><div className="text-xs mt-1">Entitas proyek: {project.projectEntityName || "—"}</div><span className="text-xs text-muted-faint">{contract?.sumber === "SIDAMON" ? "Sidamon" : "Input manual"}</span></td>
    <td className="p-4 whitespace-nowrap"><div>{ref.manMonth === null ? "Menman belum diisi" : `${ref.manMonth} MM`}</div><div className="font-mono mt-2">{rp(ref.gajiRab)}</div><div className="text-xs text-muted-faint">Gaji RAB</div></td>
    <td className="p-4">{canEdit && editing ? <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-2">
      <input aria-label={`Gaji negosiasi ${person.nama}`} className={inputClass} type="number" min="0.01" max="999999999999.99" step="0.01" required disabled={pending} placeholder="Isi nominal negosiasi" value={nominal ?? ""} onChange={e => setNominal(e.target.value === "" ? null : Number(e.target.value))} />
      <select aria-label={`Basis negosiasi ${person.nama}`} className={inputClass} value={basis} disabled={pending} onChange={e => setBasis(e.target.value as "BULAN" | "KONTRAK")}><option value="BULAN">Per bulan</option><option value="KONTRAK">Total kontrak</option></select>
      <button disabled={pending} type="submit" className={`${buttonClass} bg-navy text-white hover:bg-navy-light`}><Save size={13} />{pending ? "Menyimpan…" : "Simpan negosiasi"}</button>
    </form> : <div><div className="font-semibold font-mono whitespace-nowrap">{contract?.gajiNegosiasi ? rp(contract.gajiNegosiasi) : "Belum diisi"}</div>{contract?.gajiNegosiasi && <div className="text-xs text-muted-faint">{contract.basisNegosiasi === "BULAN" ? "per bulan" : "total kontrak"}</div>}{canEdit && <button className="text-xs mt-2 underline" onClick={() => { setNominal(contract?.gajiNegosiasi ?? null); setBasis(contract?.basisNegosiasi || "BULAN"); setEditing(true); }}>Ubah negosiasi</button>}</div>}
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
    </td>
    <td className="p-4 text-xs space-y-2"><div><span className="text-muted-faint">Gaji terisi: </span><span className="font-mono whitespace-nowrap">{summary.totalGaji === null ? "Belum diisi" : rp(summary.totalGaji)}</span></div><div><span className="text-muted-faint">Sudah dibayar: </span><span className="font-mono whitespace-nowrap text-emerald-700 dark:text-emerald-300">{rp(summary.dibayar)}</span></div><div><span className="text-muted-faint">Balance gaji terisi: </span><span className={`font-mono whitespace-nowrap ${summary.balance !== null && summary.balance < 0 ? "text-rose-600" : ""}`}>{summary.balance === null ? "Menunggu input gaji" : rp(summary.balance)}</span></div><p className="text-muted-faint">{summary.terisi}/{summary.jumlahBulan} bulan diisi · pembayaran seluruh riwayat proyek</p>{!summary.lengkap && summary.totalGaji !== null && <p className="text-amber-700">Balance sementara; belum semua bulan diisi</p>}</td>
    <td className="p-4 space-y-2"><button className={buttonClass} disabled={pending || !contract?.gajiNegosiasi} onClick={onNavigate}>Tindak lanjut<ArrowRight size={14} /></button>{canEdit && <button className="block text-xs underline text-muted-faint" disabled={pending} onClick={onNavigate}>Data kontrak</button>}{notes > 0 && <button className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300" onClick={onNavigate}><AlertTriangle size={14} />Ada kendala · {notes} bulan</button>}</td>
  </tr>;
}

function DetailGaji({ person, project, canEdit, onBack, onRecord, onSaved }: {
  person: RekananTenagaAhliItem; project: TenagaAhliProjectAssignment; canEdit: boolean;
  onBack: () => void; onRecord: (row: GajiTenagaAhliBulan) => void; onSaved: (contract: GajiTenagaAhliKontrak) => void;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(project.gajiKontrak);
  const [ref, setRef] = useState<ReferensiGajiTenagaAhli>(() => referensiPenugasan(person, project));
  const [negosiasi, setNegosiasi] = useState<number | null>(saved?.gajiNegosiasi ?? null);
  const [basis, setBasis] = useState<"BULAN" | "KONTRAK">(saved?.basisNegosiasi ?? "BULAN");
  const [rows, setRows] = useState<GajiTenagaAhliBulan[]>(() => jadwalPenugasan(person, project));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, startTransition] = useTransition();
  const [newMonth, setNewMonth] = useState("");
  const [onlyNotes, setOnlyNotes] = useState(false);
  const manual = saved?.sumber !== "SIDAMON";
  const ready = (saved?.gajiNegosiasi ?? 0) > 0;
  const noteCount = rows.filter(row => row.catatan.trim()).length;
  const summary = ringkasanGajiTenagaAhli(rows, person.riwayatGaji || [], project.projectId);
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) { if (dirty) { event.preventDefault(); event.returnValue = ""; } }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function changed() { setDirty(true); setSuccess(""); setError(""); }
  function changeRef<K extends keyof ReferensiGajiTenagaAhli>(key: K, value: ReferensiGajiTenagaAhli[K]) {
    const next = { ...ref, [key]: value };
    setRef(next);
    if (!ready && (key === "spmkMulai" || key === "spmkSelesai")) setRows(bulanDariSpmk(next.spmkMulai, next.spmkSelesai));
    changed();
  }
  function save() {
    setError(""); setSuccess("");
    if (!negosiasi || negosiasi <= 0) { setError("Isi gaji negosiasi lebih dari nol terlebih dahulu."); return; }
    if (!rows.length) { setError("Isi periode SPMK atau tambahkan minimal satu bulan gaji."); return; }
    startTransition(async () => {
      try {
        const result = await saveGajiTenagaAhliKontrakAction({ rekananId: person.id, projectId: project.projectId,
          gajiNegosiasi: negosiasi, basisNegosiasi: basis, jadwal: rows, referensi: ref, revision: saved?.revision ?? 0 });
        setSaved(result.data); onSaved(result.data); setRows(result.data.jadwal || []); setDirty(false);
        setSuccess(ready ? "Gaji bulanan dan catatan berhasil disimpan." : "Gaji negosiasi disimpan. Silakan isi gaji per bulan di bawah.");
        router.refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan data."); }
    });
  }
  function addMonth() {
    const month = newMonth || (rows.length ? bulanBerikutnya(rows[rows.length - 1].bulan) : ref.spmkMulai?.slice(0, 7) || "");
    if (!/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(month)) { setError("Pilih bulan yang valid (tahun 2000–2199)."); return; }
    if (rows.some(row => row.bulan === month)) { setError("Bulan tersebut sudah ada."); return; }
    if (rows.length >= 600) { setError("Maksimal 600 bulan."); return; }
    setRows([...rows, { bulan: month, nominal: null, catatan: "" }].sort((a, b) => a.bulan.localeCompare(b.bulan))); setNewMonth(""); changed();
  }
  return <section className="space-y-5">
    <button className={buttonClass} disabled={pending} onClick={() => { if (!dirty || window.confirm("Ada perubahan belum disimpan. Kembali dan abaikan perubahan?")) onBack(); }}><ArrowLeft size={14} />Daftar tenaga ahli</button>
    <header className="rounded-2xl border border-border bg-surface-card p-5">
      <p className="text-xs text-muted-faint mb-1">Pengisian Gaji & Negosiasi / Tindak lanjut</p><h2 className="text-lg font-bold text-navy-text">{person.nama}</h2><p className="text-sm text-muted-faint mt-1">{project.projectCode} · {project.projectName}</p><p className="text-xs text-muted-faint mt-2">NIK: {person.nik || "—"} · NPWP: {person.npwp || "—"} · PTKP: {person.ptkp || "—"}</p>
    </header>
    <div className="grid sm:grid-cols-3 gap-3">
      <div className="rounded-xl border border-border bg-surface-card p-4"><p className="text-xs text-muted-faint">Total gaji terisi (bruto)</p><p className="font-bold text-lg mt-2">{summary.totalGaji === null ? "Belum diisi" : rp(summary.totalGaji)}</p><p className="text-xs text-muted-faint mt-1">{summary.terisi}/{summary.jumlahBulan} bulan diisi</p></div>
      <div className="rounded-xl border border-border bg-surface-card p-4"><p className="text-xs text-muted-faint">Sudah dibayar (bruto)</p><p className="font-bold text-lg text-emerald-700 dark:text-emerald-300 mt-2">{rp(summary.dibayar)}</p><p className="text-xs text-muted-faint mt-1">Netto: {rp(summary.dibayarNetto)} · seluruh riwayat proyek</p></div>
      <div className="rounded-xl border border-border bg-surface-card p-4"><p className="text-xs text-muted-faint">Balance = gaji terisi − sudah dibayar</p><p className={`font-bold text-lg mt-2 ${summary.balance !== null && summary.balance < 0 ? "text-rose-600" : ""}`}>{summary.balance === null ? "Menunggu input gaji" : rp(summary.balance)}</p><p className="text-xs text-muted-faint mt-1">{summary.lengkap ? "Semua bulan sudah diisi" : "Balance sementara sampai semua bulan diisi"}{dirty ? " · Perubahan belum disimpan" : ""}</p></div>
    </div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 p-3 text-sm">{error}{error.includes("Muat ulang") && <button className="ml-2 underline" onClick={() => { if (!dirty || window.confirm("Muat ulang dan abaikan perubahan yang belum tersimpan?")) window.location.reload(); }}>Muat ulang data</button>}</div>}
    {success && <div role="status" className="rounded-lg bg-emerald-50 text-emerald-800 p-3 text-sm">{success}</div>}
    <form onSubmit={event => { event.preventDefault(); save(); }} className="rounded-2xl border border-border bg-surface-card p-5 space-y-4">
      <h3 className="font-bold text-navy-text">{manual ? "Referensi kontrak manual" : "Referensi kontrak dari Sidamon"}</h3>
      <p className="text-xs text-muted-faint">{manual ? "Untuk testing sebelum sinkronisasi, isi referensi pekerjaan, RAB, dan SPMK di sini." : "Referensi mengikuti Sidamon. Penyesuaian bulan dan nominal gaji disimpan di Simatra."}</p>
      <fieldset disabled={!canEdit || pending || !manual} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label className="text-xs space-y-1"><span>Nama pekerjaan</span><input className={inputClass} maxLength={255} value={ref.namaPekerjaan || ""} onChange={e => changeRef("namaPekerjaan", e.target.value || null)} /></label>
        <label className="text-xs space-y-1"><span>Menman (MM)</span><input className={inputClass} type="number" min="0" max="99999999.99" step="0.01" value={ref.manMonth ?? ""} onChange={e => changeRef("manMonth", e.target.value === "" ? null : Number(e.target.value))} /></label>
        <label className="text-xs space-y-1"><span>Gaji RAB (Rp)</span><input className={inputClass} type="number" min="0" max="999999999999.99" step="0.01" value={ref.gajiRab ?? ""} onChange={e => changeRef("gajiRab", e.target.value === "" ? null : Number(e.target.value))} /></label>
        <label className="text-xs space-y-1"><span>Mulai SPMK</span><input className={inputClass} type="date" min="2000-01-01" max="2199-12-31" value={ref.spmkMulai || ""} onChange={e => changeRef("spmkMulai", e.target.value || null)} /></label>
        <label className="text-xs space-y-1"><span>Selesai SPMK</span><input className={inputClass} type="date" min="2000-01-01" max="2199-12-31" value={ref.spmkSelesai || ""} onChange={e => changeRef("spmkSelesai", e.target.value || null)} /></label>
      </fieldset>
      <div className="border-t border-border pt-4 grid sm:grid-cols-2 gap-4">
        <label className="text-xs space-y-1"><span className="font-semibold">Gaji negosiasi (Rp)</span><input className={inputClass} required type="number" min="0.01" max="999999999999.99" step="0.01" disabled={!canEdit || pending} value={negosiasi ?? ""} onChange={e => { setNegosiasi(e.target.value === "" ? null : Number(e.target.value)); changed(); }} /></label>
        <label className="text-xs space-y-1"><span>Basis gaji negosiasi</span><select className={inputClass} disabled={!canEdit || pending} value={basis} onChange={e => { setBasis(e.target.value as "BULAN" | "KONTRAK"); changed(); }}><option value="BULAN">Per bulan</option><option value="KONTRAK">Total kontrak</option></select></label>
      </div>
      {!ready && <p className="text-xs text-muted-faint">{rows.length} bulan mengikuti SPMK. Nominal bulanan tetap kosong dan diisi manual setelah negosiasi disimpan. Isi periode mulai dan selesai agar daftar bulan terbentuk.</p>}
      {canEdit && <button className={`${buttonClass} bg-navy text-white hover:bg-navy-light`} disabled={pending} type="submit"><Save size={14} />{pending ? "Menyimpan…" : ready ? "Simpan perubahan" : "Simpan negosiasi & lanjut"}</button>}
    </form>
    {(ready || !canEdit) && <div className="rounded-2xl border border-border bg-surface-card overflow-hidden">
      <div className="p-5 space-y-3 border-b border-border">
        <h3 className="font-bold text-navy-text">Gaji per bulan</h3><p className="text-xs text-muted-faint">Acuan SPMK: {dateLabel(ref.spmkMulai)} – {dateLabel(ref.spmkSelesai)}. Tambah atau kurangi bulan sesuai pekerjaan aktual.</p>
        {noteCount > 0 && <button onClick={() => setOnlyNotes(!onlyNotes)} className="flex items-center gap-2 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 px-3 py-2 text-xs font-semibold" aria-pressed={onlyNotes}><AlertTriangle size={16} />{noteCount} bulan ada kendala · {onlyNotes ? "Tampilkan semua bulan" : "Tampilkan yang ada catatan"}</button>}
        {canEdit && <div className="flex flex-wrap items-center gap-2"><label className="text-xs">Tambah bulan<input aria-label="Bulan tambahan" type="month" min="2000-01" max="2199-12" disabled={pending} value={newMonth} onChange={e => setNewMonth(e.target.value)} className={`${inputClass} ml-2 !w-auto`} /></label><button disabled={pending} className={buttonClass} onClick={addMonth}><Plus size={14} />{newMonth ? "Tambah bulan" : "Tambah bulan berikutnya"}</button></div>}
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-surface-subtle text-xs text-muted-faint"><tr><th className="p-4">Bulan</th><th className="p-4 min-w-[180px]">Gaji (Rp)</th><th className="p-4 min-w-[260px]">Catatan kendala</th><th className="p-4">Pembayaran</th>{canEdit && <th className="p-4">Kurangi bulan</th>}</tr></thead><tbody>
        {rows.filter(row => !onlyNotes || row.catatan.trim()).map(row => {
          const history = person.riwayatGaji?.filter(item => item.projectId === project.projectId && `${item.tahun}-${String(item.bulan).padStart(2, "0")}` === row.bulan) || [];
          const paid = history.reduce((sum, item) => sum + item.nominalHonor, 0);
          const remaining = row.nominal === null ? null : row.nominal - paid;
          return <tr key={row.bulan} className={`border-t border-border ${row.catatan.trim() ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}>
            <td className="p-4 align-top font-semibold whitespace-nowrap">{monthLabel(row.bulan)}{(ref.spmkMulai && row.bulan < ref.spmkMulai.slice(0, 7)) || (ref.spmkSelesai && row.bulan > ref.spmkSelesai.slice(0, 7)) ? <div className="text-xs text-muted-faint font-normal mt-1">Di luar periode SPMK</div> : null}</td>
            <td className="p-4 align-top"><input aria-label={`Gaji ${monthLabel(row.bulan)}`} className={inputClass} type="number" min="0" max="999999999999.99" step="0.01" disabled={!canEdit || pending} placeholder="Belum diisi" value={row.nominal ?? ""} onChange={e => { setRows(rows.map(item => item.bulan === row.bulan ? { ...item, nominal: e.target.value === "" ? null : Number(e.target.value) } : item)); changed(); }} /></td>
            <td className="p-4 align-top"><textarea aria-label={`Catatan kendala ${monthLabel(row.bulan)}`} className={inputClass} rows={2} maxLength={1000} disabled={!canEdit || pending} placeholder="Alasan penyesuaian / kendala gaji…" value={row.catatan} onChange={e => { setRows(rows.map(item => item.bulan === row.bulan ? { ...item, catatan: e.target.value } : item)); changed(); }} />{row.catatan.trim() && <details className="mt-1 text-xs text-amber-800 dark:text-amber-200"><summary className="cursor-pointer font-semibold"><AlertTriangle size={13} className="inline mr-1" />Ada kendala · lihat catatan</summary><p className="mt-2 whitespace-pre-wrap break-words">{row.catatan}</p></details>}</td>
            <td className="p-4 align-top text-xs"><div className="space-y-2">
              {history.length ? <div><span className="text-emerald-700 dark:text-emerald-300">Sudah dibayar / tercatat di payroll</span><div className="mt-1 font-mono">{rp(paid)}</div></div> : <span className="text-muted-faint">Belum ada pembayaran</span>}
              <div className={remaining !== null && remaining < 0 ? "text-rose-600" : "text-muted-faint"}>Balance bulan ini: {remaining === null ? "Menunggu input gaji" : rp(remaining)}</div>
              {canEdit && remaining !== null && remaining > 0 && <button className={buttonClass} disabled={pending || dirty} title={dirty ? "Simpan perubahan terlebih dahulu" : "Buka form pembayaran dan pajak"} onClick={() => onRecord({ ...row, nominal: remaining })}>{history.length ? "Catat sisa pembayaran" : "Catat pembayaran"}</button>}
            </div></td>
            {canEdit && <td className="p-4 align-top"><button className={`${buttonClass} text-rose-600`} disabled={pending || history.length > 0} title={history.length ? "Bulan dengan riwayat pembayaran tidak dapat dihapus dari jadwal" : `Hapus ${monthLabel(row.bulan)}`} aria-label={`Hapus ${monthLabel(row.bulan)}`} onClick={() => { if (window.confirm(`Hapus ${monthLabel(row.bulan)} dari jadwal?${row.nominal !== null || row.catatan ? " Nominal dan catatan bulan ini akan dihapus saat disimpan." : ""}`)) { setRows(rows.filter(item => item.bulan !== row.bulan)); changed(); } }}><Trash2 size={14} /></button></td>}
          </tr>;
        })}
        {rows.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="p-6 text-muted-faint text-center">Belum ada bulan. Tambahkan bulan sesuai periode kerja.</td></tr>}
      </tbody></table></div>
      <div className="p-5 border-t border-border flex flex-wrap justify-between gap-3 items-center"><p className="text-xs text-muted-faint">{rows.length} bulan · Total gaji diisi: {rp(rows.reduce((sum, row) => sum + (row.nominal || 0), 0))}{dirty && <span className="ml-2 text-amber-700">· Belum disimpan</span>}</p>{canEdit && <button className={`${buttonClass} bg-navy text-white hover:bg-navy-light`} disabled={pending || !dirty} onClick={save}><Save size={14} />{pending ? "Menyimpan…" : "Simpan gaji bulanan"}</button>}</div>
      <p className="px-5 pb-5 text-xs text-muted-faint">Input gaji menyimpan jadwal dan catatan. Gunakan “Catat pembayaran” untuk mencatat honor beserta pajaknya ke payroll.</p>
    </div>}
  </section>;
}
