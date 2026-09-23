import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { getNeracaData } from "@/lib/neraca";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";
import { ReportVersionSwitcher, ReportVersion } from "@/components/shared/ReportVersionSwitcher";

export default async function NeracaPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string; version?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  logActivity(session!.user.id, "Buka halaman Neraca", "USER_ACTIVITY", { path: "/neraca" });
  if (role === "SUPER_ADMIN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();
  const currentVersion: ReportVersion = (searchParams.version ?? "internal").toUpperCase() === "UMUM" ? "UMUM" : "INTERNAL";

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const data = await getNeracaData(selectedEntity.id, currentYear, currentVersion);

  return (
    <PageTransition>
      <PageHeader
        title="Neraca"
        subtitle={`Posisi keuangan per 31 Desember ${currentYear} — ${selectedEntity.name} (${currentVersion === "UMUM" ? "Versi Umum" : "Versi Internal"})`}
        rightSlot={
          <>
            <ReportVersionSwitcher currentVersion={currentVersion} />
            <YearSelect currentYear={currentYear} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedKey}
            />
          </>
        }
      />

      <div className="px-4 py-3 rounded-xl bg-surface-subtle border border-border-soft text-[13px] text-muted-stronger">
        Data Neraca dihitung otomatis dari saldo awal dan seluruh transaksi kas, bank, serta jurnal yang tercatat.
      </div>

      {data.aset.length === 0 && data.kewajiban.length === 0 && data.modal.length === 0 ? (
        <div className="bg-surface-card rounded-[20px] border border-border-soft py-16 text-center">
          <div className="text-sm font-semibold text-muted-stronger mb-1">Tidak ada data</div>
          <p className="text-[13px] text-muted">Isi data COA (Aset/Kewajiban/Modal) dan transaksi terlebih dahulu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* ── AKTIVA (ASET) ── */}
          <div className="flex flex-col gap-5">
            {/* I. Aktiva Lancar */}
            <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
              <div className="px-6 py-3.5 border-b border-surface-subtle bg-blue-50/40 dark:bg-blue-500/10 flex items-center justify-between">
                <div className="font-bold text-navy-text text-[13px]">I. AKTIVA LANCAR</div>
                <span className="text-[11px] font-bold text-muted-faint">{data.aktivaLancar.length} Akun</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {data.aktivaLancar.length === 0 ? (
                    <tr><td colSpan={2} className="py-4 px-6 text-sm text-muted italic">Tidak ada aktiva lancar.</td></tr>
                  ) : (
                    data.aktivaLancar.map((item) => (
                      <tr key={item.code} className="border-b border-surface-subtle">
                        <td className="py-2.5 px-6 text-[13px] text-muted-stronger">
                          {item.code} — {item.name}
                          {item.isContra && (
                            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                              Kontra
                            </span>
                          )}
                        </td>
                        <td className={`py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold ${item.isContra ? "text-status-amber" : ""}`}>
                          {item.saldoFmt}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-surface-subtle/80">
                    <td className="py-3 px-6 font-bold text-navy-text text-[13px]">Total Aktiva Lancar</td>
                    <td className="py-3 px-6 text-right tabular-nums font-bold text-navy-text text-[13px]">{data.totalAktivaLancarFmt}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* II. Aktiva Tetap */}
            <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
              <div className="px-6 py-3.5 border-b border-surface-subtle bg-cyan-50/40 dark:bg-cyan-500/10 flex items-center justify-between">
                <div className="font-bold text-navy-text text-[13px]">II. AKTIVA TETAP</div>
                <span className="text-[11px] font-bold text-muted-faint">{data.aktivaTetap.length} Akun</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {data.aktivaTetap.length === 0 ? (
                    <tr><td colSpan={2} className="py-4 px-6 text-sm text-muted italic">Tidak ada aktiva tetap.</td></tr>
                  ) : (
                    data.aktivaTetap.map((item) => (
                      <tr key={item.code} className="border-b border-surface-subtle">
                        <td className="py-2.5 px-6 text-[13px] text-muted-stronger">
                          {item.code} — {item.name}
                          {item.isContra && (
                            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                              Pengurang
                            </span>
                          )}
                        </td>
                        <td className={`py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold ${item.isContra ? "text-status-amber" : ""}`}>
                          {item.saldoFmt}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-surface-subtle/80">
                    <td className="py-3 px-6 font-bold text-navy-text text-[13px]">Total Aktiva Tetap (Net)</td>
                    <td className="py-3 px-6 text-right tabular-nums font-bold text-navy-text text-[13px]">{data.totalAktivaTetapFmt}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Grand Total Aktiva */}
            <div className="bg-surface-card rounded-[18px] border-2 border-blue-200 dark:border-blue-500/30 px-6 py-4 flex items-center justify-between bg-blue-50/40 dark:bg-blue-500/10">
              <div>
                <span className="font-extrabold text-navy-text text-[14px]">TOTAL AKTIVA</span>
                <p className="text-[11px] text-muted">Aktiva Lancar + Aktiva Tetap</p>
              </div>
              <span className="font-black text-blue-700 dark:text-blue-400 tabular-nums text-[16px]">{data.totalAsetFmt}</span>
            </div>
          </div>

          {/* ── PASIVA (KEWAJIBAN & EKUITAS) ── */}
          <div className="flex flex-col gap-5">
            {/* I. Kewajiban */}
            <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
              <div className="px-6 py-3.5 border-b border-surface-subtle bg-orange-50/40 dark:bg-orange-500/10 flex items-center justify-between">
                <div className="font-bold text-navy-text text-[13px]">I. KEWAJIBAN</div>
                <span className="text-[11px] font-bold text-muted-faint">{data.kewajiban.length} Akun</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {data.kewajiban.length === 0 && (
                    <tr><td colSpan={2} className="py-4 px-6 text-sm text-muted">-</td></tr>
                  )}
                  {data.kewajiban.map((item) => (
                    <tr key={item.code} className="border-b border-surface-subtle">
                      <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                      <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold">{item.saldoFmt}</td>
                    </tr>
                  ))}
                  <tr className="bg-surface-subtle/80">
                    <td className="py-3 px-6 font-bold text-navy-text text-[13px]">Total Kewajiban</td>
                    <td className="py-3 px-6 text-right tabular-nums font-bold text-navy-text text-[13px]">{data.totalKewajibanFmt}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* II. Modal & Ekuitas */}
            <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
              <div className="px-6 py-3.5 border-b border-surface-subtle bg-violet-50/40 dark:bg-violet-500/10 flex items-center justify-between">
                <div className="font-bold text-navy-text text-[13px]">II. MODAL & EKUITAS</div>
                <span className="text-[11px] font-bold text-muted-faint">{data.modal.length + 2} Akun</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {data.modal.map((item) => (
                    <tr key={item.code} className="border-b border-surface-subtle">
                      <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                      <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold">{item.saldoFmt}</td>
                    </tr>
                  ))}
                  {/* Akun 310 Laba Ditahan */}
                  <tr className="border-b border-surface-subtle bg-violet-50/20 dark:bg-violet-500/5">
                    <td className="py-2.5 px-6 text-[13px] text-muted-stronger">310 — Laba Ditahan</td>
                    <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold">{data.labaDitahanFmt}</td>
                  </tr>
                  {/* Laba Tahun Berjalan */}
                  <tr className="border-b border-surface-subtle bg-green-50/40 dark:bg-green-500/10">
                    <td className="py-2.5 px-6 text-[13px] font-semibold text-muted-stronger">
                      Laba Tahun Berjalan
                    </td>
                    <td className={`py-2.5 px-6 text-right tabular-nums text-[13px] font-bold ${data.labaBersihPositive ? "text-status-green" : "text-status-red"}`}>
                      {data.labaBersihPositive ? "" : "-"}{data.labaBersihFmt}
                    </td>
                  </tr>
                  <tr className="bg-surface-subtle/80">
                    <td className="py-3 px-6 font-bold text-navy-text text-[13px]">Total Modal & Laba</td>
                    <td className="py-3 px-6 text-right tabular-nums font-bold text-navy-text text-[13px]">{data.totalModalDanLabaFmt}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Grand Total Pasiva & Status */}
            <div className={`px-6 py-4 rounded-[18px] border-2 ${data.balanced ? "border-green-300 dark:border-green-500/30 bg-green-50 dark:bg-green-500/15" : "border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-[14px]">TOTAL PASIVA</span>
                  <p className="text-[11px] text-muted">Kewajiban + Modal + Laba Ditahan</p>
                </div>
                <span className="font-black tabular-nums text-[16px]">{data.totalPassivaFmt}</span>
              </div>
              <div className={`text-[12px] mt-1 font-semibold ${data.balanced ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                {data.balanced ? "✓ Neraca seimbang (Aktiva = Pasiva)" : "✗ Neraca tidak seimbang — periksa saldo awal dan entri akun"}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
