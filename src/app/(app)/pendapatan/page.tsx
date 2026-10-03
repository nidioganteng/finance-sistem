import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { canManageTransaksi } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { PageTransition } from "@/components/layout/PageTransition";
import { getLaporanPendapatanData } from "@/lib/pendapatan";
import { LaporanPendapatanClient } from "@/components/pendapatan/LaporanPendapatanClient";

export const dynamic = "force-dynamic";

export default async function LaporanPendapatanPage({
  searchParams,
}: {
  searchParams: {
    entity?: string;
    year?: string;
    masaPajak?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, entityKeys } = session.user;
  if (
    role !== "SUPER_ADMIN" &&
    role !== "MANAJER_KEUANGAN" &&
    role !== "STAF_KEUANGAN"
  ) {
    redirect("/dashboard");
  }

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey) ?? entities[0];

  if (!selectedEntity) {
    redirect("/dashboard");
  }

  const currentYear =
    parseInt(searchParams.year ?? "") || new Date().getFullYear();
  const masaPajak = searchParams.masaPajak
    ? parseInt(searchParams.masaPajak)
    : null;

  const data = await getLaporanPendapatanData(
    selectedEntity.id,
    currentYear,
    masaPajak
  );

  if (!data) {
    redirect("/dashboard");
  }

  const canEdit = role === "SUPER_ADMIN" || canManageTransaksi(role);

  return (
    <PageTransition>
      <PageHeader
        title={`Laporan Pendapatan – ${selectedEntity.name}`}
        subtitle={`Rekapitulasi Faktur Pajak Penjualan, Realisasi Kas Bank, dan Audit SPT — ${selectedEntity.legalName ?? selectedEntity.name} (${currentYear})`}
        rightSlot={
          <EntitySwitcher
            entities={entities.map((e) => ({ key: e.key, name: e.name }))}
            showGrupOption={false}
            currentEntityKey={selectedEntity.key}
          />
        }
      />
      <div className="mt-6">
        <LaporanPendapatanClient
          data={data}
          canEdit={canEdit}
          availableEntities={entities.map((e) => ({
            id: e.id,
            key: e.key,
            name: e.name,
          }))}
        />
      </div>
    </PageTransition>
  );
}
