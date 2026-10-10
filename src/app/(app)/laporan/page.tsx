import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities, formatRupiah, getMonthlyChartData, getMonthlyByYear } from "@/lib/dashboard-data";
import { getLabaRugiData } from "@/lib/laba-rugi";
import { getNeracaData } from "@/lib/neraca";
import { getArusKasData } from "@/lib/arus-kas";
import { canViewGrupAggregate } from "@/lib/rbac";
import { resolveReportEntityKey } from "@/lib/entity-prefs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { LaporanTabs } from "@/components/laporan/LaporanTabs";
import { KomparasiControls } from "@/components/laporan/KomparasiControls";
import { MultiYearChips } from "@/components/laporan/MultiYearChips";
import { KomparasiLineChart } from "@/components/laporan/KomparasiLineChart";
import { KomparasiEntityPills } from "@/components/laporan/KomparasiEntityPills";
import { RingkasanTab } from "@/components/laporan/RingkasanTab";
import { LabaRugiView } from "@/components/laporan/LabaRugiView";
import { LabaRugiUmumView } from "@/components/laporan/LabaRugiUmumView";
import { getLaporanPajakData } from "@/lib/pajak";
import { NeracaView } from "@/components/laporan/NeracaView";
import { ArusKasView } from "@/components/laporan/ArusKasView";
import { ArusKasTabWrapper } from "@/components/laporan/ArusKasTabWrapper";
import { getArusKasPresisiData } from "@/lib/arus-kas-presisi";
import {
  getLaporanKeuanganData,
  getLaporanJurnalData,
  getLaporanBankData,
} from "@/lib/laporan-keuangan";
import { getPiutangData } from "@/lib/piutang";
import { getLaporanUtangAsetData } from "@/lib/laporan-utang-aset";
import { PiutangView } from "@/components/laporan/PiutangView";
import { UtangAsetView } from "@/components/laporan/UtangAsetView";
import { phpFetch, getPhpToken } from "@/lib/api-client";
import { getValidasiPajak3Arah, type ValidasiPajak3ArahData } from "@/lib/validasi-pajak-3arah";
import { ValidasiPajak3ArahCard } from "@/components/laporan/ValidasiPajak3ArahCard";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PageTransition } from "@/components/layout/PageTransition";
import type { ReportVersion } from "@/lib/laba-rugi";

const BULAN_LABEL = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type Period = { year: number; month?: number };

function parsePeriod(raw: string | undefined, mode: "tahunan" | "bulanan", fallback: Period): Period {
  if (!raw) return mode === "bulanan" ? { year: fallback.year, month: fallback.month ?? 1 } : { year: fallback.year };
  const [yStr, mStr] = raw.split("-");
  const year = parseInt(yStr) || fallback.year;
  if (mode !== "bulanan") return { year };
  const month = parseInt(mStr) || fallback.month || 1;
  return { year, month };
}

function periodLabel(p: Period, mode: "tahunan" | "bulanan") {
  return mode === "bulanan" ? `${BULAN_LABEL[(p.month ?? 1) - 1]} ${p.year}` : `Tahun ${p.year}`;
}

