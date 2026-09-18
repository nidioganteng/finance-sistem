"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const YEAR_COUNT = 5; // jangkauan hingga 5 tahun ke belakang

export function KomparasiControls({
  mode,
  periodA,
  periodB,
}: {
  mode: "tahunan" | "bulanan";
  periodA: { year: number; month?: number };
  periodB: { year: number; month?: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: YEAR_COUNT }, (_, i) => currentYear - i);

  function update(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) params.set(k, v);
    router.push(`${pathname}?${params.toString()}`);
  }

  function setMode(newMode: "tahunan" | "bulanan") {
    update({ mode: newMode });
  }

  function setPeriod(which: "A" | "B", year: number, month: number | undefined) {
    const value = mode === "bulanan" ? `${year}-${String(month ?? 1).padStart(2, "0")}` : String(year);
    update({ [`period${which}`]: value });
  }

  const selectClass =
    "px-2.5 py-1.5 rounded-[9px] border border-border-soft text-[12.5px] font-semibold text-muted-stronger bg-surface-card cursor-pointer";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-xl">
        {(["tahunan", "bulanan"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-[9px] text-[12.5px] font-semibold transition-colors ${
              mode === m ? "bg-navy text-white" : "text-muted-stronger hover:bg-surface-hover"
            }`}
          >
            {m === "tahunan" ? "Tahunan" : "Bulanan"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[12px] font-bold text-muted-faint">Periode A</span>
        <select
          value={periodA.year}
          onChange={(e) => setPeriod("A", Number(e.target.value), periodA.month)}
          className={selectClass}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {mode === "bulanan" && (
          <select
            value={periodA.month}
            onChange={(e) => setPeriod("A", periodA.year, Number(e.target.value))}
            className={selectClass}
          >
            {BULAN.map((b, i) => (
              <option key={b} value={i + 1}>{b}</option>
            ))}
          </select>
        )}
      </div>

      <span className="text-[12px] text-muted-faint font-bold">vs</span>

      <div className="flex items-center gap-2">
        <span className="text-[12px] font-bold text-muted-faint">Periode B</span>
        <select
          value={periodB.year}
          onChange={(e) => setPeriod("B", Number(e.target.value), periodB.month)}
          className={selectClass}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {mode === "bulanan" && (
          <select
            value={periodB.month}
            onChange={(e) => setPeriod("B", periodB.year, Number(e.target.value))}
            className={selectClass}
          >
            {BULAN.map((b, i) => (
              <option key={b} value={i + 1}>{b}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
