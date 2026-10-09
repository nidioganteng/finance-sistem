import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getUserList, getAllEntities } from "@/lib/pengguna";
import { PageHeader } from "@/components/layout/PageHeader";
import { PenggunaClient } from "@/components/pengguna/PenggunaClient";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function PenggunaPage() {
  const session = await getServerSession(authOptions);
  const { role } = session!.user;
  if (role !== "MANAJER_KEUANGAN" && role !== "SUPER_ADMIN" && role !== "STAF_KEUANGAN") redirect("/dashboard");

  const [users, allEntities] = await Promise.all([getUserList(), getAllEntities()]);

  // Manajer Keuangan dan Staf Keuangan tidak boleh melihat atau mengedit akun Super Admin
  const visibleUsers = role === "SUPER_ADMIN"
    ? users
    : users.filter((u) => u.role !== "SUPER_ADMIN");

  return (
    <PageTransition>
      <PageHeader
        title="Manajemen Pengguna"
        subtitle="Kelola akses dan peran pengguna sistem"
      />
      <PenggunaClient
        users={visibleUsers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          entityAccess: u.entityAccess,
          entityKeys: u.entityKeys,
        }))}
        allEntities={allEntities}
        viewerRole={role}
      />
    </PageTransition>
  );
}
