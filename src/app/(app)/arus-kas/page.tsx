import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { getArusKasData } from "@/lib/arus-kas";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function ArusKasPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  logActivity(session!.user.id, "Buka halaman Arus Kas", "USER_ACTIVITY", { path: "/arus-kas" });
  if (role === "SUPER_ADMIN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const data = await getArusKasData(selectedEntity.id, currentYear);
  const hasData = data.monthly.some((m) => m.hasData);

  return (
    <PageTransition>
      <PageHeader
        title="Arus Kas"
        subtitle={`Ringkasan arus kas masuk dan keluar — ${selectedEntity.name} ${currentYear}`}
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

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Kas Masuk", value: data.totalMasukFmt, color: "text-status-green" },
          { label: "Total Kas Keluar", value: data.totalKeluarFmt, color: "text-status-red" },
          {
            label: "Net Arus Kas",
            value: (data.netTotalPositive ? "" : "-") + data.netTotalFmt,
            color: data.netTotalPositive ? "text-status-green" : "text-status-red",
          },
        ].map((card) => (
          <div key={card.label} className="bg-surface-card rounded-[16px] border border-border-soft p-5">
            <div className="text-[12px] font-semibold text-muted-faint mb-1">{card.label}</div>
            <div className={`text-[20px] font-extrabold tabular-nums ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-surface-hover text-left">
              <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Bulan</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Kas Masuk</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Kas Keluar</th>
              <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase text-right">Net Flow</th>
            </tr>
          </thead>
          <tbody>
            {!hasData && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-muted">
                  Belum ada transaksi untuk periode ini.
                </td>
              </tr>
            )}
            {data.monthly.map((m) => (
              <tr
                key={m.bulan}
                className={`border-b border-surface-subtle ${m.hasData ? "hover:bg-surface-hover/30" : "opacity-40"}`}
              >
                <td className="py-3 px-6 font-semibold text-navy-text">{m.bulan}</td>
                <td className="py-3 px-3 text-right tabular-nums text-[13px] text-status-green">{m.masukFmt}</td>
                <td className="py-3 px-3 text-right tabular-nums text-[13px] text-status-red">{m.keluarFmt}</td>
                <td className={`py-3 px-6 text-right tabular-nums text-[13px] font-bold ${m.netPositive ? "text-status-green" : "text-status-red"}`}>
                  {m.hasData ? (m.netPositive ? "+" : "-") + m.netFmt : "-"}
                </td>
              </tr>
            ))}
            <tr className="bg-surface-subtle">
              <td className="py-3 px-6 font-extrabold text-navy-text">Total {currentYear}</td>
              <td className="py-3 px-3 text-right tabular-nums font-extrabold text-status-green">{data.totalMasukFmt}</td>
              <td className="py-3 px-3 text-right tabular-nums font-extrabold text-status-red">{data.totalKeluarFmt}</td>
              <td className={`py-3 px-6 text-right tabular-nums font-extrabold ${data.netTotalPositive ? "text-status-green" : "text-status-red"}`}>
                {data.netTotalPositive ? "+" : "-"}{data.netTotalFmt}
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </PageTransition>
  );
}
