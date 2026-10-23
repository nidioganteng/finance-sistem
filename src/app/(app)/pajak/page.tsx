"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { resolveEntityKey } from "@/lib/entity-prefs";

function PajakContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityParam = searchParams.get("entity") ?? undefined;
  const yearParam = searchParams.get("year") ?? undefined;

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    const { entityKeys } = user;
    const selectedKey = resolveEntityKey(entityParam, entityKeys);
    const year = parseInt(yearParam ?? "") || new Date().getFullYear();

    const params = new URLSearchParams();
    if (selectedKey) params.set("entity", selectedKey);
    if (year) params.set("year", year.toString());
    params.set("tab", "rekonsiliasi");

    router.replace(`/payroll?${params.toString()}`);
  }, [user, isLoading, entityParam, yearParam]);

  if (isLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  return null;
}

export default function PajakPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <PajakContent />
    </Suspense>
  );
}
