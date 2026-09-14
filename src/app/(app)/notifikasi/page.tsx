import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNotifFilterOptions, getNotifikasiList } from "@/lib/notifikasi";
import { markAllNotifikasiRead } from "@/lib/actions/notifikasi";
import { PageHeader } from "@/components/layout/PageHeader";
import { NotifFilterSelect } from "@/components/notifikasi/NotifFilterSelect";

export default async function NotifikasiPage({ searchParams }: { searchParams: { filter?: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  const filter = searchParams.filter ?? "semua";

  const options = getNotifFilterOptions(role);
  const list = await getNotifikasiList(role, filter);

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
        {list.length === 0 ? (
          <p className="p-6 text-sm text-muted">Tidak ada notifikasi untuk filter ini.</p>
        ) : (
          list.map((n) => (
            <div
              key={n.id}
              className={`flex gap-3 items-start px-5 py-4 border-b border-surface-subtle last:border-b-0 ${
                n.read ? "" : "bg-blue-50 dark:bg-blue-500/10"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-none ${n.read ? "bg-border" : "bg-brand"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] text-muted-stronger leading-snug">{n.text}</div>
                <div className="text-[11.5px] text-muted-faint mt-1">
                  {new Date(n.createdAt).toLocaleString("id-ID")}
                </div>
              </div>
              {!n.read && <span className="w-2 h-2 rounded-full bg-brand flex-none mt-1.5" />}
            </div>
          ))
        )}
      </div>
    </>
  );
}
