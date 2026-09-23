import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getPenyusutanSummary } from "@/lib/aset-tetap";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PrintButton } from "@/components/shared/PrintButton";
import { AktivaTetapManager } from "@/components/aktiva-tetap/AktivaTetapManager";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function AktivaTetapPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { role, entityKeys } = session.user;
  logActivity(session.user.id, "Buka modul Aktiva Tetap", "USER_ACTIVITY", { path: "/aktiva-tetap" });
  if (role === "SUPER_ADMIN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const year = parseInt(searchParams.year ?? "") || new Date().getFullYear();

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entitas manapun.</p>;
  }

  const summary = await getPenyusutanSummary(selectedEntity.id, year);

  return (
    <PageTransition>
      <PageHeader
        title={`Aktiva Tetap & Penyusutan – ${selectedEntity.name}`}
        subtitle={`Inventaris aset tetap & otomatisasi jadwal penyusutan terhubung ke Laporan Keuangan (Tahun ${year})`}
        rightSlot={
          <>
            <PrintButton />
            <YearSelect currentYear={year} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedEntity.key}
            />
          </>
        }
      />

      <AktivaTetapManager
        summary={summary}
        entityId={selectedEntity.id}
        entityName={selectedEntity.name}
        year={year}
      />
    </PageTransition>
  );
}
