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
    const allCustom = await prisma.jenisInputTransaksi.findMany({
      where: { active: true, key: { notIn: SYSTEM_KEYS } },
      select: { key: true, nama: true, extraFieldsJson: true },
      orderBy: { createdAt: "asc" },
    });
    const userEntityKeys = session.user.entityKeys;
    customInputs = allCustom
      .filter((ji) => {
        const extra = ji.extraFieldsJson as { entityKeys?: string[] } | null;
        const scope = Array.isArray(extra?.entityKeys) ? extra.entityKeys : [];
        // scope kosong = global; non-kosong = hanya tampil jika irisan dengan entitas user
        return scope.length === 0 || scope.some((k) => userEntityKeys.includes(k));
      })
      .map(({ key, nama }) => ({ key, nama }));
  }

  return (
    <AppShell role={session.user.role} customInputs={customInputs}>
      {children}
    </AppShell>
  );
}
