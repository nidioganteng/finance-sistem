import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getCOAList } from "@/lib/coa";
import { PageHeader } from "@/components/layout/PageHeader";
import { CoaClient } from "@/components/coa/CoaClient";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function CoaPage() {
  const session = await getServerSession(authOptions);
  const { role } = session!.user;
  logActivity(session!.user.id, "Buka halaman Bagan Akun", "USER_ACTIVITY", { path: "/coa" });
  if (role !== "MANAJER_KEUANGAN" && role !== "SUPER_ADMIN" && role !== "STAF_KEUANGAN") redirect("/dashboard");

  const coa = await getCOAList();

  return (
    <PageTransition>
      <PageHeader title="Bagan Akun" subtitle="Kelola daftar akun keuangan (Chart of Accounts)" />
      <CoaClient initialCoa={coa} canDelete={role !== "STAF_KEUANGAN"} />
    </PageTransition>
  );
}
