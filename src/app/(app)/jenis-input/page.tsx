import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getJenisInputList } from "@/lib/jenis-input";
import { PageHeader } from "@/components/layout/PageHeader";
import { JenisInputClient } from "@/components/jenis-input/JenisInputClient";

export default async function JenisInputPage() {
  const session = await getServerSession(authOptions);
  const { role } = session!.user;
  if (role !== "STAF_KEUANGAN") redirect("/dashboard");

  const data = await getJenisInputList();

  return (
    <>
      <PageHeader
        title="Kelola Jenis Input Transaksi"
        subtitle="Atur kategori input transaksi yang tersedia untuk staf keuangan"
      />
      <JenisInputClient
        initialData={data.map((d) => ({
          id: d.id,
          key: d.key,
          nama: d.nama,
          active: d.active,
          createdBy: d.createdBy,
          createdAt: d.createdAt,
          arahPencatatan: (d.extraFieldsJson as { arahPencatatan?: string } | null)?.arahPencatatan ?? null,
        }))}
        userRole={role}
      />
    </>
  );
}
