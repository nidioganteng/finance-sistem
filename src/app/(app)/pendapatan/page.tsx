"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { canManageTransaksi } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { PageTransition } from "@/components/layout/PageTransition";
import { getLaporanPendapatanData } from "@/lib/pendapatan";
import { LaporanPendapatanClient } from "@/components/pendapatan/LaporanPendapatanClient";

function PendapatanContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityParam = searchParams.get("entity") ?? undefined;
  const yearStr = searchParams.get("year") ?? undefined;
  const masaPajakStr = searchParams.get("masaPajak") ?? undefined;

  const [pageData, setPageData] = useState<{
    entities: Awaited<ReturnType<typeof getAccessibleEntities>>;
    selectedEntity: Awaited<ReturnType<typeof getAccessibleEntities>>[0];
    data: NonNullable<Awaited<ReturnType<typeof getLaporanPendapatanData>>>;
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
    const masaPajak = masaPajakStr ? parseInt(masaPajakStr) : null;

    setPageLoading(true);
    getAccessibleEntities(entityKeys).then(async (entities) => {
      const selectedKey = resolveEntityKey(entityParam, entityKeys);
      const selectedEntity = entities.find((e) => e.key === selectedKey) ?? entities[0];
      if (!selectedEntity) {
        router.replace("/dashboard");
        return;
      }
      const data = await getLaporanPendapatanData(selectedEntity.id, currentYear, masaPajak);
      if (!data) {
        router.replace("/dashboard");
        return;
      }
      setPageData({ entities, selectedEntity, data });
    }).catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user, entityParam, yearStr, masaPajakStr]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <div className="mt-8 p-6 text-sm text-muted">Gagal memuat data.</div>;

  const { role } = user;
  const { entities, selectedEntity, data } = pageData;
  const canEdit = role === "SUPER_ADMIN" || canManageTransaksi(role);

  return (
    <PageTransition>
      <PageHeader
        title={`Laporan Pendapatan – ${selectedEntity.name}`}
        subtitle={`Rekapitulasi Faktur Pajak Penjualan, Realisasi Kas Bank, dan Audit SPT — ${selectedEntity.legalName ?? selectedEntity.name}`}
        rightSlot={
          <EntitySwitcher
            entities={entities.map((e) => ({ key: e.key, name: e.name }))}
            showGrupOption={false}
            currentEntityKey={selectedEntity.key}
          />
        }
      />
      <div className="mt-6">
        <LaporanPendapatanClient
          data={data}
          canEdit={canEdit}
          availableEntities={entities.map((e) => ({
            id: e.id,
            key: e.key,
            name: e.name,
          }))}
        />
      </div>
    </PageTransition>
  );
}

export default function LaporanPendapatanPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <PendapatanContent />
    </Suspense>
  );
}
