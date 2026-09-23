"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function LaporanKeuanganTabs({ currentTab }: { currentTab: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isUmum = searchParams.get("version")?.toLowerCase() === "umum";

  const tabs = [
    { key: "neraca", label: "Neraca" },
    { key: "laba-rugi", label: "Laba Rugi" },
    { key: "arus-kas", label: "Arus Kas" },
  ];

  function go(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-xl w-fit">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => go(t.key)}
          className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-colors cursor-pointer ${
            currentTab === t.key ? "bg-navy text-white shadow-xs" : "text-muted-stronger hover:bg-surface-hover"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
