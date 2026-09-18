import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDokumenList } from "@/lib/dokumen";
import { PageHeader } from "@/components/layout/PageHeader";
import { DokumenFilterTabs } from "@/components/dokumen/DokumenFilterTabs";
import { ExternalLink } from "lucide-react";
import { logActivity } from "@/lib/actions/log";

const KATEGORI_LABEL: Record<string, string> = {
  SOP: "SOP",
  DOKUMEN_PENDUKUNG: "Dokumen Pendukung",
};

export default async function DokumenPage({
  searchParams,
}: {
  searchParams: { kategori?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role } = session!.user;
  logActivity(session!.user.id, "Buka halaman Dokumen & SOP", "USER_ACTIVITY", { path: "/dokumen" });
  if (role === "SUPER_ADMIN" || role === "MANAGER_ADMIN" || role === "ADMIN_SIDAMON") {
    redirect("/dashboard");
  }

  const kategori = searchParams.kategori ?? "semua";
  const dokumen = await getDokumenList(kategori);

  return (
    <>
      <PageHeader
        title="Dokumen & SOP Keuangan"
        subtitle="Arsip dokumen dan prosedur standar operasional"
      />

      <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-[13px] text-amber-800 dark:text-amber-300">
        <strong>Fitur upload dokumen</strong> akan tersedia di fase berikutnya. Untuk sementara, hubungi
        administrator sistem untuk menambahkan dokumen baru.
      </div>

      <DokumenFilterTabs current={kategori} />

      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
        {dokumen.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-sm font-semibold text-muted-stronger mb-1">Belum ada dokumen</div>
            <p className="text-[13px] text-muted">Belum ada dokumen tersimpan untuk kategori ini.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-hover text-left">
                <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Judul</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Kategori</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Diupload Oleh</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Tanggal</th>
                <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Dokumen</th>
              </tr>
            </thead>
            <tbody>
              {dokumen.map((d) => (
                <tr key={d.id} className="border-b border-surface-subtle hover:bg-surface-hover/30">
                  <td className="py-3 px-6 font-semibold text-navy-text">{d.judul}</td>
                  <td className="py-3 px-3">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-surface-hover text-muted-stronger">
                      {KATEGORI_LABEL[d.kategori] ?? d.kategori}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[12.5px] text-muted">{d.uploadedBy.name}</td>
                  <td className="py-3 px-3 text-[12.5px] text-muted">
                    {new Date(d.createdAt).toLocaleDateString("id-ID")}
                  </td>
                  <td className="py-3 px-6">
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline"
                    >
                      <ExternalLink size={13} /> Buka
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
