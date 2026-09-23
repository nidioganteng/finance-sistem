"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";

type CoaOption = { id: string; code: string; name: string };

export function CoaCombobox({
  value,
  onChange,
  options,
  placeholder = "Ketik kode atau nama akun…",
  className = "",
}: {
  value: string;
  onChange: (id: string) => void;
  options: CoaOption[];
  placeholder?: string;
  className?: string;
}) {
  const selected = options.find((o) => o.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? options.filter(
        (o) =>
          o.code.startsWith(query) ||
          o.name.toLowerCase().includes(query.toLowerCase())
      )
    : options.slice(0, 40);

  const updateRect = useCallback(() => {
    if (wrapperRef.current) {
      const r = wrapperRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + window.scrollY, left: r.left + window.scrollX, width: r.width });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, updateRect]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        // check if click is on the portal dropdown
        const portal = document.getElementById("coa-combobox-portal");
        if (!portal?.contains(e.target as Node)) {
          setOpen(false);
          setQuery("");
        }
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function handleFocus() {
    setQuery("");
    setOpen(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
    if (!e.target.value) onChange("");
  }

  function handleSelect(opt: CoaOption) {
    onChange(opt.id);
    setQuery("");
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setQuery("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); setQuery(""); }
    if (e.key === "Enter" && filtered.length === 1) {
      e.preventDefault();
      handleSelect(filtered[0]);
    }
  }

  const displayValue = open ? query : (selected ? `${selected.code} – ${selected.name}` : "");

  return (
    <>
      <div ref={wrapperRef} className={`relative ${className}`}>
        <div className="flex items-center h-full min-h-[2rem] rounded-[9px] border border-border-soft bg-surface-input focus-within:border-brand transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 h-full px-2 bg-transparent text-[12px] text-navy-text placeholder:text-muted focus:outline-none"
          />
          {selected && !open && (
            <button
              type="button"
              onMouseDown={handleClear}
              className="pr-2 text-muted-faint hover:text-navy-text transition-colors"
              tabIndex={-1}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Portal dropdown — fixed position, escapes all overflow containers */}
      {open && rect && (
        <div
          id="coa-combobox-portal"
          style={{
            position: "fixed",
            top: rect.top - window.scrollY + 4,
            left: rect.left - window.scrollX,
            width: Math.max(rect.width, 260),
            zIndex: 9999,
          }}
          className="bg-surface-card border border-border-soft rounded-[10px] shadow-xl overflow-hidden"
        >
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2.5 text-[12px] text-muted">Tidak ada akun yang cocok.</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                  className={`w-full text-left px-3 py-2 text-[12px] hover:bg-surface-hover transition-colors flex items-center gap-2 ${
                    opt.id === value ? "bg-brand/5 text-brand" : "text-navy-text"
                  }`}
                >
                  <span className="font-mono text-muted w-10 flex-none text-[11px]">{opt.code}</span>
                  <span className="truncate">{opt.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
