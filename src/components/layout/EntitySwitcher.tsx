"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronDown, Check } from "lucide-react";

type EntityOption = { key: string; name: string };

const ENTITY_LOGO: Record<string, string> = {
  gaharu: "/logo-entitas/gaharu.webp",
  kencana: "/logo-entitas/kencana.webp",
  tataring: "/logo-entitas/tataring.webp",
  ciptaAsri: "/logo-entitas/cipta-asri.webp",
};

function EntityLogo({ entityKey, name, size = 20 }: { entityKey: string; name: string; size?: number }) {
  const logo = ENTITY_LOGO[entityKey];
  if (!logo) return (
    <span className="w-5 h-5 rounded-md bg-navy/20 flex items-center justify-center text-[10px] font-bold text-navy-text flex-none">
      {name[0]}
    </span>
  );
  return (
    <span className="flex-none rounded-md bg-white border border-border-soft overflow-hidden flex items-center justify-center" style={{ width: size, height: size }}>
      <Image src={logo} alt={name} width={size} height={size} className="object-contain w-full h-full p-[2px]" />
    </span>
  );
}

export function EntitySwitcher({
  entities,
  showGrupOption,
  currentEntityKey,
}: {
  entities: EntityOption[];
  showGrupOption: boolean;
  currentEntityKey: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(value: string) {
    document.cookie = `lastEntityKey=${value}; path=/; max-age=2592000`;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "grup") {
      params.set("entity", "grup");
    } else {
      params.set("entity", value);
    }
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  const allOptions = [
    ...(showGrupOption ? [{ key: "grup", name: "Semua Entitas" }] : []),
    ...entities,
  ];
  const current = allOptions.find((o) => o.key === currentEntityKey) ?? allOptions[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-[11px] border border-border-soft bg-surface-card text-[13px] font-bold text-navy-text hover:bg-surface-hover transition-colors"
      >
        <EntityLogo entityKey={current.key} name={current.name} size={20} />
        <span className="max-w-[120px] truncate">{current.name}</span>
        <ChevronDown size={13} className={`text-muted-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] bg-surface-card border border-border-soft rounded-[14px] shadow-lg overflow-hidden py-1">
          {allOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => select(opt.key)}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-semibold transition-colors text-left ${
                opt.key === currentEntityKey
                  ? "bg-surface-hover text-navy-text"
                  : "text-muted-stronger hover:bg-surface-hover hover:text-navy-text"
              }`}
            >
              <EntityLogo entityKey={opt.key} name={opt.name} size={20} />
              <span className="flex-1">{opt.name}</span>
              {opt.key === currentEntityKey && <Check size={13} className="text-brand flex-none" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
