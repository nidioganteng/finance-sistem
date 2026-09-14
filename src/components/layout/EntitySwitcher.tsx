"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type EntityOption = { key: string; name: string };

export function EntitySwitcher({
  entities,
  showGrupOption,
  currentEntityKey,
}: {
  entities: EntityOption[];
  showGrupOption: boolean;
  currentEntityKey: string; // "grup" atau key entity
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "grup") {
      params.delete("entity");
    } else {
      params.set("entity", value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={currentEntityKey}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-[11px] border border-border-soft text-[13px] font-bold text-muted-stronger bg-surface-card cursor-pointer"
    >
      {showGrupOption && <option value="grup">Semua Entitas</option>}
      {entities.map((e) => (
        <option key={e.key} value={e.key}>
          {e.name}
        </option>
      ))}
    </select>
  );
}
