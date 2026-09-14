import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNotifFilterOptions, getNotifikasiList, getNotifTypeLabels } from "@/lib/notifikasi";
import { markAllNotifikasiRead } from "@/lib/actions/notifikasi";
import { PageHeader } from "@/components/layout/PageHeader";
import { NotifFilterSelect } from "@/components/notifikasi/NotifFilterSelect";
import { NotifikasiListClient } from "@/components/notifikasi/NotifikasiListClient";

export default async function NotifikasiPage({ searchParams }: { searchParams: { filter?: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  const filter = searchParams.filter ?? "semua";

  const options = getNotifFilterOptions(role);
  const list = await getNotifikasiList(role, filter);
  const typeLabels = getNotifTypeLabels(role);

  return (
    <>
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
    </>
  );
}
