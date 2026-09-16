"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  LabelList,
} from "recharts";
import { BarChart2, TrendingUp, GitCompare, X } from "lucide-react";

type EntityMeta = { key: string; name: string; colorHex: string };
type MonthRow = Record<string, string | number>;

interface Props {
  monthlyDataByYear: MonthRow[][];
  entities: EntityMeta[];
  years: number[];
  currentYear: number;
}

// Warna per tahun saat mode bandingkan aktif — dipakai gantiin warna per
// entitas, karena satu chart cuma bisa punya satu dimensi warna sekaligus.
const YEAR_COLORS = ["#3b6fed", "#f59e0b", "#1f9d55", "#e0433f", "#8b5cf6"];

function formatY(v: number) {
  if (v >= 1e12) return (v / 1e12).toFixed(1).replace(".", ",") + " T";
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(".", ",") + " M";
  if (v >= 1e6) return (v / 1e6).toFixed(0) + " JT";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + " rb";
  return String(v);
}

function formatTooltip(value: number) {
  return "Rp " + Math.round(value).toLocaleString("id-ID");
}

const YEAR_COUNT = 5; // jangkauan hingga 5 tahun ke belakang

export function RevenueChart({ monthlyDataByYear, entities, years, currentYear }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set(["all"]));

  const year = years[0];
  const compareYears = years.slice(1);
  const isComparing = compareYears.length > 0;
  // Maksimal 4 tahun tambahan (5 tahun total) — berlaku sama baik "Semua
  // Entitas" maupun 1 entitas spesifik yang dipilih.
  const maxCompareYears = 4;

  const visibleEntities = activeKeys.has("all")
    ? entities
    : entities.filter((e) => activeKeys.has(e.key));

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleEntity(key: string) {
    if (key === "all") {
      setActiveKeys(new Set(["all"]));
      return;
    }
    const next = new Set(activeKeys);
    next.delete("all");
    if (next.has(key)) {
      next.delete(key);
      if (next.size === 0) next.add("all");
    } else {
      next.add(key);
    }
    setActiveKeys(next);
  }

  const changeYear = useCallback(
    (y: number) => {
      pushParams({ chartYear: String(y), compareYears: compareYears.filter((c) => c !== y).join(",") || null });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname, searchParams, compareYears]
  );

  function addCompareYear(y: number) {
    if (compareYears.includes(y) || compareYears.length >= maxCompareYears) return;
    pushParams({ compareYears: [...compareYears, y].join(",") });
  }

  function removeCompareYear(y: number) {
    pushParams({ compareYears: compareYears.filter((c) => c !== y).join(",") || null });
  }

  const availableYears = Array.from({ length: YEAR_COUNT }, (_, i) => currentYear - i);
  const addableYears = availableYears.filter((y) => y !== year && !compareYears.includes(y));

  // Saat bandingkan tahun, gabungkan jadi satu deret data: satu kolom per
  // tahun, nilainya total pendapatan entitas yang lagi ditampilkan (filter
  // pill) untuk bulan itu — jadi satu chart bisa nunjukin beberapa tahun
  // sekaligus, warnanya per tahun (bukan per entitas lagi).
  const comparisonData = useMemo(() => {
    if (!isComparing) return [];
    const base = monthlyDataByYear[0] ?? [];
    return base.map((row, monthIdx) => {
      const entry: MonthRow = { month: row.month };
      years.forEach((y, i) => {
        const yearRow = monthlyDataByYear[i]?.[monthIdx];
        entry[String(y)] = visibleEntities.reduce(
          (s, e) => s + (Number(yearRow?.[e.key]) || 0),
          0
        );
      });
      return entry;
    });
  }, [isComparing, monthlyDataByYear, years, visibleEntities]);

  const chartData = isComparing ? comparisonData : monthlyDataByYear[0];
  const series = isComparing
    ? years.map((y, i) => ({ dataKey: String(y), name: `Tahun ${y}`, color: YEAR_COLORS[i % YEAR_COLORS.length] }))
    : visibleEntities.map((e) => ({ dataKey: e.key, name: e.name, color: e.colorHex }));

  const sharedAxisProps = {
    tick: { fontSize: 11, fill: "rgb(var(--color-muted-faint))" },
    axisLine: false as const,
    tickLine: false as const,
  };

  // Warna lewat CSS variable (bukan hex statis) supaya chart ikut ganti saat
  // toggle dark mode tanpa perlu re-render — variabelnya di-resolve browser
  // saat paint, bukan saat komponen ini di-render.
  const tooltipContentStyle = {
    borderRadius: 12,
    border: "1px solid rgb(var(--color-border))",
    background: "rgb(var(--color-surface-card))",
    color: "rgb(var(--color-navy-text))",
    fontSize: 12,
  };

  const chartContent = series.map((s) =>
    chartType === "bar" ? (
      <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} fill={s.color} radius={[5, 5, 0, 0]} maxBarSize={28}>
        {/* Label angka pendapatan per bulan — cuma dinyalain saat bandingkan
            tahun, biar admin bisa monitor angkanya langsung tanpa hover. */}
        {isComparing && (
          <LabelList
            dataKey={s.dataKey}
            position="top"
            formatter={(v: number) => formatY(v)}
            style={{ fontSize: 9, fontWeight: 700, fill: "rgb(var(--color-muted-stronger))" }}
          />
        )}
      </Bar>
    ) : (
      <Line
        key={s.dataKey}
        type="monotone"
        dataKey={s.dataKey}
        name={s.name}
        stroke={s.color}
        strokeWidth={2.5}
        dot={{ r: 3, fill: s.color }}
        activeDot={{ r: 5 }}
      />
    )
  );

  const commonChart = chartType === "bar" ? (
    <BarChart data={chartData} barGap={4} barCategoryGap="30%">
      <CartesianGrid vertical={false} stroke="rgb(var(--color-border))" />
      <XAxis dataKey="month" {...sharedAxisProps} />
      <YAxis {...sharedAxisProps} tickFormatter={formatY} width={56} />
      <Tooltip
        formatter={(v: number, name: string) => [formatTooltip(v), name]}
        contentStyle={tooltipContentStyle}
      />
      <Legend
        iconType="circle"
        iconSize={8}
        wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
      />
      {chartContent}
    </BarChart>
  ) : (
    <LineChart data={chartData}>
      <CartesianGrid vertical={false} stroke="rgb(var(--color-border))" />
      <XAxis dataKey="month" {...sharedAxisProps} />
      <YAxis {...sharedAxisProps} tickFormatter={formatY} width={56} />
      <Tooltip
        formatter={(v: number, name: string) => [formatTooltip(v), name]}
        contentStyle={tooltipContentStyle}
      />
      <Legend
        iconType="circle"
        iconSize={8}
        wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
      />
      {chartContent}
    </LineChart>
  );

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="text-sm font-bold text-navy-text">Performa Bulanan per Entitas</div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Year selector (tahun dasar) */}
          <select
            value={year}
            onChange={(e) => changeYear(Number(e.target.value))}
            className="text-[12px] font-semibold text-muted-stronger border border-border-soft rounded-[9px] px-2.5 py-1.5 bg-surface-card focus:outline-none"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Chip tahun pembanding aktif — netral, samain kayak tombol lain di sebelahnya */}
          {compareYears.map((y) => (
            <span
              key={y}
              className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-[9px] border border-border-soft text-[12px] font-semibold text-muted-stronger bg-surface-card"
            >
              vs {y}
              <button
                onClick={() => removeCompareYear(y)}
                className="p-0.5 rounded-full hover:bg-surface-hover"
                aria-label={`Hapus perbandingan tahun ${y}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}

          {/* Tambah tahun pembanding — maksimal 5 tahun sekaligus (tahun dasar + 4) */}
          {compareYears.length < maxCompareYears && addableYears.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && addCompareYear(Number(e.target.value))}
              className="text-[12px] font-semibold text-muted-stronger border border-dashed border-border-soft rounded-[9px] px-2.5 py-1.5 bg-surface-card focus:outline-none"
            >
              <option value="" disabled>+ Bandingkan tahun</option>
              {addableYears.map((y) => (
                <option key={y} value={y}>vs {y}</option>
              ))}
            </select>
          )}

          {/* Chart type toggle */}
          <div className="flex items-center gap-1 border border-border-soft rounded-[9px] p-0.5 bg-surface-subtle">
            <button
              onClick={() => setChartType("bar")}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[12px] font-semibold transition-colors ${
                chartType === "bar"
                  ? "bg-surface-card text-navy-text shadow-sm"
                  : "text-muted hover:text-muted-stronger"
              }`}
            >
              <BarChart2 size={13} />
              Bar
            </button>
            <button
              onClick={() => setChartType("line")}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[12px] font-semibold transition-colors ${
                chartType === "line"
                  ? "bg-surface-card text-navy-text shadow-sm"
                  : "text-muted hover:text-muted-stronger"
              }`}
            >
              <TrendingUp size={13} />
              Line
            </button>
          </div>

          {/* Buka tab Komparasi di /laporan (tabel Pendapatan/Beban/Laba lengkap) —
              bawa tahun yang sedang aktif di chart. Klik pada chart/tombol tahun
              sendiri tetap tidak pindah halaman. */}
          <Link
            href={`/laporan?tab=komparasi&mode=tahunan&periodA=${year}&periodB=${compareYears[0] ?? year - 1}`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[9px] border border-border-soft text-[12px] font-semibold text-muted-stronger hover:bg-surface-hover transition-colors"
          >
            <GitCompare size={13} />
            Detail Komparasi
          </Link>
        </div>
      </div>

      {/* Entity filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => toggleEntity("all")}
          className={`px-3 py-1 rounded-full text-[11.5px] font-semibold border transition-colors ${
            activeKeys.has("all")
              ? "bg-navy text-white border-navy"
              : "bg-surface-card text-muted-stronger border-border-soft hover:bg-surface-hover"
          }`}
        >
          Semua Entitas
        </button>
        {entities.map((e) => {
          const active = activeKeys.has(e.key);
          return (
            <button
              key={e.key}
              onClick={() => toggleEntity(e.key)}
              className={`px-3 py-1 rounded-full text-[11.5px] font-semibold border transition-colors ${
                active ? "text-white border-transparent" : "bg-surface-card text-muted-stronger border-border-soft hover:bg-surface-hover"
              }`}
              style={active ? { backgroundColor: e.colorHex, borderColor: e.colorHex } : {}}
            >
              {e.name}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={isComparing ? 320 : 280}>
          {commonChart}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
