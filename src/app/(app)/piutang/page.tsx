"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getPiutangData } from "@/lib/piutang";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { PiutangClient } from "@/components/piutang/PiutangClient";
import { PageTransition } from "@/components/layout/PageTransition";

function PiutangContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityParam = searchParams.get("entity") ?? undefined;
  const tabParam = searchParams.get("tab") ?? undefined;

  const [pageData, setPageData] = useState<{
    entities: Awaited<ReturnType<typeof getAccessibleEntities>>;
    selectedKey: string | undefined;
    data: Awaited<ReturnType<typeof getPiutangData>>;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role, entityKeys } = user;
    if (role === "MANAGER_ADMIN" || role === "ADMIN_SIDAMON") {
      router.replace("/dashboard");
      return;
    }
    setPageLoading(true);
    getAccessibleEntities(entityKeys).then(async (entities) => {
      const selectedKey = resolveEntityKey(entityParam, entityKeys);
      const selectedEntity = entities.find((e) => e.key === selectedKey) ?? entities[0];
      if (!selectedEntity) {
        setPageData(null);
        setPageLoading(false);
        return;
      }
      const data = await getPiutangData(selectedEntity.key);
      setPageData({ entities, selectedKey: selectedEntity.key, data });
    }).catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user, entityParam]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;

  const { role } = user;
  const { entities, selectedKey, data } = pageData;
  const selectedEntity = entities.find((e) => e.key === selectedKey) ?? entities[0];
  const initialTab = tabParam === "arsip" || tabParam === "selesai" ? "selesai" : "berjalan";

  return (
    <PageTransition>
      <PageHeader
        title={`Kontrol Termin – ${selectedEntity.name}`}
        subtitle="Kelola status termin dan pengeluaran proyek"
        rightSlot={
          <EntitySwitcher
            entities={entities.map((e) => ({ key: e.key, name: e.name }))}
            showGrupOption={false}
            currentEntityKey={selectedKey ?? ""}
          />
        }
      />
      <PiutangClient
        projectList={data.projectList}
        summary={data.summary}
        loadingDockList={data.loadingDockList}
        userRole={role}
        isUmumEntity={selectedEntity.isUmum}
        initialTab={initialTab}
      />
    </PageTransition>
  );
}

export default function PiutangPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <PiutangContent />
    </Suspense>
  );
}
