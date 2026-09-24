import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getAccessibleEntities,
  getUnreadNotificationCount,
  getGrupPiutangMetrics,
  getMonthlyChartData,
  formatMiliar,
} from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { canViewGrupAggregate, roleLabel } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { UserBadge, NotifBell } from "@/components/layout/UserBadge";
import { EntityCard, EntityCardCompact } from "@/components/dashboard/EntityCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { EntityFinancialSummary } from "@/components/dashboard/EntityFinancialSummary";
import { getLaporanKeuanganData } from "@/lib/laporan-keuangan";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  AlertTriangle,
  CalendarClock,
  Sparkles,
} from "lucide-react";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { entity?: string; chartYear?: string; compareYears?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys, name } = session!.user;
  logActivity(session!.user.id, "Buka halaman Dashboard", "USER_ACTIVITY", { path: "/dashboard" });

  const entities = await getAccessibleEntities(entityKeys);
  const canGrup = canViewGrupAggregate(role);

  const selectedKey = canGrup
    // Semua role yang boleh lihat grup: kalau URL tidak ada entity → tampilkan grup (undefined)
    ? (searchParams.entity && entityKeys.includes(searchParams.entity) ? searchParams.entity : searchParams.entity)
    // Role tanpa akses grup: selalu resolve ke entity pertama
    : resolveEntityKey(searchParams.entity, entityKeys);
  const showingGrup = canGrup && !selectedKey;
  const selectedEntity = entities.find((e) => e.key === selectedKey);

  const currentYear = new Date().getFullYear();
  const chartYear = searchParams.chartYear ? parseInt(searchParams.chartYear) : currentYear;
  // Tahun pembanding tambahan (di luar chartYear) — maksimal 4 (jadi 5 tahun
  // sekaligus), pembatasan lebih ketat (grup cuma 1) ditegakkan di RevenueChart
  // lewat activeKeys (client-only state, jadi tidak bisa dibatasi di sini).
  const compareYears = (searchParams.compareYears ?? "")
    .split(",")
    .map((y) => parseInt(y))
    .filter((y, idx, arr) => !isNaN(y) && y !== chartYear && arr.indexOf(y) === idx)
    .slice(0, 4);
  const chartYears = [chartYear, ...compareYears];

  const targetEntityKeys = showingGrup ? entityKeys : selectedEntity ? [selectedEntity.key] : [];

  const [unreadCount, piutangMetrics, monthlyDataByYear, entityLaporanData] = await Promise.all([
    getUnreadNotificationCount(role),
    showingGrup ? getGrupPiutangMetrics() : Promise.resolve(null),
    targetEntityKeys.length > 0
      ? Promise.all(chartYears.map((y) => getMonthlyChartData(targetEntityKeys, y)))
      : Promise.resolve([]),
    selectedEntity
      ? getLaporanKeuanganData([selectedEntity.id], currentYear, "INTERNAL")
      : Promise.resolve(null),
  ]);

  const rightSlot = (
    <>
      <NotifBell unreadCount={unreadCount} />
      {canGrup && (
        <EntitySwitcher
          entities={entities.map((e) => ({ key: e.key, name: e.name }))}
          showGrupOption={true}
          currentEntityKey={selectedKey ?? "grup"}
        />
      )}
      <UserBadge name={name} role={role} />
    </>
  );

  // Hitung agregat grup
  const totalRevenue = entities.reduce((s, e) => s + e.revenue, 0);
  const totalSpend = entities.reduce((s, e) => s + e.spend, 0);
  const totalProfit = totalRevenue - totalSpend;

  // Pisahkan entitas utama dan Umum
  const mainEntities = entities.filter((e) => !e.isUmum);
  const umumEntity = entities.find((e) => e.isUmum);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const greeting = now.getHours() < 11 ? "Selamat Pagi" : now.getHours() < 15 ? "Selamat Siang" : now.getHours() < 18 ? "Selamat Sore" : "Selamat Malam";

  const welcomeBanner = (
    <div className="relative overflow-hidden rounded-[20px]" style={{ background: "linear-gradient(135deg, #0f1e3d 0%, #1a2f5a 60%, #1e3a6e 100%)" }}>
      {/* Dot pattern */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
      />
      {/* Glow accent */}
      <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,130,255,0.18) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 px-7 py-6 flex items-center justify-between gap-6">
        <div className="min-w-0">
          {/* Date */}
          <div className="flex items-center gap-1.5 mb-3">
            <CalendarClock size={12} className="flex-none" style={{ color: "rgba(255,255,255,0.45)" }} />
            <span className="text-[11.5px] font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>{dateLabel}</span>
          </div>
          {/* Greeting */}
          <div className="flex items-center gap-2.5 mb-2">
            <h2 className="text-[22px] font-extrabold text-white leading-tight">{greeting}, {name}</h2>
            <Sparkles size={16} style={{ color: "rgba(180,200,255,0.8)", flexShrink: 0 }} />
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.55)" }}>Sistem Data Keuangan · Gaharu Sempana Group</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold"
              style={{ background: "rgba(255,255,255,0.12)", color: "rgba(200,215,255,0.95)", border: "1px solid rgba(255,255,255,0.18)" }}>
              {roleLabel(role)}
            </span>
          </div>
        </div>

        {/* Right avatar */}
        <div className="flex-none hidden sm:flex w-14 h-14 rounded-2xl items-center justify-center"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" fill="rgba(180,200,255,0.85)" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(180,200,255,0.85)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );

  return (
    <PageTransition>
      <PageHeader
        title={showingGrup ? "Master Dashboard" : `Dashboard ${selectedEntity?.name ?? ""}`}
        subtitle={
          showingGrup
            ? "Ringkasan keuangan seluruh grup perusahaan"
            : `Ringkasan performa keuangan ${selectedEntity?.legalName ?? ""}`
        }
        rightSlot={
          <div className="flex items-center gap-2.5">
            {rightSlot}
          </div>
        }
      />

      {welcomeBanner}

      {/* Grup / Master Dashboard view */}
      {showingGrup ? (
        <>
          {/* 5 KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="bg-surface-card rounded-[16px] border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center">
                  <TrendingUp size={16} className="text-blue-500 dark:text-blue-400" />
                </div>
                <span className="text-[11.5px] font-semibold text-muted">Total Pendapatan Grup</span>
              </div>
              <div className="text-[22px] font-extrabold text-navy-text tabular-nums">{formatMiliar(totalRevenue)}</div>
            </div>

            <div className="bg-surface-card rounded-[16px] border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-500/15 flex items-center justify-center">
                  <TrendingDown size={16} className="text-slate-400 dark:text-slate-500" />
                </div>
                <span className="text-[11.5px] font-semibold text-muted">Total Pengeluaran Grup</span>
              </div>
              <div className="text-[22px] font-extrabold text-navy-text tabular-nums">{formatMiliar(totalSpend)}</div>
            </div>

            <div className="bg-surface-card rounded-[16px] border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-500/15 flex items-center justify-center">
                  <BarChart3 size={16} className="text-status-green" />
                </div>
                <span className="text-[11.5px] font-semibold text-muted">Total Laba Bersih Grup</span>
              </div>
              <div className={`text-[22px] font-extrabold tabular-nums ${totalProfit >= 0 ? "text-status-green" : "text-status-red"}`}>
                {totalProfit < 0 ? "-" : ""}{formatMiliar(Math.abs(totalProfit))}
              </div>
            </div>

            <div className={`rounded-[16px] border p-4 ${(piutangMetrics?.terminPerluPerhatian ?? 0) > 0 ? "bg-yellow-50 dark:bg-yellow-500/15 border-yellow-200 dark:border-yellow-500/30" : "bg-surface-card border-border"}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${(piutangMetrics?.terminPerluPerhatian ?? 0) > 0 ? "bg-yellow-100 dark:bg-yellow-500/20" : "bg-slate-50 dark:bg-slate-500/15"}`}>
                  <AlertTriangle size={16} className={(piutangMetrics?.terminPerluPerhatian ?? 0) > 0 ? "text-yellow-600 dark:text-yellow-500" : "text-slate-400 dark:text-slate-500"} />
                </div>
                <span className="text-[11.5px] font-semibold text-muted">Piutang Perlu Perhatian</span>
              </div>
              <div className={`text-[22px] font-extrabold tabular-nums ${(piutangMetrics?.terminPerluPerhatian ?? 0) > 0 ? "text-yellow-700 dark:text-yellow-400" : "text-navy-text"}`}>
                {piutangMetrics?.terminPerluPerhatian ?? 0}
                <span className="text-[13px] font-semibold ml-1 text-muted">termin</span>
              </div>
            </div>

            <div className="bg-surface-card rounded-[16px] border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/15 flex items-center justify-center">
                  <CalendarClock size={16} className="text-purple-500 dark:text-purple-400" />
                </div>
                <span className="text-[11.5px] font-semibold text-muted">Total Piutang Belum Tertagih</span>
              </div>
              <div className="text-[22px] font-extrabold text-navy-text tabular-nums">
                {formatMiliar(piutangMetrics?.totalPiutangBelumTertagih ?? 0)}
              </div>
            </div>
          </div>

          {/* Entity cards compact — semua entitas 1 baris */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            {mainEntities.map((e) => (
              <EntityCardCompact
                key={e.key}
                entityKey={e.key}
                name={e.name}
                legalName={e.legalName}
                colorHex={e.colorHex}
                revenue={e.revenue}
                profit={e.profit}
              />
            ))}
            {umumEntity && (
              <EntityCardCompact
                entityKey={umumEntity.key}
                name={umumEntity.name}
                legalName={umumEntity.legalName}
                colorHex={umumEntity.colorHex}
                revenue={umumEntity.revenue}
                profit={umumEntity.profit}
                isUmum
              />
            )}
          </div>

          <RevenueChart
            monthlyDataByYear={monthlyDataByYear}
            entities={entities.map((e) => ({ key: e.key, name: e.name, colorHex: e.colorHex }))}
            years={chartYears}
            currentYear={currentYear}
          />
        </>
      ) : selectedEntity ? (
        <>
          <EntityCard
            entityKey={selectedEntity.key}
            name={selectedEntity.name}
            legalName={selectedEntity.legalName}
            colorHex={selectedEntity.colorHex}
            revenue={selectedEntity.revenue}
            spend={selectedEntity.spend}
            profit={selectedEntity.profit}
            interactive={true}
          />

          {entityLaporanData && (
            <EntityFinancialSummary
              data={entityLaporanData}
              entityKey={selectedEntity.key}
              year={currentYear}
            />
          )}

          <RevenueChart
            monthlyDataByYear={monthlyDataByYear}
            entities={[{ key: selectedEntity.key, name: selectedEntity.name, colorHex: selectedEntity.colorHex }]}
            years={chartYears}
            currentYear={currentYear}
            title={`Performa Bulanan ${selectedEntity.name}`}
          />

          <div className="bg-surface-card rounded-2xl border border-border p-5">
            <div className="text-sm font-bold text-navy-text mb-4">Proyek Berjalan</div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-[11.5px] font-bold text-muted-faint">
                  <td className="pb-2">Kode</td>
                  <td className="pb-2">Nama Proyek</td>
                  <td className="pb-2 text-right">Kontrak</td>
                  <td className="pb-2 text-right">Terpakai</td>
                  <td className="pb-2 text-right">Laba</td>
                </tr>
              </thead>
              <tbody>
                {selectedEntity.projects.length === 0 ? (
                  <tr className="border-t border-border">
                    <td colSpan={5} className="py-6 text-center text-sm text-muted">
                      Belum ada proyek berjalan untuk entitas ini.
                    </td>
                  </tr>
                ) : (
                  selectedEntity.projects.map((p) => (
                    <tr key={p.code} className="border-t border-border">
                      <td className="py-3 font-semibold text-muted-stronger">{p.code}</td>
                      <td className="py-3">{p.name}</td>
                      <td className="py-3 text-right tabular-nums">{formatMiliar(p.contractValue)}</td>
                      <td className="py-3 text-right tabular-nums">{formatMiliar(p.spend)}</td>
                      <td
                        className={`py-3 text-right tabular-nums font-semibold ${
                          p.profit >= 0 ? "text-status-green" : "text-status-red"
                        }`}
                      >
                        {formatMiliar(p.profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun. Hubungi Manajer Keuangan.</p>
      )}
    </PageTransition>
  );
}
