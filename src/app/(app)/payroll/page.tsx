"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getPayrollData } from "@/lib/payroll";
import { getRekonsiliasiPajakGajiData, type RekonsiliasiPajakGajiData } from "@/lib/rekonsiliasi-pajak-gaji";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PageTransition } from "@/components/layout/PageTransition";
import { getKasTransitory } from "@/lib/kas-transitory";
import { PayrollHoldSummary } from "@/components/kas-transitory/PayrollHoldSummary";
import { PayrollClient } from "@/components/payroll/PayrollClient";

function PayrollContent() {
  const { user, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const entityParam = searchParams.get("entity") ?? undefined;
  const yearParam = searchParams.get("year") ?? undefined;
  const monthParam = searchParams.get("month") ?? undefined;
  const tabParam = searchParams.get("tab") ?? undefined;

  const [pageData, setPageData] = useState<{
    entities: Awaited<ReturnType<typeof getAccessibleEntities>>;
    selectedEntity: Awaited<ReturnType<typeof getAccessibleEntities>>[0];
    year: number;
    month: number;
    initialTab: string;
    payrollData: Awaited<ReturnType<typeof getPayrollData>> | null;
    rekonsiliasiData: RekonsiliasiPajakGajiData | null;
    transitoryData: Awaited<ReturnType<typeof getKasTransitory>> | null;
    payrollError: string | null;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { entityKeys, role } = user;
    const year = parseInt(yearParam ?? "") || new Date().getFullYear();
    const month = parseInt(monthParam ?? "") || new Date().getMonth() + 1;
    const initialTab = tabParam || "pegawai";

    setPageLoading(true);
    getAccessibleEntities(entityKeys).then(async (entities) => {
      const selectedKey = resolveEntityKey(entityParam, entityKeys);
      const selectedEntity = entities.find((e) => e.key === selectedKey) || entities[0];
      if (!selectedEntity) {
        setPageData(null);
        setPageLoading(false);
        return;
      }

      let payrollError: string | null = null;
      const [payrollData, rekonsiliasiData, transitoryData] = await Promise.all([
        getPayrollData(selectedEntity.id, year, month).catch((e: unknown) => {
          payrollError = e instanceof Error ? e.message : String(e);
          return null;
        }),
        getRekonsiliasiPajakGajiData(selectedEntity.id, year).catch(() => null),
        ["SUPER_ADMIN", "MANAJER_KEUANGAN", "STAF_KEUANGAN"].includes(role)
          ? getKasTransitory(selectedEntity.id).catch(() => null)
          : Promise.resolve(null),
      ]);

      setPageData({ entities, selectedEntity, year, month, initialTab, payrollData, rekonsiliasiData: rekonsiliasiData as RekonsiliasiPajakGajiData | null, transitoryData, payrollError });
    }).catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user, entityParam, yearParam, monthParam, tabParam]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) {
    return (
      <div className="p-8 text-center text-sm text-muted-faint">
        Anda belum memiliki akses ke entitas manapun.
      </div>
    );
  }

  const { role } = user;
  const { entities, selectedEntity, year, month, initialTab, payrollData, rekonsiliasiData, transitoryData, payrollError } = pageData;

  if (!payrollData) {
    return (
      <PageTransition>
        <PageHeader title={`Laporan Gaji – ${selectedEntity.name}`} subtitle="" rightSlot={<YearSelect currentYear={year} />} />
        <div className="mt-8 rounded-xl border border-border bg-surface-card p-6 text-sm text-muted-strong">
          <p className="font-semibold text-status-red">Gagal memuat data Laporan Gaji.</p>
          {payrollError && <p className="mt-1 font-mono text-xs text-status-red/80">{payrollError}</p>}
          <p className="mt-2 text-xs text-muted">Pastikan server PHP aktif. Coba muat ulang halaman.</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <PageHeader
        title={`Laporan Gaji – ${selectedEntity.name}`}
        subtitle={`Laporan Penggajian Karyawan Tetap, Honorarium Tenaga Ahli, Rekonsiliasi Laba Rugi, dan Audit PPh 21 (Tahun ${year})`}
        rightSlot={
          <>
            <YearSelect currentYear={year} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedEntity.key}
            />
          </>
        }
      />

      {transitoryData && <PayrollHoldSummary items={transitoryData.items} entityKey={selectedEntity.key} />}
      <PayrollClient
        data={payrollData}
        rekonsiliasiData={(rekonsiliasiData ?? {}) as RekonsiliasiPajakGajiData}
        userRole={role}
        initialTab={initialTab}
        selectedYear={year}
        selectedMonth={month}
      />
    </PageTransition>
  );
}

export default function PayrollPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <PayrollContent />
    </Suspense>
  );
}
