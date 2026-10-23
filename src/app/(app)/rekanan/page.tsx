"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { canManageTransaksi } from "@/lib/rbac";
import { getRekananListAction } from "@/lib/actions/rekanan";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { RekananClient } from "@/components/rekanan/RekananClient";

export default function RekananPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [rekananData, setRekananData] = useState<{ data: Awaited<ReturnType<typeof getRekananListAction>>["data"] } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role } = user;
    if (role !== "SUPER_ADMIN" && role !== "MANAJER_KEUANGAN" && role !== "STAF_KEUANGAN") {
      router.replace("/dashboard");
      return;
    }
    setPageLoading(true);
    getRekananListAction()
      .then(({ data }) => setRekananData({ data }))
      .catch(() => setRekananData(null))
      .finally(() => setPageLoading(false));
  }, [user]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!rekananData) return <div className="mt-8 p-6 text-sm text-muted">Gagal memuat data rekanan.</div>;

  const { role } = user;
  const canManage = canManageTransaksi(role) || role === "SUPER_ADMIN";

  return (
    <PageTransition>
      <PageHeader
        title="Rekanan"
        subtitle="Database vendor, klien, subkontraktor, dan rekanan lainnya untuk pengisian otomatis transaksi"
      />
      <div className="p-4 md:p-6 space-y-6">
        <RekananClient initialRekanan={rekananData.data.filter((item) => item.tipe !== "TENAGA_AHLI")} canManage={canManage} />
      </div>
    </PageTransition>
  );
}
