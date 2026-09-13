"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function JurnalFilterChips({ chips, current, entityKey }: { chips: { key: string; label: string }[]; current: string; entityKey: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("entity", entityKey);
    if (key === "semua") params.delete("filter");
    else params.set("filter", key);
    router.push(`/jurnal?${params.toString()}`);
  }

  const allChips = [{ key: "semua", label: "Semua" }, ...chips];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {allChips.map((c) => (
        <button
          key={c.key}
          onClick={() => go(c.key)}
          className={`px-4 py-2 rounded-pill text-[13px] font-bold ${
            current === c.key ? "bg-navy text-white" : "bg-surface-hover text-muted-strong"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
