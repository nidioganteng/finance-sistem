"use client";

import { useState, useTransition } from "react";
import { TerminStatus } from "@prisma/client";
import { auditTermin, updateTerminStatus, cancelProject, completeProject } from "@/lib/actions/piutang";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Ban,
  CheckSquare,
  X,
  FileText,
  Receipt,
  Landmark,
  Calculator,
  Wallet,
  ShoppingBag,
  Users,
  Truck,
  TrendingUp,
  ChevronUp,
  Layers,
  Calendar,
} from "lucide-react";
import { formatRupiah, getMetricValueFontSize } from "@/lib/dashboard-data";
import type {
  TerminBreakdown,
  ProjectBreakdownSummary,
  ProjectExpenseItem,
  ProjectExpensesSummary,
  ProjectItem,
  TerminItem,
  PiutangSummary,
} from "@/lib/piutang";

type Summary = PiutangSummary;

type DockItem = {
  id: string;
  nama: string;
  totalFmt: string;
  status: string;
  createdAt: string;
};

const STATUS_BADGE: Record<TerminStatus, string> = {
  ON_TRACK:    "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  AT_RISK:     "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  NEEDS_AUDIT: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
};
const STATUS_LABEL: Record<TerminStatus, string> = {
  ON_TRACK:    "On Track",
  AT_RISK:     "At Risk",
  NEEDS_AUDIT: "Perlu Audit",
};
const DOCK_STATUS_LABEL: Record<string, string> = {
  MENUNGGU_ALOKASI: "Menunggu Alokasi",
  DI_LOADING_DOCK:  "Di Loading Dock",
  DIALOKASI:        "Dialokasi",
};

