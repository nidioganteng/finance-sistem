"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type MonthRow = Record<string, string | number>;

const LINE_COLORS = ["#3b6fed", "#e0433f", "#1f9d55", "#8b5cf6", "#f59e0b"];

function formatY(v: number) {
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(".", ",") + " M";
  if (v >= 1e6) return (v / 1e6).toFixed(0) + " JT";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + " rb";
  return String(v);
}

function formatTooltip(value: number) {
  return "Rp " + Math.round(value).toLocaleString("id-ID");
}

export function KomparasiLineChart({
  title = "Tren Pendapatan Bulanan",
  data,
  lineKeys,
}: {
  title?: string;
  data: MonthRow[];
  lineKeys: string[];
}) {
  const sharedAxisProps = {
    tick: { fontSize: 11, fill: "rgb(var(--color-muted-faint))" },
    axisLine: false as const,
    tickLine: false as const,
  };

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-5">
      <div className="text-sm font-bold text-navy-text mb-4">{title}</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid vertical={false} stroke="rgb(var(--color-border))" />
          <XAxis dataKey="month" {...sharedAxisProps} />
          <YAxis {...sharedAxisProps} tickFormatter={formatY} width={56} />
          <Tooltip
            formatter={(v: number, name: string) => [formatTooltip(v), name]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgb(var(--color-border))",
              background: "rgb(var(--color-surface-card))",
              color: "rgb(var(--color-navy-text))",
              fontSize: 12,
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {lineKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={key}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
