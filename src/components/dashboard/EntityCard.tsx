"use client";
import Link from "next/link";
import Image from "next/image";
import { formatMiliar } from "@/lib/dashboard-data";
import { TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

const ENTITY_LOGO: Record<string, string> = {
  gaharu: "/logo-entitas/gaharu.webp",
  kencana: "/logo-entitas/kencana.webp",
  tataring: "/logo-entitas/tataring.webp",
  ciptaAsri: "/logo-entitas/cipta-asri.webp",
};

function EntityAvatar({ entityKey, name, colorHex, size = "md" }: { entityKey: string; name: string; colorHex: string; size?: "sm" | "md" | "lg" }) {
  const logo = ENTITY_LOGO[entityKey];
  const dim = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-11 h-11" : "w-9 h-9";
  const rounded = size === "lg" ? "rounded-2xl" : "rounded-xl";
  if (logo) {
    return (
      <div className={`${dim} ${rounded} bg-white flex items-center justify-center flex-none shadow-sm overflow-hidden border border-border-soft`}>
        <Image src={logo} alt={name} width={36} height={36} className="object-contain w-full h-full p-0.5" />
      </div>
    );
  }
  return (
    <div className={`${dim} ${rounded} flex items-center justify-center text-white font-extrabold flex-none shadow-sm`} style={{ background: colorHex }}>
      {name[0]}
    </div>
  );
}

// ── Compact card — Master Dashboard (grup view) ──────────────────────────────
export function EntityCardCompact({
  entityKey,
  name,
  legalName,
  colorHex,
  revenue,
  profit,
  isUmum = false,
}: {
  entityKey: string;
  name: string;
  legalName: string;
  colorHex: string;
  revenue: number;
  profit: number;
  isUmum?: boolean;
}) {
  const isProfit = profit >= 0;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0.0";

  return (
    <Link href={`/dashboard?entity=${entityKey}`} className="block group">
      <motion.div
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
        className="bg-surface-card rounded-2xl border border-border overflow-hidden hover:shadow-[0_6px_24px_rgba(15,23,42,.08)] transition-shadow duration-200"
      >
        {/* Color bar top */}
        <div className="h-1" style={{ background: colorHex }} />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3">
            <EntityAvatar entityKey={entityKey} name={name} colorHex={colorHex} size="sm" />
            <div className="min-w-0">
              <div className="text-[13.5px] font-extrabold text-navy-text truncate">{name}</div>
              {!isUmum && <div className="text-[10.5px] text-muted truncate">{legalName}</div>}
              {isUmum && <div className="text-[10.5px] text-muted truncate">{legalName}</div>}
            </div>
          </div>

          {/* Metrics */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-faint">Pendapatan</span>
              <span className="text-[13px] font-bold text-navy-text tabular-nums">{formatMiliar(revenue)}</span>
            </div>
            <div className="h-px bg-surface-subtle" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {isProfit
                  ? <TrendingUp size={11} className="text-status-green" />
                  : <TrendingDown size={11} className="text-status-red" />}
                <span className="text-[11px] font-semibold text-muted-faint">Laba Bersih</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isProfit ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"}`}>
                  {margin}%
                </span>
                <span className={`text-[13px] font-bold tabular-nums ${isProfit ? "text-status-green" : "text-status-red"}`}>
                  {formatMiliar(profit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// ── Full card — entity-specific dashboard ────────────────────────────────────
export function EntityCard({
  entityKey,
  name,
  legalName,
  colorHex,
  revenue,
  spend,
  profit,
  interactive = true,
}: {
  entityKey: string;
  name: string;
  legalName: string;
  colorHex: string;
  revenue: number;
  spend: number;
  profit: number;
  interactive?: boolean;
}) {
  const isProfit = profit >= 0;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0.0";
  const spendPct = revenue > 0 ? Math.min(Math.round((spend / revenue) * 100), 100) : 0;

  const content = (
    <motion.div
      whileHover={interactive ? { y: -2, transition: { duration: 0.15 } } : undefined}
      className={`rounded-2xl overflow-hidden ${
        interactive ? "hover:shadow-[0_8px_32px_rgba(15,23,42,.15)] transition-shadow duration-200" : ""
      }`}
    >
      {/* Colored hero header */}
      <div
        className="relative px-6 py-5 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${colorHex} 0%, ${colorHex}cc 100%)` }}
      >
        {/* Dot pattern */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
        />
        {/* Glow */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)" }}
        />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Logo on white bg */}
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-none shadow-md overflow-hidden">
              {ENTITY_LOGO[entityKey]
                ? <img src={ENTITY_LOGO[entityKey]} alt={name} className="w-full h-full object-contain p-0.5" />
                : <span className="text-[18px] font-extrabold" style={{ color: colorHex }}>{name[0]}</span>
              }
            </div>
            <div>
              <div className="text-[18px] font-extrabold text-white leading-tight">{name}</div>
              <div className="text-[11.5px] text-white/65 mt-0.5">{legalName}</div>
            </div>
          </div>

          {/* Margin badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold flex-none"
            style={{ background: "rgba(255,255,255,0.18)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}>
            {isProfit ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            Margin {margin}%
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 divide-x divide-border bg-surface-card border-x border-b border-border rounded-b-2xl">
        {/* Pendapatan */}
        <div className="px-6 py-4">
          <div className="text-[11px] font-bold text-muted-faint uppercase tracking-wide mb-1">Pendapatan</div>
          <div className="text-[20px] font-extrabold text-navy-text tabular-nums">{formatMiliar(revenue)}</div>
        </div>

        {/* Pengeluaran */}
        <div className="px-6 py-4">
          <div className="text-[11px] font-bold text-muted-faint uppercase tracking-wide mb-1">Pengeluaran</div>
          <div className="text-[20px] font-extrabold text-navy-text tabular-nums">{formatMiliar(spend)}</div>
          <div className="mt-2 h-1 rounded-full bg-surface-hover overflow-hidden">
            <div
              className={`h-full rounded-full ${spendPct > 90 ? "bg-status-red" : spendPct > 70 ? "bg-status-amber" : "bg-brand"}`}
              style={{ width: `${spendPct}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-faint mt-0.5">{spendPct}% dari pendapatan</div>
        </div>

        {/* Laba */}
        <div className="px-6 py-4">
          <div className="text-[11px] font-bold text-muted-faint uppercase tracking-wide mb-1">
            {isProfit ? "Laba Bersih" : "Rugi Bersih"}
          </div>
          <div className={`text-[20px] font-extrabold tabular-nums ${isProfit ? "text-status-green" : "text-status-red"}`}>
            {isProfit ? "" : "-"}{formatMiliar(Math.abs(profit))}
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (!interactive) return content;

  return (
    <Link href={`/dashboard?entity=${entityKey}`} className="block">
      {content}
    </Link>
  );
}
