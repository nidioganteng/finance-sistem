"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getDokumenList } from "@/lib/dokumen";
import { PageHeader } from "@/components/layout/PageHeader";
import { DokumenClient } from "@/components/dokumen/DokumenClient";
import { PageTransition } from "@/components/layout/PageTransition";

function DokumenContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const kategori = searchParams.get("kategori") ?? "semua";

  const [dokumen, setDokumen] = useState<Awaited<ReturnType<typeof getDokumenList>> | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role } = user;
    if (role === "SUPER_ADMIN" || role === "MANAGER_ADMIN" || role === "ADMIN_SIDAMON") {
      router.replace("/dashboard");
      return;
    }
    setPageLoading(true);
    getDokumenList(kategori)
      .then(setDokumen)
      .catch(() => setDokumen(null))
      .finally(() => setPageLoading(false));
  }, [user, kategori]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!dokumen) return <div className="mt-8 p-6 text-sm text-muted">Gagal memuat dokumen.</div>;

  const { role } = user;
  const canUpload = role === "MANAJER_KEUANGAN" || role === "STAF_KEUANGAN";
  const canDelete = role === "MANAJER_KEUANGAN";

  return (
    <PageTransition>
      <PageHeader
        title="Dokumen & SOP Keuangan"
        subtitle="Arsip dokumen dan prosedur standar operasional"
      />
      <DokumenClient
        dokumen={dokumen as any}
        kategori={kategori}
        canUpload={canUpload}
        canDelete={canDelete}
      />
    </PageTransition>
  );
}

export default function DokumenPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <DokumenContent />
    </Suspense>
  );
}
