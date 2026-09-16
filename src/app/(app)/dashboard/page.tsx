import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getAccessibleEntities,
  getRecentNotifications,
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
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { entity?: string; chartYear?: string; compareYears?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys, name } = session!.user;

  const entities = await getAccessibleEntities(entityKeys);
  const canGrup = canViewGrupAggregate(role);
  const isStaff = role === "STAF_KEUANGAN";

  const selectedKey = isStaff
    // Staff selalu punya entity aktif — baca cookie kalau URL tidak ada entity
    ? resolveEntityKey(searchParams.entity, entityKeys)
    // Manager/Admin: kalau URL tidak ada entity → tampilkan grup (undefined)
    : searchParams.entity && entityKeys.includes(searchParams.entity)
      ? searchParams.entity
      : searchParams.entity; // undefined → grup
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

  const [notifications, unreadCount, piutangMetrics, monthlyDataByYear] = await Promise.all([
    getRecentNotifications(role),
    getUnreadNotificationCount(role),
    showingGrup ? getGrupPiutangMetrics() : Promise.resolve(null),
    showingGrup ? Promise.all(chartYears.map((y) => getMonthlyChartData(entityKeys, y))) : Promise.resolve([]),
  ]);

  const rightSlot = (
    <>
      {!isStaff && <NotifBell unreadCount={unreadCount} />}
      {canGrup && (
        <EntitySwitcher
          entities={entities.map((e) => ({ key: e.key, name: e.name }))}
          showGrupOption={true}
          currentEntityKey={selectedKey ?? "grup"}
        />
      )}
      {isStaff && entities.length > 1 && (
        <EntitySwitcher
          entities={entities.map((e) => ({ key: e.key, name: e.name }))}
          showGrupOption={false}
          currentEntityKey={selectedKey ?? entityKeys[0]}
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

  const welcomeBanner = (
    <div className="relative overflow-hidden rounded-[20px] px-10 py-8 flex items-center justify-between gap-6 bg-gradient-to-br from-[#2f5fe0] via-[#6a4de0] to-[#9145d6]">
      <div className="relative z-10">
        <div className="text-2xl font-extrabold text-white">Selamat Datang, {name}! 👋</div>
        <div className="text-[13.5px] text-white/85 mt-2 flex items-center gap-2.5 flex-wrap">
          Sistem Data Keuangan Gaharu Sempana Group, Anda masuk sebagai
          <span className="bg-white/20 px-3 py-1 rounded-full font-bold text-[11.5px] text-white tracking-wide">
            {roleLabel(role)}
          </span>
        </div>
      </div>
      <div className="flex-none w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" fill="rgba(255,255,255,0.8)" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );

  return (
    <>
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

      {isStaff && (
        <span className="text-[10.5px] font-bold text-muted-faint bg-surface-hover px-2.5 py-1 rounded-full w-fit">
          Mode Tampilan Saja
        </span>
      )}

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

          {/* Notifikasi terbaru */}
          <div className="bg-surface-card rounded-2xl border border-border p-5">
            <div className="text-sm font-bold text-navy-text mb-4">Notifikasi Terbaru</div>
            {notifications.length === 0 ? (
              <p className="text-sm text-muted">Belum ada notifikasi.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {notifications.map((n) => (
                  <div key={n.id} className="flex gap-2.5 items-start">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-none ${n.read ? "bg-border" : "bg-brand"}`} />
                    <div>
                      <div className="text-[12.5px] text-muted-stronger leading-snug">{n.text}</div>
                      <div className="text-[11px] text-muted-faint mt-0.5">
                        {new Date(n.createdAt).toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
            interactive={!isStaff}
          />

          <div className="bg-surface-card rounded-2xl border border-border p-5">
            <div className="text-sm font-bold text-navy-text mb-4">Proyek Berjalan</div>
            <table className="w-full text-sm">
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
                {selectedEntity.projects.map((p) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun. Hubungi Manajer Keuangan.</p>
      )}
    </>
  );
}
