"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getJurnalTransaksiHistory } from "@/lib/jurnal-transaksi";
import { getProjectOptions } from "@/lib/piutang";
import { phpFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { JurnalTransaksiClient } from "@/components/jurnal-transaksi/JurnalTransaksiClient";
import { PageTransition } from "@/components/layout/PageTransition";

function JurnalTransaksiContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityParam = searchParams.get("entity") ?? undefined;
  const pageStr = searchParams.get("page") ?? undefined;
  const dari = searchParams.get("dari") ?? "";
  const sampai = searchParams.get("sampai") ?? "";

  const [pageData, setPageData] = useState<{
    entities: Awaited<ReturnType<typeof getAccessibleEntities>>;
    selectedEntity: Awaited<ReturnType<typeof getAccessibleEntities>>[0];
    coa: { id: string; code: string; name: string; kategori: string }[];
    groups: Awaited<ReturnType<typeof getJurnalTransaksiHistory>>["groups"];
    totalPages: number;
    page: number;
    projectOptions: Awaited<ReturnType<typeof getProjectOptions>>;
    fakturOptions: Array<{
      id: string; noFaktur: string; namaRekanan: string; namaJkp: string;
      dpp: number; dppNilaiLain: number; ppn: number; pph: number;
      nilaiProyek: number; labaSetelahPajak: number; nominalDiterima: number;
      bank?: string | null; projectId?: string | null;
      projectCode?: string | null; projectName?: string | null;
      tahunPajak: number; masaPajak: number;
      tanggalTerima?: string | null; createdAt?: string;
    }>;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role, entityKeys } = user;
    if (role === "SUPER_ADMIN") {
      router.replace("/dashboard");
      return;
    }

    const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

    setPageLoading(true);
    getAccessibleEntities(entityKeys).then(async (entities) => {
      const selectedKey = resolveEntityKey(entityParam, entityKeys);
      const selectedEntity = entities.find((e) => e.key === selectedKey);
      if (!selectedEntity) {
        setPageData(null);
        setPageLoading(false);
        return;
      }

      const [coaResp, { groups, totalPages }, projectOptions, fakturResp] = await Promise.all([
        phpFetch<{ data: { id: string; code: string; name: string; kategori: string }[] }>("/api/coa"),
        getJurnalTransaksiHistory(selectedEntity.id, page, dari || undefined, sampai || undefined),
        getProjectOptions(selectedEntity.key),
        phpFetch<{ data: Array<{
          id: string; noFaktur: string; namaRekanan: string; namaJkp: string;
          dpp: number; dppNilaiLain: number; ppn: number; pph: number;
          nilaiProyek: number; labaSetelahPajak: number; nominalDiterima: number;
          bank?: string | null; projectId?: string | null;
          projectCode?: string | null; projectName?: string | null;
          tahunPajak: number; masaPajak: number;
          tanggalTerima?: string | null; createdAt?: string;
        }> }>(
          `/api/pendapatan/faktur?entityId=${encodeURIComponent(selectedEntity.id)}`
        ).catch(() => ({ data: [] })),
      ]);

      const coa = (coaResp.data ?? []).map((c) => ({ id: c.id, code: c.code, name: c.name, kategori: c.kategori }));
      const fakturOptions = fakturResp.data ?? [];

      setPageData({ entities, selectedEntity, coa, groups, totalPages, page, projectOptions, fakturOptions });
    }).catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user, entityParam, pageStr, dari, sampai]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;

  const { entities, selectedEntity, coa, groups, totalPages, page, projectOptions, fakturOptions } = pageData;

  return (
    <PageTransition>
      <PageHeader
        title={`Entry Jurnal Transaksi – ${selectedEntity.name}`}
        subtitle="Input jurnal double-entry manual per transaksi"
        rightSlot={
          <EntitySwitcher
            entities={entities.map((e) => ({ key: e.key, name: e.name }))}
            showGrupOption={false}
            currentEntityKey={selectedEntity.key}
          />
        }
      />

      <JurnalTransaksiClient
        entityKey={selectedEntity.key}
        coa={coa}
        history={groups}
        projectOptions={projectOptions}
        fakturOptions={fakturOptions}
        page={page}
        totalPages={totalPages}
        dari={dari}
        sampai={sampai}
      />
    </PageTransition>
  );
}

export default function JurnalTransaksiPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <JurnalTransaksiContent />
    </Suspense>
  );
}