export function PiutangClient({
  projectList,
  summary,
  loadingDockList = [],
  userRole = "",
  isUmumEntity = false,
  showTabs = true,
  isGrup = false,
}: {
  projectList: ProjectItem[];
  summary: Summary;
  loadingDockList?: DockItem[];
  userRole?: string;
  isUmumEntity?: boolean;
  showTabs?: boolean;
  isGrup?: boolean;
}) {
  const [tab, setTab] = useState<"termin" | "dock">("termin");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedTerminForModal, setSelectedTerminForModal] = useState<{
    project: ProjectItem;
    termin: TerminItem;
  } | null>(null);
  const [activeProjectTabs, setActiveProjectTabs] = useState<Record<string, "pengeluaran" | "termin" | "pajak">>({});

  const isManajer = userRole === "MANAJER_KEUANGAN" || userRole === "STAF_KEUANGAN";

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleAudit(id: string) {
    startTransition(async () => {
      try {
        await auditTermin(id);
      } catch (e: unknown) {
        setError((e as Error).message);
      }
    });
  }

  function handleStatusChange(id: string, status: TerminStatus) {
    startTransition(async () => {
      await updateTerminStatus(id, status);
    });
  }

  function handleCompleteProject(id: string, code: string) {
    if (!confirm(`Tandai proyek ${code} sebagai selesai? Proyek akan hilang dari daftar ini, namun transaksi di jurnal tetap tercatat.`)) return;
    startTransition(async () => {
      try {
        await completeProject(id);
      } catch (e: unknown) {
        setError((e as Error).message);
      }
    });
  }

  function handleCancelProject(id: string, code: string) {
    if (!confirm(`Batalkan proyek ${code}? Termin yang belum terbayar akan dihapus dan proyek dianggap selesai.`)) return;
    startTransition(async () => {
      try {
        await cancelProject(id);
      } catch (e: unknown) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-status-red text-sm">{error}</div>
      )}

      {/* ── Tab nav ── */}
      {showTabs && (
        <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-xl w-fit">
          <button
            onClick={() => setTab("termin")}
            className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-colors ${
              tab === "termin" ? "bg-navy text-white" : "text-muted-stronger hover:bg-surface-hover"
            }`}
          >
            Kontrol Termin
          </button>
          {isUmumEntity && (
            <button
              onClick={() => setTab("dock")}
              className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-colors ${
                tab === "dock" ? "bg-navy text-white" : "text-muted-stronger hover:bg-surface-hover"
              }`}
            >
              Loading Dock
            </button>
          )}
        </div>
      )}

      {/* ── Tab: Daftar Termin ── */}
      {tab === "termin" && (
        <>
          {/* Kartu ringkasan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-card rounded-[16px] border border-border-soft p-4 sm:p-5 min-w-0 overflow-hidden shadow-xs">
              <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5 truncate">
                Total Nilai Kontrak Aktif
              </div>
              <div className={`${getMetricValueFontSize(summary.totalKontrakFmt)} text-navy-text truncate`} title={summary.totalKontrakFmt}>
                {summary.totalKontrakFmt}
              </div>
              <div className="text-[12px] text-muted mt-0.5 truncate">{summary.jumlahProyek} proyek</div>
            </div>
            <div className="bg-surface-card rounded-[16px] border border-border-soft p-4 sm:p-5 min-w-0 overflow-hidden shadow-xs">
              <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5 truncate">
                Total Termin Tertagih
              </div>
              <div className={`${getMetricValueFontSize(summary.totalTerminTagihFmt)} text-status-green truncate`} title={summary.totalTerminTagihFmt}>
                {summary.totalTerminTagihFmt}
              </div>
              <div className="text-[12px] text-muted mt-0.5 truncate">
                {summary.totalKontrak > 0
                  ? `${Math.round((summary.totalTerminTagih / summary.totalKontrak) * 100)}% dari total kontrak`
                  : "—"}
              </div>
            </div>
            <div className="bg-surface-card rounded-[16px] border border-border-soft p-4 sm:p-5 min-w-0 overflow-hidden shadow-xs">
              <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5 truncate">
                Sisa Piutang Belum Tertagih
              </div>
              <div className={`${getMetricValueFontSize(summary.sisaPiutangFmt)} text-status-red truncate`} title={summary.sisaPiutangFmt}>
                {summary.sisaPiutangFmt}
              </div>
              <div className="text-[12px] text-muted mt-0.5 truncate">belum masuk kas</div>
            </div>
          </div>

          {/* Tabel proyek dengan termin expandable */}
          {projectList.length === 0 ? (
            <div className="bg-surface-card rounded-[20px] border border-border-soft py-16 text-center text-sm text-muted">
              Belum ada proyek untuk entitas ini.
            </div>
          ) : (
            <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-hover text-left">
                    <th className="py-3 px-5 w-8" />
                    <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Proyek</th>
                    <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">
                      Nilai Kontrak
                    </th>
                    <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">
                      Termin Tertagih
                    </th>
                    <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Progress</th>
                    <th className="py-3 px-5 text-[11px] font-bold text-muted-faint uppercase text-right">
                      Sisa Piutang
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projectList.map((p) => {
                    const isExpanded = expandedIds.has(p.id);
                    return (
                      <>
                        {/* Baris proyek — klik untuk expand/collapse */}
                        <tr
                          key={`proj-${p.id}`}
                          onClick={() => toggleExpand(p.id)}
                          className="border-b border-surface-subtle bg-surface-subtle/30 hover:bg-surface-hover/40 cursor-pointer"
                        >
                          <td className="py-3 px-5 text-muted-faint">
                            {isExpanded
                              ? <ChevronDown size={14} />
                              : <ChevronRight size={14} />}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <div className="font-bold text-navy-text text-[13px]">{p.code}</div>
                              {p.entityName && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                                  {p.entityName}
                                </span>
                              )}
                              {p.status === "CANCELLED" && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-surface-hover text-muted-faint">
                                  Dibatalkan
                                </span>
                              )}
                              {p.status === "COMPLETED" && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">
                                  Selesai
                                </span>
                              )}
                            </div>
                            <div className="text-[12px] text-muted-stronger">{p.name}</div>
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-[13px] font-semibold text-navy-text whitespace-nowrap">
                            {p.contractValueFmt}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                            <div className="text-[13px] font-semibold text-status-green">
                              {p.terminTagihFmt}
                            </div>
                            {p.expensesSummary && p.expensesSummary.totalPengeluaran > 0 ? (
                              <div className="text-[10px] text-muted-faint flex items-center justify-end gap-1 mt-0.5 font-medium">
                                <span>Keluar: <span className="font-semibold text-status-red">{p.expensesSummary.totalPengeluaranFmt}</span></span>
                                <span>·</span>
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                  Laba: {p.expensesSummary.labaKotorFmt}
                                </span>
                              </div>
                            ) : p.breakdownSummary && p.breakdownSummary.totalGross > 0 ? (
                              <div className="text-[10px] text-muted-faint flex items-center justify-end gap-1 mt-0.5 font-medium">
                                <span>DPP: {p.breakdownSummary.totalDppFmt}</span>
                                <span>·</span>
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                  Net: {p.breakdownSummary.totalNetBankFmt}
                                </span>
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 px-3">
                            {p.status === "CANCELLED" ? (
                              <span className="text-[12px] text-muted-faint">
                                Proyek dibatalkan
                              </span>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <div className="w-28 h-2 bg-surface-hover rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        p.maxPercentage >= 80 || p.status === "COMPLETED"
                                          ? "bg-status-green"
                                          : p.maxPercentage >= 50
                                          ? "bg-brand"
                                          : "bg-orange-400"
                                      }`}
                                      style={{ width: `${Math.min(p.maxPercentage, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`text-[12.5px] font-bold ${p.status === "COMPLETED" ? "text-status-green" : "text-muted-stronger"}`}>
                                    {p.maxPercentage}%
                                  </span>
                                </div>
                                <div className={`text-[11px] mt-1 ${p.isOverdue ? "text-status-red font-semibold" : "text-muted-faint"}`}>
                                  {p.status === "COMPLETED" ? "Kontrak selesai 100%" : `Batas kontrak: ${p.deadlineFmt}${p.isOverdue ? " · Lewat tempo" : ""}`}
                                </div>
                              </>
                            )}
                          </td>
                          <td className="py-3 px-5 text-right">
                            <div className="tabular-nums text-[13px] font-semibold text-status-red whitespace-nowrap">
                              {p.sisaTagihFmt}
                            </div>
                            {isManajer && p.status === "ACTIVE" && (
                              <div className="mt-1.5 flex flex-col items-end gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCompleteProject(p.id, p.code);
                                  }}
                                  disabled={isPending}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-green-300 dark:border-green-600 text-[11px] font-semibold text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10"
                                >
                                  <CheckSquare size={11} /> Tandai Selesai
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelProject(p.id, p.code);
                                  }}
                                  disabled={isPending}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[11px] font-semibold text-muted-stronger hover:bg-surface-hover"
                                >
                                  <Ban size={11} /> Batalkan Proyek
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* Panel Lengkap Rincian Proyek (Pengeluaran, Termin, Pajak) */}
                        {isExpanded && (
                          <tr className="border-b border-surface-subtle">
                            <td colSpan={6} className="p-3 sm:p-5 bg-surface-subtle/40">
                              <div className="rounded-2xl border border-border bg-surface-card p-5 sm:p-6 shadow-md space-y-6">
                                {/* Header Rincian Proyek */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-navy text-white shadow-xs">
                                      <Layers size={20} />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-base font-bold text-navy-text tracking-tight">
                                          {p.code} — {p.name}
                                        </h4>
                                        {p.entityName && (
                                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                                            {p.entityName}
                                          </span>
                                        )}
                                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                                          p.status === "COMPLETED"
                                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                            : p.status === "CANCELLED"
                                            ? "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                                            : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                        }`}>
                                          {p.status === "COMPLETED" ? "Proyek Selesai" : p.status === "CANCELLED" ? "Dibatalkan" : "Proyek Aktif"}
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-faint mt-1 flex items-center gap-1.5">
                                        <Calendar size={13} />
                                        <span>Batas Waktu Kontrak: <strong className="text-navy-text">{p.deadlineFmt}</strong></span>
                                        {p.isOverdue && p.status === "ACTIVE" && (
                                          <span className="text-status-red font-semibold">· Melewati Jatuh Tempo</span>
                                        )}
                                      </p>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpand(p.id);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface-subtle hover:bg-surface-hover text-xs font-semibold text-muted-stronger transition-colors cursor-pointer self-start sm:self-auto"
                                  >
                                    <ChevronUp size={14} /> Tutup Detail
                                  </button>
                                </div>

                                {/* 4 Kartu Ringkasan Finansial Utama */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                                  {/* 1. Nilai Kontrak */}
                                  <div className="p-4 rounded-xl bg-surface-subtle/80 border border-border-subtle hover:border-border transition-all">
                                    <div className="flex items-center justify-between text-muted-faint mb-1.5">
                                      <span className="text-[11px] font-bold uppercase tracking-wider">Nilai Kontrak Proyek</span>
                                      <FileText size={16} className="text-muted-faint" />
                                    </div>
                                    <div className="text-lg font-bold font-mono text-navy-text tracking-tight">
                                      {p.contractValueFmt}
                                    </div>
                                    <div className="text-[11px] text-muted-faint mt-1">
                                      Pagu Total Kontrak SPK
                                    </div>
                                  </div>

                                  {/* 2. Termin Cair (Kas Masuk) */}
                                  <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50">
                                    <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 mb-1.5">
                                      <span className="text-[11px] font-bold uppercase tracking-wider">Termin Cair (Kas Masuk)</span>
                                      <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300 tracking-tight">
                                      {p.terminTagihFmt}
                                    </div>
                                    <div className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 mt-1 flex items-center justify-between">
                                      <span>{p.maxPercentage}% dari Kontrak</span>
                                      <span className="font-semibold">{p.termin.length} Termin</span>
                                    </div>
                                  </div>

                                  {/* 3. Realisasi Biaya Proyek */}
                                  <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-800/50">
                                    <div className="flex items-center justify-between text-rose-800 dark:text-rose-300 mb-1.5">
                                      <span className="text-[11px] font-bold uppercase tracking-wider">Realisasi Biaya Proyek</span>
                                      <Wallet size={16} className="text-rose-600 dark:text-rose-400" />
                                    </div>
                                    <div className="text-lg font-bold font-mono text-rose-700 dark:text-rose-300 tracking-tight">
                                      {p.expensesSummary?.totalPengeluaranFmt ?? "Rp 0"}
                                    </div>
                                    <div className="text-[11px] text-rose-700/90 dark:text-rose-400/90 mt-1 flex items-center justify-between">
                                      <span>Pengeluaran Riil</span>
                                      <span className="font-semibold">{p.expensesSummary?.items.length ?? 0} Transaksi</span>
                                    </div>
                                  </div>

                                  {/* 4. Laba Kas Berjalan */}
                                  {(() => {
                                    const laba = p.expensesSummary?.labaKotor ?? (p.terminTagih - (p.expensesSummary?.totalPengeluaran ?? 0));
                                    const isProfit = laba >= 0;
                                    return (
                                      <div className={`p-4 rounded-xl border ${
                                        isProfit
                                          ? "bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-200/70 dark:border-indigo-800/50"
                                          : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-800/50"
                                      }`}>
                                        <div className={`flex items-center justify-between mb-1.5 ${
                                          isProfit ? "text-indigo-800 dark:text-indigo-300" : "text-amber-800 dark:text-amber-300"
                                        }`}>
                                          <span className="text-[11px] font-bold uppercase tracking-wider">Laba Kas Berjalan</span>
                                          <Calculator size={16} className={isProfit ? "text-indigo-600 dark:text-indigo-400" : "text-amber-600 dark:text-amber-400"} />
                                        </div>
                                        <div className={`text-lg font-bold font-mono tracking-tight ${
                                          isProfit ? "text-indigo-700 dark:text-indigo-300" : "text-amber-700 dark:text-amber-300"
                                        }`}>
                                          {p.expensesSummary?.labaKotorFmt ?? formatRupiah(laba)}
                                        </div>
                                        <div className="text-[11px] text-muted-faint mt-1 flex items-center justify-between">
                                          <span>Sisa Piutang:</span>
                                          <span className="font-mono font-semibold text-status-red">{p.sisaTagihFmt}</span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Visual Alur Kas Proyek (Cashflow Bar) */}
                                <div className="p-3.5 rounded-xl bg-surface-subtle/50 border border-border-subtle">
                                  <div className="flex items-center justify-between text-xs mb-1.5">
                                    <span className="font-semibold text-navy-text flex items-center gap-1.5">
                                      <TrendingUp size={13} className="text-brand" />
                                      Alur Finansial Proyek (Biaya Riil vs Termin Cair vs Pagu Kontrak)
                                    </span>
                                    <span className="text-muted-faint font-mono text-[11px]">
                                      Total Pagu: {p.contractValueFmt}
                                    </span>
                                  </div>
                                  <div className="h-3 w-full bg-surface-hover rounded-full overflow-hidden flex">
                                    {p.contractValue > 0 && (p.expensesSummary?.totalPengeluaran ?? 0) > 0 && (
                                      <div
                                        className="h-full bg-rose-500 transition-all"
                                        style={{ width: `${Math.min(((p.expensesSummary?.totalPengeluaran ?? 0) / p.contractValue) * 100, 100)}%` }}
                                        title={`Realisasi Biaya: ${p.expensesSummary?.totalPengeluaranFmt}`}
                                      />
                                    )}
                                    {p.contractValue > 0 && (p.expensesSummary?.labaKotor ?? 0) > 0 && (
                                      <div
                                        className="h-full bg-emerald-500 transition-all"
                                        style={{ width: `${Math.min(((p.expensesSummary?.labaKotor ?? 0) / p.contractValue) * 100, 100)}%` }}
                                        title={`Surplus Kas: ${p.expensesSummary?.labaKotorFmt}`}
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 text-[11px] text-muted mt-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                                      <span>Biaya Riil: <strong className="font-mono text-rose-600 dark:text-rose-400">{p.expensesSummary?.totalPengeluaranFmt ?? "Rp 0"}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                                      <span>Termin Cair: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{p.terminTagihFmt}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-full bg-surface-hover border border-border inline-block" />
                                      <span>Sisa Kontrak Belum Cair: <strong className="font-mono text-muted-stronger">{p.sisaTagihFmt}</strong></span>
                                    </div>
                                  </div>
                                </div>

                                {/* Tab Switcher Rincian */}
                                {(() => {
                                  const currentTab =
                                    activeProjectTabs[p.id] ??
                                    (p.expensesSummary?.items.length > 0 ? "pengeluaran" : "termin");

                                  return (
                                    <div className="space-y-4">
                                      <div className="flex items-center gap-2 border-b border-border pb-2 flex-wrap">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setActiveProjectTabs((prev) => ({ ...prev, [p.id]: "pengeluaran" }))
                                          }
                                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                                            currentTab === "pengeluaran"
                                              ? "bg-rose-600 text-white shadow-xs"
                                              : "text-muted-stronger hover:bg-surface-hover"
                                          }`}
                                        >
                                          <Wallet size={14} />
                                          Detail Pengeluaran Biaya
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            currentTab === "pengeluaran"
                                              ? "bg-rose-800 text-rose-100"
                                              : "bg-surface-subtle text-muted"
                                          }`}>
                                            {p.expensesSummary?.items.length ?? 0}
                                          </span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            setActiveProjectTabs((prev) => ({ ...prev, [p.id]: "termin" }))
                                          }
                                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                                            currentTab === "termin"
                                              ? "bg-emerald-600 text-white shadow-xs"
                                              : "text-muted-stronger hover:bg-surface-hover"
                                          }`}
                                        >
                                          <Receipt size={14} />
                                          Riwayat Penagihan Termin
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            currentTab === "termin"
                                              ? "bg-emerald-800 text-emerald-100"
                                              : "bg-surface-subtle text-muted"
                                          }`}>
                                            {p.termin.length}
                                          </span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            setActiveProjectTabs((prev) => ({ ...prev, [p.id]: "pajak" }))
                                          }
                                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                                            currentTab === "pajak"
                                              ? "bg-indigo-600 text-white shadow-xs"
                                              : "text-muted-stronger hover:bg-surface-hover"
                                          }`}
                                        >
                                          <Calculator size={14} />
                                          Rekapitulasi Pajak & Bank
                                        </button>
                                      </div>

                                      {/* TAB 1: DETAIL PENGELUARAN PROYEK */}
                                      {currentTab === "pengeluaran" && (
                                        <div className="space-y-3.5">
                                          {/* Mini summary badges per kategori pengeluaran */}
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40">
                                              <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                                                <ShoppingBag size={14} /> Bahan & Material
                                              </div>
                                              <div className="text-sm font-bold font-mono text-blue-900 dark:text-blue-100 mt-1">
                                                {p.expensesSummary?.totalMaterialFmt ?? "Rp 0"}
                                              </div>
                                            </div>

                                            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                                              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                                                <Users size={14} /> Gaji & Upah Tukang
                                              </div>
                                              <div className="text-sm font-bold font-mono text-amber-900 dark:text-amber-100 mt-1">
                                                {p.expensesSummary?.totalGajiFmt ?? "Rp 0"}
                                              </div>
                                            </div>

                                            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
                                              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                                                <Truck size={14} /> Operasional & Transport
                                              </div>
                                              <div className="text-sm font-bold font-mono text-emerald-900 dark:text-emerald-100 mt-1">
                                                {p.expensesSummary?.totalOperasionalFmt ?? "Rp 0"}
                                              </div>
                                            </div>

                                            <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40">
                                              <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                                                <FileText size={14} /> Beban Lain-lain
                                              </div>
                                              <div className="text-sm font-bold font-mono text-purple-900 dark:text-purple-100 mt-1">
                                                {p.expensesSummary?.totalLainnyaFmt ?? "Rp 0"}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Tabel Pengeluaran Proyek */}
                                          {p.expensesSummary?.items && p.expensesSummary.items.length > 0 ? (
                                            <div className="rounded-xl border border-border overflow-hidden">
                                              <div className="overflow-x-auto">
                                                <table className="w-full text-left text-xs">
                                                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                                                    <tr>
                                                      <th className="py-2.5 px-3">Tanggal</th>
                                                      <th className="py-2.5 px-3">No. Bukti</th>
                                                      <th className="py-2.5 px-3">Keterangan Pengeluaran</th>
                                                      <th className="py-2.5 px-3">Kategori & Akun Beban</th>
                                                      <th className="py-2.5 px-3">Sumber Kas/Bank</th>
                                                      <th className="py-2.5 px-3 text-right">Nominal</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-border bg-surface-card">
                                                    {p.expensesSummary.items.map((exp) => (
                                                      <tr key={exp.id} className="hover:bg-surface-hover/40 transition-colors">
                                                        <td className="py-2.5 px-3 text-muted-stronger whitespace-nowrap font-medium">
                                                          {exp.tanggalFmt}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-mono font-semibold text-navy-text whitespace-nowrap">
                                                          {exp.noBukti}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-navy-text font-medium max-w-xs break-words">
                                                          {exp.keterangan}
                                                        </td>
                                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                                          <span className={`inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-md border mr-1.5 ${
                                                            exp.kategoriBeban === "Gaji & Upah"
                                                              ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                                              : exp.kategoriBeban === "Bahan & Material"
                                                              ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                                              : exp.kategoriBeban === "Operasional & Transport"
                                                              ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                                              : "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                                          }`}>
                                                            {exp.kategoriBeban}
                                                          </span>
                                                          <span className="text-[11px] text-muted-faint font-mono">
                                                            {exp.coaCode} · {exp.coaName}
                                                          </span>
                                                        </td>
                                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-surface-subtle text-muted-stronger border border-border">
                                                            {exp.sumberKasBank}
                                                          </span>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-status-red whitespace-nowrap text-sm">
                                                          {exp.nominalFmt}
                                                        </td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                  <tfoot className="bg-surface-subtle font-bold border-t border-border text-xs">
                                                    <tr>
                                                      <td colSpan={5} className="py-3 px-3 text-right text-muted-stronger">
                                                        Total Realisasi Pengeluaran:
                                                      </td>
                                                      <td className="py-3 px-3 text-right font-mono text-status-red tabular-nums text-sm font-bold">
                                                        {p.expensesSummary.totalPengeluaranFmt}
                                                      </td>
                                                    </tr>
                                                  </tfoot>
                                                </table>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="p-6 rounded-xl border border-dashed border-border bg-surface-subtle/30 text-center text-xs text-muted-faint space-y-1">
                                              <p className="font-semibold text-muted-stronger">Belum ada catatan pengeluaran khusus untuk proyek ini.</p>
                                              <p className="text-[11px]">
                                                Setiap pengeluaran (pembelian semen/material, upah tukang, vendor) yang dialokasikan ke kode proyek <strong className="text-navy-text">{p.code}</strong> pada Entry Jurnal atau Transaksi Kas akan otomatis terakumulasi di sini.
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* TAB 2: PROGRES PENAGIHAN TERMIN */}
                                      {currentTab === "termin" && (
                                        <div className="space-y-3">
                                          {p.termin.length > 0 ? (
                                            <div className="rounded-xl border border-border overflow-hidden">
                                              <div className="overflow-x-auto">
                                                <table className="w-full text-left text-xs">
                                                  <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                                                    <tr>
                                                      <th className="py-2.5 px-3">Termin & Kwitansi</th>
                                                      <th className="py-2.5 px-3 text-right">Bruto Kwitansi</th>
                                                      <th className="py-2.5 px-3 text-right">Potongan Pajak</th>
                                                      <th className="py-2.5 px-3 text-right">Net Masuk Bank</th>
                                                      <th className="py-2.5 px-3 text-center">Progres Kontrak</th>
                                                      <th className="py-2.5 px-3 text-center">Status</th>
                                                      <th className="py-2.5 px-3 text-right">Aksi & Rincian</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-border bg-surface-card">
                                                    {p.termin.map((t) => {
                                                      const totalPajak = (t.breakdown?.ppn ?? 0) + (t.breakdown?.pph ?? 0);
                                                      return (
                                                        <tr key={t.id} className="hover:bg-surface-hover/40 transition-colors">
                                                          <td className="py-2.5 px-3">
                                                            <div className="font-bold text-navy-text flex items-center gap-1.5 flex-wrap">
                                                              <span>{t.name}</span>
                                                              {t.breakdown?.noBukti && (
                                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                                  {t.breakdown.noBukti}
                                                                </span>
                                                              )}
                                                              {t.breakdown?.bank && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-subtle text-muted-stronger border border-border">
                                                                  {t.breakdown.bank}
                                                                </span>
                                                              )}
                                                            </div>
                                                            <div className="text-[11px] text-muted-faint mt-0.5">
                                                              Tgl: {t.breakdown?.tanggalTerimaFmt || "-"}
                                                              {t.auditedAt && ` · Diaudit: ${t.auditedAt} (${t.auditedByName})`}
                                                            </div>
                                                          </td>
                                                          <td className="py-2.5 px-3 text-right font-mono font-bold text-navy-text tabular-nums whitespace-nowrap text-sm">
                                                            {t.nominalFmt}
                                                          </td>
                                                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                                                            <div className="font-mono font-semibold text-amber-700 dark:text-amber-300">
                                                              {formatRupiah(totalPajak)}
                                                            </div>
                                                            {t.breakdown && (
                                                              <div className="text-[10px] text-muted-faint">
                                                                PPN: {t.breakdown.ppnFmt} · PPh: {t.breakdown.pphFmt}
                                                              </div>
                                                            )}
                                                          </td>
                                                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 tabular-nums whitespace-nowrap text-sm">
                                                            {t.breakdown?.netBankFmt || t.nominalFmt}
                                                          </td>
                                                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                            {t.percentage !== undefined && (
                                                              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                                                +{t.percentageDelta ?? t.percentage}% (Kumulatif: {t.percentage}%)
                                                              </span>
                                                            )}
                                                          </td>
                                                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                            <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-md ${STATUS_BADGE[t.status]}`}>
                                                              {STATUS_LABEL[t.status]}
                                                            </span>
                                                          </td>
                                                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                            <div className="flex items-center gap-1.5 justify-end">
                                                              <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  setSelectedTerminForModal({ project: p, termin: t });
                                                                }}
                                                                className="px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                                                title="Lihat rincian lengkap DPP, PPN, PPh & Jurnal Termin ini"
                                                              >
                                                                <FileText size={12} /> Breakdown Pajak
                                                              </button>
                                                              {isManajer && (
                                                                <>
                                                                  {t.status !== "ON_TRACK" && (
                                                                    <button
                                                                      type="button"
                                                                      onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleAudit(t.id);
                                                                      }}
                                                                      disabled={isPending}
                                                                      className="px-2 py-1 rounded-lg bg-navy text-white text-[11px] font-semibold flex items-center gap-1 shadow-2xs cursor-pointer"
                                                                    >
                                                                      <CheckCircle size={10} /> Audit
                                                                    </button>
                                                                  )}
                                                                  <select
                                                                    value={t.status}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onChange={(e) =>
                                                                      handleStatusChange(t.id, e.target.value as TerminStatus)
                                                                    }
                                                                    disabled={isPending}
                                                                    className="px-2 py-1 rounded-lg border border-border text-[11px] bg-surface-input text-navy-text"
                                                                  >
                                                                    <option value="ON_TRACK">On Track</option>
                                                                    <option value="AT_RISK">At Risk</option>
                                                                    <option value="NEEDS_AUDIT">Perlu Audit</option>
                                                                  </select>
                                                                </>
                                                              )}
                                                            </div>
                                                          </td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                  <tfoot className="bg-surface-subtle font-bold border-t border-border text-xs">
                                                    <tr>
                                                      <td className="py-3 px-3 text-muted-stronger">
                                                        Total Termin Diterima ({p.termin.length} Termin):
                                                      </td>
                                                      <td className="py-3 px-3 text-right font-mono text-navy-text tabular-nums text-sm">
                                                        {p.breakdownSummary?.totalGrossFmt ?? p.terminTagihFmt}
                                                      </td>
                                                      <td className="py-3 px-3 text-right font-mono text-amber-700 dark:text-amber-300 tabular-nums text-sm">
                                                        {formatRupiah((p.breakdownSummary?.totalPpn ?? 0) + (p.breakdownSummary?.totalPph ?? 0))}
                                                      </td>
                                                      <td className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-emerald-300 tabular-nums text-sm">
                                                        {p.breakdownSummary?.totalNetBankFmt ?? p.terminTagihFmt}
                                                      </td>
                                                      <td colSpan={3} />
                                                    </tr>
                                                  </tfoot>
                                                </table>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="p-6 rounded-xl border border-dashed border-border bg-surface-subtle/30 text-center text-xs text-muted-faint">
                                              Belum ada termin penagihan yang terbit untuk proyek ini.
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* TAB 3: RINCIAN PAJAK & BANK */}
                                      {currentTab === "pajak" && (
                                        <div className="space-y-4">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
                                              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block uppercase">
                                                Pendapatan Bruto (Kwitansi)
                                              </span>
                                              <span className="text-base font-bold font-mono text-emerald-900 dark:text-emerald-100 block mt-1">
                                                {p.breakdownSummary?.totalGrossFmt ?? p.terminTagihFmt}
                                              </span>
                                              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400 block mt-0.5">
                                                {p.maxPercentage}% dari Kontrak ({p.contractValueFmt})
                                              </span>
                                            </div>

                                            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40">
                                              <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 block uppercase">
                                                Dasar Pengenaan Pajak (DPP)
                                              </span>
                                              <span className="text-base font-bold font-mono text-blue-900 dark:text-blue-100 block mt-1">
                                                {p.breakdownSummary?.totalDppFmt ?? "Rp 0"}
                                              </span>
                                              <span className="text-[11px] text-blue-700/80 dark:text-blue-400 block mt-0.5">
                                                DPP Nilai Lain: {p.breakdownSummary?.totalDppNilaiLainFmt ?? "Rp 0"}
                                              </span>
                                            </div>

                                            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                                              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block uppercase">
                                                Pajak Terutang & Dipotong
                                              </span>
                                              <span className="text-base font-bold font-mono text-amber-900 dark:text-amber-100 block mt-1">
                                                {formatRupiah((p.breakdownSummary?.totalPpn ?? 0) + (p.breakdownSummary?.totalPph ?? 0))}
                                              </span>
                                              <span className="text-[11px] text-amber-700/80 dark:text-amber-400 block mt-0.5">
                                                PPN: {p.breakdownSummary?.totalPpnFmt ?? "Rp 0"} · PPh: {p.breakdownSummary?.totalPphFmt ?? "Rp 0"}
                                              </span>
                                            </div>

                                            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40">
                                              <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 block uppercase">
                                                Bersih Masuk Rekening Bank
                                              </span>
                                              <span className="text-base font-bold font-mono text-indigo-900 dark:text-indigo-100 block mt-1">
                                                {p.breakdownSummary?.totalNetBankFmt ?? p.terminTagihFmt}
                                              </span>
                                              <span className="text-[11px] text-indigo-700/80 dark:text-indigo-400 block mt-0.5">
                                                Netto Realisasi Kas Diterima
                                              </span>
                                            </div>
                                          </div>

                                          <div className="p-3.5 rounded-xl bg-surface-subtle border border-border text-xs text-muted-stronger flex items-start gap-2.5">
                                            <Calculator size={16} className="text-brand shrink-0 mt-0.5" />
                                            <div>
                                              <span className="font-semibold text-navy-text">Standar Akuntansi & Perpajakan Konstruksi:</span>
                                              <p className="mt-0.5 text-muted-faint leading-relaxed">
                                                Setiap kwitansi termin memuat DPP (100/111 atau DPP Nilai Lain), PPN 11%/12% terutang, serta potongan PPh Final Jasa Konstruksi (misal 1,75% s.d 2,65%). Sisa bersih disalurkan langsung ke akun Kas/Bank entitas.
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Tombol Tutup di Bawah Detail */}
                                <div className="pt-2 flex justify-end border-t border-border">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpand(p.id);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-surface-subtle hover:bg-surface-hover text-xs font-semibold text-muted-stronger transition-colors cursor-pointer"
                                  >
                                    <ChevronUp size={14} /> Tutup Detail Proyek {p.code}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Tab: Loading Dock ── */}
      {tab === "dock" && (
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-hover text-left">
                <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Nama</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">
                  Total
                </th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Status</th>
                <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {loadingDockList.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-sm text-muted">
                    Belum ada transaksi loading dock.
                  </td>
                </tr>
              )}
              {loadingDockList.map((d) => (
                <tr key={d.id} className="border-b border-surface-subtle hover:bg-surface-hover/30">
                  <td className="py-3 px-6 font-semibold text-navy-text">{d.nama}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[13px] whitespace-nowrap">{d.totalFmt}</td>
                  <td className="py-3 px-3">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-surface-hover text-muted-stronger">
                      {DOCK_STATUS_LABEL[d.status] ?? d.status}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-[12.5px] text-muted">{d.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}



      {/* Modal Detail Breakdown Termin Tertagih */}
      {selectedTerminForModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setSelectedTerminForModal(null)}
        >
          <div
            className="w-full max-w-2xl bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-subtle/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy-text">
                    Rincian Termin & Perpajakan ({selectedTerminForModal.termin.name})
                  </h3>
                  <p className="text-xs text-muted-faint">
                    Proyek: <span className="font-semibold text-muted-stronger">{selectedTerminForModal.project.code}</span> – {selectedTerminForModal.project.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTerminForModal(null)}
                className="p-1.5 rounded-lg text-muted-faint hover:text-navy-text hover:bg-surface-hover transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5 max-h-[calc(85vh-130px)] overflow-y-auto">
              {/* Metadata Info Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-surface-subtle border border-border-subtle text-xs">
                <div>
                  <span className="text-muted-faint block text-[11px]">No. Bukti / Jurnal</span>
                  <span className="font-mono font-bold text-navy-text">
                    {selectedTerminForModal.termin.breakdown?.noBukti || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-faint block text-[11px]">Tgl. Penerimaan</span>
                  <span className="font-medium text-navy-text">
                    {selectedTerminForModal.termin.breakdown?.tanggalTerimaFmt || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-faint block text-[11px]">Bank Penerima</span>
                  <span className="font-medium text-navy-text">
                    {selectedTerminForModal.termin.breakdown?.bank || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-faint block text-[11px]">Status Termin</span>
                  <span className="font-bold text-status-green">
                    {selectedTerminForModal.termin.status}
                  </span>
                </div>
              </div>

              {/* Tax & Financial Breakdown Cards */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-faint mb-2 flex items-center gap-1.5">
                  <Calculator size={14} /> Perhitungan DPP, PPN & PPh
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Gross (Kwitansi) */}
                  <div className="p-3 rounded-xl bg-surface-subtle border border-border-subtle">
                    <div className="text-[11px] text-muted-faint font-medium">Nilai Kwitansi / Bruto Pendapatan</div>
                    <div className="text-base font-bold font-mono text-navy-text mt-0.5">
                      {selectedTerminForModal.termin.breakdown?.grossFmt || selectedTerminForModal.termin.nominalFmt}
                    </div>
                    <div className="text-[10px] text-muted-faint mt-1">
                      Kredit Akun 400 (Pendapatan diakui)
                    </div>
                  </div>

                  {/* DPP Dasar & DPP Nilai Lain */}
                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40">
                    <div className="text-[11px] text-blue-800 dark:text-blue-300 font-medium">Dasar Pengenaan Pajak (DPP)</div>
                    <div className="text-base font-bold font-mono text-blue-900 dark:text-blue-200 mt-0.5">
                      {selectedTerminForModal.termin.breakdown?.dppFmt || "Rp 0"}
                    </div>
                    <div className="text-[10px] text-blue-700/80 dark:text-blue-400 mt-1">
                      DPP Nilai Lain (11/12): <span className="font-mono font-semibold">{selectedTerminForModal.termin.breakdown?.dppNilaiLainFmt || "Rp 0"}</span>
                    </div>
                  </div>

                  {/* PPN Terutang */}
                  <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                    <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">PPN Terutang (12%)</div>
                    <div className="text-base font-bold font-mono text-amber-900 dark:text-amber-200 mt-0.5">
                      {selectedTerminForModal.termin.breakdown?.ppnFmt || "Rp 0"}
                    </div>
                    <div className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-1">
                      12% × DPP Nilai Lain (= 11% × DPP Dasar)
                    </div>
                  </div>

                  {/* Potongan PPh */}
                  <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40">
                    <div className="text-[11px] text-purple-800 dark:text-purple-300 font-medium">Potongan Pajak (PPh)</div>
                    <div className="text-base font-bold font-mono text-purple-900 dark:text-purple-200 mt-0.5">
                      {selectedTerminForModal.termin.breakdown?.pphFmt || "Rp 0"}
                    </div>
                    <div className="text-[10px] text-purple-700/80 dark:text-purple-400 mt-1">
                      {selectedTerminForModal.termin.breakdown?.pphItems && selectedTerminForModal.termin.breakdown.pphItems.length > 0 ? (
                        selectedTerminForModal.termin.breakdown.pphItems.map((p, idx) => (
                          <span key={idx} className="mr-2">
                            {p.name}: {p.amountFmt}
                          </span>
                        ))
                      ) : (
                        "PPh 21 / PPh Final 4(2)"
                      )}
                    </div>
                  </div>
                </div>

                {/* Net Kas Masuk Bank */}
                <div className="mt-3 p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      <Landmark size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                        Bersih Diterima di Rekening Bank
                      </div>
                      <div className="text-[11px] text-indigo-700/80 dark:text-indigo-400">
                        {selectedTerminForModal.termin.breakdown?.bank || "Kas / Bank"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold font-mono text-indigo-900 dark:text-indigo-100">
                      {selectedTerminForModal.termin.breakdown?.netBankFmt || selectedTerminForModal.termin.nominalFmt}
                    </div>
                    <div className="text-[10px] text-indigo-600 dark:text-indigo-400">
                      Kwitansi ({selectedTerminForModal.termin.breakdown?.grossFmt}) - Potongan PPh ({selectedTerminForModal.termin.breakdown?.pphFmt})
                    </div>
                  </div>
                </div>
              </div>

              {/* Jurnal Pembukuan */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-faint mb-2 flex items-center gap-1.5">
                  <FileText size={14} /> Jurnal Pembukuan Terkait
                </h4>
                {selectedTerminForModal.termin.breakdown?.jurnalRows && selectedTerminForModal.termin.breakdown.jurnalRows.length > 0 ? (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-subtle border-b border-border text-muted-stronger">
                        <tr>
                          <th className="py-2.5 px-3">No. Akun</th>
                          <th className="py-2.5 px-3">Nama Akun</th>
                          <th className="py-2.5 px-3 text-right">Debit</th>
                          <th className="py-2.5 px-3 text-right">Kredit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle bg-surface-card">
                        {selectedTerminForModal.termin.breakdown.jurnalRows.map((j, idx) => (
                          <tr key={idx} className="hover:bg-surface-hover/30">
                            <td className="py-2 px-3 font-mono font-bold text-navy-text">
                              {j.coaCode}
                            </td>
                            <td className="py-2 px-3 text-muted-stronger">
                              {j.coaName}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums text-status-green font-semibold">
                              {j.debit > 0 ? formatRupiah(j.debit) : "-"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums text-status-blue font-semibold">
                              {j.kredit > 0 ? formatRupiah(j.kredit) : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-surface-subtle font-bold border-t border-border text-xs">
                        <tr>
                          <td colSpan={2} className="py-2.5 px-3 text-right text-muted-stronger">
                            Total Keseimbangan Jurnal:
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-status-green">
                            {formatRupiah(
                              selectedTerminForModal.termin.breakdown.jurnalRows.reduce((acc, r) => acc + r.debit, 0)
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-status-blue">
                            {formatRupiah(
                              selectedTerminForModal.termin.breakdown.jurnalRows.reduce((acc, r) => acc + r.kredit, 0)
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-faint">
                    Belum ada baris transaksi jurnal umum yang ditautkan ke termin ini.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-border bg-surface-subtle/50">
              <button
                type="button"
                onClick={() => setSelectedTerminForModal(null)}
                className="px-4 py-2 rounded-xl bg-navy text-white text-xs font-semibold hover:bg-navy/90 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
