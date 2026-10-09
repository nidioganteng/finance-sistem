import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getJurnalTransaksiHistory } from "@/lib/jurnal-transaksi";
import { getProjectOptions } from "@/lib/piutang";
import { phpFetch, getPhpToken } from "@/lib/api-client";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { JurnalTransaksiClient } from "@/components/jurnal-transaksi/JurnalTransaksiClient";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function JurnalTransaksiPage({
  searchParams,
}: {
  searchParams: { entity?: string; page?: string; dari?: string; sampai?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;

  // SUPER_ADMIN hanya monitoring — tidak perlu input jurnal manual
  if (role === "SUPER_ADMIN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const token = await getPhpToken();
  const [coaResp, { groups, totalPages }, projectOptions] = await Promise.all([
    phpFetch<{ data: { id: string; code: string; name: string; kategori: string }[] }>("/api/coa", token),
    getJurnalTransaksiHistory(selectedEntity.id, page, searchParams.dari, searchParams.sampai),
    getProjectOptions(selectedEntity.key),
  ]);

  const coa = (coaResp.data ?? []).map((c) => ({ id: c.id, code: c.code, name: c.name, kategori: c.kategori }));

  // Build search params record for pagination href builder (exclude page)
  const spRecord: Record<string, string> = {};
  if (searchParams.entity) spRecord.entity = searchParams.entity;

  return (
    <PageTransition>
      <PageHeader
        title={`Entry Jurnal Transaksi – ${selectedEntity.name}`}
        subtitle="Input jurnal double-entry manual per transaksi"
        rightSlot={
          <EntitySwitcher
            entities={entities.map((e) => ({ key: e.key, name: e.name }))}
            showGrupOption={false}
            currentEntityKey={selectedEntity.key}
          />
        }
      />

      <JurnalTransaksiClient
        entityKey={selectedEntity.key}
        coa={coa}
        history={groups}
        projectOptions={projectOptions}
        page={page}
        totalPages={totalPages}
        dari={searchParams.dari ?? ""}
        sampai={searchParams.sampai ?? ""}
      />
    </PageTransition>
  );
}
