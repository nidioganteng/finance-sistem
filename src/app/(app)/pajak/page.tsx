import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { getLabaRugiData } from "@/lib/laba-rugi";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function PajakPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  logActivity(session!.user.id, "Buka halaman Laporan Pajak", "USER_ACTIVITY", { path: "/pajak" });
  if (role !== "MANAJER_KEUANGAN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const data = await getLabaRugiData(selectedEntity.id, currentYear);

  return (
    <PageTransition>
      <PageHeader
        title="Rekonsiliasi Laporan Pajak"
        subtitle={`Kalkulasi awal Pajak Penghasilan Badan — ${selectedEntity.name} ${currentYear}`}
        rightSlot={
          <>
            <YearSelect currentYear={currentYear} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedKey}
            />
          </>
        }
      />

      <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-[13px] text-amber-800 dark:text-amber-300">
        <strong>Perhatian:</strong> Data rekonsiliasi ini merupakan kalkulasi awal berbasis laporan internal.
        Konsultasikan dengan konsultan pajak untuk pengisian SPT resmi. Tarif PPh Badan berlaku sesuai
        ketentuan DJP yang berlaku.
      </div>

      <div className="flex flex-col gap-5">
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-subtle">
            <div className="font-bold text-navy-text">PENGHASILAN BRUTO</div>
            <div className="text-[12.5px] text-muted mt-0.5">Berdasarkan akun Pendapatan yang tercatat</div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {data.pendapatanList.length === 0 && (
                <tr><td colSpan={2} className="py-4 px-6 text-sm text-muted">Tidak ada akun pendapatan.</td></tr>
              )}
              {data.pendapatanList.map((item) => (
                <tr key={item.code} className="border-b border-surface-subtle">
                  <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                  <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold">{item.totalFmt}</td>
                </tr>
              ))}
              <tr className="bg-surface-subtle">
                <td className="py-3 px-6 font-extrabold text-navy-text">Total Penghasilan Bruto</td>
                <td className="py-3 px-6 text-right tabular-nums font-extrabold text-navy-text">{data.totalPendapatanFmt}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-subtle">
            <div className="font-bold text-navy-text">BEBAN YANG DAPAT DIKURANGKAN</div>
            <div className="text-[12.5px] text-muted mt-0.5">Berdasarkan akun Beban yang tercatat</div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {data.bebanList.length === 0 && (
                <tr><td colSpan={2} className="py-4 px-6 text-sm text-muted">Tidak ada akun beban.</td></tr>
              )}
              {data.bebanList.map((item) => (
                <tr key={item.code} className="border-b border-surface-subtle">
                  <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                  <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold">{item.totalFmt}</td>
                </tr>
              ))}
              <tr className="bg-surface-subtle">
                <td className="py-3 px-6 font-extrabold text-navy-text">Total Beban Dikurangkan</td>
                <td className="py-3 px-6 text-right tabular-nums font-extrabold text-navy-text">{data.totalBebanFmt}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={`px-6 py-5 rounded-[20px] border-2 ${data.labaBersihPositive ? "border-navy/30 bg-navy/5" : "border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10"}`}>
          <div className="text-[13px] font-semibold text-muted-stronger mb-1">
            ESTIMASI PENGHASILAN KENA PAJAK (PKP)
          </div>
          <div className="text-[12.5px] text-muted mb-3">
            Penghasilan Bruto − Beban yang Dapat Dikurangkan
          </div>
          <div className={`text-[28px] font-extrabold tabular-nums ${data.labaBersihPositive ? "text-navy-text" : "text-status-red"}`}>
            {data.labaBersihPositive ? "" : "-"}{data.labaBersihFmt}
          </div>
          {data.labaBersihPositive && (
            <div className="mt-3 text-[12.5px] text-muted-stronger">
              PPh Badan = PKP × Tarif Pajak (sesuai ketentuan DJP). Konsultasikan dengan konsultan pajak Anda.
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
