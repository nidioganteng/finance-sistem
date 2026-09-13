import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getUserList, getAllEntities } from "@/lib/pengguna";
import { PageHeader } from "@/components/layout/PageHeader";
import { PenggunaClient } from "@/components/pengguna/PenggunaClient";

export default async function PenggunaPage() {
  const session = await getServerSession(authOptions);
  const { role } = session!.user;
  if (role !== "MANAJER_KEUANGAN" && role !== "SUPER_ADMIN") redirect("/dashboard");

  const [users, allEntities] = await Promise.all([getUserList(), getAllEntities()]);

  return (
    <>
      <PageHeader
        title="Manajemen Pengguna"
        subtitle="Kelola akses dan peran pengguna sistem"
      />
      <PenggunaClient
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          entityAccess: u.entityAccess,
        }))}
        allEntities={allEntities}
      />
    </>
  );
}
