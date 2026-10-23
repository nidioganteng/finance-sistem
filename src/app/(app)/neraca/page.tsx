"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { getLaporanKeuanganData } from "@/lib/laporan-keuangan";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PageTransition } from "@/components/layout/PageTransition";
import type { ReportVersion } from "@/lib/laba-rugi";
import { NeracaView } from "@/components/laporan/NeracaView";

function NeracaContent() {
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
    data: Awaited<ReturnType<typeof getLaporanKeuanganData>>;
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
      const data = await getLaporanKeuanganData(selectedEntity.id, currentYear, currentVersion);
      setPageData({ entities, selectedKey: selectedKey!, selectedEntity, currentYear, currentVersion, data });
    }).catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user, entityParam, yearStr, versionParam]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;

  const { entities, selectedKey, selectedEntity, currentYear, currentVersion, data } = pageData;

  return (
    <PageTransition>
      <PageHeader
        title="Neraca"
        subtitle={`Posisi keuangan per 31 Desember ${currentYear} — ${selectedEntity.name} (${currentVersion === "UMUM" ? "Versi Umum" : "Versi Internal"})`}
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

      <div className="px-4 py-3 rounded-xl bg-surface-subtle border border-border-soft text-[13px] text-muted-stronger">
        Data Neraca dihitung otomatis dari saldo awal dan seluruh transaksi kas, bank, serta jurnal yang tercatat.
      </div>

      {data.aset.length === 0 && data.kewajiban.length === 0 && data.modal.length === 0 ? (
        <div className="bg-surface-card rounded-[20px] border border-border-soft py-16 text-center">
          <div className="text-sm font-semibold text-muted-stronger mb-1">Tidak ada data</div>
          <p className="text-[13px] text-muted">Isi data COA (Aset/Kewajiban/Modal) dan transaksi terlebih dahulu.</p>
        </div>
      ) : (
        <NeracaView data={data} year={currentYear} entityName={selectedEntity.name} />
      )}
    </PageTransition>
  );
}

export default function NeracaPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <NeracaContent />
    </Suspense>
  );
}
