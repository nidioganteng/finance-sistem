import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getPayrollData } from "@/lib/payroll";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PageTransition } from "@/components/layout/PageTransition";
import { PayrollClient } from "@/components/payroll/PayrollClient";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string; month?: string; tab?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { role, entityKeys } = session.user;

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey) || entities[0];
  const year = parseInt(searchParams.year ?? "") || new Date().getFullYear();
  const month = parseInt(searchParams.month ?? "") || new Date().getMonth() + 1;
  const initialTab = searchParams.tab || "pegawai";

  if (!selectedEntity) {
    return (
      <div className="p-8 text-center text-sm text-muted-faint">
        Anda belum memiliki akses ke entitas manapun.
      </div>
    );
  }

  const payrollData = await getPayrollData(selectedEntity.id, year, month);

  return (
    <PageTransition>
      <PageHeader
        title={`Laporan Gaji – ${selectedEntity.name}`}
        subtitle={`Laporan Penggajian Karyawan Tetap, Honorarium Tenaga Ahli Lintas Entitas, dan Rekonsiliasi Laba Rugi (Tahun ${year})`}
        rightSlot={
          <>
            <YearSelect currentYear={year} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedEntity.key}
            />
          </>
        }
      />

      <PayrollClient
        data={payrollData}
        userRole={role}
        initialTab={initialTab}
        selectedYear={year}
        selectedMonth={month}
      />
    </PageTransition>
  );
}
