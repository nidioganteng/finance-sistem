"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type CoaOption = { id: string; code: string; name: string };

function genMonthOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}

const MONTH_OPTIONS = genMonthOptions();

export function JurnalExtraFilters({
  coaList,
  currentBulan,
  currentAkunId,
  entityKey,
}: {
  coaList: CoaOption[];
  currentBulan: string;
  currentAkunId: string;
  entityKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const push = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("entity", entityKey);
      for (const [k, v] of Object.entries(patch)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, entityKey]
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Bulan */}
      <select
        value={currentBulan}
        onChange={(e) => push({ bulan: e.target.value })}
        className="text-[12.5px] font-semibold text-muted-stronger border border-border-soft rounded-[9px] px-2.5 py-2 bg-surface-input focus:outline-none"
      >
        <option value="">Semua Bulan</option>
        {MONTH_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Akun */}
      <select
        value={currentAkunId}
        onChange={(e) => push({ akunId: e.target.value })}
        className="text-[12.5px] font-semibold text-muted-stronger border border-border-soft rounded-[9px] px-2.5 py-2 bg-surface-input focus:outline-none max-w-[220px]"
      >
        <option value="">Semua Akun</option>
        {coaList.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
