"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden flex items-center gap-1.5 px-3 py-2 rounded-[11px] border border-border-soft text-[13px] font-bold text-muted-stronger bg-surface-card hover:bg-surface-hover transition-colors"
    >
      <Printer size={14} />
      Export PDF
    </button>
  );
}
