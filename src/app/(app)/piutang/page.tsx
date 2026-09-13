import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { getPiutangData } from "@/lib/piutang";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { PiutangClient } from "@/components/piutang/PiutangClient";

export default async function PiutangPage({
  searchParams,
}: {
  searchParams: { entity?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  if (role === "SUPER_ADMIN" || role === "MANAGER_ADMIN" || role === "ADMIN_SIDAMON") {
    redirect("/dashboard");
  }

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey =
    searchParams.entity && entityKeys.includes(searchParams.entity)
      ? searchParams.entity
      : entityKeys[0];
  const selectedEntity = entities.find((e) => e.key === selectedKey);

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const data = await getPiutangData(selectedEntity.id);

  return (
    <>
      <PageHeader
        title="Kontrol Piutang & Termin"
        subtitle={`Kelola status termin proyek — ${selectedEntity.name}`}
        rightSlot={
          <EntitySwitcher
            entities={entities.map((e) => ({ key: e.key, name: e.name }))}
            showGrupOption={false}
            currentEntityKey={selectedKey}
          />
        }
      />
      <PiutangClient
        terminList={data.terminList}
        loadingDockList={data.loadingDockList}
        userRole={role}
        isUmumEntity={selectedEntity.isUmum}
      />
    </>
  );
}
