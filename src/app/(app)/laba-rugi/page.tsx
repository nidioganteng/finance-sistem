import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PageTransition } from "@/components/layout/PageTransition";
import type { ReportVersion } from "@/lib/laba-rugi";
import { getLaporanPajakData } from "@/lib/pajak";
import { LabaRugiUmumView } from "@/components/laporan/LabaRugiUmumView";

export default async function LabaRugiPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string; version?: string };
}) {
  const session = await getServerSession(authOptions);
  const { entityKeys } = session!.user;

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();
  const currentVersion: ReportVersion = (searchParams.version ?? "internal").toUpperCase() === "UMUM" ? "UMUM" : "INTERNAL";

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const taxData = await getLaporanPajakData(selectedEntity.id, currentYear, currentVersion, selectedEntity.name);

  return (
    <PageTransition>
      <PageHeader
        title="Laporan Laba Rugi"
        subtitle={`Periode Januari – Desember ${currentYear} — ${selectedEntity.name} (${currentVersion === "UMUM" ? "Versi Umum" : "Versi Internal"})`}
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

      <LabaRugiUmumView data={taxData} entityKey={selectedKey} version={currentVersion} />
    </PageTransition>
  );
}
