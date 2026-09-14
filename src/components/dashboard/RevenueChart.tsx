"use client";

import { useState, useCallback } from "react";
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
} from "recharts";
import { BarChart2, TrendingUp } from "lucide-react";

type EntityMeta = { key: string; name: string; colorHex: string };
type MonthRow = Record<string, string | number>;

interface Props {
  monthlyData: MonthRow[];
  entities: EntityMeta[];
  year: number;
  currentYear: number;
}

function formatY(v: number) {
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(".", ",") + " M";
  if (v >= 1e6) return (v / 1e6).toFixed(0) + " JT";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + " rb";
  return String(v);
}

function formatTooltip(value: number) {
  return "Rp " + Math.round(value).toLocaleString("id-ID");
}

const YEAR_COUNT = 5;

export function RevenueChart({ monthlyData, entities, year, currentYear }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set(["all"]));

  const visibleEntities = activeKeys.has("all")
    ? entities
    : entities.filter((e) => activeKeys.has(e.key));

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
      const params = new URLSearchParams(searchParams.toString());
      params.set("chartYear", String(y));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const availableYears = Array.from({ length: YEAR_COUNT }, (_, i) => currentYear - i);

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

  const chartContent = visibleEntities.map((e) =>
    chartType === "bar" ? (
      <Bar key={e.key} dataKey={e.key} name={e.name} fill={e.colorHex} radius={[5, 5, 0, 0]} maxBarSize={28} />
    ) : (
      <Line
        key={e.key}
        type="monotone"
        dataKey={e.key}
        name={e.name}
        stroke={e.colorHex}
        strokeWidth={2.5}
        dot={{ r: 3, fill: e.colorHex }}
        activeDot={{ r: 5 }}
      />
    )
  );

  const commonChart = chartType === "bar" ? (
    <BarChart data={monthlyData} barGap={4} barCategoryGap="30%">
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
    <LineChart data={monthlyData}>
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
          {/* Year selector */}
          <select
            value={year}
            onChange={(e) => changeYear(Number(e.target.value))}
            className="text-[12px] font-semibold text-muted-stronger border border-border-soft rounded-[9px] px-2.5 py-1.5 bg-surface-card focus:outline-none"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

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
      <ResponsiveContainer width="100%" height={280}>
        {commonChart}
      </ResponsiveContainer>
    </div>
  );
}
