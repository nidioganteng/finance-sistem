"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const TABS = [
  { key: "semua", label: "Semua" },
  { key: "SOP", label: "SOP" },
  { key: "DOKUMEN_PENDUKUNG", label: "Dokumen Pendukung" },
];

export function DokumenFilterTabs({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function go(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("kategori", key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-xl w-fit">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => go(t.key)}
          className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-colors ${
            current === t.key ? "bg-navy text-white" : "text-muted-stronger hover:bg-surface-hover"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
