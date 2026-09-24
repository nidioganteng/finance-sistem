import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { getLaporanKeuanganData } from "@/lib/laporan-keuangan";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";
import type { ReportVersion } from "@/lib/laba-rugi";
import { NeracaView } from "@/components/laporan/NeracaView";

export default async function NeracaPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string; version?: string };
}) {
  const session = await getServerSession(authOptions);
  const { entityKeys } = session!.user;
  logActivity(session!.user.id, "Buka halaman Neraca", "USER_ACTIVITY", { path: "/neraca" });

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();
  const currentVersion: ReportVersion = (searchParams.version ?? "internal").toUpperCase() === "UMUM" ? "UMUM" : "INTERNAL";

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const data = await getLaporanKeuanganData(selectedEntity.id, currentYear, currentVersion);

  return (
    <PageTransition>
      <PageHeader
        title="Neraca"
        subtitle={`Posisi keuangan per 31 Desember ${currentYear} — ${selectedEntity.name} (${currentVersion === "UMUM" ? "Versi Umum" : "Versi Internal"})`}
        rightSlot={
          <>
            <YearSelect currentYear={currentYear} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedKey}
            />
          </>
        }
      />

      <div className="px-4 py-3 rounded-xl bg-surface-subtle border border-border-soft text-[13px] text-muted-stronger">
        Data Neraca dihitung otomatis dari saldo awal dan seluruh transaksi kas, bank, serta jurnal yang tercatat.
      </div>

      {data.aset.length === 0 && data.kewajiban.length === 0 && data.modal.length === 0 ? (
        <div className="bg-surface-card rounded-[20px] border border-border-soft py-16 text-center">
          <div className="text-sm font-semibold text-muted-stronger mb-1">Tidak ada data</div>
          <p className="text-[13px] text-muted">Isi data COA (Aset/Kewajiban/Modal) dan transaksi terlebih dahulu.</p>
        </div>
      ) : (
        <NeracaView
          data={data}
          year={currentYear}
          entityName={selectedEntity.name}
        />
      )}
    </PageTransition>
  );
}
