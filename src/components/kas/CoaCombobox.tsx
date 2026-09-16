"use client";

import { useState, useRef, useEffect } from "react";

type CoaOption = { id: string; code: string; name: string };

export function CoaCombobox({
  value,
  onChange,
  options,
  placeholder = "Ketik nomor atau nama akun...",
}: {
  value: string;
  onChange: (id: string) => void;
  options: CoaOption[];
  placeholder?: string;
}) {
  const selectedOption = options.find((o) => o.id === value);
  const [query, setQuery] = useState(selectedOption ? `${selectedOption.code} — ${selectedOption.name}` : "");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered =
    query.trim() === ""
      ? options
      : options.filter(
          (o) =>
            o.code.toLowerCase().includes(query.toLowerCase()) ||
            o.name.toLowerCase().includes(query.toLowerCase())
        );

  // Sync display when value prop changes externally
  useEffect(() => {
    if (!open) {
      const opt = options.find((o) => o.id === value);
      setQuery(opt ? `${opt.code} — ${opt.name}` : "");
    }
  }, [value, open, options]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Restore display text to selected option if user didn't pick
        const opt = options.find((o) => o.id === value);
        setQuery(opt ? `${opt.code} — ${opt.name}` : "");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [value, options]);

  function handleFocus() {
    setQuery("");
    setOpen(true);
    setHighlightIdx(0);
  }

  function handleQueryChange(q: string) {
    setQuery(q);
    setOpen(true);
    setHighlightIdx(0);
  }

  function select(opt: CoaOption) {
    onChange(opt.id);
    setQuery(`${opt.code} — ${opt.name}`);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightIdx]) select(filtered[highlightIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      const opt = options.find((o) => o.id === value);
      setQuery(opt ? `${opt.code} — ${opt.name}` : "");
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-2.5 py-2 rounded-[9px] border border-border text-[13px] bg-surface-input text-navy-text placeholder:text-muted-faint focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface-card border border-border-soft rounded-[10px] shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-[12.5px] text-muted-faint">Tidak ada akun ditemukan.</div>
          ) : (
            filtered.map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                onMouseDown={() => select(opt)}
                onMouseEnter={() => setHighlightIdx(idx)}
                className={`w-full text-left px-3 py-2 text-[12.5px] flex items-center gap-2 ${
                  idx === highlightIdx ? "bg-surface-hover" : ""
                }`}
              >
                <span className="font-mono text-[11.5px] text-muted-faint w-14 shrink-0">{opt.code}</span>
                <span className="text-navy-text truncate">{opt.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
