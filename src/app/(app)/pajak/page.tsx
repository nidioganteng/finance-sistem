import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { canViewGrupAggregate, canManageTransaksi } from "@/lib/rbac";
import { getRekonsiliasiPajakGajiData } from "@/lib/rekonsiliasi-pajak-gaji";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PageTransition } from "@/components/layout/PageTransition";
import { RekonsiliasiPajakGajiClient } from "@/components/pajak/RekonsiliasiPajakGajiClient";
import { logActivity } from "@/lib/actions/log";
import Link from "next/link";
import { Scale, Receipt, ArrowRight } from "lucide-react";

export default async function PajakPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string; tab?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { role, entityKeys } = session.user;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isPrivileged =
    isSuperAdmin || role === "MANAJER_KEUANGAN" || role === "STAF_KEUANGAN";

  if (!isPrivileged) redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const isGrup = selectedKey === "grup" && canViewGrupAggregate(role);

  let targetIds: string[] = [];
  let headerEntityName = "Semua Entitas (Grup)";

  if (isGrup) {
    targetIds = entities.map((e) => e.id);
  } else {
    const selectedEntity =
      entities.find((e) => e.key === selectedKey) || entities[0];
    if (selectedEntity) {
      targetIds = [selectedEntity.id];
      headerEntityName = selectedEntity.name;
    }
  }

  const year = parseInt(searchParams.year ?? "") || new Date().getFullYear();

  try {
    logActivity(
      session.user.id,
      "Buka halaman Rekonsiliasi Pajak & Audit",
      "USER_ACTIVITY",
      {
        path: "/pajak",
        year,
        entityKey: selectedKey,
      }
    );
  } catch {
    // ignore
  }

  const reconData = await getRekonsiliasiPajakGajiData(targetIds, year);

  return (
    <PageTransition>
      <PageHeader
        title={`Rekonsiliasi Pajak & Audit – ${headerEntityName}`}
        subtitle={`Audit Kepatuhan Gaji vs PPh 21 (SPT Masa 1721), Rekapitulasi Tahunan, dan Kontrol Selisih (${year})`}
        rightSlot={
          <>
            <YearSelect currentYear={year} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={canViewGrupAggregate(role)}
              currentEntityKey={selectedKey}
            />
          </>
        }
      />

      {/* Navigasi Cepat Modul Perpajakan Lainnya */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-card border border-border-soft text-xs shadow-2xs">
        <div className="flex items-center gap-2 text-navy-soft">
          <Scale className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <span className="font-semibold text-navy-text">
              Audit Perpajakan Holding:
            </span>{" "}
            <span>
              Halaman ini merekonsiliasi Gaji vs PPh 21. Untuk audit PPN E-Faktur silakan buka modul Laporan Pendapatan.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Link
            href={`/pendapatan?entity=${selectedKey}&year=${year}&tab=rekonsiliasi`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 transition-colors"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Lapis 3: Rekonsiliasi PPN Faktur</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <RekonsiliasiPajakGajiClient
        data={reconData}
        entityKey={selectedKey}
        canEdit={canManageTransaksi(role) || isSuperAdmin}
      />
    </PageTransition>
  );
}
