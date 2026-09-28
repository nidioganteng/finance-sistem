"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function LogTabs({ currentTab }: { currentTab: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function go(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const tabs = [
    { key: "all", label: "Semua" },
    { key: "financial", label: "Perubahan Finansial" },
    { key: "user", label: "Aktivitas Pengguna" },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-xl w-fit">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => go(t.key)}
          className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-colors ${
            currentTab === t.key
              ? "bg-navy text-white shadow-sm"
              : "text-muted-stronger hover:bg-surface-hover"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
