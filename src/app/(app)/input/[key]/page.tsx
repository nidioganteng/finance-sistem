"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getJenisInput } from "@/lib/kas";
import { KasScreen } from "@/components/kas/KasScreen";
import { PageTransition } from "@/components/layout/PageTransition";

const SYSTEM_KEYS = ["kasKecil", "kasBesar", "bankBuku"];

const LAPORAN_LABEL: Record<string, string> = {
  JURNAL_UMUM: "Jurnal Umum",
  BUKU_BESAR: "Buku Besar",
  LAPORAN_KEUANGAN: "Laporan Keuangan",
  PIUTANG: "Piutang",
  PAJAK: "Laporan Pajak",
};

function CustomInputContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const key = params.key as string;

  const [jenisInput, setJenisInput] = useState<Awaited<ReturnType<typeof getJenisInput>> | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role } = user;
    if (role !== "STAF_KEUANGAN" && role !== "MANAJER_KEUANGAN") {
      router.replace("/dashboard");
      return;
    }
    setPageLoading(true);
    getJenisInput(key).then((ji) => {
      if (!ji || !ji.active || SYSTEM_KEYS.includes(key)) {
        router.replace("/dashboard");
        return;
      }
      setJenisInput(ji);
    }).catch(() => router.replace("/dashboard"))
      .finally(() => setPageLoading(false));
  }, [user, key]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user || !jenisInput) return null;

  const { entityKeys } = user;

  const extra = jenisInput.extraFieldsJson as Record<string, unknown> | null;
  const arahLaporan = Array.isArray(extra?.arahLaporan) ? (extra.arahLaporan as string[]) : [];
  const scopeKeys = Array.isArray(extra?.entityKeys) ? (extra.entityKeys as string[]) : [];

  const subtitle =
    arahLaporan.length > 0
      ? `Dicatat ke: ${arahLaporan.map((k) => LAPORAN_LABEL[k] ?? k).join(", ")}`
      : "Input dan riwayat transaksi";

  const excludeEntityKeys =
    scopeKeys.length > 0
      ? entityKeys.filter((k) => !scopeKeys.includes(k))
      : [];

  return (
    <PageTransition>
      <KasScreen
        jenisInputKey={key}
        title={jenisInput.nama}
        subtitle={subtitle}
        pagePath={`/input/${key}`}
        excludeEntityKeys={excludeEntityKeys}
      />
    </PageTransition>
  );
}

export default function CustomInputPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <CustomInputContent />
    </Suspense>
  );
}
