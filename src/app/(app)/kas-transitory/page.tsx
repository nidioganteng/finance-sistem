import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getKasTransitory } from "@/lib/kas-transitory";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { KasTransitoryClient } from "@/components/kas-transitory/KasTransitoryClient";

export default async function KasTransitoryPage({ searchParams }: { searchParams: { entity?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const { role, entityKeys } = session.user;
  if (!["SUPER_ADMIN", "MANAJER_KEUANGAN", "STAF_KEUANGAN"].includes(role)) redirect("/dashboard");
  const entities = await getAccessibleEntities(entityKeys);
  const selected = entities.find(entity => entity.key === resolveEntityKey(searchParams.entity, entityKeys)) || entities[0];
  if (!selected) return <p className="p-6 text-sm text-muted">Belum ada akses entitas.</p>;
  const data = await getKasTransitory(selected.id);
  return <>
    <PageHeader title={`Kas Transitory – ${selected.name}`} subtitle="Pantau dana yang sudah dicatat keluar dan belum diserahkan kepada penerima." rightSlot={<EntitySwitcher entities={entities.map(entity => ({ key: entity.key, name: entity.name }))} currentEntityKey={selected.key} showGrupOption={false} />} />
    <KasTransitoryClient key={selected.id} data={data} canReverse={role !== "STAF_KEUANGAN"} />
  </>;
}
