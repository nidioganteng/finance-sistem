import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getCOAList } from "@/lib/coa";
import { PageHeader } from "@/components/layout/PageHeader";
import { CoaClient } from "@/components/coa/CoaClient";

export default async function CoaPage() {
  const session = await getServerSession(authOptions);
  const { role } = session!.user;
  if (role !== "MANAJER_KEUANGAN" && role !== "SUPER_ADMIN") redirect("/dashboard");

  const coa = await getCOAList();

  return (
    <>
      <PageHeader title="Bagan Akun" subtitle="Kelola daftar akun keuangan (Chart of Accounts)" />
      <CoaClient initialCoa={coa} />
    </>
  );
}
