"use client";

import { useEffect, useRef, useState, useTransition, type InputHTMLAttributes } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Plus, Save, Trash2, UserPlus } from "lucide-react";
import type { RekananTenagaAhliItem, TenagaAhliProjectAssignment } from "@/lib/payroll";
import { saveGajiTenagaAhliKontrakAction } from "@/lib/actions/payroll";
import {
  bulanBerikutnya, bulanDariSpmk, penugasanPadaEntitas, ringkasanGajiTenagaAhli,
  type GajiTenagaAhliBulan, type ReferensiGajiTenagaAhli, type GajiTenagaAhliKontrak,
} from "@/lib/tenaga-ahli-gaji";

const inputClass = "h-8 w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs leading-5 text-foreground disabled:opacity-60";
const buttonClass = "inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 hover:bg-surface-hover";
const rp = (value: number | null | undefined) => value == null ? "Belum tersedia" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const monthLabel = (value: string) => new Date(`${value}-01T12:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
const dateLabel = (value: string | null) => value ? value.split("-").reverse().join("/") : "Belum tersedia";

function formatNominalInput(value: number | null): string {
  return value === null ? "" : value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function parseNominalInput(value: string): number | null {
  return value === "" ? null : Number(value.replace(/\./g, "").replace(",", "."));
}

function RupiahInput({ value, onValueChange, min = 0, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max"> & {
  value: number | null; onValueChange: (value: number | null) => void; min?: number;
}) {
  const [display, setDisplay] = useState(() => formatNominalInput(value));
  useEffect(() => {
    setDisplay(current => parseNominalInput(current) === value ? current : formatNominalInput(value));
  }, [value]);
  return <span className="relative block">
    <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-faint pointer-events-none">Rp</span>
    <input {...props} type="text" inputMode="decimal" className={`${inputClass} !pl-10 font-mono`} value={display}
      onChange={event => {
        const input = event.currentTarget;
        const raw = input.value.replace(/[^0-9,]/g, "");
        const [whole, ...fraction] = raw.split(",");
        const integer = whole.replace(/^0+(?=\d)/, "") || (fraction.length ? "0" : "");
        const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (fraction.length ? `,${fraction.join("").slice(0, 2)}` : "");
        const amount = parseNominalInput(formatted);
        input.setCustomValidity(amount !== null && (amount < min || amount > 999999999999.99) ? `Nominal harus antara ${formatNominalInput(min)} dan 999.999.999.999,99.` : "");
        setDisplay(formatted);
        onValueChange(amount);
      }} onBlur={event => { setDisplay(formatNominalInput(value)); props.onBlur?.(event); }} />
  </span>;
}

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

export function TenagaAhliNegosiasi({ people, entityId, year, month, canEdit, search, onAddManual, onRecord }: {
  people: RekananTenagaAhliItem[];
  entityId?: string;
  year: number;
  month: number;
  canEdit: boolean;
  search: string;
  onAddManual: () => void;
  onRecord: (person: RekananTenagaAhliItem, project: TenagaAhliProjectAssignment, row: GajiTenagaAhliBulan) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [overrides, setOverrides] = useState<Record<string, GajiTenagaAhliKontrak>>({});
  const [listScope, setListScope] = useState<"bulan" | "tahun">("bulan");
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
    return <DetailGaji key={`${personId}:${projectId}`} {...selected} year={year} month={month} canEdit={canEdit} onSaved={onSaved} onBack={() => navigate()} onRecord={row => onRecord(selected.person, selected.project, row)} />;
  }
  const filtered = available.filter(({ person, project }) => `${person.nama} ${person.nik} ${person.kategori} ${project.projectCode} ${project.projectName}`.toLowerCase().includes(search.toLowerCase()));
  const warningCount = available.reduce((sum, { project }) => sum + (project.gajiKontrak?.jadwal?.filter(row => row.catatan.trim() && (listScope === "bulan" ? row.bulan === `${year}-${String(month).padStart(2, "0")}` : row.bulan.startsWith(`${year}-`))).length || 0), 0);
  return <section className="rounded-2xl border border-border bg-surface-card overflow-hidden">
    <div className="p-5 border-b border-border flex flex-wrap gap-4 items-start justify-between">
      <div><h2 className="font-bold text-navy-text">Pengisian Gaji & Negosiasi</h2><p className="text-xs text-muted-faint mt-1">Pilih tenaga ahli, isi gaji negosiasi, lalu kelola gaji bulanan pada halaman pribadinya.</p></div>
      <div className="flex flex-wrap items-center gap-2"><select aria-label="Periode tracking daftar" className={`${inputClass} !w-auto`} value={listScope} onChange={event => setListScope(event.target.value as "bulan" | "tahun")}><option value="bulan">{monthLabel(`${year}-${String(month).padStart(2, "0")}`)}</option><option value="tahun">Tahun {year}</option></select>{canEdit && <button className={buttonClass} onClick={onAddManual}><UserPlus size={14} />Tambah tenaga ahli manual</button>}</div>
    </div>
    {warningCount > 0 && <div role="status" className="m-5 flex gap-2 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 p-3 text-sm"><AlertTriangle size={18} className="shrink-0" />{warningCount} bulan memiliki catatan kendala. Buka rincian tenaga ahli untuk memeriksa alasannya.</div>}
    <div className="overflow-x-auto"><table className="w-full text-sm text-left">
      <thead className="bg-surface-subtle text-xs text-muted-faint"><tr><th className="p-4">Tenaga ahli / data diri</th><th className="p-4">Nama pekerjaan / proyek</th><th className="p-4">Menman / Gaji RAB</th><th className="p-4 min-w-[180px]">Gaji negosiasi</th><th className="p-4">Gaji & pembayaran (bruto)</th><th className="p-4">Tindak lanjut</th></tr></thead>
      <tbody>{filtered.map(({ person, project }) => <NegosiasiRow key={`${person.id}:${project.projectId}`} person={person} project={project} year={year} month={listScope === "bulan" ? month : undefined} canEdit={canEdit} onSaved={onSaved} onNavigate={() => navigate(person, project)} />)}
        {filtered.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-muted-faint">{available.length ? "Tidak ada tenaga ahli yang cocok dengan pencarian." : "Belum ada tenaga ahli pada entitas ini. Tambahkan tenaga ahli secara manual beserta penugasan proyeknya."}</td></tr>}
      </tbody>
    </table></div>
  </section>;
}

function NegosiasiRow({ person, project, year, month, canEdit, onSaved, onNavigate }: {
  person: RekananTenagaAhliItem; project: TenagaAhliProjectAssignment; year: number; month?: number; canEdit: boolean;
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
  const visibleRows = rows.filter(row => month ? row.bulan === `${year}-${String(month).padStart(2, "0")}` : row.bulan.startsWith(`${year}-`));
  const visiblePayments = (person.riwayatGaji || []).filter(payment => payment.tahun === year && (!month || payment.bulan === month));
  const summary = ringkasanGajiTenagaAhli(visibleRows, visiblePayments, project.projectId);
  const notes = visibleRows.filter(row => row.catatan.trim()).length;
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
      <RupiahInput aria-label={`Gaji negosiasi ${person.nama}`} min={0.01} required disabled={pending} placeholder="Isi nominal negosiasi" value={nominal} onValueChange={setNominal} />
      <select aria-label={`Basis negosiasi ${person.nama}`} className={inputClass} value={basis} disabled={pending} onChange={e => setBasis(e.target.value as "BULAN" | "KONTRAK")}><option value="BULAN">Per bulan</option><option value="KONTRAK">Total kontrak</option></select>
      <button disabled={pending} type="submit" className={`${buttonClass} bg-navy text-white hover:bg-navy-light`}><Save size={13} />{pending ? "Menyimpan…" : "Simpan negosiasi"}</button>
    </form> : <div><div className="font-semibold font-mono whitespace-nowrap">{contract?.gajiNegosiasi ? rp(contract.gajiNegosiasi) : "Belum diisi"}</div>{contract?.gajiNegosiasi && <div className="text-xs text-muted-faint">{contract.basisNegosiasi === "BULAN" ? "per bulan" : "total kontrak"}</div>}{canEdit && <button className="text-xs mt-2 underline" onClick={() => { setNominal(contract?.gajiNegosiasi ?? null); setBasis(contract?.basisNegosiasi || "BULAN"); setEditing(true); }}>Ubah negosiasi</button>}</div>}
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
    </td>
    <td className="p-4 text-xs space-y-2"><div><span className="text-muted-faint">Gaji terisi: </span><span className="font-mono whitespace-nowrap">{summary.totalGaji === null ? "Belum diisi" : rp(summary.totalGaji)}</span></div><div><span className="text-muted-faint">Sudah dibayar: </span><span className="font-mono whitespace-nowrap text-emerald-700 dark:text-emerald-300">{rp(summary.dibayar)}</span></div><div><span className="text-muted-faint">Balance gaji terisi: </span><span className={`font-mono whitespace-nowrap ${summary.balance !== null && summary.balance < 0 ? "text-rose-600" : ""}`}>{summary.balance === null ? "Menunggu input gaji" : rp(summary.balance)}</span></div><p className="text-muted-faint">{summary.terisi}/{summary.jumlahBulan} bulan diisi · pembayaran periode dipilih</p>{!summary.lengkap && summary.totalGaji !== null && <p className="text-amber-700">Balance sementara; belum semua bulan diisi</p>}</td>
    <td className="p-4 space-y-2"><button className={buttonClass} disabled={pending || !contract?.gajiNegosiasi} onClick={onNavigate}>Tindak lanjut<ArrowRight size={14} /></button>{canEdit && <button className="block text-xs underline text-muted-faint" disabled={pending} onClick={onNavigate}>Data kontrak</button>}{notes > 0 && <button className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300" onClick={onNavigate}><AlertTriangle size={14} />Ada kendala · {notes} bulan</button>}</td>
  </tr>;
}

function DetailGaji({ person, project, year, month, canEdit, onBack, onRecord, onSaved }: {
  person: RekananTenagaAhliItem; project: TenagaAhliProjectAssignment; year: number; month: number; canEdit: boolean;
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
  const [detailScope, setDetailScope] = useState<"bulan" | "kontrak">("bulan");
  const activePeriod = `${year}-${String(month).padStart(2, "0")}`;
  const visibleRows = detailScope === "kontrak" ? rows : rows.filter(row => row.bulan === activePeriod);
  const visiblePayments = detailScope === "kontrak" ? person.riwayatGaji || [] : (person.riwayatGaji || []).filter(payment => payment.tahun === year && payment.bulan === month);
  const [activeNoteMonth, setActiveNoteMonth] = useState<string | null>(null);
  const noteDialog = useRef<HTMLDialogElement>(null);
  const activeNote = rows.find(row => row.bulan === activeNoteMonth);
  const selectedNewMonth = newMonth || (rows.length ? bulanBerikutnya(rows[rows.length - 1].bulan) : ref.spmkMulai?.slice(0, 7)) || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  useEffect(() => {
    if (activeNoteMonth && noteDialog.current && !noteDialog.current.open) noteDialog.current.showModal();
  }, [activeNoteMonth]);
  const manual = saved?.sumber !== "SIDAMON";
  const ready = (saved?.gajiNegosiasi ?? 0) > 0;
  const noteCount = visibleRows.filter(row => row.catatan.trim()).length;
  const summary = ringkasanGajiTenagaAhli(visibleRows, visiblePayments, project.projectId);
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
    const month = selectedNewMonth;
    if (!/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(month)) { setError("Pilih bulan yang valid (tahun 2000–2199)."); return; }
    if (rows.some(row => row.bulan === month)) { setError("Bulan tersebut sudah ada."); return; }
    if (rows.length >= 600) { setError("Maksimal 600 bulan."); return; }
    setRows([...rows, { bulan: month, nominal: null, catatan: "" }].sort((a, b) => a.bulan.localeCompare(b.bulan))); setNewMonth(""); setDetailScope("kontrak"); changed();
  }
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center gap-3">
      <button className={buttonClass} disabled={pending} onClick={() => { if (!dirty || window.confirm("Ada perubahan belum disimpan. Kembali dan abaikan perubahan?")) onBack(); }}><ArrowLeft size={13} />Daftar tenaga ahli</button>
      <span className="text-xs text-muted-faint">Pengisian Gaji & Negosiasi / Tindak lanjut</span>
    </div>
    <header className="rounded-xl border border-border bg-surface-card px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="text-base font-bold text-navy-text">{person.nama}</h2><p className="text-xs text-muted-faint">{project.projectCode} · {project.projectName}</p></div>
      <p className="mt-1 text-[11px] text-muted-faint">NIK: {person.nik || "—"} · NPWP: {person.npwp || "—"} · PTKP: {person.ptkp || "—"}</p>
      <dl className="mt-3 grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-3 sm:divide-x sm:divide-border">
        <div><dt className="text-[11px] text-muted-faint">Gaji terisi (bruto)</dt><dd className="mt-0.5 text-base font-bold tabular-nums">{summary.totalGaji === null ? "Belum diisi" : rp(summary.totalGaji)}</dd><p className="mt-0.5 text-[11px] text-muted-faint">{summary.terisi}/{summary.jumlahBulan} bulan diisi</p></div>
        <div className="sm:pl-4"><dt className="text-[11px] text-muted-faint">Sudah dibayar (bruto)</dt><dd className="mt-0.5 text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{rp(summary.dibayar)}</dd><p className="mt-0.5 text-[11px] text-muted-faint">Netto {rp(summary.dibayarNetto)} · {detailScope === "kontrak" ? "seluruh kontrak" : monthLabel(activePeriod)}</p></div>
        <div className="sm:pl-4"><dt title="Gaji terisi dikurangi pembayaran bruto" className="text-[11px] text-muted-faint">Balance gaji terisi</dt><dd className={`mt-0.5 text-base font-bold tabular-nums ${summary.balance !== null && summary.balance < 0 ? "text-rose-600" : ""}`}>{summary.balance === null ? "Menunggu input gaji" : rp(summary.balance)}</dd><p className="mt-0.5 text-[11px] text-muted-faint">{summary.lengkap ? "Semua bulan terisi" : "Sementara · belum semua bulan terisi"}{dirty ? " · Belum disimpan" : ""}</p></div>
      </dl>
    </header>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2 text-xs">{error}{error.includes("Muat ulang") && <button className="ml-2 underline" onClick={() => { if (!dirty || window.confirm("Muat ulang dan abaikan perubahan yang belum tersimpan?")) window.location.reload(); }}>Muat ulang data</button>}</div>}
    {success && <div role="status" className="rounded-lg bg-emerald-50 text-emerald-800 px-3 py-2 text-xs">{success}</div>}
    <details open={!ready} className="rounded-xl border border-border bg-surface-card">
      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-navy-text">
        Kontrak & negosiasi <span className="ml-2 font-normal text-muted-faint">{manual ? "Manual" : "Sidamon"} · {ref.manMonth ?? "—"} MM · RAB {rp(ref.gajiRab)} · Negosiasi {rp(negosiasi)}{basis === "BULAN" ? " / bulan" : " / kontrak"}</span>
      </summary>
      <form onSubmit={event => { event.preventDefault(); save(); }} className="border-t border-border px-4 py-3 space-y-3">
      <fieldset disabled={!canEdit || pending || !manual} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="text-xs space-y-1"><span>Nama pekerjaan</span><input className={inputClass} maxLength={255} value={ref.namaPekerjaan || ""} onChange={e => changeRef("namaPekerjaan", e.target.value || null)} /></label>
        <label className="text-xs space-y-1"><span>Menman (MM)</span><input className={inputClass} type="number" min="0" max="99999999.99" step="0.01" value={ref.manMonth ?? ""} onChange={e => changeRef("manMonth", e.target.value === "" ? null : Number(e.target.value))} /></label>
        <label className="text-xs space-y-1"><span>Gaji RAB (Rp)</span><RupiahInput aria-label="Gaji RAB" value={ref.gajiRab} onValueChange={value => changeRef("gajiRab", value)} /></label>
        <label className="text-xs space-y-1"><span>Mulai SPMK</span><input className={inputClass} type="date" min="2000-01-01" max="2199-12-31" value={ref.spmkMulai || ""} onChange={e => changeRef("spmkMulai", e.target.value || null)} /></label>
        <label className="text-xs space-y-1"><span>Selesai SPMK</span><input className={inputClass} type="date" min="2000-01-01" max="2199-12-31" value={ref.spmkSelesai || ""} onChange={e => changeRef("spmkSelesai", e.target.value || null)} /></label>
      </fieldset>
      <div className="border-t border-border pt-3 grid sm:grid-cols-2 gap-3">
        <label className="text-xs space-y-1"><span className="font-semibold">Gaji negosiasi (Rp)</span><RupiahInput aria-label="Gaji negosiasi" required min={0.01} disabled={!canEdit || pending} value={negosiasi} onValueChange={value => { setNegosiasi(value); changed(); }} /></label>
        <label className="text-xs space-y-1"><span>Basis gaji negosiasi</span><select className={inputClass} disabled={!canEdit || pending} value={basis} onChange={e => { setBasis(e.target.value as "BULAN" | "KONTRAK"); changed(); }}><option value="BULAN">Per bulan</option><option value="KONTRAK">Total kontrak</option></select></label>
      </div>
      {!ready && <p className="text-xs text-muted-faint">{rows.length} bulan mengikuti SPMK. Nominal bulanan tetap kosong dan diisi manual setelah negosiasi disimpan. Isi periode mulai dan selesai agar daftar bulan terbentuk.</p>}
      {canEdit && <button className={`${buttonClass} bg-navy text-white hover:bg-navy-light`} disabled={pending} type="submit"><Save size={14} />{pending ? "Menyimpan…" : ready ? "Simpan perubahan" : "Simpan negosiasi & lanjut"}</button>}
      </form>
    </details>
    {(ready || !canEdit) && <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div><h3 className="text-sm font-semibold text-navy-text">Gaji per bulan <span className="ml-2 text-[11px] font-normal text-muted-faint">SPMK {dateLabel(ref.spmkMulai)} – {dateLabel(ref.spmkSelesai)}</span></h3></div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Periode tracking gaji" value={detailScope} onChange={event => { setDetailScope(event.target.value as "bulan" | "kontrak"); setOnlyNotes(false); }} className={`${inputClass} !w-auto`}><option value="bulan">{monthLabel(activePeriod)}</option><option value="kontrak">Semua bulan kontrak</option></select>
          {noteCount > 0 && <button onClick={() => setOnlyNotes(!onlyNotes)} className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" aria-pressed={onlyNotes}><AlertTriangle size={13} />{noteCount} kendala · {onlyNotes ? "Semua bulan" : "Filter catatan"}</button>}
          {canEdit && <>
            <select aria-label="Bulan tambahan" disabled={pending} value={selectedNewMonth.slice(5, 7)} onChange={event => setNewMonth(`${selectedNewMonth.slice(0, 4)}-${event.target.value}`)} className={`${inputClass} !w-auto`}>
              {Array.from({ length: 12 }, (_, index) => <option key={index} value={String(index + 1).padStart(2, "0")}>{new Date(2026, index, 1).toLocaleDateString("id-ID", { month: "long" })}</option>)}
            </select>
            <select aria-label="Tahun tambahan" disabled={pending} value={selectedNewMonth.slice(0, 4)} onChange={event => setNewMonth(`${event.target.value}-${selectedNewMonth.slice(5, 7)}`)} className={`${inputClass} !w-auto`}>
              {Array.from({ length: 200 }, (_, index) => <option key={index} value={2000 + index}>{2000 + index}</option>)}
            </select>
            <button disabled={pending} className={buttonClass} onClick={addMonth}><Plus size={13} />Tambah bulan</button>
          </>}
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-xs text-left"><thead className="bg-surface-subtle text-xs text-muted-faint"><tr><th className="px-3 py-2">Bulan</th><th className="px-3 py-2 min-w-[170px]">Gaji (Rp)</th><th className="px-3 py-2 min-w-[220px]">Catatan kendala</th><th className="px-3 py-2">Pembayaran</th>{canEdit && <th className="px-3 py-2"><span className="sr-only">Kurangi bulan</span></th>}</tr></thead><tbody>
        {visibleRows.filter(row => !onlyNotes || row.catatan.trim()).map(row => {
          const history = person.riwayatGaji?.filter(item => item.projectId === project.projectId && `${item.tahun}-${String(item.bulan).padStart(2, "0")}` === row.bulan) || [];
          const paid = history.reduce((sum, item) => sum + item.nominalHonor, 0);
          const remaining = row.nominal === null ? null : row.nominal - paid;
          return <tr key={row.bulan} className={`border-t border-border ${row.catatan.trim() ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}>
            <td className="px-3 py-2 align-middle font-semibold whitespace-nowrap">{monthLabel(row.bulan)}{(ref.spmkMulai && row.bulan < ref.spmkMulai.slice(0, 7)) || (ref.spmkSelesai && row.bulan > ref.spmkSelesai.slice(0, 7)) ? <div className="text-xs text-muted-faint font-normal mt-1">Di luar periode SPMK</div> : null}</td>
            <td className="px-3 py-2 align-middle"><RupiahInput aria-label={`Gaji ${monthLabel(row.bulan)}`} disabled={!canEdit || pending} placeholder="Belum diisi" value={row.nominal} onValueChange={value => { setRows(rows.map(item => item.bulan === row.bulan ? { ...item, nominal: value } : item)); changed(); }} /></td>
            <td className="px-3 py-2 align-middle"><div className="relative">
              <textarea aria-label={`Catatan kendala ${monthLabel(row.bulan)}`} className={`${inputClass} block resize-none overflow-hidden !py-1 !pr-9`} rows={1} maxLength={1000} disabled={!canEdit || pending} placeholder="Catatan kendala…" value={row.catatan} onChange={e => { setRows(rows.map(item => item.bulan === row.bulan ? { ...item, catatan: e.target.value } : item)); changed(); }} />
              {row.catatan.trim() && <button type="button" className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-r-lg text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950/50" aria-label={`Ada kendala ${monthLabel(row.bulan)}: lihat catatan lengkap`} title="Ada kendala · lihat catatan lengkap" onClick={() => setActiveNoteMonth(row.bulan)}><AlertTriangle size={14} /></button>}
            </div></td>
            <td className="px-3 py-2 align-middle text-xs"><div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
              <span className={history.length ? "font-medium tabular-nums text-emerald-700 dark:text-emerald-300" : "text-muted-faint"}>{history.length ? `${rp(paid)} dibayar` : "Belum dibayar"}</span>
              {canEdit && remaining !== null && remaining > 0 && <button className={buttonClass} disabled={pending || dirty} title={dirty ? "Simpan perubahan terlebih dahulu" : "Buka form pembayaran dan pajak"} onClick={() => onRecord({ ...row, nominal: remaining })}>{history.length ? "Catat sisa pembayaran" : "Catat pembayaran"}</button>}
            </div>{history.length > 0 && remaining !== null && <div className={`mt-0.5 text-[11px] ${remaining < 0 ? "text-rose-600" : "text-muted-faint"}`}>Sisa {rp(remaining)}</div>}</td>
            {canEdit && <td className="px-3 py-2 align-middle"><button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-faint hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40" disabled={pending || history.length > 0} title={history.length ? "Bulan dengan riwayat pembayaran tidak dapat dihapus dari jadwal" : `Hapus ${monthLabel(row.bulan)}`} aria-label={`Hapus ${monthLabel(row.bulan)}`} onClick={() => { if (window.confirm(`Hapus ${monthLabel(row.bulan)} dari jadwal?${row.nominal !== null || row.catatan ? " Nominal dan catatan bulan ini akan dihapus saat disimpan." : ""}`)) { setRows(rows.filter(item => item.bulan !== row.bulan)); changed(); } }}><Trash2 size={14} /></button></td>}
          </tr>;
        })}
        {visibleRows.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="p-6 text-muted-faint text-center">Belum ada jadwal untuk {monthLabel(activePeriod)}. Pilih Semua bulan kontrak atau tambahkan bulan.</td></tr>}
      </tbody></table></div>
      <div className="px-3 py-2 border-t border-border flex flex-wrap justify-between gap-2 items-center"><p className="text-[11px] text-muted-faint">{visibleRows.length} bulan ditampilkan · Total gaji terisi periode ini: {rp(summary.totalGaji)}{dirty && <span className="ml-2 text-amber-700">· Belum disimpan</span>}</p>{canEdit && <button className={`${buttonClass} bg-navy text-white hover:bg-navy-light`} disabled={pending || !dirty} onClick={save}><Save size={14} />{pending ? "Menyimpan…" : "Simpan gaji bulanan"}</button>}</div>
    </div>}
    <dialog ref={noteDialog} onClose={() => setActiveNoteMonth(null)} aria-labelledby="salary-note-title" className="m-auto w-full max-w-md rounded-xl border border-border bg-surface-card p-0 text-foreground shadow-xl backdrop:bg-slate-900/40">
      {activeNote && <>
        <div className="flex items-center justify-between border-b border-border px-4 py-3"><h3 id="salary-note-title" className="text-sm font-semibold">Catatan kendala · {monthLabel(activeNote.bulan)}</h3><button type="button" className={buttonClass} onClick={() => noteDialog.current?.close()}>Tutup</button></div>
        <div className="space-y-2 p-4"><textarea aria-label="Catatan kendala lengkap" className="w-full resize-y rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground" rows={5} maxLength={1000} disabled={!canEdit || pending} value={activeNote.catatan} onChange={event => { setRows(rows.map(row => row.bulan === activeNote.bulan ? { ...row, catatan: event.target.value } : row)); changed(); }} />{canEdit && <p className="text-xs text-muted-faint">Simpan gaji bulanan setelah selesai mengubah catatan.</p>}</div>
      </>}
    </dialog>
  </section>;
}
