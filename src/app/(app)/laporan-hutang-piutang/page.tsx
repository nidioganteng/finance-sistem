"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
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

function LaporanHutangPiutangContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityParam = searchParams.get("entity") ?? undefined;
  const yearStr = searchParams.get("year") ?? undefined;

  const [pageData, setPageData] = useState<{
    entities: Awaited<ReturnType<typeof getAccessibleEntities>>;
    selectedKey: string | undefined;
    currentYear: number;
    canGrup: boolean;
    entityData: Awaited<ReturnType<typeof getLaporanHutangPiutangEntityData>> | null;
    grupData: Awaited<ReturnType<typeof getLaporanHutangPiutangGrupData>> | null;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role, entityKeys } = user;
    if (role !== "SUPER_ADMIN" && role !== "MANAJER_KEUANGAN" && role !== "STAF_KEUANGAN") {
      router.replace("/dashboard");
      return;
    }
    const currentYear = parseInt(yearStr ?? "") || new Date().getFullYear();
    const canGrup = canViewGrupAggregate(role);

    setPageLoading(true);
    getAccessibleEntities(entityKeys).then(async (entities) => {
      const selectedKey = resolveReportEntityKey(entityParam, entityKeys, canGrup);
      const selectedEntity = entities.find((e) => e.key === selectedKey);
      const isGrup = !selectedEntity || selectedKey === "grup";

      const [entityData, grupData] = await Promise.all([
        selectedEntity ? getLaporanHutangPiutangEntityData(selectedEntity.key, currentYear) : null,
        isGrup && canGrup ? getLaporanHutangPiutangGrupData(currentYear) : null,
      ]);

      setPageData({ entities, selectedKey, currentYear, canGrup, entityData, grupData });
    }).catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user, entityParam, yearStr]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <div className="mt-8 p-6 text-sm text-muted">Gagal memuat data.</div>;

  const { entities, selectedKey, currentYear, canGrup, entityData, grupData } = pageData;
  const selectedEntity = entities.find((e) => e.key === selectedKey);
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

export default function LaporanHutangPiutangPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <LaporanHutangPiutangContent />
    </Suspense>
  );
}
