import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities, formatRupiah } from "@/lib/dashboard-data";
import { getLabaRugiData } from "@/lib/laba-rugi";
import { getNeracaData } from "@/lib/neraca";
import { getArusKasData } from "@/lib/arus-kas";
import { canViewGrupAggregate } from "@/lib/rbac";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { LaporanTabs } from "@/components/laporan/LaporanTabs";
import { prisma } from "@/lib/prisma";

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string; tab?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  if (role !== "SUPER_ADMIN" && role !== "MANAJER_KEUANGAN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const canGrup = canViewGrupAggregate(role);
  // Grup view hanya muncul kalau canGrup dan tidak ada entity di URL (user sengaja pilih grup).
  // Kalau tidak ada entity di URL tapi juga tidak canGrup → baca cookie via resolveEntityKey.
  const selectedKey =
    canGrup && !searchParams.entity
      ? undefined
      : resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();
  const tab = searchParams.tab ?? "ringkasan";

  // For group view, aggregate all entity data
  const entityIds = selectedEntity
    ? [selectedEntity.id]
    : entities.map((e) => e.id);

  // Fetch data based on active tab
  let labaRugiData = null;
  let neracaData = null;
  let arusKasData = null;

  if (tab === "ringkasan" || tab === "laba-rugi") {
    const allLabaRugi = await Promise.all(entityIds.map((id) => getLabaRugiData(id, currentYear)));
    labaRugiData = {
      pendapatanList: [] as { code: string; name: string; total: number; totalFmt: string }[],
      bebanList: [] as { code: string; name: string; total: number; totalFmt: string }[],
      totalPendapatan: allLabaRugi.reduce((s, d) => s + d.pendapatanList.reduce((x, i) => x + i.total, 0), 0),
      totalBeban: allLabaRugi.reduce((s, d) => s + d.bebanList.reduce((x, i) => x + i.total, 0), 0),
      labaBersih: 0,
      labaBersihPositive: true,
      totalPendapatanFmt: "",
      totalBebanFmt: "",
      labaBersihFmt: "",
    };
    labaRugiData.labaBersih = labaRugiData.totalPendapatan - labaRugiData.totalBeban;
    labaRugiData.labaBersihPositive = labaRugiData.labaBersih >= 0;
    labaRugiData.totalPendapatanFmt = formatRupiah(labaRugiData.totalPendapatan);
    labaRugiData.totalBebanFmt = formatRupiah(labaRugiData.totalBeban);
    labaRugiData.labaBersihFmt = formatRupiah(Math.abs(labaRugiData.labaBersih));
    // Merge lists
    for (const d of allLabaRugi) {
      for (const item of d.pendapatanList) {
        const existing = labaRugiData.pendapatanList.find((x) => x.code === item.code);
        if (existing) existing.total += item.total;
        else labaRugiData.pendapatanList.push({ ...item });
      }
      for (const item of d.bebanList) {
        const existing = labaRugiData.bebanList.find((x) => x.code === item.code);
        if (existing) existing.total += item.total;
        else labaRugiData.bebanList.push({ ...item });
      }
    }
    labaRugiData.pendapatanList = labaRugiData.pendapatanList.map((i) => ({ ...i, totalFmt: formatRupiah(i.total) }));
    labaRugiData.bebanList = labaRugiData.bebanList.map((i) => ({ ...i, totalFmt: formatRupiah(i.total) }));
  }

  if (tab === "neraca") {
    neracaData = await getNeracaData(entityIds[0] ?? "", currentYear);
  }

  if (tab === "arus-kas") {
    const allArusKas = await Promise.all(entityIds.map((id) => getArusKasData(id, currentYear)));
    const totalMasuk = allArusKas.reduce((s, d) => s + d.monthly.reduce((x, m) => x + m.masuk, 0), 0);
    const totalKeluar = allArusKas.reduce((s, d) => s + d.monthly.reduce((x, m) => x + m.keluar, 0), 0);
    arusKasData = allArusKas[0] ?? null;
    if (arusKasData) {
      arusKasData = {
        ...arusKasData,
        totalMasukFmt: formatRupiah(totalMasuk),
        totalKeluarFmt: formatRupiah(totalKeluar),
        netTotalFmt: formatRupiah(Math.abs(totalMasuk - totalKeluar)),
        netTotalPositive: totalMasuk >= totalKeluar,
      };
    }
  }

  const txCount = await prisma.transaction.count({
    where: {
      entityId: { in: entityIds },
      tanggal: {
        gte: new Date(`${currentYear}-01-01`),
        lte: new Date(`${currentYear}-12-31T23:59:59`),
      },
    },
  });

  const entityLabel = selectedEntity ? selectedEntity.name : "Semua Entitas";

  return (
    <>
      <PageHeader
        title="Laporan Keuangan"
        subtitle={`Ringkasan laporan keuangan — ${entityLabel} ${currentYear}`}
        rightSlot={
          <>
            <YearSelect currentYear={currentYear} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={canGrup}
              currentEntityKey={selectedKey ?? "grup"}
            />
          </>
        }
      />

      <LaporanTabs currentTab={tab} />

      {tab === "ringkasan" && labaRugiData && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Pendapatan", value: labaRugiData.totalPendapatanFmt, color: "text-status-green" },
              { label: "Total Beban", value: labaRugiData.totalBebanFmt, color: "text-status-red" },
              {
                label: "Laba/Rugi Bersih",
                value: (labaRugiData.labaBersihPositive ? "" : "-") + labaRugiData.labaBersihFmt,
                color: labaRugiData.labaBersihPositive ? "text-status-green" : "text-status-red",
              },
              { label: "Total Transaksi", value: txCount.toString() + " transaksi", color: "text-navy-text" },
            ].map((card) => (
              <div key={card.label} className="bg-surface-card rounded-[16px] border border-border-soft p-5">
                <div className="text-[12px] font-semibold text-muted-faint mb-1">{card.label}</div>
                <div className={`text-[18px] font-extrabold tabular-nums ${card.color}`}>{card.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "laba-rugi" && labaRugiData && (
        <div className="flex flex-col gap-5">
          <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-subtle font-bold text-navy-text">PENDAPATAN</div>
            <table className="w-full text-sm">
              <tbody>
                {labaRugiData.pendapatanList.map((item) => (
                  <tr key={item.code} className="border-b border-surface-subtle">
                    <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                    <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold text-status-green">{item.totalFmt}</td>
                  </tr>
                ))}
                <tr className="bg-green-50 dark:bg-green-500/15">
                  <td className="py-3 px-6 font-extrabold text-navy-text">Total Pendapatan</td>
                  <td className="py-3 px-6 text-right tabular-nums font-extrabold text-status-green">{labaRugiData.totalPendapatanFmt}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-subtle font-bold text-navy-text">BEBAN</div>
            <table className="w-full text-sm">
              <tbody>
                {labaRugiData.bebanList.map((item) => (
                  <tr key={item.code} className="border-b border-surface-subtle">
                    <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                    <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold text-status-red">{item.totalFmt}</td>
                  </tr>
                ))}
                <tr className="bg-red-50 dark:bg-red-500/10">
                  <td className="py-3 px-6 font-extrabold text-navy-text">Total Beban</td>
                  <td className="py-3 px-6 text-right tabular-nums font-extrabold text-status-red">{labaRugiData.totalBebanFmt}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className={`px-6 py-5 rounded-[20px] border-2 ${labaRugiData.labaBersihPositive ? "border-green-300 dark:border-green-500/30 bg-green-50 dark:bg-green-500/15" : "border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10"}`}>
            <div className="text-[13px] font-semibold text-muted-stronger mb-1">
              {labaRugiData.labaBersihPositive ? "LABA BERSIH" : "RUGI BERSIH"}
            </div>
            <div className={`text-[28px] font-extrabold tabular-nums ${labaRugiData.labaBersihPositive ? "text-status-green" : "text-status-red"}`}>
              {labaRugiData.labaBersihPositive ? "" : "-"}{labaRugiData.labaBersihFmt}
            </div>
          </div>
        </div>
      )}

      {tab === "neraca" && neracaData && (
        <div className="px-4 py-3 rounded-xl bg-surface-subtle border border-border-soft text-[13px] text-muted-stronger">
          Neraca per 31 Desember {currentYear}. Lihat detail di halaman <a href="/neraca" className="text-brand font-semibold hover:underline">Neraca</a>.
        </div>
      )}

      {tab === "arus-kas" && arusKasData && (
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-hover text-left">
                <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Bulan</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Kas Masuk</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Kas Keluar</th>
                <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {arusKasData.monthly.map((m) => (
                <tr key={m.bulan} className={`border-b border-surface-subtle ${m.hasData ? "" : "opacity-40"}`}>
                  <td className="py-3 px-6 font-semibold text-navy-text">{m.bulan}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[13px] text-status-green">{m.masukFmt}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[13px] text-status-red">{m.keluarFmt}</td>
                  <td className={`py-3 px-6 text-right tabular-nums text-[13px] font-bold ${m.netPositive ? "text-status-green" : "text-status-red"}`}>
                    {m.hasData ? (m.netPositive ? "+" : "-") + m.netFmt : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
