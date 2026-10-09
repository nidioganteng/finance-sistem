import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities, formatRupiah } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { canManageTransaksi } from "@/lib/rbac";
import { getJenisInput, getCoaOptions, getRunningSaldo, getKasLedger, getSaldoSebelum, getInitialSaldoAwal } from "@/lib/kas";
import { getProjectOptions } from "@/lib/piutang";
import { REKENING_BY_ENTITY, type RekeningOption } from "@/lib/bank-accounts";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { PaginationNav } from "@/components/shared/PaginationNav";
import { KasScreenClient } from "./KasScreenClient";

export async function KasScreen({
  jenisInputKey,
  title,
  subtitle,
  pagePath,
  searchParams,
  excludeEntityKeys = [],
}: {
  jenisInputKey: string;
  title: string;
  subtitle: string;
  pagePath: string;
  searchParams: { entity?: string; rekening?: string; dari?: string; sampai?: string; page?: string };
  excludeEntityKeys?: string[];
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;

  if (!canManageTransaksi(role)) redirect("/dashboard");

  const allEntities = await getAccessibleEntities(entityKeys);
  const entities = allEntities.filter((e) => !excludeEntityKeys.includes(e.key));
  const validKeys = entities.map((e) => e.key);
  const selectedKey = resolveEntityKey(searchParams.entity, validKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);

  // Jika entity=grup (atau entity param tidak valid) ada di URL, redirect ke entity pertama yang valid
  // supaya PHP API tidak menerima "grup" atau nilai yang bukan entity key asli.
  if (searchParams.entity && !validKeys.includes(searchParams.entity) && validKeys.length > 0) {
    const params = new URLSearchParams();
    params.set("entity", validKeys[0]);
    if (searchParams.rekening) params.set("rekening", searchParams.rekening);
    if (searchParams.dari) params.set("dari", searchParams.dari);
    if (searchParams.sampai) params.set("sampai", searchParams.sampai);
    if (searchParams.page) params.set("page", searchParams.page);
    redirect(`${pagePath}?${params.toString()}`);
  }

  const jenisInput = await getJenisInput(jenisInputKey);
  if (!selectedEntity || !jenisInput) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  // Rekening per entitas — hanya relevan untuk Buku Bank
  const isBankBuku = jenisInputKey === "bankBuku";
  const isKasKecil = jenisInputKey === "kasKecil";
  const isKasBesar = jenisInputKey === "kasBesar";
  const rekeningOptions: RekeningOption[] = isBankBuku
    ? (REKENING_BY_ENTITY[selectedKey] ?? [])
    : [];
  const bukuBankRekeningOptions: RekeningOption[] = (isKasKecil || isKasBesar)
    ? (REKENING_BY_ENTITY[selectedKey] ?? [])
    : [];
  const selectedRekeningId =
    rekeningOptions.length > 0
      ? rekeningOptions.find((r) => r.id === searchParams.rekening)?.id ?? rekeningOptions[0].id
      : undefined;
  const selectedRekeningNama = rekeningOptions.find((r) => r.id === selectedRekeningId)?.nama;

  const kasPage = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const currentYear = searchParams.dari
    ? new Date(searchParams.dari).getFullYear()
    : searchParams.sampai
    ? new Date(searchParams.sampai).getFullYear()
    : new Date().getFullYear();

  const [coaOptions, saldo, kasLedger, projectOptions, saldoAwal] = await Promise.all([
    getCoaOptions(),
    getRunningSaldo(selectedEntity.id, jenisInput.id, selectedRekeningNama, currentYear),
    getKasLedger(selectedEntity.id, jenisInputKey, selectedRekeningNama, searchParams.dari, searchParams.sampai, kasPage, currentYear),
    getProjectOptions(selectedEntity.key),
    searchParams.dari
      ? getSaldoSebelum(selectedEntity.id, jenisInput.id, searchParams.dari, selectedRekeningNama, currentYear)
      : getInitialSaldoAwal(selectedEntity.id, jenisInput.id, selectedRekeningNama, currentYear),
  ]);

  const { entries: ledger, totalPages: ledgerTotalPages, page: ledgerPage } = kasLedger;

  const totalMasuk = ledger.reduce((s, r) => s + r.masuk, 0);
  const totalKeluar = ledger.reduce((s, r) => s + r.keluar, 0);

  const coaList = coaOptions.map((c) => ({ id: c.id, code: c.code, name: c.name }));
  const extra = jenisInput.extraFieldsJson as { arahLaporan?: string[] } | null;
  const defaultArahLaporan = Array.isArray(extra?.arahLaporan) ? extra.arahLaporan : [];

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
        dari={searchParams.dari ?? ""}
        sampai={searchParams.sampai ?? ""}
        currentYear={currentYear}
      />
      <PaginationNav
        page={ledgerPage}
        totalPages={ledgerTotalPages}
        buildHref={(p) => {
          const params = new URLSearchParams();
          if (selectedEntity.key) params.set("entity", selectedEntity.key);
          if (searchParams.rekening) params.set("rekening", searchParams.rekening);
          if (searchParams.dari) params.set("dari", searchParams.dari);
          if (searchParams.sampai) params.set("sampai", searchParams.sampai);
          params.set("page", String(p));
          return `${pagePath}?${params.toString()}`;
        }}
      />
    </>
  );
}
