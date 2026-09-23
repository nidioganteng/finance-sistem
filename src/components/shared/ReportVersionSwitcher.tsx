"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Layers } from "lucide-react";

export type ReportVersion = "INTERNAL" | "UMUM";

export function ReportVersionSwitcher({
  currentVersion = "INTERNAL",
}: {
  currentVersion?: ReportVersion | string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const normalized = (currentVersion ?? "INTERNAL").toString().toUpperCase() === "UMUM" ? "UMUM" : "INTERNAL";

  function setVersion(v: ReportVersion) {
    if (v === normalized) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("version", v.toLowerCase());
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-[12px] bg-surface-card border border-border-soft shadow-xs">
      <span className="hidden sm:flex items-center pl-2 pr-1 text-muted text-[11px] font-bold uppercase tracking-wider gap-1">
        <Layers size={13} className="text-muted-faint" />
        Versi:
      </span>
      <button
        type="button"
        onClick={() => setVersion("INTERNAL")}
        className={`px-3 py-1.5 rounded-[9px] text-[12px] sm:text-[13px] font-bold transition-all cursor-pointer ${
          normalized === "INTERNAL"
            ? "bg-navy text-white shadow-sm"
            : "text-muted hover:text-navy-text hover:bg-surface-hover/60"
        }`}
      >
        Internal
      </button>
      <button
        type="button"
        onClick={() => setVersion("UMUM")}
        className={`px-3 py-1.5 rounded-[9px] text-[12px] sm:text-[13px] font-bold transition-all cursor-pointer ${
          normalized === "UMUM"
            ? "bg-navy text-white shadow-sm"
            : "text-muted hover:text-navy-text hover:bg-surface-hover/60"
        }`}
      >
        Umum
      </button>
    </div>
  );
}
