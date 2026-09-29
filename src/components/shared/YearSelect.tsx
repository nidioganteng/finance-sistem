"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export function YearSelect({ currentYear }: { currentYear: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(year: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(year));
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-[38px] flex items-center gap-2 px-3 rounded-[11px] border border-border-soft bg-surface-card text-[13px] font-bold text-navy-text hover:bg-surface-hover transition-colors cursor-pointer"
        aria-label="Pilih tahun"
      >
        <span>{currentYear}</span>
        <ChevronDown
          size={13}
          className={`text-muted-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[110px] bg-surface-card border border-border-soft rounded-[14px] shadow-lg overflow-hidden py-1 animate-in fade-in">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => select(y)}
              className={`w-full flex items-center justify-between px-3.5 py-2 text-[13px] font-semibold transition-colors text-left cursor-pointer ${
                y === currentYear
                  ? "bg-surface-hover text-navy-text font-bold"
                  : "text-muted-stronger hover:bg-surface-hover hover:text-navy-text"
              }`}
            >
              <span>{y}</span>
              {y === currentYear && <Check size={13} className="text-brand flex-none" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
