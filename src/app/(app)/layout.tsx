"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { phpFetch } from "@/lib/api-client";
import { getStoredToken } from "@/lib/auth-store";
import { AppShell } from "@/components/layout/AppShell";
import { Role } from "@/types/app-enums";

const SYSTEM_KEYS = ["kasKecil", "kasBesar", "bankBuku"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [customInputs, setCustomInputs] = useState<{ key: string; nama: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "STAF_KEUANGAN" && user.role !== "MANAJER_KEUANGAN") return;

    const token = getStoredToken();
    if (!token) return;

    phpFetch<{ data: { key: string; nama: string; active: boolean; extraFieldsJson: { entityKeys?: string[] } | null }[] }>(
      "/api/jenis-input", token
    )
      .then((resp) => {
        const userEntityKeys = user.entityKeys;
        setCustomInputs(
          (resp.data ?? [])
            .filter((ji) => ji.active && !SYSTEM_KEYS.includes(ji.key))
            .filter((ji) => {
              const scope = Array.isArray(ji.extraFieldsJson?.entityKeys)
                ? ji.extraFieldsJson!.entityKeys!
                : [];
              return scope.length === 0 || scope.some((k) => userEntityKeys.includes(k));
            })
            .map(({ key, nama }) => ({ key, nama }))
        );
      })
      .catch(() => {});
  }, [user]);

  // Tampilkan loading singkat sebelum auth resolve
  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <AppShell role={user.role as Role} customInputs={customInputs}>
      {children}
    </AppShell>
  );
}
