"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getNotifFilterOptions, getNotifikasiList, getNotifTypeLabels } from "@/lib/notifikasi";
import { markAllNotifikasiRead } from "@/lib/actions/notifikasi";
import { PageHeader } from "@/components/layout/PageHeader";
import { PaginationNav } from "@/components/shared/PaginationNav";
import { NotifFilterSelect } from "@/components/notifikasi/NotifFilterSelect";
import { NotifikasiListClient } from "@/components/notifikasi/NotifikasiListClient";
import { PageTransition } from "@/components/layout/PageTransition";

function NotifikasiContent() {
  const { user, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter") ?? "semua";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [pageData, setPageData] = useState<{
    options: ReturnType<typeof getNotifFilterOptions>;
    list: Awaited<ReturnType<typeof getNotifikasiList>>["list"];
    totalPages: number;
    typeLabels: ReturnType<typeof getNotifTypeLabels>;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const loadData = () => {
    if (!user) return;
    const { role } = user;
    setPageLoading(true);
    const options = getNotifFilterOptions(role);
    const typeLabels = getNotifTypeLabels(role);
    getNotifikasiList(role, filter, page)
      .then(({ list, totalPages }) => {
        setPageData({ options, list, totalPages, typeLabels });
      })
      .catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [user, filter, page]);

  const handleMarkAllRead = async () => {
    await markAllNotifikasiRead();
    loadData();
  };

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <div className="mt-8 p-6 text-sm text-muted">Gagal memuat notifikasi.</div>;

  const { options, list, totalPages, typeLabels } = pageData;

  return (
    <PageTransition>
      <PageHeader title="Notifikasi" subtitle="Seluruh riwayat notifikasi sistem" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <NotifFilterSelect options={options} current={filter} />
        <button
          type="button"
          onClick={handleMarkAllRead}
          className="px-4 py-2.5 rounded-[11px] border border-border-soft text-[13px] font-semibold text-muted-stronger bg-surface-card"
        >
          Tandai Semua Sudah Dibaca
        </button>
      </div>

      <div className="bg-surface-card border border-border-soft rounded-[20px] overflow-hidden">
        <NotifikasiListClient
          initialList={list.map((n) => ({
            id: n.id,
            text: n.text,
            typeLabel: typeLabels[n.type] ?? n.type,
            read: n.read,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      </div>

      <PaginationNav
        page={page}
        totalPages={totalPages}
        buildHref={(p) => {
          const params = new URLSearchParams();
          if (filter && filter !== "semua") params.set("filter", filter);
          params.set("page", String(p));
          return `/notifikasi?${params.toString()}`;
        }}
      />
    </PageTransition>
  );
}

export default function NotifikasiPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <NotifikasiContent />
    </Suspense>
  );
}
