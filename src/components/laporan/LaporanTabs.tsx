"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const TABS = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "laba-rugi", label: "Laba Rugi" },
  { key: "neraca", label: "Neraca" },
  { key: "arus-kas", label: "Arus Kas" },
  { key: "komparasi", label: "Komparasi" },
];

export function LaporanTabs({ currentTab }: { currentTab: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function go(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-xl w-fit">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => go(t.key)}
          className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-colors ${
            currentTab === t.key ? "bg-navy text-white" : "text-muted-stronger hover:bg-surface-hover"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
