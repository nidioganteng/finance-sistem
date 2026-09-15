import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { getProfitabilitasData } from "@/lib/profitabilitas";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { canViewGrupAggregate } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";

const STATUS_BADGE: Record<string, string> = {
  ON_TRACK: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  AT_RISK: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  NEEDS_AUDIT: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
};
const STATUS_LABEL: Record<string, string> = {
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  NEEDS_AUDIT: "Perlu Audit",
};

export default async function ProfitabilitasPage({
  searchParams,
}: {
  searchParams: { entity?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  if (role === "SUPER_ADMIN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const data = await getProfitabilitasData(selectedEntity.id);

  return (
    <>
      <PageHeader
        title="Profitabilitas Proyek"
        subtitle={`Analisis laba rugi per proyek — ${selectedEntity.name}`}
        rightSlot={
          <EntitySwitcher
            entities={entities.map((e) => ({ key: e.key, name: e.name }))}
            showGrupOption={canViewGrupAggregate(role)}
            currentEntityKey={selectedKey}
          />
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Nilai Kontrak", value: data.summary.totalKontrakFmt, sub: `${data.summary.projectCount} proyek`, color: "text-navy-text" },
          { label: "Total Terpakai", value: data.summary.totalTerpakaiiFmt, sub: "", color: "text-muted-stronger" },
          {
            label: "Total Laba/Rugi",
            value: (data.summary.totalLabaPositive ? "" : "-") + data.summary.totalLabaFmt,
            sub: "",
            color: data.summary.totalLabaPositive ? "text-status-green" : "text-status-red",
          },
          { label: "Rata-rata Margin", value: data.summary.avgMargin + "%", sub: "", color: "text-navy-text" },
        ].map((card) => (
          <div key={card.label} className="bg-surface-card rounded-[16px] border border-border-soft p-5">
            <div className="text-[12px] font-semibold text-muted-faint mb-1">{card.label}</div>
            <div className={`text-[20px] font-extrabold tabular-nums ${card.color}`}>{card.value}</div>
            {card.sub && <div className="text-[11.5px] text-muted mt-1">{card.sub}</div>}
          </div>
        ))}
      </div>

      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-hover text-left">
              <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Kode</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Nama Proyek</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Nilai Kontrak</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Terpakai</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Laba/Rugi</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Margin</th>
              <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Status Termin</th>
            </tr>
          </thead>
          <tbody>
            {data.projects.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-muted">
                  Belum ada proyek untuk entitas ini.
                </td>
              </tr>
            )}
            {data.projects.map((p) => (
              <tr key={p.code} className="border-b border-surface-subtle hover:bg-surface-hover/30">
                <td className="py-3 px-6 font-mono font-semibold text-navy-text text-[13px]">{p.code}</td>
                <td className="py-3 px-3 text-[13.5px] text-muted-stronger">{p.name}</td>
                <td className="py-3 px-3 text-right tabular-nums text-[13px]">{p.kontrakFmt}</td>
                <td className="py-3 px-3 text-right tabular-nums text-[13px]">{p.terpakaiiFmt}</td>
                <td className={`py-3 px-3 text-right tabular-nums text-[13px] font-semibold ${p.labaPositive ? "text-status-green" : "text-status-red"}`}>
                  {p.labaPositive ? "" : "-"}{p.labaFmt}
                </td>
                <td className={`py-3 px-3 text-right text-[13px] font-semibold ${Number(p.margin) >= 0 ? "text-status-green" : "text-status-red"}`}>
                  {p.margin}%
                </td>
                <td className="py-3 px-6">
                  {p.terminStatus ? (
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${STATUS_BADGE[p.terminStatus]}`}>
                      {STATUS_LABEL[p.terminStatus]}
                    </span>
                  ) : (
                    <span className="text-[12px] text-muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
