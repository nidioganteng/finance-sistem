"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getDaftarAkunData } from "@/lib/daftar-akun";
import { canManageTransaksi } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PrintButton } from "@/components/shared/PrintButton";
import { DaftarAkunClient } from "@/components/daftar-akun/DaftarAkunClient";
import { PageTransition } from "@/components/layout/PageTransition";

function DaftarAkunContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityParam = searchParams.get("entity") ?? undefined;
  const yearStr = searchParams.get("year") ?? undefined;

  const [pageData, setPageData] = useState<{
    entities: Awaited<ReturnType<typeof getAccessibleEntities>>;
    selectedEntity: Awaited<ReturnType<typeof getAccessibleEntities>>[0];
    year: number;
    rows: Awaited<ReturnType<typeof getDaftarAkunData>>["rows"];
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
      const { rows } = await getDaftarAkunData(selectedEntity.id, year);
      setPageData({ entities, selectedEntity, year, rows });
    }).catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user, entityParam, yearStr]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;

  const { role } = user;
  const { entities, selectedEntity, year, rows } = pageData;

  return (
    <PageTransition>
      <PageHeader
        title={`Daftar Akun – ${selectedEntity.name}`}
        subtitle="Seluruh akun COA beserta saldo awal, mutasi, dan saldo akhir"
        rightSlot={
          <>
            <PrintButton title="Daftar Akun" entityName={selectedEntity.name} year={year} />
            <YearSelect currentYear={year} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedEntity.key}
            />
          </>
        }
      />

      <DaftarAkunClient
        rows={rows}
        entityId={selectedEntity.id}
        currentEntityKey={selectedEntity.key}
        year={year}
        canEdit={canManageTransaksi(role)}
      />
    </PageTransition>
  );
}

export default function DaftarAkunPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <DaftarAkunContent />
    </Suspense>
  );
}
