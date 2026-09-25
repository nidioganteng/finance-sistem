"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type EntityMeta = { key: string; name: string; colorHex: string };

export function KomparasiEntityPills({
  entities,
  currentEntityKey,
  canGrup,
}: {
  entities: EntityMeta[];
  currentEntityKey: string | undefined;
  canGrup: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(key: string | undefined) {
    const target = key || "grup";
    document.cookie = `lastEntityKey=${target}; path=/; max-age=2592000`;
    const params = new URLSearchParams(searchParams.toString());
    if (key) {
      params.set("entity", key);
    } else {
      params.set("entity", "grup");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const isAll = !currentEntityKey;

  return (
    <div className="flex flex-wrap gap-1.5">
      {canGrup && (
        <button
          onClick={() => select(undefined)}
          className={`px-3 py-1 rounded-full text-[11.5px] font-semibold border transition-colors ${
            isAll
              ? "bg-navy text-white border-navy"
              : "bg-surface-card text-muted-stronger border-border-soft hover:bg-surface-hover"
          }`}
        >
          Semua Entitas
        </button>
      )}
      {entities.map((e) => {
        const active = currentEntityKey === e.key;
        return (
          <button
            key={e.key}
            onClick={() => select(e.key)}
            className={`px-3 py-1 rounded-full text-[11.5px] font-semibold border transition-colors ${
              active
                ? "text-white border-transparent"
                : "bg-surface-card text-muted-stronger border-border-soft hover:bg-surface-hover"
            }`}
            style={active ? { backgroundColor: e.colorHex, borderColor: e.colorHex } : {}}
          >
            {e.name}
          </button>
        );
      })}
    </div>
  );
}
