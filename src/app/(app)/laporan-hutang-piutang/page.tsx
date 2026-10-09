import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveReportEntityKey } from "@/lib/entity-prefs";
import { canViewGrupAggregate } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PageTransition } from "@/components/layout/PageTransition";
import {
  getLaporanHutangPiutangEntityData,
  getLaporanHutangPiutangGrupData,
} from "@/lib/laporan-hutang-piutang";
import { LaporanHutangPiutangClient } from "@/components/laporan-hutang-piutang/LaporanHutangPiutangClient";

export const dynamic = "force-dynamic";

export default async function LaporanHutangPiutangPage({
  searchParams,
}: {
  searchParams: {
    entity?: string;
    year?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, entityKeys } = session.user;
  if (role !== "SUPER_ADMIN" && role !== "MANAJER_KEUANGAN" && role !== "STAF_KEUANGAN") {
    redirect("/dashboard");
  }

  const entities = await getAccessibleEntities(entityKeys);
  const canGrup = canViewGrupAggregate(role);
  const selectedKey = resolveReportEntityKey(searchParams.entity, entityKeys, canGrup);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();

  const isGrup = !selectedEntity || selectedKey === "grup";

  const [entityData, grupData] = await Promise.all([
    selectedEntity ? getLaporanHutangPiutangEntityData(selectedEntity.key, currentYear) : null,
    isGrup && canGrup ? getLaporanHutangPiutangGrupData(currentYear) : null,
  ]);

  const entityTitle = selectedEntity ? selectedEntity.name : "Semua Entitas (Grup)";

  return (
    <PageTransition>
      <PageHeader
        title="Laporan Hutang & Piutang Antar-Entitas"
        subtitle={`Rekapitulasi dan rekonsiliasi saldo kewajiban hutang & piutang afiliasi internal — ${entityTitle} (${currentYear})`}
        rightSlot={
          <>
            <YearSelect currentYear={currentYear} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={canGrup}
              currentEntityKey={selectedKey ?? "grup"}
            />
          </>
        }
      />

      <LaporanHutangPiutangClient
        entityData={entityData}
        grupData={grupData}
        selectedEntityKey={selectedKey ?? "grup"}
        year={currentYear}
      />
    </PageTransition>
  );
}
