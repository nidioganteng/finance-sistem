"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getJenisInputList } from "@/lib/jenis-input";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { JenisInputClient } from "@/components/jenis-input/JenisInputClient";
import { PageTransition } from "@/components/layout/PageTransition";

export default function JenisInputPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [pageData, setPageData] = useState<{
    data: Awaited<ReturnType<typeof getJenisInputList>>;
    entities: Awaited<ReturnType<typeof getAccessibleEntities>>;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role, entityKeys } = user;
    if (role !== "SUPER_ADMIN" && role !== "MANAJER_KEUANGAN") {
      router.replace("/dashboard");
      return;
    }
    setPageLoading(true);
    Promise.all([getJenisInputList(), getAccessibleEntities(entityKeys)])
      .then(([data, entities]) => setPageData({ data, entities }))
      .catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <div className="mt-8 p-6 text-sm text-muted">Gagal memuat data.</div>;

  const { role } = user;
  const { data, entities } = pageData;

  return (
    <PageTransition>
      <PageHeader
        title="Kelola Jenis Input Transaksi"
        subtitle="Atur kategori input transaksi yang tersedia untuk staf keuangan"
      />
      <JenisInputClient
        initialData={data.map((d) => {
          const extra = d.extraFieldsJson as { arahLaporan?: string[]; entityKeys?: string[] } | null;
          return {
            id: d.id,
            key: d.key,
            nama: d.nama,
            active: d.active,
            createdBy: d.createdBy,
            createdAt: d.createdAt,
            arahLaporan: Array.isArray(extra?.arahLaporan) ? extra.arahLaporan : [],
            entityKeys: Array.isArray(extra?.entityKeys) ? extra.entityKeys : [],
          };
        })}
        entities={entities.map((e) => ({ key: e.key, name: e.name }))}
        userRole={role}
      />
    </PageTransition>
  );
}
