"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAccessibleEntities, formatRupiah } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { canManageTransaksi } from "@/lib/rbac";
import { getJenisInput, getCoaOptions, getKasLedger } from "@/lib/kas";
import { getProjectOptions } from "@/lib/piutang";
import { REKENING_BY_ENTITY, type RekeningOption } from "@/lib/bank-accounts";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { PaginationNav } from "@/components/shared/PaginationNav";
import { KasScreenClient } from "./KasScreenClient";

export function KasScreen({
  jenisInputKey,
  title,
  subtitle,
  pagePath,
  excludeEntityKeys = [],
}: {
  jenisInputKey: string;
  title: string;
  subtitle: string;
  pagePath: string;
  excludeEntityKeys?: string[];
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityParam = searchParams.get("entity") ?? undefined;
  const rekeningParam = searchParams.get("rekening") ?? undefined;
  const dariParam = searchParams.get("dari") ?? "";
  const sampaiParam = searchParams.get("sampai") ?? "";
  const pageParam = searchParams.get("page") ?? "1";

  const [pageData, setPageData] = useState<{
    entities: Awaited<ReturnType<typeof getAccessibleEntities>>;
    selectedEntity: Awaited<ReturnType<typeof getAccessibleEntities>>[0];
    coaList: { id: string; code: string; name: string }[];
    ledger: Awaited<ReturnType<typeof getKasLedger>>["entries"];
    ledgerTotalPages: number;
    ledgerPage: number;
    totalMasuk: number;
    totalKeluar: number;
    saldoAwal: number;
    saldo: number;
    rekeningOptions: RekeningOption[];
    selectedRekeningId: string | undefined;
    selectedRekeningNama: string | undefined;
    projectOptions: Awaited<ReturnType<typeof getProjectOptions>>;
    defaultArahLaporan: string[];
    bukuBankRekeningOptions: RekeningOption[];
    currentYear: number;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { role, entityKeys } = user;
    if (!canManageTransaksi(role)) {
      router.replace("/dashboard");
      return;
    }
    const kasPage = Math.max(1, parseInt(pageParam, 10) || 1);
    const currentYear = dariParam
      ? new Date(dariParam).getFullYear()
      : sampaiParam
      ? new Date(sampaiParam).getFullYear()
      : new Date().getFullYear();

    setPageLoading(true);
    getAccessibleEntities(entityKeys).then(async (allEntities) => {
      const entities = allEntities.filter((e) => !excludeEntityKeys.includes(e.key));
      const validKeys = entities.map((e) => e.key);
      const selectedKey = resolveEntityKey(entityParam, validKeys);
      const selectedEntity = entities.find((e) => e.key === selectedKey);

      if (!selectedEntity) {
        setPageData(null);
        setPageLoading(false);
        return;
      }

      const isBankBuku = jenisInputKey === "bankBuku";
      const isKasKecil = jenisInputKey === "kasKecil";
      const isKasBesar = jenisInputKey === "kasBesar";
      const rekeningOptions: RekeningOption[] = isBankBuku
        ? (REKENING_BY_ENTITY[selectedKey ?? ""] ?? [])
        : [];
      const bukuBankRekeningOptions: RekeningOption[] = (isKasKecil || isKasBesar)
        ? (REKENING_BY_ENTITY[selectedKey ?? ""] ?? [])
        : [];
      const selectedRekeningId =
        rekeningOptions.length > 0
          ? rekeningOptions.find((r) => r.id === rekeningParam)?.id ?? rekeningOptions[0].id
          : undefined;
      const selectedRekeningNama = rekeningOptions.find((r) => r.id === selectedRekeningId)?.nama;

      const jenisInput = await getJenisInput(jenisInputKey);
      if (!jenisInput) {
        setPageData(null);
        setPageLoading(false);
        return;
      }

      const [coaOptions, kasLedger, projectOptions] = await Promise.all([
        getCoaOptions(),
        getKasLedger(selectedEntity.id, jenisInputKey, selectedRekeningNama, dariParam || undefined, sampaiParam || undefined, kasPage, currentYear),
        getProjectOptions(selectedEntity.key),
      ]);

      const coaList = coaOptions.map((c) => ({ id: c.id, code: c.code, name: c.name }));
      const extra = jenisInput.extraFieldsJson as { arahLaporan?: string[] } | null;
      const defaultArahLaporan = Array.isArray(extra?.arahLaporan) ? extra.arahLaporan : [];

      setPageData({
        entities,
        selectedEntity,
        coaList,
        ledger: kasLedger.entries,
        ledgerTotalPages: kasLedger.totalPages,
        ledgerPage: kasLedger.page,
        totalMasuk: kasLedger.totalMasuk,
        totalKeluar: kasLedger.totalKeluar,
        saldoAwal: kasLedger.saldoAwal,
        saldo: kasLedger.runningSaldo,
        rekeningOptions,
        selectedRekeningId,
        selectedRekeningNama,
        projectOptions,
        defaultArahLaporan,
        bukuBankRekeningOptions,
        currentYear,
      });
    }).catch(() => setPageData(null))
      .finally(() => setPageLoading(false));
  }, [user, entityParam, rekeningParam, dariParam, sampaiParam, pageParam, jenisInputKey]);

  if (isLoading || pageLoading) {
    return <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>;
  }
  if (!user) return null;
  if (!pageData) return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;

  const { entities, selectedEntity, coaList, ledger, ledgerTotalPages, ledgerPage, totalMasuk, totalKeluar, saldoAwal, saldo, rekeningOptions, selectedRekeningId, selectedRekeningNama, projectOptions, defaultArahLaporan, bukuBankRekeningOptions, currentYear } = pageData;

  return (
    <>
      <PageHeader
        title={`${title} – ${selectedEntity.name}`}
        subtitle={subtitle}
        rightSlot={
          <EntitySwitcher
            entities={entities.map((e) => ({ key: e.key, name: e.name }))}
            showGrupOption={false}
            currentEntityKey={selectedEntity.key}
          />
        }
      />
      <KasScreenClient
        entityKey={selectedEntity.key}
        jenisInputKey={jenisInputKey}
        pagePath={pagePath}
        coaOptions={coaList}
        saldoFmt={formatRupiah(saldo)}
        saldoLabel={selectedRekeningNama ? `Saldo ${selectedRekeningNama}` : "Saldo Berjalan"}
        saldoAwal={saldoAwal}
        totalMasuk={totalMasuk}
        totalKeluar={totalKeluar}
        ledger={ledger}
        rekeningOptions={rekeningOptions}
        selectedRekeningId={selectedRekeningId}
        selectedRekeningNama={selectedRekeningNama}
        allEntities={entities.map((e) => ({ key: e.key, name: e.name }))}
        projectOptions={projectOptions}
        defaultArahLaporan={defaultArahLaporan}
        bukuBankRekeningOptions={bukuBankRekeningOptions}
        dari={dariParam}
        sampai={sampaiParam}
        currentYear={currentYear}
      />
      <PaginationNav
        page={ledgerPage}
        totalPages={ledgerTotalPages}
        buildHref={(p) => {
          const params = new URLSearchParams();
          if (selectedEntity.key) params.set("entity", selectedEntity.key);
          if (rekeningParam) params.set("rekening", rekeningParam);
          if (dariParam) params.set("dari", dariParam);
          if (sampaiParam) params.set("sampai", sampaiParam);
          params.set("page", String(p));
          return `${pagePath}?${params.toString()}`;
        }}
      />
    </>
  );
}
