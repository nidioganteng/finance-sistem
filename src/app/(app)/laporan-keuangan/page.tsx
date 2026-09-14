import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities, formatRupiah } from "@/lib/dashboard-data";
import { getLaporanKeuanganData } from "@/lib/laporan-keuangan";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PrintButton } from "@/components/shared/PrintButton";
import { LaporanKeuanganTabs } from "@/components/laporan-keuangan/LaporanKeuanganTabs";
import { AlertTriangle } from "lucide-react";

export default async function LaporanKeuanganPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string; tab?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  if (role === "SUPER_ADMIN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();
  const tab = searchParams.tab ?? "neraca";

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const data = await getLaporanKeuanganData(selectedEntity.id, currentYear);

  const hasData = data.pendapatan.length > 0 || data.beban.length > 0 || data.aset.length > 0;

  return (
    <>
      <PageHeader
        title="Laporan Keuangan"
        subtitle={`${selectedEntity.name} — Periode ${currentYear}`}
        rightSlot={
          <>
            <PrintButton />
            <YearSelect currentYear={currentYear} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedKey}
            />
          </>
        }
      />

      <div className="print:hidden"><LaporanKeuanganTabs currentTab={tab} /></div>

      {!hasData && (
        <div className="bg-surface-card rounded-[20px] border border-border-soft py-16 text-center">
          <div className="text-sm font-semibold text-muted-stronger mb-1">Tidak ada data</div>
          <p className="text-[13px] text-muted">Belum ada transaksi dengan akun COA untuk periode ini.</p>
        </div>
      )}

      {hasData && tab === "neraca" && <NeracaTab data={data} year={currentYear} entityName={selectedEntity.name} />}
      {hasData && tab === "laba-rugi" && <LabaRugiTab data={data} year={currentYear} entityName={selectedEntity.name} />}
      {hasData && tab === "arus-kas" && <ArusKasTab data={data} year={currentYear} entityName={selectedEntity.name} />}
    </>
  );
}

