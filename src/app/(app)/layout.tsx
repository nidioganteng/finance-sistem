import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";

const SYSTEM_KEYS = ["kasKecil", "kasBesar", "bankBuku"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let customInputs: { key: string; nama: string }[] = [];
  if (session.user.role === "STAF_KEUANGAN" || session.user.role === "MANAJER_KEUANGAN") {
    customInputs = await prisma.jenisInputTransaksi.findMany({
      where: { active: true, key: { notIn: SYSTEM_KEYS } },
      select: { key: true, nama: true },
      orderBy: { createdAt: "asc" },
    });
  }

  return (
    <AppShell role={session.user.role} customInputs={customInputs}>
      {children}
    </AppShell>
  );
}
