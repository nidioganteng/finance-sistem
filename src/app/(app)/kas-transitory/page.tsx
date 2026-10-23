"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getKasTransitory } from "@/lib/kas-transitory";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { KasTransitoryClient } from "@/components/kas-transitory/KasTransitoryClient";

function KasTransitoryContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityParam = searchParams.get("entity") ?? undefined;

  const [pageData, setPageData] = useState<{
    entities: Awaited<ReturnType<typeof getAccessibleEntities>>;
    selected: Awaited<ReturnType<typeof getAccessibleEntities>>[0];
    data: Awaited<ReturnType<typeof getKasTransitory>>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role, entityKeys } = user;
    if (!["SUPER_ADMIN", "MANAJER_KEUANGAN", "STAF_KEUANGAN"].includes(role)) {
      router.replace("/dashboard");
      return;
    }
    setPageLoading(true);
    setError(null);
    getAccessibleEntities(entityKeys).then(async (entities) => {
      const selected = entities.find((e) => e.key === resolveEntityKey(entityParam, entityKeys)) || entities[0];
      if (!selected) {
        setPageData(null);
        setPageLoading(false);
        return;
      }
      try {
        const data = await getKasTransitory(selected.id);
        setPageData({ entities, selected, data });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPageData({ entities, selected, data: null as any });
      }
    }).catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user, entityParam]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <p className="p-6 text-sm text-muted">Belum ada akses entitas.</p>;

  const { role } = user;
  const { entities, selected } = pageData;

  const header = (
    <PageHeader
      title={`Kas Transitory – ${selected.name}`}
      subtitle="Pantau dana yang sudah dicatat keluar dan belum diserahkan kepada penerima."
      rightSlot={
        <EntitySwitcher
          entities={entities.map((e) => ({ key: e.key, name: e.name }))}
          currentEntityKey={selected.key}
          showGrupOption={false}
        />
      }
    />
  );

  if (error) {
    return (
      <>
        {header}
        <div className="mt-8 rounded-xl border border-border bg-surface-card p-6 text-sm text-muted-strong">
          <p className="font-semibold text-status-red">Gagal memuat data Kas Transitory.</p>
          <p className="mt-2 text-xs">{error}</p>
          <p className="mt-2 text-xs text-muted">Pastikan server PHP aktif dan endpoint <code>/api/kas-transitory</code> tersedia. Coba muat ulang halaman.</p>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <KasTransitoryClient key={selected.id} data={pageData.data} canReverse={role !== "STAF_KEUANGAN"} />
    </>
  );
}

export default function KasTransitoryPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <KasTransitoryContent />
    </Suspense>
  );
}
