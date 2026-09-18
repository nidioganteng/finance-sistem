import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getPiutangData } from "@/lib/piutang";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { PiutangClient } from "@/components/piutang/PiutangClient";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function PiutangPage({
  searchParams,
}: {
  searchParams: { entity?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  logActivity(session!.user.id, "Buka halaman Kontrol Piutang", "USER_ACTIVITY", { path: "/piutang" });
  if (role === "SUPER_ADMIN" || role === "MANAGER_ADMIN" || role === "ADMIN_SIDAMON") {
    redirect("/dashboard");
  }

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const data = await getPiutangData(selectedEntity.id);

  return (
    <PageTransition>
      <PageHeader
        title={`Kontrol Piutang & Termin – ${selectedEntity.name}`}
        subtitle="Kelola status termin proyek"
        rightSlot={
          <EntitySwitcher
            entities={entities.map((e) => ({ key: e.key, name: e.name }))}
            showGrupOption={false}
            currentEntityKey={selectedKey}
          />
        }
      />
      <PiutangClient
        projectList={data.projectList}
        summary={data.summary}
        loadingDockList={data.loadingDockList}
        userRole={role}
        isUmumEntity={selectedEntity.isUmum}
      />
    </PageTransition>
  );
}
