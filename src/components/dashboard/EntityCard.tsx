"use client";
import Link from "next/link";
import Image from "next/image";
import { formatMiliar, formatRupiah, getMetricValueFontSize } from "@/lib/dashboard-data";
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
      <div className={`${dim} ${rounded} bg-white dark:bg-surface-card flex items-center justify-center flex-none shadow-sm overflow-hidden border border-border-soft`}>
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
  spend,
  profit,
  isUmum = false,
}: {
  entityKey: string;
  name: string;
  legalName: string;
  colorHex: string;
  revenue: number;
  spend?: number;
  profit: number;
  isUmum?: boolean;
}) {
  const isProfit = profit >= 0;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0.0";
  const revenueFull = formatRupiah(revenue);
  const profitFull = `${isProfit ? "" : "-"}${formatRupiah(Math.abs(profit))}`;

  return (
    <Link
      href={`/dashboard?entity=${entityKey}`}
      className="block group hover:z-30 relative"
      title={`${name}: Pendapatan ${revenueFull} | ${isProfit ? "Laba" : "Rugi"} ${profitFull}`}
    >
      <motion.div
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
        className="bg-surface-card rounded-2xl border border-border hover:shadow-[0_6px_24px_rgba(15,23,42,.08)] transition-shadow duration-200 overflow-hidden"
      >
        {/* Color bar top */}
        <div className="h-1 rounded-t-2xl" style={{ background: colorHex }} />

        <div className="p-3.5 sm:p-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <EntityAvatar entityKey={entityKey} name={name} colorHex={colorHex} size="sm" />
              <div className="min-w-0">
                <div className="text-[13.5px] font-extrabold text-navy-text truncate">{name}</div>
                <div className="text-[10.5px] text-muted truncate">{legalName}</div>
              </div>
            </div>
            <span
              className={`flex-none text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isProfit
                  ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                  : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
              }`}
            >
              {margin}%
            </span>
          </div>

          {/* Metrics */}
          <div className="flex flex-col gap-2">
            {/* Pendapatan Row */}
            <div
              className="group/pendapatan relative flex items-center justify-between gap-1.5 py-0.5 rounded px-1 -mx-1 hover:bg-surface-hover/60 transition-colors"
              title={`Pendapatan ${name}: ${revenueFull}`}
            >
              <span className="text-[11px] font-semibold text-muted-faint flex-none whitespace-nowrap">Pendapatan</span>
              <span className="text-[12.5px] sm:text-[13px] font-bold text-navy-text tabular-nums whitespace-nowrap">{formatMiliar(revenue)}</span>

              {/* Instant Floating Tooltip */}
              <div className="pointer-events-none absolute bottom-full right-0 mb-1 z-50 hidden group-hover/pendapatan:flex flex-col items-end">
                <div className="bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xl whitespace-nowrap border border-white/10 tracking-tight">
                  {revenueFull}
                </div>
                <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900 dark:border-t-slate-800 mr-3" />
              </div>
            </div>

            <div className="h-px bg-surface-subtle" />

            {/* Pengeluaran Row */}
            {spend !== undefined && (
              <>
                <div
                  className="group/spend relative flex items-center justify-between gap-1.5 py-0.5 rounded px-1 -mx-1 hover:bg-surface-hover/60 transition-colors"
                  title={`Pengeluaran ${name}: ${formatRupiah(spend)}`}
                >
                  <span className="text-[11px] font-semibold text-muted-faint flex-none whitespace-nowrap">Pengeluaran</span>
                  <span className="text-[12.5px] sm:text-[13px] font-bold text-navy-text tabular-nums whitespace-nowrap">{formatMiliar(spend)}</span>

                  {/* Instant Floating Tooltip */}
                  <div className="pointer-events-none absolute bottom-full right-0 mb-1 z-50 hidden group-hover/spend:flex flex-col items-end">
                    <div className="bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xl whitespace-nowrap border border-white/10 tracking-tight">
                      Pengeluaran: {formatRupiah(spend)}
                    </div>
                    <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900 dark:border-t-slate-800 mr-3" />
                  </div>
                </div>

                <div className="h-px bg-surface-subtle" />
              </>
            )}

            {/* Laba Bersih Row */}
            <div
              className="group/laba relative flex items-center justify-between gap-1.5 py-0.5 rounded px-1 -mx-1 hover:bg-surface-hover/60 transition-colors"
              title={`${isProfit ? "Laba Bersih" : "Rugi Bersih"} ${name}: ${profitFull}`}
            >
              <div className="flex items-center gap-1 flex-none whitespace-nowrap">
                {isProfit
                  ? <TrendingUp size={11} className="text-status-green flex-none" />
                  : <TrendingDown size={11} className="text-status-red flex-none" />}
                <span className="text-[11px] font-semibold text-muted-faint">
                  {isProfit ? "Laba Bersih" : "Rugi Bersih"}
                </span>
              </div>
              <span className={`text-[12.5px] sm:text-[13px] font-bold tabular-nums whitespace-nowrap ${isProfit ? "text-status-green" : "text-status-red"}`}>
                {formatMiliar(profit)}
              </span>

              {/* Instant Floating Tooltip */}
              <div className="pointer-events-none absolute bottom-full right-0 mb-1 z-50 hidden group-hover/laba:flex flex-col items-end">
                <div className={`text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xl whitespace-nowrap border border-white/10 tracking-tight ${isProfit ? "bg-status-green" : "bg-status-red"}`}>
                  {profitFull}
                </div>
                <div className={`w-0 h-0 border-x-4 border-x-transparent border-t-4 mr-3 ${isProfit ? "border-t-status-green" : "border-t-status-red"}`} />
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

  const formattedRevenue = formatRupiah(revenue);
  const formattedSpend = formatRupiah(spend);
  const formattedProfit = `${isProfit ? "" : "-"}${formatRupiah(Math.abs(profit))}`;

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
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-surface-card flex items-center justify-center flex-none shadow-md overflow-hidden border border-border-soft">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border bg-surface-card border-x border-b border-border rounded-b-2xl">
        {/* Pendapatan */}
        <div className="px-5 sm:px-6 py-4 min-w-0">
          <div className="text-[11px] font-bold text-muted-faint uppercase tracking-wide mb-1">Pendapatan</div>
          <div className={`${getMetricValueFontSize(formattedRevenue)} text-navy-text truncate`} title={formattedRevenue}>
            {formattedRevenue}
          </div>
        </div>

        {/* Pengeluaran */}
        <div className="px-5 sm:px-6 py-4 min-w-0">
          <div className="text-[11px] font-bold text-muted-faint uppercase tracking-wide mb-1">Pengeluaran</div>
          <div className={`${getMetricValueFontSize(formattedSpend)} text-navy-text truncate`} title={formattedSpend}>
            {formattedSpend}
          </div>
          <div className="mt-2 h-1 rounded-full bg-surface-hover overflow-hidden">
            <div
              className={`h-full rounded-full ${spendPct > 90 ? "bg-status-red" : spendPct > 70 ? "bg-status-amber" : "bg-brand"}`}
              style={{ width: `${spendPct}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-faint mt-0.5">{spendPct}% dari pendapatan</div>
        </div>

        {/* Laba */}
        <div className="px-5 sm:px-6 py-4 min-w-0">
          <div className="text-[11px] font-bold text-muted-faint uppercase tracking-wide mb-1">
            {isProfit ? "Laba Bersih" : "Rugi Bersih"}
          </div>
          <div className={`${getMetricValueFontSize(formattedProfit)} ${isProfit ? "text-status-green" : "text-status-red"} truncate`} title={formattedProfit}>
            {formattedProfit}
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
