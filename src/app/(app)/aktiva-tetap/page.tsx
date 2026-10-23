"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getPenyusutanSummary } from "@/lib/aset-tetap";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PrintButton } from "@/components/shared/PrintButton";
import { AktivaTetapManager } from "@/components/aktiva-tetap/AktivaTetapManager";
import { PageTransition } from "@/components/layout/PageTransition";

function AktivaTetapContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityParam = searchParams.get("entity") ?? undefined;
  const yearStr = searchParams.get("year") ?? undefined;

  const [pageData, setPageData] = useState<{
    entities: Awaited<ReturnType<typeof getAccessibleEntities>>;
    selectedEntity: Awaited<ReturnType<typeof getAccessibleEntities>>[0];
    year: number;
    summary: Awaited<ReturnType<typeof getPenyusutanSummary>>;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role, entityKeys } = user;
    if (role === "SUPER_ADMIN") {
      router.replace("/dashboard");
      return;
    }
    const year = parseInt(yearStr ?? "") || new Date().getFullYear();
    setPageLoading(true);
    getAccessibleEntities(entityKeys).then(async (entities) => {
      const selectedKey = resolveEntityKey(entityParam, entityKeys);
      const selectedEntity = entities.find((e) => e.key === selectedKey);
      if (!selectedEntity) {
        setPageData(null);
        setPageLoading(false);
        return;
      }
      const summary = await getPenyusutanSummary(selectedEntity.id, year);
      setPageData({ entities, selectedEntity, year, summary });
    }).catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user, entityParam, yearStr]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <p className="text-sm text-muted">Kamu belum punya akses ke entitas manapun.</p>;

  const { entities, selectedEntity, year, summary } = pageData;

  return (
    <PageTransition>
      <PageHeader
        title={`Aktiva Tetap & Penyusutan – ${selectedEntity.name}`}
        subtitle={`Inventaris aset tetap & otomatisasi jadwal penyusutan terhubung ke Laporan Keuangan (Tahun ${year})`}
        rightSlot={
          <>
            <PrintButton title="Aktiva Tetap" entityName={selectedEntity.name} year={year} />
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

export default function AktivaTetapPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <AktivaTetapContent />
    </Suspense>
  );
}
