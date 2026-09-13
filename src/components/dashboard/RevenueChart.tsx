"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Row = { name: string; revenue: number; spend: number; color: string };

export function RevenueChart({ data }: { data: Row[] }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="text-sm font-bold text-navy-text mb-4">Pendapatan vs Pengeluaran per Entitas</div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={6}>
          <CartesianGrid vertical={false} stroke="#f1f2f5" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1e9).toFixed(0)}M`}
          />
          <Tooltip
            formatter={(value: number) => "Rp " + value.toLocaleString("id-ID")}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e6eb", fontSize: 12 }}
          />
          <Bar dataKey="revenue" name="Pendapatan" fill="#3b6fed" radius={[6, 6, 0, 0]} />
          <Bar dataKey="spend" name="Pengeluaran" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