// ── Tab: Neraca ──────────────────────────────────────────────────────
function NeracaTab({
  data,
  year,
  entityName,
}: {
  data: Awaited<ReturnType<typeof getLaporanKeuanganData>>;
  year: number;
  entityName: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Report header */}
      <div className="text-center py-2">
        <div className="font-bold text-navy-text text-[15px]">{entityName.toUpperCase()}</div>
        <div className="font-bold text-navy-text text-[13px] mt-0.5">NERACA</div>
        <div className="text-[12px] text-muted mt-0.5">Per 31 Desember {year}</div>
        <div className="text-[11px] text-muted-faint">(Dalam Rupiah)</div>
      </div>

      {!data.neracaBalanced && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[14px] px-4 py-3.5">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-none" />
          <div className="text-[13px] text-red-700 dark:text-red-400">
            <span className="font-bold">Neraca tidak seimbang!</span> Total Aktiva ({data.totalAsetFmt}) ≠ Total Pasiva ({data.totalPassivaFmt}).
            Periksa entri akun COA untuk menemukan sumber ketidakseimbangan.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Aktiva */}
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-subtle font-extrabold text-navy-text">AKTIVA</div>
          <table className="w-full text-sm">
            <tbody>
              {data.aset.length === 0 && (
                <tr><td colSpan={2} className="py-4 px-6 text-[13px] text-muted italic">Tidak ada akun aset.</td></tr>
              )}
              {data.aset.map((item) => (
                <tr key={item.code} className="border-b border-surface-subtle hover:bg-surface-hover/30">
                  <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                  <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold text-navy-text">{item.saldoFmt}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className="py-3.5 px-6 font-extrabold text-navy-text">Total Aktiva</td>
                <td className={`py-3.5 px-6 text-right tabular-nums font-extrabold ${data.neracaBalanced ? "text-navy-text" : "text-red-600 dark:text-red-400"}`}>
                  {data.totalAsetFmt}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pasiva */}
        <div className="flex flex-col gap-4">
          {/* Kewajiban */}
          <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-subtle font-extrabold text-navy-text">KEWAJIBAN</div>
            <table className="w-full text-sm">
              <tbody>
                {data.kewajiban.length === 0 && (
                  <tr><td colSpan={2} className="py-3 px-6 text-[13px] text-muted italic">Tidak ada kewajiban.</td></tr>
                )}
                {data.kewajiban.map((item) => (
                  <tr key={item.code} className="border-b border-surface-subtle hover:bg-surface-hover/30">
                    <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                    <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold text-navy-text">{item.saldoFmt}</td>
                  </tr>
                ))}
                <tr className="bg-surface-subtle/60 border-t border-border-soft">
                  <td className="py-2.5 px-6 font-bold text-[13px] text-navy-text">Total Kewajiban</td>
                  <td className="py-2.5 px-6 text-right tabular-nums font-bold text-[13px] text-navy-text">{data.totalKewajibanFmt}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Modal */}
          <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-subtle font-extrabold text-navy-text">MODAL</div>
            <table className="w-full text-sm">
              <tbody>
                {data.modal.map((item) => (
                  <tr key={item.code} className="border-b border-surface-subtle hover:bg-surface-hover/30">
                    <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                    <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold text-navy-text">{item.saldoFmt}</td>
                  </tr>
                ))}
                {/* Laba Tahun Berjalan — angka yang SAMA dari tab Laba Rugi */}
                <tr className="border-b border-surface-subtle bg-green-50/40 dark:bg-green-500/10">
                  <td className="py-2.5 px-6 text-[13px] font-semibold text-muted-stronger">
                    Laba Tahun Berjalan {year}
                  </td>
                  <td className={`py-2.5 px-6 text-right tabular-nums text-[13px] font-bold ${data.labaBersihPositive ? "text-status-green" : "text-status-red"}`}>
                    {data.labaBersihPositive ? "" : "-"}{data.labaBersihFmt}
                  </td>
                </tr>
                <tr className="bg-surface-subtle/60 border-t border-border-soft">
                  <td className="py-2.5 px-6 font-bold text-[13px] text-navy-text">Total Modal</td>
                  <td className="py-2.5 px-6 text-right tabular-nums font-bold text-[13px] text-navy-text">
                    {/* totalModal + labaBersih */}
                    {formatRupiah(Math.abs(data.totalModal + data.labaBersih))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total Pasiva */}
          <div className={`px-6 py-4 rounded-[16px] border-2 ${data.neracaBalanced ? "border-green-300 dark:border-green-500/40 bg-green-50 dark:bg-green-500/10" : "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10"}`}>
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[13px] text-navy-text">Total Kewajiban + Modal</span>
              <span className={`font-extrabold tabular-nums ${data.neracaBalanced ? "text-navy-text" : "text-red-600 dark:text-red-400"}`}>
                {data.totalPassivaFmt}
              </span>
            </div>
            <div className={`text-[12px] mt-1 font-semibold ${data.neracaBalanced ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
              {data.neracaBalanced ? "✓ Neraca seimbang" : "✗ Neraca tidak seimbang"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Laba Rugi ───────────────────────────────────────────────────
function LabaRugiTab({
  data,
  year,
  entityName,
}: {
  data: Awaited<ReturnType<typeof getLaporanKeuanganData>>;
  year: number;
  entityName: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Report header */}
      <div className="text-center py-2">
        <div className="font-bold text-navy-text text-[15px]">{entityName.toUpperCase()}</div>
        <div className="font-bold text-navy-text text-[13px] mt-0.5">LAPORAN LABA RUGI</div>
        <div className="text-[12px] text-muted mt-0.5">Periode 1 Januari s/d 31 Desember {year}</div>
        <div className="text-[11px] text-muted-faint">(Dalam Rupiah)</div>
      </div>

      {/* Pendapatan */}
      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-subtle font-extrabold text-navy-text">PENDAPATAN USAHA</div>
        <table className="w-full text-sm">
          <tbody>
            {data.pendapatan.length === 0 && (
              <tr><td colSpan={2} className="py-4 px-6 text-[13px] text-muted italic">Tidak ada akun pendapatan.</td></tr>
            )}
            {data.pendapatan.map((item) => (
              <tr key={item.code} className="border-b border-surface-subtle">
                <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold text-status-green">{item.saldoFmt}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-soft bg-green-50/50 dark:bg-green-500/10">
              <td className="py-3 px-6 font-extrabold text-navy-text">Total Pendapatan Usaha</td>
              <td className="py-3 px-6 text-right tabular-nums font-extrabold text-status-green">{data.totalPendapatanFmt}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Beban */}
      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-subtle font-extrabold text-navy-text">BEBAN USAHA</div>
        <table className="w-full text-sm">
          <tbody>
            {data.beban.length === 0 && (
              <tr><td colSpan={2} className="py-4 px-6 text-[13px] text-muted italic">Tidak ada akun beban.</td></tr>
            )}
            {data.beban.map((item) => (
              <tr key={item.code} className="border-b border-surface-subtle">
                <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold text-status-red">{item.saldoFmt}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-soft bg-red-50/50 dark:bg-red-500/10">
              <td className="py-3 px-6 font-extrabold text-navy-text">Total Beban Usaha</td>
              <td className="py-3 px-6 text-right tabular-nums font-extrabold text-status-red">{data.totalBebanFmt}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Laba/Rugi Bersih */}
      <div className={`px-6 py-5 rounded-[20px] border-2 ${data.labaBersihPositive ? "border-green-300 dark:border-green-500/40 bg-green-50 dark:bg-green-500/10" : "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10"}`}>
        <div className="text-[12px] font-semibold text-muted-stronger mb-1">
          {data.labaBersihPositive ? "LABA BERSIH" : "RUGI BERSIH"}
        </div>
        <div className={`text-[28px] font-extrabold tabular-nums ${data.labaBersihPositive ? "text-status-green" : "text-status-red"}`}>
          {data.labaBersihPositive ? "" : "-"}{data.labaBersihFmt}
        </div>
        <div className="text-[12px] text-muted mt-1">
          Total Pendapatan ({data.totalPendapatanFmt}) − Total Beban ({data.totalBebanFmt})
        </div>
      </div>
    </div>
  );
}

// ── Tab: Arus Kas ────────────────────────────────────────────────────
function ArusKasTab({
  data,
  year,
  entityName,
}: {
  data: Awaited<ReturnType<typeof getLaporanKeuanganData>>;
  year: number;
  entityName: string;
}) {
  const fmtSigned = (val: number, fmt: string) =>
    val === 0 ? <span className="text-muted-faint">—</span> :
    val > 0 ? <span className="text-navy-text">{fmt}</span> :
    <span className="text-status-red">({fmt})</span>;

  return (
    <div className="flex flex-col gap-4">
      {/* Report header */}
      <div className="text-center py-2">
        <div className="font-bold text-navy-text text-[15px]">{entityName.toUpperCase()}</div>
        <div className="font-bold text-navy-text text-[13px] mt-0.5">LAPORAN ARUS KAS</div>
        <div className="text-[12px] text-muted mt-0.5">Periode 1 Januari s/d 31 Desember {year}</div>
        <div className="text-[11px] text-muted-faint">(Dalam Rupiah) · Metode Tidak Langsung</div>
      </div>

      {!data.arusKasBalanced && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[14px] px-4 py-3.5">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-none" />
          <div className="text-[13px] text-red-700 dark:text-red-400">
            <span className="font-bold">Arus Kas tidak seimbang!</span> Kas Akhir Periode ({data.kasAkhirFmt}) ≠ total saldo Kas+Bank di Neraca ({data.kasAsetFmt}).
          </div>
        </div>
      )}

      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {/* ── Aktivitas Operasi ── */}
            <tr className="bg-surface-subtle">
              <td colSpan={2} className="py-3 px-6 font-extrabold text-navy-text text-[13px]">
                Aktivitas Operasi
              </td>
            </tr>
            <tr className="border-b border-surface-subtle">
              <td className="py-2.5 px-8 text-[13px] text-muted-stronger">Laba/(Rugi) Bersih</td>
              <td className="py-2.5 px-6 text-right tabular-nums text-[13px]">
                {fmtSigned(data.labaBersih, data.labaBersihFmt)}
              </td>
            </tr>
            <tr className="border-b border-surface-subtle">
              <td className="py-2.5 px-8 text-[13px] text-muted-faint italic">Penyesuaian non-kas (penyusutan, dll.)</td>
              <td className="py-2.5 px-6 text-right tabular-nums text-[13px] text-muted-faint">—</td>
            </tr>
            {data.perubahanAsetNonKas !== 0 && (
              <tr className="border-b border-surface-subtle">
                <td className="py-2.5 px-8 text-[13px] text-muted-stronger">Penurunan/(Kenaikan) Aset Non-Kas</td>
                <td className="py-2.5 px-6 text-right tabular-nums text-[13px]">
                  {fmtSigned(data.perubahanAsetNonKas, formatRupiah(Math.abs(data.perubahanAsetNonKas)))}
                </td>
              </tr>
            )}
            {data.perubahanKewajiban !== 0 && (
              <tr className="border-b border-surface-subtle">
                <td className="py-2.5 px-8 text-[13px] text-muted-stronger">Kenaikan/(Penurunan) Kewajiban</td>
                <td className="py-2.5 px-6 text-right tabular-nums text-[13px]">
                  {fmtSigned(data.perubahanKewajiban, formatRupiah(Math.abs(data.perubahanKewajiban)))}
                </td>
              </tr>
            )}
            <tr className="border-b-2 border-border bg-surface-subtle/40">
              <td className="py-3 px-6 font-bold text-[13px] text-navy-text">Kas dari Aktivitas Operasi</td>
              <td className="py-3 px-6 text-right tabular-nums font-bold text-[13px]">
                {fmtSigned(data.kasOperasi, data.kasOperasiFmt)}
              </td>
            </tr>

            {/* ── Aktivitas Investasi ── */}
            <tr className="bg-surface-subtle">
              <td colSpan={2} className="py-3 px-6 font-extrabold text-navy-text text-[13px]">
                Aktivitas Investasi
              </td>
            </tr>
            <tr className="border-b border-surface-subtle">
              <td className="py-2.5 px-8 text-[13px] text-muted-faint italic">Perolehan/Pelepasan Aset Tetap</td>
              <td className="py-2.5 px-6 text-right tabular-nums text-[13px] text-muted-faint">—</td>
            </tr>
            <tr className="border-b-2 border-border bg-surface-subtle/40">
              <td className="py-3 px-6 font-bold text-[13px] text-navy-text">Kas dari Aktivitas Investasi</td>
              <td className="py-3 px-6 text-right tabular-nums font-bold text-[13px]">
                {fmtSigned(data.kasInvestasi, data.kasInvestasiFmt)}
              </td>
            </tr>

            {/* ── Aktivitas Pendanaan ── */}
            <tr className="bg-surface-subtle">
              <td colSpan={2} className="py-3 px-6 font-extrabold text-navy-text text-[13px]">
                Aktivitas Pendanaan
              </td>
            </tr>
            {data.kasPendanaan !== 0 ? (
              <tr className="border-b border-surface-subtle">
                <td className="py-2.5 px-8 text-[13px] text-muted-stronger">Perubahan Modal Bersih</td>
                <td className="py-2.5 px-6 text-right tabular-nums text-[13px]">
                  {fmtSigned(data.kasPendanaan, data.kasPendanaanFmt)}
                </td>
              </tr>
            ) : (
              <tr className="border-b border-surface-subtle">
                <td className="py-2.5 px-8 text-[13px] text-muted-faint italic">Setoran Modal / Dividen</td>
                <td className="py-2.5 px-6 text-right tabular-nums text-[13px] text-muted-faint">—</td>
              </tr>
            )}
            <tr className="border-b-2 border-border bg-surface-subtle/40">
              <td className="py-3 px-6 font-bold text-[13px] text-navy-text">Kas dari Aktivitas Pendanaan</td>
              <td className="py-3 px-6 text-right tabular-nums font-bold text-[13px]">
                {fmtSigned(data.kasPendanaan, data.kasPendanaanFmt)}
              </td>
            </tr>

            {/* ── Penutup ── */}
            <tr className="border-b border-surface-subtle">
              <td className="py-3 px-6 font-semibold text-[13px] text-muted-stronger">
                Kenaikan/(Penurunan) Bersih Kas & Setara Kas
              </td>
              <td className="py-3 px-6 text-right tabular-nums font-semibold text-[13px]">
                {fmtSigned(data.kenaikanBersihKas, data.kenaikanBersihFmt)}
              </td>
            </tr>
            <tr className="border-b border-surface-subtle">
              <td className="py-3 px-6 font-semibold text-[13px] text-muted-stronger">Kas & Setara Kas Awal Periode</td>
              <td className="py-3 px-6 text-right tabular-nums font-semibold text-[13px] text-muted">
                {data.kasAwal === 0 ? "—" : data.kasAwalFmt}
              </td>
            </tr>
            <tr className={`border-t-2 ${data.arusKasBalanced ? "border-green-400 dark:border-green-500/40 bg-green-50/50 dark:bg-green-500/10" : "border-red-400 dark:border-red-500/40 bg-red-50/50 dark:bg-red-500/10"}`}>
              <td className="py-4 px-6 font-extrabold text-navy-text">Kas & Setara Kas Akhir Periode</td>
              <td className={`py-4 px-6 text-right tabular-nums font-extrabold text-[15px] ${data.arusKasBalanced ? "text-navy-text" : "text-red-600 dark:text-red-400"}`}>
                {data.kasAkhirFmt}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {data.arusKasBalanced && (
        <div className="px-4 py-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-[12px] text-green-700 dark:text-green-400 font-semibold">
          ✓ Kas Akhir Periode sama dengan total saldo Kas+Bank di Neraca — laporan konsisten.
        </div>
      )}
    </div>
  );
}
