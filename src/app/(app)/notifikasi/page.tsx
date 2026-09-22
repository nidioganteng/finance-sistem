import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getNotifFilterOptions, getNotifikasiList, getNotifTypeLabels } from "@/lib/notifikasi";
import { markAllNotifikasiRead } from "@/lib/actions/notifikasi";
import { PageHeader } from "@/components/layout/PageHeader";
import { PaginationNav } from "@/components/shared/PaginationNav";
import { logActivity } from "@/lib/actions/log";
import { NotifFilterSelect } from "@/components/notifikasi/NotifFilterSelect";
import { NotifikasiListClient } from "@/components/notifikasi/NotifikasiListClient";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function NotifikasiPage({ searchParams }: { searchParams: { filter?: string; page?: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  logActivity(session!.user.id, "Buka halaman Notifikasi", "USER_ACTIVITY", { path: "/notifikasi" });
  if (role === "STAF_KEUANGAN") redirect("/dashboard");
  const filter = searchParams.filter ?? "semua";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const options = getNotifFilterOptions(role);
  const { list, totalPages } = await getNotifikasiList(role, filter, page);
  const typeLabels = getNotifTypeLabels(role);

  return (
    <PageTransition>
      <PageHeader title="Notifikasi" subtitle="Seluruh riwayat notifikasi sistem" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <NotifFilterSelect options={options} current={filter} />
        <form action={markAllNotifikasiRead}>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-[11px] border border-border-soft text-[13px] font-semibold text-muted-stronger bg-surface-card"
          >
            Tandai Semua Sudah Dibaca
          </button>
        </form>
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
