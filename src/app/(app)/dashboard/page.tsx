import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities, getRecentNotifications, getUnreadNotificationCount, formatRupiah } from "@/lib/dashboard-data";
import { canViewGrupAggregate, roleLabel } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { UserBadge, NotifBell } from "@/components/layout/UserBadge";
import { EntityCard } from "@/components/dashboard/EntityCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { entity?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys, name } = session!.user;

  const entities = await getAccessibleEntities(entityKeys);
  const canGrup = canViewGrupAggregate(role);
  const isStaff = role === "STAF_KEUANGAN";

  const selectedKey =
    searchParams.entity && entityKeys.includes(searchParams.entity)
      ? searchParams.entity
      : isStaff
      ? entityKeys[0]
      : searchParams.entity;
  const showingGrup = canGrup && !selectedKey;
  const selectedEntity = entities.find((e) => e.key === selectedKey);

  const notifications = await getRecentNotifications(role);
  const unreadCount = await getUnreadNotificationCount(role);

  const rightSlot = (
    <>
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
      <NotifBell unreadCount={unreadCount} />
    </>
  );

  return (
    <>
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
      </div>

      <PageHeader
        title={showingGrup ? "Master Dashboard" : `Dashboard ${selectedEntity?.name ?? ""}`}
        subtitle={
          showingGrup
            ? "Ringkasan keuangan seluruh grup perusahaan"
            : `Ringkasan performa keuangan ${selectedEntity?.legalName ?? ""}`
        }
        rightSlot={rightSlot}
      />

      {isStaff && (
        <span className="text-[10.5px] font-bold text-muted-faint bg-surface-hover px-2.5 py-1 rounded-full w-fit">
          Mode Tampilan Saja
        </span>
      )}

      {showingGrup ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {entities.map((e) => (
              <EntityCard
                key={e.key}
                entityKey={e.key}
                name={e.name}
                legalName={e.legalName}
                colorHex={e.colorHex}
                revenue={e.revenue}
                spend={e.spend}
                profit={e.profit}
              />
            ))}
          </div>

          <RevenueChart
            data={entities.map((e) => ({ name: e.name, revenue: e.revenue, spend: e.spend, color: e.colorHex }))}
          />

          <div className="bg-white rounded-2xl border border-border p-5">
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

          <div className="bg-white rounded-2xl border border-border p-5">
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
                    <td className="py-3 text-right tabular-nums">{formatRupiah(p.contractValue)}</td>
                    <td className="py-3 text-right tabular-nums">{formatRupiah(p.spend)}</td>
                    <td
                      className={`py-3 text-right tabular-nums font-semibold ${
                        p.profit >= 0 ? "text-status-green" : "text-status-red"
                      }`}
                    >
                      {formatRupiah(p.profit)}
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
