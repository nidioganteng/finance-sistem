"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { id } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

function parseDate(s: string): Date | undefined {
  if (!s) return undefined;
  const parts = s.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const date = new Date(y, m, d);
    return isNaN(date.getTime()) ? undefined : date;
  }
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? undefined : d;
}

function toStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fmtDisplay(s: string): string {
  const d = parseDate(s);
  if (!d) return "";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const CURRENT_YEAR = new Date().getFullYear();
const START_YEAR = CURRENT_YEAR - 10;
const END_YEAR = CURRENT_YEAR + 5;

const POPUP_W = 300;

export function DatePicker({
  value,
  onChange,
  placeholder = "Pilih tanggal",
  className = "",
  required,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(parseDate(value) ?? new Date());
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const calcPosition = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const popupH = 320;

    const top = spaceBelow >= popupH || spaceBelow >= spaceAbove
      ? r.bottom + 6
      : r.top - popupH - 6;

    let left = r.left;
    if (left + POPUP_W > window.innerWidth - 8) {
      left = window.innerWidth - POPUP_W - 8;
    }

    setPopupStyle({ position: "fixed", top, left, width: POPUP_W, zIndex: 9999 });
  }, []);

  useEffect(() => {
    if (!open) return;
    calcPosition();
    window.addEventListener("scroll", calcPosition, true);
    window.addEventListener("resize", calcPosition);
    return () => {
      window.removeEventListener("scroll", calcPosition, true);
      window.removeEventListener("resize", calcPosition);
    };
  }, [open, calcPosition]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        btnRef.current?.contains(e.target as Node) ||
        popupRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (value) setMonth(parseDate(value) ?? new Date());
  }, [value]);

  const selected = parseDate(value);

  function handleSelect(day: Date | undefined) {
    if (!day) return;
    onChange(toStr(day));
    setOpen(false);
  }

  const cn = {
    root: "w-full",
    months: "w-full",
    month: "w-full",
    month_caption: "flex items-center justify-between mb-3 px-0.5",
    caption_label: "hidden",
    dropdowns: "flex items-center gap-1.5",
    dropdown_root: "relative",
    dropdown: [
      "appearance-none bg-surface-subtle border border-border-soft rounded-[8px]",
      "text-[12.5px] font-bold text-navy-text px-2.5 py-1.5 pr-6 cursor-pointer",
      "focus:outline-none focus:border-brand hover:bg-surface-hover transition-colors",
      "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E\")] bg-no-repeat bg-[right_0.4rem_center] bg-[length:1em_1em]",
    ].join(" "),
    nav: "flex items-center gap-1",
    button_previous: [
      "w-7 h-7 flex items-center justify-center rounded-[8px] text-muted-stronger",
      "hover:bg-surface-hover transition-colors cursor-pointer border-0 bg-transparent",
    ].join(" "),
    button_next: [
      "w-7 h-7 flex items-center justify-center rounded-[8px] text-muted-stronger",
      "hover:bg-surface-hover transition-colors cursor-pointer border-0 bg-transparent",
    ].join(" "),
    weekdays: "flex mb-1",
    weekday: "flex-1 text-center text-[11px] font-bold text-muted-faint uppercase py-1.5 select-none",
    weeks: "w-full",
    week: "flex",
    day: "flex-1 flex items-center justify-center p-[2px]",
    day_button: [
      "w-9 h-9 rounded-[9px]",
      "text-[13px] font-semibold text-navy-text",
      "hover:bg-surface-hover transition-colors cursor-pointer",
      "border-0 bg-transparent mx-auto flex items-center justify-center",
    ].join(" "),
    selected: "dp-selected",
    today: "dp-today",
    outside: "dp-outside",
    disabled: "dp-disabled",
  };

  const popup = open ? (
    <div ref={popupRef} style={popupStyle} className="bg-surface-card border border-border-soft rounded-[16px] shadow-2xl p-4">
      <style>{`
        .dp-selected button { background-color: rgb(var(--color-navy)) !important; color: #fff !important; }
        .dp-today:not(.dp-selected) button { color: rgb(var(--color-brand)) !important; font-weight: 800 !important; }
        .dp-outside button { opacity: 0.3; }
        .dp-disabled button { opacity: 0.25; cursor: not-allowed; pointer-events: none; }
        .rdp-root * { box-sizing: border-box; }
        .rdp-root { width: 100%; }
        .rdp-month { width: 100%; }
        .rdp-month_grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .rdp-root td, .rdp-root th { padding: 0; }
      `}</style>
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={handleSelect}
        month={month}
        onMonthChange={setMonth}
        locale={id}
        weekStartsOn={1}
        showOutsideDays
        captionLayout="dropdown"
        startMonth={new Date(START_YEAR, 0)}
        endMonth={new Date(END_YEAR, 11)}
        components={{
          Chevron: ({ orientation }) =>
            orientation === "left" ? <ChevronLeft size={13} /> : <ChevronRight size={13} />,
        }}
        classNames={cn}
      />
    </div>
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={[
          "w-full h-9 px-3 rounded-[9px] border bg-surface-input text-[13px] text-left",
          "flex items-center gap-2 transition-colors focus:outline-none",
          open ? "border-brand" : "border-border-soft",
          disabled ? "opacity-50 cursor-not-allowed" : "hover:border-brand/60 cursor-pointer",
          value ? "text-navy-text" : "text-muted",
        ].join(" ")}
      >
        <CalendarDays size={13} className="text-muted-faint flex-none" />
        <span className="flex-1 truncate">{value ? fmtDisplay(value) : placeholder}</span>
      </button>

      {typeof document !== "undefined" && createPortal(popup, document.body)}
    </div>
  );
}
