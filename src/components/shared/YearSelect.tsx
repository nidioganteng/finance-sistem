"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function YearSelect({ currentYear }: { currentYear: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  function onChange(year: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", year);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={currentYear}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-[11px] border border-border-soft text-[13px] font-bold text-muted-stronger bg-white cursor-pointer"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}
