import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getJenisInputList } from "@/lib/jenis-input";
import { PageHeader } from "@/components/layout/PageHeader";
import { JenisInputClient } from "@/components/jenis-input/JenisInputClient";
import { logActivity } from "@/lib/actions/log";

export default async function JenisInputPage() {
  const session = await getServerSession(authOptions);
  const { role } = session!.user;
  logActivity(session!.user.id, "Buka halaman Jenis Input Transaksi", "USER_ACTIVITY", { path: "/jenis-input" });
  if (role !== "STAF_KEUANGAN" && role !== "MANAJER_KEUANGAN") redirect("/dashboard");

  const data = await getJenisInputList();

  return (
    <>
      <PageHeader
        title="Kelola Jenis Input Transaksi"
        subtitle="Atur kategori input transaksi yang tersedia untuk staf keuangan"
      />
      <JenisInputClient
        initialData={data.map((d) => {
          const extra = d.extraFieldsJson as { arahLaporan?: string[] } | null;
          return {
            id: d.id,
            key: d.key,
            nama: d.nama,
            active: d.active,
            createdBy: d.createdBy,
            createdAt: d.createdAt,
            arahLaporan: Array.isArray(extra?.arahLaporan) ? extra.arahLaporan : [],
          };
        })}
        userRole={role}
      />
    </>
  );
}