// delta positif dianggap "baik" untuk Pendapatan & Laba, tapi "buruk" untuk Beban —
// goodWhenUp membalik warna supaya kenaikan Beban tetap ditandai merah.
function computeDelta(a: number, b: number, goodWhenUp: boolean) {
  const diff = a - b;
  const pct = b !== 0 ? (diff / Math.abs(b)) * 100 : a !== 0 ? 100 : 0;
  const isUp = diff > 0;
  const isFlat = diff === 0;
  const isGood = isFlat ? null : isUp === goodWhenUp;
  return { diff, pct, isUp, isFlat, isGood };
}

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: {
    entity?: string;
    year?: string;
    tab?: string;
    mode?: string;
    periodA?: string;
    periodB?: string;
    chartYears?: string;
    version?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  if (role !== "SUPER_ADMIN" && role !== "MANAJER_KEUANGAN" && role !== "STAF_KEUANGAN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const currentVersion: ReportVersion = (searchParams.version ?? "internal").toUpperCase() === "UMUM" ? "UMUM" : "INTERNAL";
  const canGrup = canViewGrupAggregate(role);
  const effectiveCanGrup = currentVersion === "UMUM" ? false : canGrup;
  const selectedKey = resolveReportEntityKey(searchParams.entity, entityKeys, effectiveCanGrup);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();
  const tab = searchParams.tab ?? "ringkasan";

  // For group view, aggregate all entity data
  const entityIds = selectedEntity
    ? [selectedEntity.id]
    : entities.map((e) => e.id);
  const entityKeysArr = selectedEntity
    ? [selectedEntity.key]
    : entities.map((e) => e.key);

  // Fetch data based on active tab
  let laporanKeuanganData: Awaited<ReturnType<typeof getLaporanKeuanganData>> | null = null;
  let jurnalData: Awaited<ReturnType<typeof getLaporanJurnalData>> | null = null;
  let bankData: Awaited<ReturnType<typeof getLaporanBankData>> | null = null;
  let arusKasCombined: any = null;
  let arusKasPresisiData: Awaited<ReturnType<typeof getArusKasPresisiData>> | null = null;
  let piutangData: Awaited<ReturnType<typeof getPiutangData>> | null = null;
  let utangAsetData: Awaited<ReturnType<typeof getLaporanUtangAsetData>> | null = null;
  let taxData: Awaited<ReturnType<typeof getLaporanPajakData>> | null = null;
  let validasiPajak3Arah: ValidasiPajak3ArahData | null = null;

  if (tab === "ringkasan") {
    const [laporan, jData, bData] = await Promise.all([
      getLaporanKeuanganData(entityIds, currentYear, currentVersion),
      getLaporanJurnalData(entityIds, currentYear, 80),
      getLaporanBankData(entityIds, currentYear, 80),
    ]);
    laporanKeuanganData = laporan;
    jurnalData = jData;
    bankData = bData;
  } else if (tab === "laba-rugi" || tab === "neraca") {
    const [laporan, tax, validasi3Arah] = await Promise.all([
      getLaporanKeuanganData(entityIds, currentYear, currentVersion),
      tab === "laba-rugi"
        ? getLaporanPajakData(entityIds, currentYear, currentVersion, selectedEntity?.name ?? "Grup")
        : Promise.resolve(null),
      tab === "laba-rugi"
        ? getValidasiPajak3Arah(entityIds, currentYear, currentVersion)
        : Promise.resolve(null),
    ]);
    laporanKeuanganData = laporan;
    taxData = tax;
    validasiPajak3Arah = validasi3Arah;
  } else if (tab === "arus-kas") {
    const [laporan, allArusKas, presisi] = await Promise.all([
      getLaporanKeuanganData(entityIds, currentYear, currentVersion),
      Promise.all(entityIds.map((id) => getArusKasData(id, currentYear, currentVersion))),
      getArusKasPresisiData(entityIds, currentYear, currentVersion),
    ]);
    laporanKeuanganData = laporan;
    arusKasPresisiData = presisi;

    const MONTHS_LABEL = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];

    const monthlyCombined = MONTHS_LABEL.map((bulan, i) => {
      const masuk = allArusKas.reduce((s, d) => s + (d.monthly[i]?.masuk || 0), 0);
      const keluar = allArusKas.reduce((s, d) => s + (d.monthly[i]?.keluar || 0), 0);
      const net = masuk - keluar;
      return {
        bulan,
        masuk,
        keluar,
        net,
        masukFmt: masuk > 0 ? formatRupiah(masuk) : "-",
        keluarFmt: keluar > 0 ? formatRupiah(keluar) : "-",
        netFmt: formatRupiah(Math.abs(net)),
        netPositive: net >= 0,
        hasData: masuk > 0 || keluar > 0,
      };
    });

    const totalMasuk = allArusKas.reduce((s, d) => s + d.monthly.reduce((x, m) => x + m.masuk, 0), 0);
    const totalKeluar = allArusKas.reduce((s, d) => s + d.monthly.reduce((x, m) => x + m.keluar, 0), 0);
    const netTotal = totalMasuk - totalKeluar;

    arusKasCombined = {
      monthly: monthlyCombined,
      totalMasuk,
      totalKeluar,
      netTotal,
      totalMasukFmt: formatRupiah(totalMasuk),
      totalKeluarFmt: formatRupiah(totalKeluar),
      netTotalFmt: formatRupiah(Math.abs(netTotal)),
      netTotalPositive: netTotal >= 0,
      kasAwalFmt: laporan.kasAwalFmt,
      kasOperasiFmt: laporan.kasOperasiFmt,
      kasInvestasiFmt: laporan.kasInvestasiFmt,
      kasPendanaanFmt: laporan.kasPendanaanFmt,
      kenaikanBersihFmt: laporan.kenaikanBersihFmt,
      kasAkhirFmt: laporan.kasAkhirFmt,
      kasOperasi: laporan.kasOperasi,
      kasInvestasi: laporan.kasInvestasi,
      kasPendanaan: laporan.kasPendanaan,
      kenaikanBersihKas: laporan.kenaikanBersihKas,
    };
  } else if (tab === "piutang") {
    piutangData = await getPiutangData(entityKeysArr[0] ?? "");
  } else if (tab === "utang-aset") {
    utangAsetData = await getLaporanUtangAsetData(entityIds[0] ?? "", currentYear);
  }

  // Komparasi antar-periode (bulan vs bulan, atau tahun vs tahun) — jangkauan
  // dibatasi 5 tahun ke belakang lewat KomparasiControls.
  let komparasiData: {
    mode: "tahunan" | "bulanan";
    periodA: Period;
    periodB: Period;
    labelA: string;
    labelB: string;
    pendapatan: ReturnType<typeof computeDelta> & { a: number; b: number };
    beban: ReturnType<typeof computeDelta> & { a: number; b: number };
    laba: ReturnType<typeof computeDelta> & { a: number; b: number };
    txCountA: number;
    txCountB: number;
  } | null = null;

  type MonthRow = Record<string, string | number>;
  let komparasiChart:
    | { type: "grup"; chartA: MonthRow[]; chartB: MonthRow[]; entities: { key: string; name: string; colorHex: string }[]; lineData: MonthRow[]; lineYears: number[] }
    | { type: "single"; data: MonthRow[]; years: number[] }
    | null = null;

  if (tab === "komparasi") {
    const mode = searchParams.mode === "bulanan" ? "bulanan" : "tahunan";
    const nowYear = new Date().getFullYear();
    const nowMonth = new Date().getMonth() + 1;
    const periodA = parsePeriod(searchParams.periodA, mode, { year: nowYear, month: nowMonth });
    const periodB = parsePeriod(searchParams.periodB, mode, { year: nowYear - 2, month: nowMonth });

    const fmtDate = (p: Period, end: boolean) => {
      if (p.month) {
        const lastDay = new Date(p.year, p.month, 0).getDate();
        return end ? `${p.year}-${String(p.month).padStart(2, "0")}-${lastDay} 23:59:59` : `${p.year}-${String(p.month).padStart(2, "0")}-01 00:00:00`;
      }
      return end ? `${p.year}-12-31 23:59:59` : `${p.year}-01-01 00:00:00`;
    };

    const phpToken = await getPhpToken();
    const txCountParams = (p: Period) => {
      const params = new URLSearchParams({ type: "tx-count", dateFrom: fmtDate(p, false), dateTo: fmtDate(p, true) });
      entityIds.forEach((id) => params.append("entityIds[]", id));
      return params.toString();
    };

    const [labaRugiA, labaRugiB, txRespA, txRespB] = await Promise.all([
      Promise.all(entityIds.map((id) => getLabaRugiData(id, periodA.year, periodA.month, currentVersion))),
      Promise.all(entityIds.map((id) => getLabaRugiData(id, periodB.year, periodB.month, currentVersion))),
      phpFetch<{ count: number }>(`/api/laporan-keuangan?${txCountParams(periodA)}`, phpToken),
      phpFetch<{ count: number }>(`/api/laporan-keuangan?${txCountParams(periodB)}`, phpToken),
    ]);
    const txCountA = txRespA.count ?? 0;
    const txCountB = txRespB.count ?? 0;

    const sumPendapatan = (list: typeof labaRugiA) => list.reduce((s, d) => s + d.totalPendapatan, 0);
    const sumBeban = (list: typeof labaRugiA) => list.reduce((s, d) => s + d.totalBeban, 0);

    const pendapatanA = sumPendapatan(labaRugiA);
    const pendapatanB = sumPendapatan(labaRugiB);
    const bebanA = sumBeban(labaRugiA);
    const bebanB = sumBeban(labaRugiB);

    komparasiData = {
      mode,
      periodA,
      periodB,
      labelA: periodLabel(periodA, mode),
      labelB: periodLabel(periodB, mode),
      pendapatan: { a: pendapatanA, b: pendapatanB, ...computeDelta(pendapatanA, pendapatanB, true) },
      beban: { a: bebanA, b: bebanB, ...computeDelta(bebanA, bebanB, false) },
      laba: {
        a: pendapatanA - bebanA,
        b: pendapatanB - bebanB,
        ...computeDelta(pendapatanA - bebanA, pendapatanB - bebanB, true),
      },
      txCountA,
      txCountB,
    };

    // Chart tren pendapatan bulanan antar-tahun (berlaku untuk mode Tahunan maupun Bulanan).
    // Grup ("Semua Entitas") menampilkan tren per tahun komparasi;
    // 1 entitas spesifik menampilkan pilihan multi-tahun (2-5 tahun) dengan warna per tahun.
    if (!selectedEntity) {
      const entityKeysAll = entities.map((e) => e.key);
      let allYears: number[];
      if (periodA.year === periodB.year) {
        allYears = [periodA.year - 1, periodA.year];
      } else {
        const minYear = Math.min(periodA.year, periodB.year);
        const maxYear = Math.max(periodA.year, periodB.year);
        allYears = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
      }

      const allCharts = await Promise.all(allYears.map((y) => getMonthlyChartData(entityKeysAll, y, currentVersion)));
      const chartByYear: Record<number, MonthRow[]> = {};
      allYears.forEach((y, i) => { chartByYear[y] = allCharts[i]; });

      const chartA = chartByYear[periodA.year];
      const chartB = chartByYear[periodB.year];
      const baseChart = chartA || chartByYear[allYears[0]] || [];

      // Line chart: per bulan, total semua entitas, satu garis per tahun
      const lineData: MonthRow[] = baseChart.map((rowA, mi) => {
        const entry: MonthRow = { month: rowA.month };
        for (const y of allYears) {
          const row = chartByYear[y]?.[mi];
          if (row) {
            entry[String(y)] = entityKeysAll.reduce((s, k) => s + (Number(row[k]) || 0), 0);
          }
        }
        return entry;
      });

      komparasiChart = {
        type: "grup",
        chartA: chartA || baseChart,
        chartB: chartB || baseChart,
        entities: entities.map((e) => ({ key: e.key, name: e.name, colorHex: e.colorHex })),
        lineData,
        lineYears: allYears,
      };
    } else {
      const parsedYears = (searchParams.chartYears ?? "")
        .split(",")
        .map((y) => parseInt(y))
        .filter((y) => !isNaN(y));
      let chartYears: number[];
      if (parsedYears.length >= 2) {
        chartYears = Array.from(new Set(parsedYears)).sort((a, b) => a - b).slice(0, 5);
      } else {
        const yearsSet = new Set([periodB.year, periodA.year]);
        if (yearsSet.size < 2) {
          yearsSet.add(periodA.year - 1);
        }
        chartYears = Array.from(yearsSet).sort((a, b) => a - b);
      }
      const data = await getMonthlyByYear([selectedEntity.id], chartYears, currentVersion);
      komparasiChart = { type: "single", data, years: chartYears };
    }
  }

  const entityLabel = selectedEntity ? selectedEntity.name : "Semua Entitas";

  return (
    <PageTransition>
      <PageHeader
        title={`Laporan Keuangan ${currentVersion === "UMUM" ? "Umum" : "Internal"}`}
        subtitle={
          tab === "komparasi" && komparasiData
            ? `Komparasi laporan keuangan — ${entityLabel} · ${komparasiData.labelA} vs ${komparasiData.labelB} (${currentVersion === "UMUM" ? "Versi Umum" : "Versi Internal"})`
            : `Ringkasan laporan keuangan — ${entityLabel} ${currentYear} (${currentVersion === "UMUM" ? "Versi Umum" : "Versi Internal"})`
        }
        rightSlot={
          <>
            {tab !== "komparasi" && <YearSelect currentYear={currentYear} />}
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={effectiveCanGrup}
              currentEntityKey={selectedKey ?? "grup"}
            />
          </>
        }
      />

      <LaporanTabs currentTab={tab} />

      {tab === "komparasi" && komparasiData && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <KomparasiControls
              mode={komparasiData.mode}
              periodA={komparasiData.periodA}
              periodB={komparasiData.periodB}
            />
            <KomparasiEntityPills
              entities={entities.map((e) => ({ key: e.key, name: e.name, colorHex: e.colorHex }))}
              currentEntityKey={selectedKey}
              canGrup={effectiveCanGrup}
            />
          </div>

          <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-surface-hover text-left">
                  <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Metrik</th>
                  <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">{komparasiData.labelA}</th>
                  <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">{komparasiData.labelB}</th>
                  <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase text-right">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Pendapatan", d: komparasiData.pendapatan },
                  { label: "Beban", d: komparasiData.beban },
                  { label: "Laba/Rugi Bersih", d: komparasiData.laba },
                ].map((row) => {
                  const Icon = row.d.isFlat ? Minus : row.d.isUp ? TrendingUp : TrendingDown;
                  const color = row.d.isFlat
                    ? "text-muted"
                    : row.d.isGood
                    ? "text-status-green"
                    : "text-status-red";
                  return (
                    <tr key={row.label} className="border-b border-surface-subtle">
                      <td className="py-3 px-6 font-semibold text-navy-text">{row.label}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-navy-text">{formatRupiah(row.d.a)}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-navy-text">{formatRupiah(row.d.b)}</td>
                      <td className={`py-3 px-6 text-right tabular-nums font-bold ${color}`}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Icon size={14} />
                          {(row.d.diff >= 0 ? "+" : "-") + formatRupiah(Math.abs(row.d.diff))}
                          <span className="text-[11px] font-semibold text-muted-faint">
                            ({row.d.pct >= 0 ? "+" : ""}{row.d.pct.toFixed(1)}%)
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="py-3 px-6 font-semibold text-navy-text">Total Transaksi</td>
                  <td className="py-3 px-3 text-right tabular-nums text-navy-text">{komparasiData.txCountA}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-navy-text">{komparasiData.txCountB}</td>
                  <td className="py-3 px-6 text-right tabular-nums font-bold text-muted-stronger">
                    {komparasiData.txCountA - komparasiData.txCountB >= 0 ? "+" : ""}
                    {komparasiData.txCountA - komparasiData.txCountB}
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>

          {komparasiChart?.type === "grup" && (
            <KomparasiLineChart
              title={`Tren Pendapatan Bulanan — ${komparasiChart.lineYears.join(", ")}`}
              data={komparasiChart.lineData}
              lineKeys={komparasiChart.lineYears.map(String)}
            />
          )}

          {komparasiChart?.type === "single" && (
            <div className="flex flex-col gap-3">
              <MultiYearChips selectedYears={komparasiChart.years} />
              <KomparasiLineChart
                title="Tren Pendapatan Bulanan Antar-Tahun"
                data={komparasiChart.data}
                lineKeys={komparasiChart.years.map(String)}
              />
            </div>
          )}
        </div>
      )}

      {tab === "ringkasan" && laporanKeuanganData && jurnalData && bankData && (
        <RingkasanTab
          kpi={{
            totalPendapatan: laporanKeuanganData.totalPendapatan,
            totalBeban: laporanKeuanganData.totalBeban,
            labaBersih: laporanKeuanganData.labaBersih,
            totalPendapatanFmt: laporanKeuanganData.totalPendapatanFmt,
            totalBebanFmt: laporanKeuanganData.totalBebanFmt,
            labaBersihFmt: laporanKeuanganData.labaBersihFmt,
            labaBersihPositive: laporanKeuanganData.labaBersihPositive,
            txCount: jurnalData.totalCount,
            marginPct:
              laporanKeuanganData.totalPendapatan > 0
                ? (laporanKeuanganData.labaBersih / laporanKeuanganData.totalPendapatan) * 100
                : 0,
          }}
          jurnal={jurnalData}
          bank={bankData}
          entityName={entityLabel}
          isGrup={!selectedEntity}
          year={currentYear}
        />
      )}

      {tab === "laba-rugi" && laporanKeuanganData && (
        <div className="flex flex-col gap-6">
          {validasiPajak3Arah && (
            <ValidasiPajak3ArahCard
              data={validasiPajak3Arah}
              entityName={entityLabel}
            />
          )}
          {taxData ? (
            <LabaRugiUmumView data={taxData} entityKey={selectedKey ?? ""} version={currentVersion} />
          ) : (
            <LabaRugiView
              data={laporanKeuanganData}
              year={currentYear}
              entityName={entityLabel}
            />
          )}
        </div>
      )}

      {tab === "neraca" && laporanKeuanganData && (
        <NeracaView
          data={laporanKeuanganData}
          year={currentYear}
          entityName={entityLabel}
        />
      )}

      {tab === "arus-kas" && arusKasCombined && (
        arusKasPresisiData ? (
          <ArusKasTabWrapper
            standardView={
              <ArusKasView
                data={arusKasCombined}
                year={currentYear}
                entityName={entityLabel}
              />
            }
            presisiData={arusKasPresisiData}
            entityId={selectedEntity?.id ?? entityIds[0]}
          />
        ) : (
          <ArusKasView
            data={arusKasCombined}
            year={currentYear}
            entityName={entityLabel}
          />
        )
      )}

      {tab === "piutang" && piutangData && (
        <PiutangView
          projectList={piutangData.projectList}
          summary={piutangData.summary}
          userRole={role}
          isGrup={!selectedEntity}
        />
      )}

      {tab === "utang-aset" && utangAsetData && (
        <UtangAsetView data={utangAsetData} />
      )}
    </PageTransition>
  );
}
