import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { getLabaRugiData } from "@/lib/laba-rugi";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";

export default async function LabaRugiPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  if (role === "SUPER_ADMIN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey =
    searchParams.entity && entityKeys.includes(searchParams.entity)
      ? searchParams.entity
      : entityKeys[0];
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const data = await getLabaRugiData(selectedEntity.id, currentYear);

  return (
    <>
      <PageHeader
        title="Laporan Laba Rugi"
        subtitle={`Periode Januari – Desember ${currentYear} — ${selectedEntity.name}`}
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

      {data.pendapatanList.length === 0 && data.bebanList.length === 0 ? (
        <div className="bg-white rounded-[20px] border border-black/[.06] py-16 text-center">
          <div className="text-sm font-semibold text-muted-stronger mb-1">Tidak ada data</div>
          <p className="text-[13px] text-muted">Isi data COA (Pendapatan/Beban) dan transaksi terlebih dahulu.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-[20px] border border-black/[.06] overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-subtle">
              <div className="font-bold text-navy-text">PENDAPATAN</div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {data.pendapatanList.length === 0 && (
                  <tr><td colSpan={2} className="py-4 px-6 text-sm text-muted">Tidak ada akun pendapatan.</td></tr>
                )}
                {data.pendapatanList.map((item) => (
                  <tr key={item.code} className="border-b border-surface-subtle">
                    <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                    <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold text-status-green">{item.totalFmt}</td>
                  </tr>
                ))}
                <tr className="bg-green-50">
                  <td className="py-3 px-6 font-extrabold text-navy-text">Total Pendapatan</td>
                  <td className="py-3 px-6 text-right tabular-nums font-extrabold text-status-green">{data.totalPendapatanFmt}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-[20px] border border-black/[.06] overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-subtle">
              <div className="font-bold text-navy-text">BEBAN</div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {data.bebanList.length === 0 && (
                  <tr><td colSpan={2} className="py-4 px-6 text-sm text-muted">Tidak ada akun beban.</td></tr>
                )}
                {data.bebanList.map((item) => (
                  <tr key={item.code} className="border-b border-surface-subtle">
                    <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                    <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold text-status-red">{item.totalFmt}</td>
                  </tr>
                ))}
                <tr className="bg-red-50">
                  <td className="py-3 px-6 font-extrabold text-navy-text">Total Beban</td>
                  <td className="py-3 px-6 text-right tabular-nums font-extrabold text-status-red">{data.totalBebanFmt}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={`px-6 py-5 rounded-[20px] border-2 ${data.labaBersihPositive ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
            <div className="text-[13px] font-semibold text-muted-stronger mb-1">
              {data.labaBersihPositive ? "LABA BERSIH" : "RUGI BERSIH"}
            </div>
            <div className={`text-[28px] font-extrabold tabular-nums ${data.labaBersihPositive ? "text-status-green" : "text-status-red"}`}>
              {data.labaBersihPositive ? "" : "-"}{data.labaBersihFmt}
            </div>
            <div className="text-[12px] text-muted mt-1">
              Total Pendapatan − Total Beban = {data.labaBersihPositive ? "+" : "-"}{data.labaBersihFmt}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
