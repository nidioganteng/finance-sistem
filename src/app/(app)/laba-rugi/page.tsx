"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
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

function LabaRugiContent() {
  const { user, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const entityParam = searchParams.get("entity") ?? undefined;
  const yearStr = searchParams.get("year") ?? undefined;
  const versionParam = searchParams.get("version") ?? undefined;

  const [pageData, setPageData] = useState<{
    entities: Awaited<ReturnType<typeof getAccessibleEntities>>;
    selectedKey: string;
    selectedEntity: Awaited<ReturnType<typeof getAccessibleEntities>>[0];
    currentYear: number;
    currentVersion: ReportVersion;
    taxData: Awaited<ReturnType<typeof getLaporanPajakData>>;
    validasi3Arah: Awaited<ReturnType<typeof getValidasiPajak3Arah>>;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { entityKeys } = user;
    const currentYear = parseInt(yearStr ?? "") || new Date().getFullYear();
    const currentVersion: ReportVersion = (versionParam ?? "internal").toUpperCase() === "UMUM" ? "UMUM" : "INTERNAL";

    setPageLoading(true);
    getAccessibleEntities(entityKeys).then(async (entities) => {
      const selectedKey = resolveEntityKey(entityParam, entityKeys);
      const selectedEntity = entities.find((e) => e.key === selectedKey);
      if (!selectedEntity) {
        setPageData(null);
        setPageLoading(false);
        return;
      }
      const [taxData, validasi3Arah] = await Promise.all([
        getLaporanPajakData(selectedEntity.id, currentYear, currentVersion, selectedEntity.name),
        getValidasiPajak3Arah(selectedEntity.id, currentYear, currentVersion),
      ]);
      setPageData({ entities, selectedKey: selectedKey!, selectedEntity, currentYear, currentVersion, taxData, validasi3Arah });
    }).catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user, entityParam, yearStr, versionParam]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;

  const { entities, selectedKey, selectedEntity, currentYear, currentVersion, taxData, validasi3Arah } = pageData;

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

export default function LabaRugiPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <LabaRugiContent />
    </Suspense>
  );
}
