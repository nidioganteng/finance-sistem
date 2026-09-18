import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getActivityLogs } from "@/lib/log";
import { PageHeader } from "@/components/layout/PageHeader";
import { LogTabs } from "@/components/log/LogTabs";
import { roleLabel } from "@/lib/rbac";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function LogPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role } = session!.user;
  logActivity(session!.user.id, "Buka halaman Log Aktivitas", "USER_ACTIVITY", { path: "/log" });
  if (role !== "SUPER_ADMIN" && role !== "MANAJER_KEUANGAN") redirect("/dashboard");

  const tab = searchParams.tab === "financial" ? "financial" : "user";
  const category = tab === "financial" ? "FINANCIAL_CHANGE" : "USER_ACTIVITY";
  const logs = await getActivityLogs(category);

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
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Aksi</th>
              <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-muted">
                  Belum ada log untuk kategori ini.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-surface-subtle hover:bg-surface-hover/30">
                <td className="py-3 px-6 text-[12.5px] text-muted whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("id-ID")}
                </td>
                <td className="py-3 px-3 font-semibold text-navy-text text-[13px]">{log.actor.name}</td>
                <td className="py-3 px-3 text-[12px] text-muted">
                  {log.actor.role ? roleLabel(log.actor.role) : "-"}
                </td>
                <td className="py-3 px-3 text-[13px] text-muted-stronger">{log.action}</td>
                <td className="py-3 px-6">
                  {log.detail && (
                    <code className="text-[11.5px] text-muted bg-surface-subtle px-2 py-1 rounded">
                      {JSON.stringify(log.detail).slice(0, 120)}
                    </code>
                  )}
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
