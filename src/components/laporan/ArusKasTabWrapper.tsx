"use client";

import React, { useState } from "react";
import { FileText, LayoutDashboard } from "lucide-react";
import { ArusKasPresisiClient } from "./ArusKasPresisiClient";
import type { ArusKasPresisiData } from "@/lib/arus-kas-presisi";

interface ArusKasTabWrapperProps {
  standardView: React.ReactNode;
  presisiData: ArusKasPresisiData;
  entityId: string;
}

export function ArusKasTabWrapper({
  standardView,
  presisiData,
  entityId,
}: ArusKasTabWrapperProps) {
  const [viewMode, setViewMode] = useState<"rinci" | "tren">("rinci");

  return (
    <div className="flex flex-col gap-5">
      {/* Switcher Tampilan Arus Kas */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card p-3 rounded-2xl border border-border-soft print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider pl-1">
            Format Tampilan:
          </span>
          <div className="flex items-center p-1 bg-surface-subtle rounded-xl gap-1">
            <button
              onClick={() => setViewMode("rinci")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-bold transition-all cursor-pointer ${
                viewMode === "rinci"
                  ? "bg-navy text-white shadow-xs"
                  : "text-muted hover:text-navy-text hover:bg-surface-hover"
              }`}
            >
              <FileText size={14} />
              Laporan Arus Kas
            </button>
            <button
              onClick={() => setViewMode("tren")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-bold transition-all cursor-pointer ${
                viewMode === "tren"
                  ? "bg-navy text-white shadow-xs"
                  : "text-muted hover:text-navy-text hover:bg-surface-hover"
              }`}
            >
              <LayoutDashboard size={14} />
              Tren Bulanan
            </button>
          </div>
        </div>
      </div>

      {/* Konten sesuai mode terpilih */}
      {viewMode === "rinci" ? (
        <ArusKasPresisiClient data={presisiData} entityId={entityId} />
      ) : (
        standardView
      )}
    </div>
  );
}
