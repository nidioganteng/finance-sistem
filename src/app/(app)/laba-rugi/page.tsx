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
import { getValidasiPajak3Arah } from "@/lib/validasi-pajak-3arah";
import { LabaRugiUmumView } from "@/components/laporan/LabaRugiUmumView";
import { ValidasiPajak3ArahCard } from "@/components/laporan/ValidasiPajak3ArahCard";

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

  const [taxData, validasi3Arah] = await Promise.all([
    getLaporanPajakData(selectedEntity.id, currentYear, currentVersion, selectedEntity.name),
    getValidasiPajak3Arah(selectedEntity.id, currentYear, currentVersion),
  ]);

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

      <div className="flex flex-col gap-6">
        <ValidasiPajak3ArahCard data={validasi3Arah} entityName={selectedEntity.name} />
        <LabaRugiUmumView data={taxData} entityKey={selectedKey} version={currentVersion} />
      </div>
    </PageTransition>
  );
}
