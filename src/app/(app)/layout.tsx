import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { phpFetch, getPhpToken } from "@/lib/api-client";
import { AppShell } from "@/components/layout/AppShell";

const SYSTEM_KEYS = ["kasKecil", "kasBesar", "bankBuku"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let customInputs: { key: string; nama: string }[] = [];
  if (session.user.role === "STAF_KEUANGAN" || session.user.role === "MANAJER_KEUANGAN") {
    try {
      const token = await getPhpToken();
      const resp = await phpFetch<{ data: { key: string; nama: string; active: boolean; extraFieldsJson: { entityKeys?: string[] } | null }[] }>(
        "/api/jenis-input", token
      );
      const userEntityKeys = session.user.entityKeys;
      customInputs = (resp.data ?? [])
        .filter((ji) => ji.active && !SYSTEM_KEYS.includes(ji.key))
        .filter((ji) => {
          const scope = Array.isArray(ji.extraFieldsJson?.entityKeys) ? ji.extraFieldsJson!.entityKeys! : [];
          return scope.length === 0 || scope.some((k) => userEntityKeys.includes(k));
        })
        .map(({ key, nama }) => ({ key, nama }));
    } catch {
      customInputs = [];
    }
  }

  return (
    <AppShell role={session.user.role} customInputs={customInputs}>
      {children}
    </AppShell>
  );
}
