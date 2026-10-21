"use client";

import { useEffect, useRef, useState, useTransition, type InputHTMLAttributes } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Plus, Save, Trash2, UserPlus } from "lucide-react";
import type { RekananTenagaAhliItem, TenagaAhliProjectAssignment } from "@/lib/payroll";
import { saveGajiTenagaAhliKontrakAction } from "@/lib/actions/payroll";
import {
  bulanBerikutnya, bulanDariSpmk, penugasanPadaEntitas, ringkasanGajiTenagaAhli, pphGajiTenagaAhli,
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
  return [...byMonth.values()].map(row => row.pph21 === undefined ? { ...row, pph21: pphGajiTenagaAhli(row, (person.riwayatGaji || []).filter(payment => payment.projectId === project.projectId && `${payment.tahun}-${String(payment.bulan).padStart(2, "0")}` === row.bulan)) } : row).sort((a, b) => a.bulan.localeCompare(b.bulan));
}

export function TenagaAhliNegosiasi({ people, entityId, year, month, canEdit, search, onAddManual }: {
  people: RekananTenagaAhliItem[];
  entityId?: string;
  year: number;
  month: number;
  canEdit: boolean;
  search: string;
  onAddManual: () => void;
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
    return <DetailGaji key={`${personId}:${projectId}`} {...selected} year={year} month={month} canEdit={canEdit} onSaved={onSaved} onBack={() => navigate()} />;
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
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const rows = jadwalPenugasan(person, project);
  const visibleRows = rows.filter(row => month ? row.bulan === `${year}-${String(month).padStart(2, "0")}` : row.bulan.startsWith(`${year}-`));
  const summary = ringkasanGajiTenagaAhli(visibleRows, person.riwayatGaji || [], project.projectId, contract?.gajiNegosiasi ?? null);
  const notes = visibleRows.filter(row => row.catatan.trim()).length;
  function save() {
    setError("");
    if (!nominal || nominal <= 0) { setError("Isi gaji negosiasi lebih dari nol."); return; }
    if (!rows.length) { setError("Lengkapi tanggal kontrak terlebih dahulu."); return; }
    if (rows.reduce((total, row) => total + (row.nominal || 0), 0) > nominal + 0.001) { setError("Total gaji bulanan melebihi total negosiasi kontrak."); return; }
    const missingTax = rows.find(row => (row.nominal || 0) > 0 && row.pph21 == null);
    if (missingTax) { setError(`Isi PPh ${monthLabel(missingTax.bulan)} secara manual (isi 0 bila tanpa potongan).`); return; }
    startTransition(async () => {
      try {
        const result = await saveGajiTenagaAhliKontrakAction({ rekananId: person.id, projectId: project.projectId,
          gajiNegosiasi: nominal, basisNegosiasi: "KONTRAK", referensi: ref, jadwal: rows, revision: contract?.revision ?? 0 });
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
      <p className="text-xs text-muted-faint">Total untuk seluruh kontrak</p>
      <button disabled={pending} type="submit" className={`${buttonClass} bg-navy text-white hover:bg-navy-light`}><Save size={13} />{pending ? "Menyimpan…" : "Simpan negosiasi"}</button>
    </form> : <div><div className="font-semibold font-mono whitespace-nowrap">{contract?.gajiNegosiasi ? rp(contract.gajiNegosiasi) : "Belum diisi"}</div>{contract?.gajiNegosiasi && <div className="text-xs text-muted-faint">total kontrak</div>}{canEdit && <button className="text-xs mt-2 underline" onClick={() => { setNominal(contract?.gajiNegosiasi ?? null); setEditing(true); }}>Ubah negosiasi</button>}</div>}
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
    </td>
    <td className="p-4 text-xs space-y-2"><div><span className="text-muted-faint">Gaji terisi: </span><span className="font-mono whitespace-nowrap">{summary.totalGaji === null ? "Belum diisi" : rp(summary.totalGaji)}</span></div><div><span className="text-muted-faint">Sudah dibayar: </span><span className="font-mono whitespace-nowrap text-emerald-700 dark:text-emerald-300">{rp(summary.dibayar)}</span></div><div><span className="text-muted-faint">Balance negosiasi: </span><span className={`font-mono whitespace-nowrap ${summary.balance !== null && summary.balance < 0 ? "text-rose-600" : ""}`}>{summary.balance === null ? "Menunggu negosiasi" : rp(summary.balance)}</span></div><p className="text-muted-faint">{summary.terisi}/{summary.jumlahBulan} bulan diisi · pembayaran seluruh kontrak</p><p className={summary.lunas ? "text-emerald-700" : "text-amber-700"}>{summary.lunas ? "Balance · total negosiasi terpenuhi" : summary.balance !== null && summary.balance < 0 ? "Melebihi total negosiasi" : "Belum balance"}</p></td>
    <td className="p-4 space-y-2"><button className={buttonClass} disabled={pending || !contract?.gajiNegosiasi} onClick={onNavigate}>Tindak lanjut<ArrowRight size={14} /></button>{canEdit && <button className="block text-xs underline text-muted-faint" disabled={pending} onClick={onNavigate}>Data kontrak</button>}{notes > 0 && <button className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300" onClick={onNavigate}><AlertTriangle size={14} />Ada kendala · {notes} bulan</button>}</td>
  </tr>;
}

function DetailGaji({ person, project, year, month, canEdit, onBack, onSaved }: {
  person: RekananTenagaAhliItem; project: TenagaAhliProjectAssignment; year: number; month: number; canEdit: boolean;
  onBack: () => void; onSaved: (contract: GajiTenagaAhliKontrak) => void;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(project.gajiKontrak);
  const ref = referensiPenugasan(person, project);
  const negosiasi = saved?.gajiNegosiasi ?? null;
  const [rows, setRows] = useState<GajiTenagaAhliBulan[]>(() => jadwalPenugasan(person, project));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, startTransition] = useTransition();
  const [newMonth, setNewMonth] = useState("");
  const [addingMonth, setAddingMonth] = useState(false);
  const [onlyNotes, setOnlyNotes] = useState(false);
  const [detailScope, setDetailScope] = useState<"bulan" | "kontrak">("bulan");
  const activePeriod = `${year}-${String(month).padStart(2, "0")}`;
  const visibleRows = detailScope === "kontrak" ? rows : rows.filter(row => row.bulan === activePeriod);
  const [activeNoteMonth, setActiveNoteMonth] = useState<string | null>(null);
  const noteDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [deleteMonth, setDeleteMonth] = useState<string | null>(null);
  const deleteRow = rows.find(row => row.bulan === deleteMonth);
  const activeNote = rows.find(row => row.bulan === activeNoteMonth);
  const selectedNewMonth = newMonth || (rows.length ? bulanBerikutnya(rows[rows.length - 1].bulan) : ref.spmkMulai?.slice(0, 7)) || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  useEffect(() => {
    if (activeNoteMonth && noteDialog.current && !noteDialog.current.open) noteDialog.current.showModal();
  }, [activeNoteMonth]);
  useEffect(() => {
    if (deleteMonth && deleteDialog.current && !deleteDialog.current.open) deleteDialog.current.showModal();
  }, [deleteMonth]);
  const manual = saved?.sumber !== "SIDAMON";
  const ready = (saved?.gajiNegosiasi ?? 0) > 0;
  const noteCount = visibleRows.filter(row => row.catatan.trim()).length;
  const summary = ringkasanGajiTenagaAhli(visibleRows, person.riwayatGaji || [], project.projectId, negosiasi);
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) { if (dirty) { event.preventDefault(); event.returnValue = ""; } }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function changed() { setDirty(true); setSuccess(""); setError(""); }
  function save() {
    setError(""); setSuccess("");
    if (!negosiasi || negosiasi <= 0) { setError("Isi gaji negosiasi lebih dari nol terlebih dahulu."); return; }
    if (!rows.length) { setError("Isi periode SPMK atau tambahkan minimal satu bulan gaji."); return; }
    if (rows.reduce((total, row) => total + (row.nominal || 0), 0) > negosiasi + 0.001) { setError("Total gaji bulanan melebihi total negosiasi kontrak."); return; }
    const missingTax = rows.find(row => (row.nominal || 0) > 0 && row.pph21 == null);
    if (missingTax) { setError(`Isi PPh ${monthLabel(missingTax.bulan)} secara manual (isi 0 bila tanpa potongan).`); return; }
    startTransition(async () => {
      try {
        const result = await saveGajiTenagaAhliKontrakAction({ rekananId: person.id, projectId: project.projectId,
          gajiNegosiasi: negosiasi, basisNegosiasi: "KONTRAK", jadwal: rows, referensi: ref, revision: saved?.revision ?? 0 });
        setSaved(result.data); onSaved(result.data); setRows(result.data.jadwal || []); setDirty(false);
        setSuccess(ready ? "Gaji dan pembayaran otomatis berhasil disimpan." : "Gaji negosiasi disimpan. Silakan isi gaji per bulan di bawah.");
        router.refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan data."); }
    });
  }
  function addMonth() {
    if (summary.batasTercapai) { setError("Pembayaran sudah mencapai total negosiasi. Bulan tidak dapat ditambah."); return; }
    const month = selectedNewMonth;
    if (!/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(month)) { setError("Pilih bulan yang valid (tahun 2000–2199)."); return; }
    if (rows.some(row => row.bulan === month)) { setError("Bulan tersebut sudah ada."); return; }
    if (rows.length >= 600) { setError("Maksimal 600 bulan."); return; }
    setRows([...rows, { bulan: month, nominal: null, catatan: "" }].sort((a, b) => a.bulan.localeCompare(b.bulan))); setNewMonth(""); setAddingMonth(false); setDetailScope("kontrak"); changed();
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
        <div><dt className="text-[11px] text-muted-faint">Total gaji negosiasi (kontrak)</dt><dd className="mt-0.5 text-base font-bold tabular-nums">{negosiasi === null ? "Belum diisi" : rp(negosiasi)}</dd><p className="mt-0.5 text-[11px] text-muted-faint">Gaji terisi {rp(summary.totalGaji)} · {summary.terisi}/{summary.jumlahBulan} bulan diisi</p></div>
        <div className="sm:pl-4"><dt className="text-[11px] text-muted-faint">Sudah dibayar (bruto)</dt><dd className="mt-0.5 text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{rp(summary.dibayar)}</dd><p className="mt-0.5 text-[11px] text-muted-faint">Netto {rp(summary.dibayarNetto)} · seluruh kontrak</p></div>
        <div className="sm:pl-4"><dt title="Total negosiasi dikurangi seluruh pembayaran bruto kontrak" className="text-[11px] text-muted-faint">Balance negosiasi</dt><dd className={`mt-0.5 text-base font-bold tabular-nums ${summary.balance !== null && summary.balance < 0 ? "text-rose-600" : ""}`}>{summary.balance === null ? "Menunggu negosiasi" : rp(summary.balance)}</dd><p className="mt-0.5 text-[11px] text-muted-faint">{summary.lunas ? "Balance · total negosiasi terpenuhi" : summary.balance !== null && summary.balance < 0 ? "Melebihi total negosiasi" : "Belum balance · sisa total negosiasi"}{dirty ? " · Belum disimpan" : ""}</p></div>
      </dl>
    </header>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2 text-xs">{error}{error.includes("Muat ulang") && <button className="ml-2 underline" onClick={() => { if (!dirty || window.confirm("Muat ulang dan abaikan perubahan yang belum tersimpan?")) window.location.reload(); }}>Muat ulang data</button>}</div>}
    {success && <div role="status" className="rounded-lg bg-emerald-50 text-emerald-800 px-3 py-2 text-xs">{success}</div>}
    <details open={!ready} className="rounded-xl border border-border bg-surface-card">
      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-navy-text">
        Kontrak & negosiasi <span className="ml-2 font-normal text-muted-faint">{manual ? "Manual" : "Sidamon"} · {ref.manMonth ?? "—"} MM · RAB {rp(ref.gajiRab)} · Negosiasi {rp(negosiasi)} / kontrak</span>
      </summary>
      <div className="border-t border-border px-4 py-3">
        <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-muted-faint">Nama pekerjaan</dt><dd className="mt-1 font-medium">{ref.namaPekerjaan || "—"}</dd></div>
          <div><dt className="text-muted-faint">Menman (MM)</dt><dd className="mt-1 font-medium">{ref.manMonth ?? "—"}</dd></div>
          <div><dt className="text-muted-faint">Gaji RAB</dt><dd className="mt-1 font-medium">{rp(ref.gajiRab)}</dd></div>
          <div><dt className="text-muted-faint">Mulai SPMK</dt><dd className="mt-1 font-medium">{dateLabel(ref.spmkMulai)}</dd></div>
          <div><dt className="text-muted-faint">Selesai SPMK</dt><dd className="mt-1 font-medium">{dateLabel(ref.spmkSelesai)}</dd></div>
          <div><dt className="text-muted-faint">Gaji negosiasi · total kontrak</dt><dd className="mt-1 font-medium">{rp(negosiasi)}</dd></div>
        </dl>
        <p className="mt-3 text-[11px] text-muted-faint">Referensi kontrak diubah melalui Database Tenaga Ahli{manual ? "." : "; data Sidamon mengikuti sumber sinkronisasi."} Negosiasi dikelola dari daftar Pengisian Gaji & Negosiasi.</p>
      </div>
    </details>
    {(ready || !canEdit) && <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div><h3 className="text-sm font-semibold text-navy-text">Gaji per bulan <span className="ml-2 text-[11px] font-normal text-muted-faint">SPMK {dateLabel(ref.spmkMulai)} – {dateLabel(ref.spmkSelesai)}</span></h3></div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Periode tracking gaji" value={detailScope} onChange={event => { setDetailScope(event.target.value as "bulan" | "kontrak"); setOnlyNotes(false); }} className={`${inputClass} !w-auto`}><option value="bulan">{monthLabel(activePeriod)}</option><option value="kontrak">Semua bulan kontrak</option></select>
          {noteCount > 0 && <button onClick={() => setOnlyNotes(!onlyNotes)} className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" aria-pressed={onlyNotes}><AlertTriangle size={13} />{noteCount} kendala · {onlyNotes ? "Semua bulan" : "Filter catatan"}</button>}
          {canEdit && <button disabled={pending || summary.batasTercapai} className={buttonClass} aria-expanded={addingMonth && !summary.batasTercapai} title={summary.batasTercapai ? "Pembayaran sudah mencapai total negosiasi" : "Tambah bulan ke jadwal gaji"} aria-controls="salary-add-month" onClick={() => setAddingMonth(!addingMonth)}><Plus size={13} />{addingMonth ? "Batal tambah bulan" : "Tambah bulan"}</button>}
        </div>
      </div>
      {canEdit && addingMonth && !summary.batasTercapai && <div id="salary-add-month" className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-subtle px-3 py-2">
            <span className="text-xs text-muted-faint">Tambahkan bulan ke jadwal gaji:</span>
            <select aria-label="Bulan tambahan" disabled={pending} value={selectedNewMonth.slice(5, 7)} onChange={event => setNewMonth(`${selectedNewMonth.slice(0, 4)}-${event.target.value}`)} className={`${inputClass} !w-auto`}>
              {Array.from({ length: 12 }, (_, index) => <option key={index} value={String(index + 1).padStart(2, "0")}>{new Date(2026, index, 1).toLocaleDateString("id-ID", { month: "long" })}</option>)}
            </select>
            <select aria-label="Tahun tambahan" disabled={pending} value={selectedNewMonth.slice(0, 4)} onChange={event => setNewMonth(`${event.target.value}-${selectedNewMonth.slice(5, 7)}`)} className={`${inputClass} !w-auto`}>
              {Array.from({ length: 200 }, (_, index) => <option key={index} value={2000 + index}>{2000 + index}</option>)}
            </select>
            <button disabled={pending} className={buttonClass} onClick={addMonth}><Plus size={13} />Tambahkan ke jadwal</button>
      </div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-xs text-left"><thead className="bg-surface-subtle text-xs text-muted-faint"><tr><th className="px-3 py-2">Bulan</th><th className="px-3 py-2 min-w-[170px]">Gaji (Rp)</th><th className="px-3 py-2 min-w-[160px]">PPh (Rp)</th><th className="px-3 py-2 min-w-[130px] text-right">Netto (Rp)</th><th className="px-3 py-2 min-w-[220px]">Catatan kendala</th><th className="px-3 py-2">Pembayaran</th>{canEdit && <th className="px-3 py-2"><span className="sr-only">Kurangi bulan</span></th>}</tr></thead><tbody>
        {visibleRows.filter(row => !onlyNotes || row.catatan.trim()).map(row => {
          const history = person.riwayatGaji?.filter(item => item.projectId === project.projectId && `${item.tahun}-${String(item.bulan).padStart(2, "0")}` === row.bulan) || [];
          const hasManualPayment = history.some(item => !item.id.startsWith("gaji-"));
          const tax = pphGajiTenagaAhli(row, history);
          const paid = history.reduce((sum, item) => sum + item.nominalHonor, 0);
          const remaining = row.nominal === null ? null : row.nominal - paid;
          return <tr key={row.bulan} className={`border-t border-border ${row.catatan.trim() ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}>
            <td className="px-3 py-2 align-middle font-semibold whitespace-nowrap">{monthLabel(row.bulan)}{(ref.spmkMulai && row.bulan < ref.spmkMulai.slice(0, 7)) || (ref.spmkSelesai && row.bulan > ref.spmkSelesai.slice(0, 7)) ? <div className="text-xs text-muted-faint font-normal mt-1">Di luar periode SPMK</div> : null}</td>
            <td className="px-3 py-2 align-middle"><RupiahInput aria-label={`Gaji ${monthLabel(row.bulan)}`} disabled={!canEdit || pending} placeholder="Belum diisi" value={row.nominal} onValueChange={value => { setRows(rows.map(item => item.bulan === row.bulan ? { ...item, nominal: value, ...(value === null ? { pph21: null } : value === 0 ? { pph21: 0 } : {}) } : item)); changed(); }} /></td>
            <td className="px-3 py-2 align-middle"><RupiahInput aria-label={`PPh ${monthLabel(row.bulan)}`} disabled={!canEdit || pending || row.nominal === null} placeholder="PPh" value={tax} onValueChange={value => { setRows(rows.map(item => item.bulan === row.bulan ? { ...item, pph21: value } : item)); changed(); }} /></td>
            <td className="px-3 py-2 align-middle text-right font-medium tabular-nums whitespace-nowrap">{row.nominal === null || tax === null ? <span className="text-muted-faint">—</span> : rp(row.nominal - tax)}</td>
            <td className="px-3 py-2 align-middle"><div className="relative">
              <textarea aria-label={`Catatan kendala ${monthLabel(row.bulan)}`} className={`${inputClass} block resize-none overflow-hidden !py-1 !pr-9`} rows={1} maxLength={1000} disabled={!canEdit || pending} placeholder="Catatan kendala…" value={row.catatan} onChange={e => { setRows(rows.map(item => item.bulan === row.bulan ? { ...item, catatan: e.target.value } : item)); changed(); }} />
              {row.catatan.trim() && <button type="button" className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-r-lg text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950/50" aria-label={`Ada kendala ${monthLabel(row.bulan)}: lihat catatan lengkap`} title="Ada kendala · lihat catatan lengkap" onClick={() => setActiveNoteMonth(row.bulan)}><AlertTriangle size={14} /></button>}
            </div></td>
            <td className="px-3 py-2 align-middle text-xs"><div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
              <span className={history.length ? "font-medium tabular-nums text-emerald-700 dark:text-emerald-300" : "text-muted-faint"}>{history.length ? `${rp(paid)} dibayar` : row.nominal !== null && row.nominal > 0 ? "Otomatis saat disimpan" : "Menunggu input gaji"}</span>
            </div>{history.length > 0 && remaining !== null && <div className={`mt-0.5 text-[11px] ${remaining < 0 ? "text-rose-600" : "text-muted-faint"}`}>Sisa {rp(remaining)}</div>}</td>
            {canEdit && <td className="px-3 py-2 align-middle"><button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-faint hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40" disabled={pending || hasManualPayment} title={hasManualPayment ? "Bulan dengan pembayaran manual tidak dapat dihapus dari jadwal" : `Hapus ${monthLabel(row.bulan)}`} aria-label={`Hapus ${monthLabel(row.bulan)}`} onClick={() => setDeleteMonth(row.bulan)}><Trash2 size={14} /></button></td>}
          </tr>;
        })}
        {visibleRows.length === 0 && <tr><td colSpan={canEdit ? 7 : 6} className="p-6 text-muted-faint text-center">Belum ada jadwal untuk {monthLabel(activePeriod)}. Pilih Semua bulan kontrak atau tambahkan bulan.</td></tr>}
      </tbody></table></div>
      <div className="px-3 py-2 border-t border-border flex flex-wrap justify-between gap-2 items-center"><p className="text-[11px] text-muted-faint">{visibleRows.length} bulan ditampilkan · Total gaji terisi periode ini: {rp(summary.totalGaji)}{dirty && <span className="ml-2 text-amber-700">· Belum disimpan</span>}<span className="block mt-0.5">Gaji dan PPh tersimpan untuk proyek {project.projectCode || project.projectName}. Bruto masuk pengeluaran proyek; PPh mengurangi netto.</span></p>{canEdit && <button className={`${buttonClass} bg-navy text-white hover:bg-navy-light`} disabled={pending} onClick={save}><Save size={14} />{pending ? "Menyimpan…" : "Simpan gaji & pembayaran"}</button>}</div>
    </div>}
    <dialog ref={deleteDialog} onClose={() => setDeleteMonth(null)} aria-labelledby="delete-salary-month-title" aria-describedby="delete-salary-month-description" className="fixed inset-auto left-1/2 top-1/2 !m-0 w-[calc(100%_-_2rem)] max-w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-soft bg-surface-card p-0 text-foreground shadow-2xl backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm">
      {deleteRow && <>
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-500/15"><Trash2 size={16} className="text-status-red" /></div>
            <div><h3 id="delete-salary-month-title" className="text-sm font-bold text-navy-text">Hapus bulan gaji?</h3><p id="delete-salary-month-description" className="mt-0.5 text-xs leading-relaxed text-muted-faint">Bulan ini akan dihapus dari jadwal setelah perubahan disimpan.</p></div>
          </div>
          <div className="mt-4 rounded-xl border border-border-soft bg-surface-subtle px-3.5 py-2.5">
            <p className="text-xs font-bold text-navy-text">{monthLabel(deleteRow.bulan)}</p>
            <p className="mt-1 text-xs text-muted-faint">{person.nama} · {project.projectCode}</p>
            {(deleteRow.nominal !== null || deleteRow.catatan) && <p className="mt-2 text-xs leading-relaxed text-muted-faint">Nominal, catatan, dan pembayaran otomatis bulan ini ikut dihapus saat disimpan.</p>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border-soft bg-surface-subtle/50 px-5 py-3">
          <button autoFocus type="button" disabled={pending} className="rounded-xl border border-border-soft px-4 py-2 text-xs font-semibold text-muted-stronger transition-colors hover:bg-surface-hover disabled:opacity-50" onClick={() => deleteDialog.current?.close()}>Batal</button>
          <button type="button" disabled={pending || !canEdit} className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50" onClick={() => { setRows(previous => previous.filter(row => row.bulan !== deleteMonth)); changed(); deleteDialog.current?.close(); }}>Hapus bulan</button>
        </div>
      </>}
    </dialog>
    <dialog ref={noteDialog} onClose={() => setActiveNoteMonth(null)} aria-labelledby="salary-note-title" className="m-auto w-full max-w-md rounded-xl border border-border bg-surface-card p-0 text-foreground shadow-xl backdrop:bg-slate-900/40">
      {activeNote && <>
        <div className="flex items-center justify-between border-b border-border px-4 py-3"><h3 id="salary-note-title" className="text-sm font-semibold">Catatan kendala · {monthLabel(activeNote.bulan)}</h3><button type="button" className={buttonClass} onClick={() => noteDialog.current?.close()}>Tutup</button></div>
        <div className="space-y-2 p-4"><textarea aria-label="Catatan kendala lengkap" className="w-full resize-y rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground" rows={5} maxLength={1000} disabled={!canEdit || pending} value={activeNote.catatan} onChange={event => { setRows(rows.map(row => row.bulan === activeNote.bulan ? { ...row, catatan: event.target.value } : row)); changed(); }} />{canEdit && <p className="text-xs text-muted-faint">Simpan gaji bulanan setelah selesai mengubah catatan.</p>}</div>
      </>}
    </dialog>
  </section>;
}
