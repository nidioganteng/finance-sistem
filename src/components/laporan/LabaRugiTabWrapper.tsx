"use client";

import React, { useState } from "react";
import { FileText, FileSpreadsheet } from "lucide-react";
import { LaporanPajakClient } from "@/components/pajak/LaporanPajakClient";
import type { LaporanPajakData } from "@/lib/pajak";

interface LabaRugiTabWrapperProps {
  standardView: React.ReactNode;
  taxData: LaporanPajakData;
  entityKey: string;
}

export function LabaRugiTabWrapper({
  standardView,
  taxData,
  entityKey,
}: LabaRugiTabWrapperProps) {
  const [viewMode, setViewMode] = useState<"standar" | "fiskal">("standar");

  return (
    <div className="flex flex-col gap-5">
      {/* Switcher Tampilan Laba Rugi */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card p-3 rounded-2xl border border-border-soft print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider pl-1">
            Format Tampilan:
          </span>
          <div className="flex items-center p-1 bg-surface-subtle rounded-xl gap-1">
            <button
              onClick={() => setViewMode("standar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-bold transition-all cursor-pointer ${
                viewMode === "standar"
                  ? "bg-navy text-white shadow-xs"
                  : "text-muted hover:text-navy-text hover:bg-surface-hover"
              }`}
            >
              <FileText size={14} />
              Standar SAK
            </button>
            <button
              onClick={() => setViewMode("fiskal")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-bold transition-all cursor-pointer ${
                viewMode === "fiskal"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted hover:text-emerald-600 hover:bg-surface-hover"
              }`}
            >
              <FileSpreadsheet size={14} />
              Komersial vs Fiskal (Template Excel)
            </button>
          </div>
        </div>

        <span className="text-[12px] text-muted italic pr-1">
          {viewMode === "standar"
            ? "Menampilkan pembukuan per versi (Internal/Umum)"
            : "Menampilkan komparasi Komersial, Koreksi Fiskal & Fiskal bersisian"}
        </span>
      </div>

      {/* Konten sesuai mode terpilih */}
      {viewMode === "standar" ? (
        standardView
      ) : (
        <LaporanPajakClient data={taxData} entityKey={entityKey} />
      )}
    </div>
  );
}
