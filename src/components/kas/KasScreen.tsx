import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities, formatRupiah } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getJenisInput, getCoaOptions, getRunningSaldo, getKasLedger } from "@/lib/kas";
import { getProjectOptions } from "@/lib/piutang";
import { REKENING_BY_ENTITY, type RekeningOption } from "@/lib/bank-accounts";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
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
  searchParams: { entity?: string; rekening?: string };
  excludeEntityKeys?: string[];
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;

  if (role !== "STAF_KEUANGAN") redirect("/dashboard");

  const allEntities = await getAccessibleEntities(entityKeys);
  const entities = allEntities.filter((e) => !excludeEntityKeys.includes(e.key));
  const validKeys = entities.map((e) => e.key);
  const selectedKey = resolveEntityKey(searchParams.entity, validKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);

  const jenisInput = await getJenisInput(jenisInputKey);
  if (!selectedEntity || !jenisInput) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  // Rekening per entitas — hanya relevan untuk Bank Buku
  const isBankBuku = jenisInputKey === "bankBuku";
  const rekeningOptions: RekeningOption[] = isBankBuku
    ? (REKENING_BY_ENTITY[selectedKey] ?? [])
    : [];
  const selectedRekeningId =
    rekeningOptions.length > 0
      ? rekeningOptions.find((r) => r.id === searchParams.rekening)?.id ?? rekeningOptions[0].id
      : undefined;
  const selectedRekeningNama = rekeningOptions.find((r) => r.id === selectedRekeningId)?.nama;

  const [coaOptions, saldo, ledger, projectOptions] = await Promise.all([
    getCoaOptions(),
    getRunningSaldo(selectedEntity.id, jenisInput.id, selectedRekeningNama),
    getKasLedger(selectedEntity.id, jenisInput.id, selectedRekeningNama),
    getProjectOptions(selectedEntity.id),
  ]);

  const coaList = coaOptions.map((c) => ({ id: c.id, code: c.code, name: c.name }));

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
        ledger={ledger}
        rekeningOptions={rekeningOptions}
        selectedRekeningId={selectedRekeningId}
        allEntities={entities.map((e) => ({ key: e.key, name: e.name }))}
        projectOptions={projectOptions}
      />
    </>
  );
}
