import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities, formatRupiah } from "@/lib/dashboard-data";
import { getJenisInput, getCoaOptions, getRunningSaldo, getKasLedger } from "@/lib/kas";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { KasScreenClient } from "./KasScreenClient";

export async function KasScreen({
  jenisInputKey,
  title,
  subtitle,
  pagePath,
  searchParams,
}: {
  jenisInputKey: string;
  title: string;
  subtitle: string;
  pagePath: string;
  searchParams: { entity?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;

  // Halaman input Kas cuma ada di sidebar Staf Keuangan pada desain aslinya.
  if (role !== "STAF_KEUANGAN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = searchParams.entity && entityKeys.includes(searchParams.entity) ? searchParams.entity : entityKeys[0];
  const selectedEntity = entities.find((e) => e.key === selectedKey);

  const jenisInput = await getJenisInput(jenisInputKey);
  if (!selectedEntity || !jenisInput) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const [coaOptions, saldo, ledger] = await Promise.all([
    getCoaOptions(),
    getRunningSaldo(selectedEntity.id, jenisInput.id),
    getKasLedger(selectedEntity.id, jenisInput.id),
  ]);

  return (
    <>
      <PageHeader
        title={title}
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
        coaOptions={coaOptions.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
        saldoFmt={formatRupiah(saldo)}
        ledger={ledger}
      />
    </>
  );
}
