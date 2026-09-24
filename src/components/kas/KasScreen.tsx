import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities, formatRupiah } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { canManageTransaksi } from "@/lib/rbac";
import { getJenisInput, getCoaOptions, getRunningSaldo, getKasLedger, getSaldoSebelum } from "@/lib/kas";
import { getProjectOptions } from "@/lib/piutang";
import { REKENING_BY_ENTITY, type RekeningOption } from "@/lib/bank-accounts";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { PaginationNav } from "@/components/shared/PaginationNav";
import { KasScreenClient } from "./KasScreenClient";
import { logActivity } from "@/lib/actions/log";

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
  logActivity(session!.user.id, `Buka halaman ${title}`, "USER_ACTIVITY", { path: pagePath });

  if (!canManageTransaksi(role)) redirect("/dashboard");

  const allEntities = await getAccessibleEntities(entityKeys);
  const entities = allEntities.filter((e) => !excludeEntityKeys.includes(e.key));
  const validKeys = entities.map((e) => e.key);
  const selectedKey = resolveEntityKey(searchParams.entity, validKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);

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

  const [coaOptions, saldo, kasLedger, projectOptions, saldoAwal] = await Promise.all([
    getCoaOptions(),
    getRunningSaldo(selectedEntity.id, jenisInput.id, selectedRekeningNama),
    getKasLedger(selectedEntity.id, jenisInput.id, selectedRekeningNama, searchParams.dari, searchParams.sampai, kasPage),
    getProjectOptions(selectedEntity.id),
    searchParams.dari
      ? getSaldoSebelum(selectedEntity.id, jenisInput.id, searchParams.dari, selectedRekeningNama)
      : Promise.resolve(0),
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
        allEntities={entities.map((e) => ({ key: e.key, name: e.name }))}
        projectOptions={projectOptions}
        defaultArahLaporan={defaultArahLaporan}
        bukuBankRekeningOptions={bukuBankRekeningOptions}
        dari={searchParams.dari ?? ""}
        sampai={searchParams.sampai ?? ""}
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
