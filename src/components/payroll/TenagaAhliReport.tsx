"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { filterTenagaAhliTracking, groupTenagaAhliTracking, summarizeTenagaAhliTracking, type TenagaAhliTrackingRow } from "@/lib/tenaga-ahli-tracking";

const money = (value: number | null) => value === null ? "Belum diisi" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(value);
const periodName = (value: string) => new Date(`${value}-01T12:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
const selectClass = "h-8 rounded-lg border border-border bg-surface-card px-2 text-xs text-foreground";
const titles = { proyek: "Rekap Per Proyek", bulan: "Rekap Setahun", nama: "Akumulasi Tenaga Ahli", holding: "Konsolidasi Holding" };

export function TenagaAhliReport({ rows, group, entityId, entityName, year, month, search, summaryOnly = false, periodScope, onTracking }: {
  rows: TenagaAhliTrackingRow[]; group: keyof typeof titles; entityId?: string; entityName?: string;
  year: number; month: number; search: string; summaryOnly?: boolean; periodScope?: "bulan" | "tahun"; onTracking?: () => void;
}) {
  const [scope, setScope] = useState<"bulan" | "tahun">("tahun");
  const [expanded, setExpanded] = useState<string | null>(null);
  const pathname = usePathname();
  const params = useSearchParams();
  const activeScope = periodScope || scope;
  const activePeriod = `${year}-${String(month).padStart(2, "0")}`;
  const period = activeScope === "bulan" ? periodName(activePeriod) : `Tahun ${year}`;
  const visible = filterTenagaAhliTracking(rows, { year, month: activeScope === "bulan" ? month : undefined,
    entityId: group === "holding" ? undefined : entityId, search });
  const summary = summarizeTenagaAhliTracking(visible);
  const groups = groupTenagaAhliTracking(visible, group);
  function detailUrl(row: TenagaAhliTrackingRow) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", "tenaga-ahli"); next.set("ahliId", row.personId || ""); next.set("proyekAhliId", row.projectId || "");
    next.set("year", row.periode.slice(0, 4)); next.set("month", String(Number(row.periode.slice(5))));
    return `${pathname}?${next}`;
  }
  return <section className="overflow-hidden rounded-xl border border-border bg-surface-card">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
      <div><h3 className="text-sm font-semibold text-navy-text">{summaryOnly ? "Gaji terisi & pembayaran" : titles[group]}</h3><p className="mt-0.5 text-xs text-muted-faint">{period} · {group === "holding" ? "Seluruh holding" : entityName}</p></div>
      {!periodScope && <select aria-label="Periode rekap tenaga ahli" className={selectClass} value={scope} onChange={event => { setScope(event.target.value as "bulan" | "tahun"); setExpanded(null); }}><option value="bulan">Bulan dipilih</option><option value="tahun">Setahun</option></select>}
    </header>
    <dl className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-4">
      <div><dt className="text-[11px] text-muted-faint">Gaji terisi (bruto)</dt><dd className="mt-1 text-base font-semibold tabular-nums">{money(summary.gajiTerisi)}</dd><p className="text-[11px] text-muted-faint">{summary.jumlahInput} input bulanan</p></div>
      <div><dt className="text-[11px] text-muted-faint">Sudah dibayar (bruto)</dt><dd className="mt-1 text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{money(summary.dibayar)}</dd><p className="text-[11px] text-muted-faint">{summary.jumlahPembayaran} transaksi tercatat</p></div>
      <div><dt className="text-[11px] text-muted-faint">PPh / netto dibayar</dt><dd className="mt-1 text-sm tabular-nums">{money(summary.pph)} / {money(summary.netto)}</dd></div>
      <div><dt className="text-[11px] text-muted-faint">Balance gaji terisi</dt><dd className={`mt-1 text-base font-semibold tabular-nums ${summary.balance !== null && summary.balance < 0 ? "text-rose-600" : ""}`}>{summary.balance === null ? "Menunggu input gaji" : money(summary.balance)}</dd><p className="text-[11px] text-muted-faint">Gaji terisi − dibayar bruto{summary.belumAdaGaji ? " · sebagian pembayaran belum punya input gaji" : ""}</p></div>
    </dl>
    {summary.jumlahKendala > 0 && <p className="flex items-center gap-1 border-t border-border px-4 py-2 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle size={13} />{summary.jumlahKendala} catatan kendala pada periode ini</p>}
    {!summaryOnly && <div className="overflow-x-auto border-t border-border"><table className="w-full min-w-[750px] text-left text-xs">
      <thead className="bg-surface-subtle text-muted-faint"><tr><th className="px-3 py-2">{group === "proyek" ? "Proyek" : group === "bulan" ? "Bulan" : group === "holding" ? "Entitas" : "Tenaga ahli"}</th><th className="px-3 py-2 text-right">Gaji terisi</th><th className="px-3 py-2 text-right">Sudah dibayar</th><th className="px-3 py-2 text-right">PPh</th><th className="px-3 py-2 text-right">Netto</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
      <tbody>{groups.map(item => <Group key={item.key} item={item} />)}{groups.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-faint">Belum ada gaji terisi atau pembayaran tercatat untuk {period}.</td></tr>}</tbody>
      {groups.length > 0 && <tfoot className="border-t border-border bg-surface-subtle font-semibold"><tr><td className="px-3 py-2">Total · {period}</td><td className="px-3 py-2 text-right tabular-nums">{money(summary.gajiTerisi)}</td><td className="px-3 py-2 text-right tabular-nums">{money(summary.dibayar)}</td><td className="px-3 py-2 text-right tabular-nums">{money(summary.pph)}</td><td className="px-3 py-2 text-right tabular-nums">{money(summary.netto)}</td><td className="px-3 py-2 text-right tabular-nums">{summary.balance === null ? "—" : money(summary.balance)}</td></tr></tfoot>}
    </table></div>}
    <p className="border-t border-border px-4 py-2 text-[11px] text-muted-faint">Gaji terisi mengikuti entitas profil; pembayaran mengikuti entitas pembayar. Angka RAB dan negosiasi tidak dihitung sebagai pembayaran.</p>
  </section>;

  function Group({ item }: { item: (typeof groups)[number] }) {
    const open = expanded === item.key;
    const value = item.summary;
    return <>
      <tr className="border-t border-border"><td className="px-3 py-2"><button className="inline-flex items-center gap-1.5 text-left font-semibold" aria-expanded={open} onClick={() => setExpanded(open ? null : item.key)}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{group === "bulan" ? periodName(item.label) : item.label}</button><p className="ml-5 mt-0.5 text-[11px] text-muted-faint">{value.jumlahInput} input · {value.jumlahPembayaran} pembayaran</p></td><td className="px-3 py-2 text-right tabular-nums">{money(value.gajiTerisi)}</td><td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{money(value.dibayar)}</td><td className="px-3 py-2 text-right tabular-nums">{money(value.pph)}</td><td className="px-3 py-2 text-right tabular-nums">{money(value.netto)}</td><td className={`px-3 py-2 text-right tabular-nums ${value.balance !== null && value.balance < 0 ? "text-rose-600" : ""}`}>{value.balance === null ? "—" : money(value.balance)}</td></tr>
      {open && <tr><td colSpan={6} className="bg-surface-subtle/30 p-3"><div className="overflow-x-auto rounded-lg border border-border bg-surface-card"><table className="w-full text-xs text-left"><thead className="bg-surface-subtle text-muted-faint"><tr><th className="px-3 py-2">Bulan / tenaga ahli</th><th className="px-3 py-2">Proyek / entitas</th><th className="px-3 py-2 text-right">Gaji terisi</th><th className="px-3 py-2 text-right">Dibayar</th><th className="px-3 py-2">Catatan / tracking</th></tr></thead><tbody>{item.rows.map(row => <tr key={row.id} className="border-t border-border"><td className="px-3 py-2"><div>{periodName(row.periode)}</div><div className="font-semibold">{row.nama}</div></td><td className="px-3 py-2">{row.projectCode} · {row.projectName}<div className="text-muted-faint">{row.entityName}</div></td><td className="px-3 py-2 text-right tabular-nums">{money(row.gajiTerisi)}</td><td className="px-3 py-2 text-right tabular-nums">{money(row.payments.reduce((sum, payment) => sum + payment.nominalHonor, 0))}<div className="text-[11px] text-muted-faint">{row.payments.map(payment => payment.tanggal).join(", ")}</div></td><td className="px-3 py-2">{row.catatan && <p className="mb-1 flex max-w-xs items-start gap-1 whitespace-pre-wrap break-words text-amber-700 dark:text-amber-300"><AlertTriangle size={12} />{row.catatan}</p>}{row.personId && row.projectId && <Link className="font-semibold underline" onClick={onTracking} href={detailUrl(row)}>Tracking bulan ini</Link>}</td></tr>)}</tbody></table></div></td></tr>}
    </>;
  }
}
