import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getUserList, getAllEntities } from "@/lib/pengguna";
import { PageHeader } from "@/components/layout/PageHeader";
import { PenggunaClient } from "@/components/pengguna/PenggunaClient";
import { logActivity } from "@/lib/actions/log";

export default async function PenggunaPage() {
  const session = await getServerSession(authOptions);
  const { role } = session!.user;
  logActivity(session!.user.id, "Buka halaman Manajemen Pengguna", "USER_ACTIVITY", { path: "/pengguna" });
  if (role !== "MANAJER_KEUANGAN" && role !== "SUPER_ADMIN") redirect("/dashboard");

  const [users, allEntities] = await Promise.all([getUserList(), getAllEntities()]);

  // Manager Keuangan tidak boleh melihat atau mengedit akun Super Admin
  const visibleUsers = role === "MANAJER_KEUANGAN"
    ? users.filter((u) => u.role !== "SUPER_ADMIN")
    : users;

  return (
    <>
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
        }))}
        allEntities={allEntities}
        viewerRole={role}
      />
    </>
  );
}
