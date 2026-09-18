"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const YEAR_COUNT = 5; // jangkauan hingga 5 tahun ke belakang
const MIN_YEARS = 2;
const MAX_YEARS = 5;

// Cuma dipakai saat 1 entitas spesifik dipilih — grup ("Semua Entitas")
// dibatasi ke Periode A/B saja (2 tahun) lewat KomparasiControls.
export function MultiYearChips({ selectedYears }: { selectedYears: number[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: YEAR_COUNT }, (_, i) => currentYear - i);

  function toggle(y: number) {
    let next: number[];
    if (selectedYears.includes(y)) {
      if (selectedYears.length <= MIN_YEARS) return;
      next = selectedYears.filter((x) => x !== y);
    } else {
      if (selectedYears.length >= MAX_YEARS) return;
      next = [...selectedYears, y];
    }
    next.sort((a, b) => a - b);
    const params = new URLSearchParams(searchParams.toString());
    params.set("chartYears", next.join(","));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-bold text-muted-faint">
        Bandingkan tahun ({selectedYears.length}/{MAX_YEARS}):
      </span>
      {years.map((y) => {
        const active = selectedYears.includes(y);
        return (
          <button
            key={y}
            onClick={() => toggle(y)}
            className={`px-3 py-1 rounded-full text-[12px] font-semibold border transition-colors ${
              active
                ? "bg-navy text-white border-navy"
                : "bg-surface-card text-muted-stronger border-border-soft hover:bg-surface-hover"
            }`}
          >
            {y}
          </button>
        );
      })}
    </div>
  );
}
