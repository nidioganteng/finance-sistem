import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getPayrollData } from "@/lib/payroll";
import { getRekonsiliasiPajakGajiData, type RekonsiliasiPajakGajiData } from "@/lib/rekonsiliasi-pajak-gaji";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PageTransition } from "@/components/layout/PageTransition";
import dynamic from "next/dynamic";
import { getKasTransitory } from "@/lib/kas-transitory";
import { PayrollHoldSummary } from "@/components/kas-transitory/PayrollHoldSummary";

// Disable SSR for PayrollClient — komponen 7000+ baris ini hanya butuh render di browser,
// bukan di server. Ini menghilangkan semua kemungkinan crash saat SSR.
const PayrollClient = dynamic(
  () => import("@/components/payroll/PayrollClient").then((m) => ({ default: m.PayrollClient })),
  { ssr: false, loading: () => <div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data payroll…</div> }
);

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

  let payrollError: string | null = null;
  const [payrollData, rekonsiliasiData, transitoryData] = await Promise.all([
    getPayrollData(selectedEntity.id, year, month).catch((e: unknown) => {
      payrollError = e instanceof Error ? e.message : String(e);
      return null;
    }),
    getRekonsiliasiPajakGajiData(selectedEntity.id, year).catch(() => null),
    ["SUPER_ADMIN", "MANAJER_KEUANGAN", "STAF_KEUANGAN"].includes(role)
      ? getKasTransitory(selectedEntity.id).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!payrollData) {
    return (
      <PageTransition>
        <PageHeader title={`Laporan Gaji – ${selectedEntity.name}`} subtitle="" rightSlot={<YearSelect currentYear={year} />} />
        <div className="mt-8 rounded-xl border border-border bg-surface-card p-6 text-sm text-muted-strong">
          <p className="font-semibold text-status-red">Gagal memuat data Laporan Gaji.</p>
          {payrollError && <p className="mt-1 font-mono text-xs text-status-red/80">{payrollError}</p>}
          <p className="mt-2 text-xs text-muted">Pastikan server PHP aktif. Coba muat ulang halaman.</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <PageHeader
        title={`Laporan Gaji – ${selectedEntity.name}`}
        subtitle={`Laporan Penggajian Karyawan Tetap, Honorarium Tenaga Ahli, Rekonsiliasi Laba Rugi, dan Audit PPh 21 (Tahun ${year})`}
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

      {transitoryData && <PayrollHoldSummary items={transitoryData.items} entityKey={selectedEntity.key} />}
      <PayrollClient
        data={payrollData}
        rekonsiliasiData={(rekonsiliasiData ?? {}) as RekonsiliasiPajakGajiData}
        userRole={role}
        initialTab={initialTab}
        selectedYear={year}
        selectedMonth={month}
      />
    </PageTransition>
  );
}
