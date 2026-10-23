"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getCOAList } from "@/lib/coa";
import { PageHeader } from "@/components/layout/PageHeader";
import { CoaClient } from "@/components/coa/CoaClient";
import { PageTransition } from "@/components/layout/PageTransition";

export default function CoaPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [coa, setCoa] = useState<Awaited<ReturnType<typeof getCOAList>> | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role } = user;
    if (role !== "MANAJER_KEUANGAN" && role !== "SUPER_ADMIN" && role !== "STAF_KEUANGAN") {
      router.replace("/dashboard");
      return;
    }
    setPageLoading(true);
    getCOAList()
      .then(setCoa)
      .catch(() => setCoa(null))
      .finally(() => setPageLoading(false));
  }, [user]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!coa) return <div className="mt-8 p-6 text-sm text-muted">Gagal memuat data COA.</div>;

  return (
    <PageTransition>
      <PageHeader title="Bagan Akun" subtitle="Kelola daftar akun keuangan (Chart of Accounts)" />
      <CoaClient initialCoa={coa as any} canDelete={true} />
    </PageTransition>
  );
}
