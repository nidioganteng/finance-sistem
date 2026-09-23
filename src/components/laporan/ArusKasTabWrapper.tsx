"use client";

import React, { useState } from "react";
import { FileSpreadsheet, LayoutDashboard } from "lucide-react";
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
  const [viewMode, setViewMode] = useState<"presisi" | "standar">("presisi");

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
              onClick={() => setViewMode("presisi")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-bold transition-all cursor-pointer ${
                viewMode === "presisi"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted hover:text-emerald-600 hover:bg-surface-hover"
              }`}
            >
              <FileSpreadsheet size={14} />
              Format Presisi (Template Excel)
            </button>
            <button
              onClick={() => setViewMode("standar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-bold transition-all cursor-pointer ${
                viewMode === "standar"
                  ? "bg-navy text-white shadow-xs"
                  : "text-muted hover:text-navy-text hover:bg-surface-hover"
              }`}
            >
              <LayoutDashboard size={14} />
              Format Standar SAK
            </button>
          </div>
        </div>

        <span className="text-[12px] text-muted italic pr-1">
          {viewMode === "presisi"
            ? "Format vertikal tidak langsung dengan rincian modal kerja & pihak berelasi"
            : "Format ringkas per aktivitas operasi, investasi & pendanaan"}
        </span>
      </div>

      {/* Konten sesuai mode terpilih */}
      {viewMode === "presisi" ? (
        <ArusKasPresisiClient data={presisiData} entityId={entityId} />
      ) : (
        standardView
      )}
    </div>
  );
}
