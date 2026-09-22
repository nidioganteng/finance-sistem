import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getDaftarAkunData } from "@/lib/daftar-akun";
import { canManageTransaksi } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PrintButton } from "@/components/shared/PrintButton";
import { DaftarAkunClient } from "@/components/daftar-akun/DaftarAkunClient";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function DaftarAkunPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  logActivity(session!.user.id, "Buka halaman Daftar Akun", "USER_ACTIVITY", { path: "/daftar-akun" });
  if (role === "SUPER_ADMIN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const year = parseInt(searchParams.year ?? "") || new Date().getFullYear();

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const { rows } = await getDaftarAkunData(selectedEntity.id, year);

  return (
    <PageTransition>
      <PageHeader
        title={`Daftar Akun – ${selectedEntity.name}`}
        subtitle="Seluruh akun COA beserta saldo awal, mutasi, dan saldo akhir"
        rightSlot={
          <>
            <PrintButton />
            <YearSelect currentYear={year} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedEntity.key}
            />
          </>
        }
      />

      <DaftarAkunClient rows={rows} entityId={selectedEntity.id} year={year} canEdit={canManageTransaksi(role)} />
    </PageTransition>
  );
}
