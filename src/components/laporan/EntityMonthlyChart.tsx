"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

type EntityMeta = { key: string; name: string; colorHex: string };
type MonthRow = Record<string, string | number>;

function formatY(v: number) {
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(".", ",") + " M";
  if (v >= 1e6) return (v / 1e6).toFixed(0) + " JT";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + " rb";
  return String(v);
}

function formatTooltip(value: number) {
  return "Rp " + Math.round(value).toLocaleString("id-ID");
}

// Chart pendapatan bulanan berwarna per-entitas untuk SATU tahun — dipakai
// berpasangan (satu per Periode A, satu per Periode B) di tab Komparasi saat
// "Semua Entitas" dipilih, supaya kedua tahun bisa dibandingkan berdampingan.
export function EntityMonthlyChart({
  title,
  data,
  entities,
}: {
  title: string;
  data: MonthRow[];
  entities: EntityMeta[];
}) {
  const sharedAxisProps = {
    tick: { fontSize: 11, fill: "rgb(var(--color-muted-faint))" },
    axisLine: false as const,
    tickLine: false as const,
  };

  const tooltipContentStyle = {
    borderRadius: 12,
    border: "1px solid rgb(var(--color-border))",
    background: "rgb(var(--color-surface-card))",
    color: "rgb(var(--color-navy-text))",
    fontSize: 12,
  };

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-5">
      <div className="text-sm font-bold text-navy-text mb-4">{title}</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={4} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="rgb(var(--color-border))" />
          <XAxis dataKey="month" {...sharedAxisProps} />
          <YAxis {...sharedAxisProps} tickFormatter={formatY} width={56} />
          <Tooltip
            formatter={(v: number, name: string) => [formatTooltip(v), name]}
            contentStyle={tooltipContentStyle}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {entities.map((e) => (
            <Bar key={e.key} dataKey={e.key} name={e.name} fill={e.colorHex} radius={[5, 5, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
