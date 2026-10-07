import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canManageTransaksi } from "@/lib/rbac";
import { getRekananListAction } from "@/lib/actions/rekanan";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { RekananClient } from "@/components/rekanan/RekananClient";

export const metadata = {
  title: "Rekanan | SIMATRA",
  description: "Database terpusat identitas Rekanan, Vendor, Klien, dan Tenaga Ahli",
};

export default async function RekananPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { role } = session.user;
  if (role !== "SUPER_ADMIN" && role !== "MANAJER_KEUANGAN" && role !== "STAF_KEUANGAN") {
    redirect("/dashboard");
  }

  const { data: initialRekanan } = await getRekananListAction();
  const canManage = canManageTransaksi(role) || role === "SUPER_ADMIN";

  return (
    <PageTransition>
      <PageHeader
        title="Rekanan"
        subtitle="Database terpusat Vendor, Klien, dan Tenaga Ahli untuk pengisian otomatis transaksi"
      />
      <div className="p-4 md:p-6 space-y-6">
        <RekananClient initialRekanan={initialRekanan} canManage={canManage} />
      </div>
    </PageTransition>
  );
}
