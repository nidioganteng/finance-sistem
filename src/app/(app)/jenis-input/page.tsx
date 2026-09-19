import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getJenisInputList } from "@/lib/jenis-input";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { JenisInputClient } from "@/components/jenis-input/JenisInputClient";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function JenisInputPage() {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  logActivity(session!.user.id, "Buka halaman Jenis Input Transaksi", "USER_ACTIVITY", { path: "/jenis-input" });
  if (role !== "STAF_KEUANGAN" && role !== "MANAJER_KEUANGAN") redirect("/dashboard");

  const [data, entities] = await Promise.all([
    getJenisInputList(),
    getAccessibleEntities(entityKeys),
  ]);

  return (
    <PageTransition>
      <PageHeader
        title="Kelola Jenis Input Transaksi"
        subtitle="Atur kategori input transaksi yang tersedia untuk staf keuangan"
      />
      <JenisInputClient
        initialData={data.map((d) => {
          const extra = d.extraFieldsJson as { arahLaporan?: string[]; entityKeys?: string[] } | null;
          return {
            id: d.id,
            key: d.key,
            nama: d.nama,
            active: d.active,
            createdBy: d.createdBy,
            createdAt: d.createdAt,
            arahLaporan: Array.isArray(extra?.arahLaporan) ? extra.arahLaporan : [],
            entityKeys: Array.isArray(extra?.entityKeys) ? extra.entityKeys : [],
          };
        })}
        entities={entities.map((e) => ({ key: e.key, name: e.name }))}
        userRole={role}
      />
    </PageTransition>
  );
}
