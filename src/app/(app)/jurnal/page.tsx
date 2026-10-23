"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getJenisInputChips, getJurnalRows, getCoaList } from "@/lib/jurnal";
import { getProjectOptions } from "@/lib/piutang";
import { canManageTransaksi } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { PrintButton } from "@/components/shared/PrintButton";
import { PaginationNav } from "@/components/shared/PaginationNav";
import { JurnalFilterChips } from "@/components/jurnal/JurnalFilterChips";
import { JurnalExtraFilters } from "@/components/jurnal/JurnalExtraFilters";
import { JurnalTable } from "@/components/jurnal/JurnalTable";
import { AlertTriangle } from "lucide-react";
import { PageTransition } from "@/components/layout/PageTransition";

function JurnalContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityParam = searchParams.get("entity") ?? undefined;
  const filter = searchParams.get("filter") ?? "semua";
  const bulan = searchParams.get("bulan") ?? "";
  const akunCode = searchParams.get("akunCode") ?? "";
  const projectId = searchParams.get("projectId") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [pageData, setPageData] = useState<{
    entities: Awaited<ReturnType<typeof getAccessibleEntities>>;
    selectedKey: string | undefined;
    chips: Awaited<ReturnType<typeof getJenisInputChips>>;
    coaList: Awaited<ReturnType<typeof getCoaList>>;
    projectOptions: Awaited<ReturnType<typeof getProjectOptions>>;
    rows: Awaited<ReturnType<typeof getJurnalRows>>["rows"];
    totalDebit: number;
    totalKredit: number;
    isBalanced: boolean;
    totalDebitFmt: string;
    totalKreditFmt: string;
    totalPages: number;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role, entityKeys } = user;
    if (role === "SUPER_ADMIN") {
      router.replace("/dashboard");
      return;
    }
    setPageLoading(true);
    getAccessibleEntities(entityKeys).then(async (entities) => {
      const selectedKey = resolveEntityKey(entityParam, entityKeys);
      const selectedEntity = entities.find((e) => e.key === selectedKey);
      if (!selectedEntity) {
        setPageData(null);
        setPageLoading(false);
        return;
      }
      const [chips, coaList, projectOptions, jurnalResult] = await Promise.all([
        getJenisInputChips(selectedEntity.id),
        getCoaList(),
        getProjectOptions(selectedEntity.key),
        getJurnalRows(selectedEntity.id, filter, bulan || undefined, akunCode || undefined, page, projectId || undefined),
      ]);
      setPageData({
        entities,
        selectedKey,
        chips,
        coaList,
        projectOptions,
        rows: jurnalResult.rows,
        totalDebit: jurnalResult.totalDebit,
        totalKredit: jurnalResult.totalKredit,
        isBalanced: jurnalResult.isBalanced,
        totalDebitFmt: jurnalResult.totalDebitFmt,
        totalKreditFmt: jurnalResult.totalKreditFmt,
        totalPages: jurnalResult.totalPages,
      });
    }).catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user, entityParam, filter, bulan, akunCode, projectId, page]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;

  const { role } = user;
  const { entities, selectedKey, chips, coaList, projectOptions, rows, totalDebit, totalKredit, isBalanced, totalDebitFmt, totalKreditFmt, totalPages } = pageData;
  const selectedEntity = entities.find((e) => e.key === selectedKey)!;
  const selisih = Math.abs(totalDebit - totalKredit);

  return (
    <PageTransition>
      <PageHeader
        title={`Jurnal Umum – ${selectedEntity.name}`}
        subtitle="Seluruh transaksi kas dan bank, tercatat otomatis dari setiap input"
        rightSlot={
          <>
            <PrintButton title="Jurnal Umum" entityName={selectedEntity.name} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedEntity.key}
            />
          </>
        }
      />

      {!isBalanced && rows.length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[14px] px-4 py-3.5">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-none" />
          <div className="text-[13px] text-red-700 dark:text-red-400">
            <span className="font-bold">Jurnal tidak seimbang!</span> Total Debit dan Kredit berbeda sebesar{" "}
            <span className="font-bold">Rp {selisih.toLocaleString("id-ID")}</span>. Kemungkinan ada transaksi lama
            yang belum punya entri pasangan. Periksa kembali data atau hubungi Manajer Keuangan.
          </div>
        </div>
      )}

      <div className="print:hidden flex items-center justify-between flex-wrap gap-3">
        <JurnalFilterChips chips={chips} current={filter} entityKey={selectedEntity.key} />
        <JurnalExtraFilters
          coaList={coaList}
          projectList={projectOptions.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
          currentBulan={bulan}
          currentAkunCode={akunCode}
          currentProjectId={projectId}
          entityKey={selectedEntity.key}
        />
      </div>

      <JurnalTable
        rows={rows}
        entityId={selectedEntity.id}
        isBalanced={isBalanced}
        totalDebitFmt={totalDebitFmt}
        totalKreditFmt={totalKreditFmt}
        coaOptions={coaList}
        projectOptions={projectOptions.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
        canEditAkun={canManageTransaksi(role)}
      />

      <PaginationNav
        page={page}
        totalPages={totalPages}
        buildHref={(p) => {
          const params = new URLSearchParams();
          if (selectedEntity.key) params.set("entity", selectedEntity.key);
          if (filter && filter !== "semua") params.set("filter", filter);
          if (bulan) params.set("bulan", bulan);
          if (akunCode) params.set("akunCode", akunCode);
          if (projectId) params.set("projectId", projectId);
          params.set("page", String(p));
          return `/jurnal?${params.toString()}`;
        }}
      />
    </PageTransition>
  );
}

export default function JurnalPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <JurnalContent />
    </Suspense>
  );
}
