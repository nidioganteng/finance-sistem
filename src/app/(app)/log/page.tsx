"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getActivityLogs } from "@/lib/log";
import { PageHeader } from "@/components/layout/PageHeader";
import { LogTabs } from "@/components/log/LogTabs";
import { roleLabel } from "@/lib/rbac";
import { formatLogDetail } from "@/lib/format-log-detail";
import { PageTransition } from "@/components/layout/PageTransition";

function LogContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = tabParam === "financial" ? "financial" : tabParam === "user" ? "user" : "all";

  const [logs, setLogs] = useState<Awaited<ReturnType<typeof getActivityLogs>> | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role } = user;
    if (role !== "SUPER_ADMIN" && role !== "MANAJER_KEUANGAN" && role !== "STAF_KEUANGAN") {
      router.replace("/dashboard");
      return;
    }
    const category = tab === "financial" ? "FINANCIAL_CHANGE" : tab === "user" ? "USER_ACTIVITY" : undefined;
    setPageLoading(true);
    getActivityLogs(category)
      .then(setLogs)
      .catch(() => setLogs(null))
      .finally(() => setPageLoading(false));
  }, [user, tab]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!logs) return <div className="mt-8 p-6 text-sm text-muted">Gagal memuat log.</div>;

  return (
    <PageTransition>
      <PageHeader title="Log Aktivitas" subtitle="Riwayat aktivitas pengguna dan perubahan finansial" />

      <div className="px-4 py-3 rounded-xl bg-surface-subtle border border-border-soft text-[13px] text-muted-stronger">
        <strong>Catatan:</strong> Log Aktivitas Pengguna otomatis dihapus setelah 30 hari.
        Log Perubahan Finansial disimpan permanen (minimal 10 tahun).
      </div>

      <LogTabs currentTab={tab} />

      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-surface-hover text-left">
              <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Waktu</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Aktor</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Role</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Kategori</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Aksi</th>
              <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-muted">
                  Belum ada log untuk kategori ini.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-surface-subtle hover:bg-surface-hover/30">
                <td className="py-3 px-6 text-[12.5px] text-muted whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("id-ID")}
                </td>
                <td className="py-3 px-3 font-semibold text-navy-text text-[13px]">{log.actor?.name ?? "-"}</td>
                <td className="py-3 px-3 text-[12px] text-muted">
                  {log.actor?.role ? roleLabel(log.actor.role as Parameters<typeof roleLabel>[0]) : "-"}
                </td>
                <td className="py-3 px-3">
                  {log.category === "FINANCIAL_CHANGE" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      Finansial
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                      Pengguna
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-[13px] text-muted-stronger">{log.action}</td>
                <td className="py-3 px-6 text-[12.5px] text-muted-stronger">
                  {formatLogDetail(log.detail, log.action)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </PageTransition>
  );
}

export default function LogPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <LogContent />
    </Suspense>
  );
}
