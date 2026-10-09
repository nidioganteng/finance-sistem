import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDokumenList } from "@/lib/dokumen";
import { PageHeader } from "@/components/layout/PageHeader";
import { DokumenClient } from "@/components/dokumen/DokumenClient";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function DokumenPage({
  searchParams,
}: {
  searchParams: { kategori?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role } = session!.user;
  if (role === "SUPER_ADMIN" || role === "MANAGER_ADMIN" || role === "ADMIN_SIDAMON") {
    redirect("/dashboard");
  }

  const kategori = searchParams.kategori ?? "semua";
  const dokumen = await getDokumenList(kategori);

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
