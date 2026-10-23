"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getUserList, getAllEntities } from "@/lib/pengguna";
import { PageHeader } from "@/components/layout/PageHeader";
import { PenggunaClient } from "@/components/pengguna/PenggunaClient";
import { PageTransition } from "@/components/layout/PageTransition";

export default function PenggunaPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [pageData, setPageData] = useState<{
    users: Awaited<ReturnType<typeof getUserList>>;
    allEntities: Awaited<ReturnType<typeof getAllEntities>>;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role } = user;
    if (role !== "MANAJER_KEUANGAN" && role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
      return;
    }
    setPageLoading(true);
    Promise.all([getUserList(), getAllEntities()])
      .then(([users, allEntities]) => setPageData({ users, allEntities }))
      .catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <div className="mt-8 p-6 text-sm text-muted">Gagal memuat data pengguna.</div>;

  const { role } = user;
  const { users, allEntities } = pageData;
  const visibleUsers = role === "SUPER_ADMIN"
    ? users
    : users.filter((u) => u.role !== "SUPER_ADMIN");

  return (
    <PageTransition>
      <PageHeader
        title="Manajemen Pengguna"
        subtitle="Kelola akses dan peran pengguna sistem"
      />
      <PenggunaClient
        users={visibleUsers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          entityAccess: u.entityAccess,
          entityKeys: u.entityKeys,
        }))}
        allEntities={allEntities}
        viewerRole={role}
      />
    </PageTransition>
  );
}
