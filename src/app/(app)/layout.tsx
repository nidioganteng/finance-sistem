import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/Sidebar";

const SYSTEM_KEYS = ["kasKecil", "kasBesar", "bankBuku"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let customInputs: { key: string; nama: string }[] = [];
  if (session.user.role === "STAF_KEUANGAN") {
    customInputs = await prisma.jenisInputTransaksi.findMany({
      where: { active: true, key: { notIn: SYSTEM_KEYS } },
      select: { key: true, nama: true },
      orderBy: { createdAt: "asc" },
    });
  }

  return (
    <div className="flex min-h-screen bg-surface-page">
      <div className="print:hidden">
        <Sidebar role={session.user.role} customInputs={customInputs} />
      </div>
      <main className="flex-1 min-w-0 px-8 py-7 pb-16 flex flex-col gap-5">{children}</main>
    </div>
  );
}
