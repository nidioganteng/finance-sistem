"use client";

import { useState, useTransition } from "react";
import { TerminStatus } from "@prisma/client";
import { auditTermin, updateTerminStatus, cancelProject, completeProject, reopenProject } from "@/lib/actions/piutang";
import {
  AlertTriangle,
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
  PlayCircle,
  RotateCcw,
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
  ON_TRACK:    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  AT_RISK:     "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  NEEDS_AUDIT: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
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
  const [tab, setTab] = useState<"berjalan" | "selesai" | "dock">("berjalan");
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

  const isManajer = userRole === "MANAJER_KEUANGAN" || userRole === "STAF_KEUANGAN" || userRole === "SUPER_ADMIN";

  const runningProjects = projectList.filter((p) => p.status === "ACTIVE");
  const completedProjects = projectList.filter((p) => p.status === "COMPLETED" || p.status === "CANCELLED");
  const overdueProjectsCount = runningProjects.filter((p) => p.isOverdue).length;

  const totalCompletedKontrak = completedProjects.reduce((sum, p) => sum + p.contractValue, 0);
  const totalCompletedTermin = completedProjects.reduce((sum, p) => sum + p.terminTagih, 0);
  const totalCompletedKontrakFmt = formatRupiah(totalCompletedKontrak);
  const totalCompletedTerminFmt = formatRupiah(totalCompletedTermin);

  const displayedProjects = tab === "berjalan" ? runningProjects : completedProjects;

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
    if (!confirm(`Tandai proyek ${code} sebagai selesai? Proyek akan dipindahkan ke tab Proyek Selesai, namun transaksi di jurnal tetap tercatat.`)) return;
    startTransition(async () => {
      try {
        await completeProject(id);
      } catch (e: unknown) {
        setError((e as Error).message);
      }
    });
  }

  function handleCancelProject(id: string, code: string) {
    if (!confirm(`Batalkan proyek ${code}? Termin yang belum terbayar akan dihapus dan proyek dipindahkan ke tab Proyek Selesai.`)) return;
    startTransition(async () => {
      try {
        await cancelProject(id);
      } catch (e: unknown) {
        setError((e as Error).message);
      }
    });
  }

  function handleReopenProject(id: string, code: string) {
    if (!confirm(`Kembalikan proyek ${code} ke daftar Proyek Berjalan?`)) return;
    startTransition(async () => {
      try {
        await reopenProject(id);
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
        <div className="flex items-center gap-1.5 p-1 bg-surface-subtle rounded-xl w-fit border border-border/60">
          <button
            onClick={() => setTab("berjalan")}
            className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              tab === "berjalan"
                ? "bg-navy text-white shadow-xs"
                : "text-muted-stronger hover:bg-surface-hover hover:text-navy-text"
            }`}
          >
            <PlayCircle size={15} />
            <span>Proyek Berjalan</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
              tab === "berjalan" ? "bg-white/20 text-white" : "bg-surface-hover text-muted-stronger"
            }`}>
              {runningProjects.length}
            </span>
          </button>

          <button
            onClick={() => setTab("selesai")}
            className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              tab === "selesai"
                ? "bg-navy text-white shadow-xs"
                : "text-muted-stronger hover:bg-surface-hover hover:text-navy-text"
            }`}
          >
            <CheckCircle size={15} />
            <span>Proyek Selesai</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
              tab === "selesai" ? "bg-white/20 text-white" : "bg-surface-hover text-muted-stronger"
            }`}>
              {completedProjects.length}
            </span>
          </button>

          {isUmumEntity && (
            <button
              onClick={() => setTab("dock")}
              className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                tab === "dock"
                  ? "bg-navy text-white shadow-xs"
                  : "text-muted-stronger hover:bg-surface-hover hover:text-navy-text"
              }`}
            >
              <Truck size={15} />
              <span>Loading Dock</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                tab === "dock" ? "bg-white/20 text-white" : "bg-surface-hover text-muted-stronger"
              }`}>
                {loadingDockList.length}
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── Tab: Proyek Berjalan & Proyek Selesai ── */}
      {(tab === "berjalan" || tab === "selesai") && (
        <>
          {tab === "berjalan" && (
            <>
              {/* Alert jika ada proyek yang lewat tanggal kontrak & termin < 80% */}
              {overdueProjectsCount > 0 && (
                <div className="flex items-start sm:items-center gap-3 p-4 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 shadow-xs">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <AlertTriangle size={17} />
                  </div>
                  <div className="text-xs flex-1">
                    <span className="font-bold text-sm block sm:inline">Perhatian: {overdueProjectsCount} Proyek Melewati Batas Kontrak! </span>
                    <span className="text-muted-stronger">Progres termin masih di bawah 80% meskipun tanggal kontrak telah terlewati. Harap tindak lanjuti penagihan termin.</span>
                  </div>
                </div>
              )}

              {/* Kartu ringkasan Proyek Berjalan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface-card rounded-[16px] border border-border-soft p-4 sm:p-5 min-w-0 overflow-hidden shadow-xs">
                  <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5 truncate">
                    Total Nilai Kontrak Aktif
                  </div>
                  <div className={`${getMetricValueFontSize(summary.totalKontrakFmt)} text-navy-text truncate`} title={summary.totalKontrakFmt}>
                    {summary.totalKontrakFmt}
                  </div>
                  <div className="text-[12px] text-muted mt-0.5 truncate">{runningProjects.length} proyek berjalan</div>
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
            </>
          )}

          {tab === "selesai" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-card rounded-[16px] border border-border-soft p-4 sm:p-5 min-w-0 overflow-hidden shadow-xs">
                <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5 truncate">
                  Total Proyek Selesai
                </div>
                <div className="text-[19px] sm:text-[21px] font-extrabold text-navy-text truncate">
                  {completedProjects.length} Proyek
                </div>
                <div className="text-[12px] text-muted mt-0.5 truncate">
                  {completedProjects.filter((p) => p.status === "COMPLETED").length} Selesai · {completedProjects.filter((p) => p.status === "CANCELLED").length} Dibatalkan
                </div>
              </div>
              <div className="bg-surface-card rounded-[16px] border border-border-soft p-4 sm:p-5 min-w-0 overflow-hidden shadow-xs">
                <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5 truncate">
                  Total Nilai Kontrak Selesai
                </div>
                <div className={`${getMetricValueFontSize(totalCompletedKontrakFmt)} text-navy-text truncate`} title={totalCompletedKontrakFmt}>
                  {totalCompletedKontrakFmt}
                </div>
                <div className="text-[12px] text-muted mt-0.5 truncate">Akumulasi kontrak rampung</div>
              </div>
              <div className="bg-surface-card rounded-[16px] border border-border-soft p-4 sm:p-5 min-w-0 overflow-hidden shadow-xs">
                <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5 truncate">
                  Total Realisasi Termin Selesai
                </div>
                <div className={`${getMetricValueFontSize(totalCompletedTerminFmt)} text-status-green truncate`} title={totalCompletedTerminFmt}>
                  {totalCompletedTerminFmt}
                </div>
                <div className="text-[12px] text-muted mt-0.5 truncate">100% tuntas dicairkan</div>
              </div>
            </div>
          )}

          {/* Tabel proyek dengan termin expandable */}
          {displayedProjects.length === 0 ? (
            <div className="bg-surface-card rounded-[20px] border border-border-soft py-16 text-center text-sm text-muted">
              {tab === "berjalan"
                ? "Belum ada proyek yang sedang berjalan untuk entitas ini."
                : "Belum ada proyek yang berstatus selesai untuk entitas ini."}
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
                      {tab === "berjalan" ? "Sisa Piutang" : "Tindakan"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedProjects.map((p) => {
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
                              {p.isOverdue && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <AlertTriangle size={10} /> Perlu Diwaspadai
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
                                        p.status === "COMPLETED"
                                          ? "bg-status-green"
                                          : p.isOverdue
                                          ? "bg-rose-500"
                                          : p.maxPercentage >= 80
                                          ? "bg-status-green"
                                          : p.maxPercentage >= 50
                                          ? "bg-brand"
                                          : "bg-orange-400"
                                      }`}
                                      style={{ width: `${Math.min(p.maxPercentage, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`text-[12.5px] font-bold ${
                                    p.status === "COMPLETED"
                                      ? "text-status-green"
                                      : p.isOverdue
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-muted-stronger"
                                  }`}>
                                    {p.maxPercentage}%
                                  </span>
                                </div>
                                <div className={`text-[11px] mt-1 flex items-center gap-1 ${p.isOverdue ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-muted-faint"}`}>
                                  {p.isOverdue && <AlertTriangle size={11} className="shrink-0" />}
                                  <span>
                                    {p.status === "COMPLETED" ? "Kontrak selesai 100%" : `Batas kontrak: ${p.deadlineFmt}${p.isOverdue ? " · Lewat tempo (< 80%)" : ""}`}
                                  </span>
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
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-green-300 dark:border-green-600 text-[11px] font-semibold text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 cursor-pointer"
                                >
                                  <CheckSquare size={11} /> Tandai Selesai
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelProject(p.id, p.code);
                                  }}
                                  disabled={isPending}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[11px] font-semibold text-muted-stronger hover:bg-surface-hover cursor-pointer"
                                >
                                  <Ban size={11} /> Batalkan Proyek
                                </button>
                              </div>
                            )}
                            {isManajer && p.status !== "ACTIVE" && (
                              <div className="mt-1.5 flex flex-col items-end gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReopenProject(p.id, p.code);
                                  }}
                                  disabled={isPending}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-blue-300 dark:border-blue-600 text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer"
                                  title="Kembalikan proyek ini ke daftar Proyek Berjalan"
                                >
                                  <RotateCcw size={11} /> Buka Kembali
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
                                      <p className="text-xs text-muted-faint mt-1 flex items-center gap-1.5 flex-wrap">
                                        <Calendar size={13} />
                                        <span>Batas Waktu Kontrak: <strong className="text-navy-text">{p.deadlineFmt}</strong></span>
                                        {p.isOverdue && p.status === "ACTIVE" && (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                            <AlertTriangle size={11} /> Melewati Jatuh Tempo (Termin &lt; 80%)
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                                    {isManajer && p.status !== "ACTIVE" && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReopenProject(p.id, p.code);
                                        }}
                                        disabled={isPending}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                                        title="Kembalikan proyek ini ke daftar Proyek Berjalan"
                                      >
                                        <RotateCcw size={13} /> Buka Kembali Proyek
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpand(p.id);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface-subtle hover:bg-surface-hover text-xs font-semibold text-muted-stronger transition-colors cursor-pointer"
                                    >
                                      <ChevronUp size={14} /> Tutup Detail
                                    </button>
                                  </div>
                                </div>

                                {/* 1. Strip Ringkasan Finansial Utama (Clean Horizontal Metric Ribbon) */}
                                <div className="bg-surface-subtle/60 rounded-xl border border-border p-3 sm:p-4">
                                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
                                    {/* Nilai Kontrak */}
                                    <div className="sm:px-3 first:pl-0">
                                      <span className="text-[11px] font-semibold text-muted-faint uppercase block tracking-wider">
                                        Nilai Kontrak
                                      </span>
                                      <span className="text-base sm:text-lg font-bold font-mono text-navy-text block mt-0.5">
                                        {p.contractValueFmt}
                                      </span>
                                      <span className="text-[11px] text-muted-faint block mt-0.5">
                                        Pagu Total SPK
                                      </span>
                                    </div>

                                    {/* Termin Cair */}
                                    <div className="sm:px-3 pt-2 sm:pt-0">
                                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase block tracking-wider">
                                        Termin Cair (Masuk)
                                      </span>
                                      <span className="text-base sm:text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300 block mt-0.5">
                                        {p.terminTagihFmt}
                                      </span>
                                      <span className="text-[11px] text-muted-faint block mt-0.5">
                                        {p.maxPercentage}% · {p.termin.length} termin
                                      </span>
                                    </div>

                                    {/* Realisasi Biaya */}
                                    <div className="sm:px-3 pt-2 sm:pt-0">
                                      <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase block tracking-wider">
                                        Realisasi Biaya
                                      </span>
                                      <span className="text-base sm:text-lg font-bold font-mono text-rose-700 dark:text-rose-300 block mt-0.5">
                                        {p.expensesSummary?.totalPengeluaranFmt ?? "Rp 0"}
                                      </span>
                                      <span className="text-[11px] text-muted-faint block mt-0.5">
                                        {p.expensesSummary?.items.length ?? 0} transaksi riil
                                      </span>
                                    </div>

                                    {/* Laba Kas Berjalan */}
                                    <div className="sm:px-3 pt-2 sm:pt-0">
                                      <span className="text-[11px] font-semibold text-navy-text uppercase block tracking-wider">
                                        Laba Kas Berjalan
                                      </span>
                                      <span className={`text-base sm:text-lg font-bold font-mono block mt-0.5 ${
                                        (p.expensesSummary?.labaKotor ?? 0) >= 0
                                          ? "text-emerald-700 dark:text-emerald-300"
                                          : "text-rose-700 dark:text-rose-300"
                                      }`}>
                                        {p.expensesSummary?.labaKotorFmt ?? "Rp 0"}
                                      </span>
                                      <span className="text-[11px] text-muted-faint block mt-0.5">
                                        Kas Masuk - Biaya Riil
                                      </span>
                                    </div>

                                    {/* Sisa Piutang */}
                                    <div className="sm:px-3 pt-2 sm:pt-0">
                                      <span className="text-[11px] font-semibold text-status-red uppercase block tracking-wider">
                                        Sisa Belum Cair
                                      </span>
                                      <span className="text-base sm:text-lg font-bold font-mono text-status-red block mt-0.5">
                                        {p.sisaTagihFmt}
                                      </span>
                                      <span className="text-[11px] text-muted-faint block mt-0.5">
                                        Sisa pagu kontrak
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* 2. Tab Switcher (Hanya 2 Tab Bersih) */}
                                {(() => {
                                  const currentTab =
                                    activeProjectTabs[p.id] ??
                                    (p.termin.length > 0 ? "termin" : "pengeluaran");

                                  return (
                                    <div className="space-y-4">
                                      <div className="flex items-center gap-2 border-b border-border pb-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setActiveProjectTabs((prev) => ({ ...prev, [p.id]: "termin" }))
                                          }
                                          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                                            currentTab === "termin"
                                              ? "bg-navy text-white shadow-xs"
                                              : "text-muted-stronger hover:bg-surface-hover"
                                          }`}
                                        >
                                          <Receipt size={14} />
                                          Riwayat Penagihan Termin ({p.termin.length})
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            setActiveProjectTabs((prev) => ({ ...prev, [p.id]: "pengeluaran" }))
                                          }
                                          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                                            currentTab === "pengeluaran"
                                              ? "bg-navy text-white shadow-xs"
                                              : "text-muted-stronger hover:bg-surface-hover"
                                          }`}
                                        >
                                          <Wallet size={14} />
                                          Realisasi Pengeluaran Biaya ({p.expensesSummary?.items.length ?? 0})
                                        </button>
                                      </div>

                                      {/* TAB 1: RIWAYAT TERMIN & KAS MASUK */}
                                      {currentTab === "termin" && (
                                        <div className="space-y-3.5">
                                          {p.termin.length > 0 ? (
                                            <>
                                              <div className="rounded-xl border border-border overflow-hidden">
                                                <div className="overflow-x-auto">
                                                  <table className="w-full min-w-[760px] text-left text-xs">
                                                    <thead className="bg-surface-subtle border-b border-border text-muted-stronger font-bold">
                                                      <tr>
                                                        <th className="py-2.5 px-3.5">Termin & Bukti Bayar</th>
                                                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Kwitansi Bruto</th>
                                                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap">(-) Potongan Pajak</th>
                                                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap">(=) Net Masuk Bank</th>
                                                        <th className="py-2.5 px-3.5 text-right whitespace-nowrap min-w-[210px]">Status & Aksi</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border bg-surface-card">
                                                      {p.termin.map((t) => {
                                                        const totalPajak = (t.breakdown?.ppn ?? 0) + (t.breakdown?.pph ?? 0);
                                                        return (
                                                          <tr key={t.id} className="hover:bg-surface-hover/30 transition-colors">
                                                            {/* Kolom 1: Termin & Dokumen */}
                                                            <td className="py-3 px-3.5">
                                                              <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-navy-text text-sm">
                                                                  {t.name.replace(/\s*\[.*?\]\s*$/, "")}
                                                                </span>
                                                                {t.percentage !== undefined && (
                                                                  <span className="text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                    +{t.percentageDelta ?? t.percentage}% (Pagu {t.percentage}%)
                                                                  </span>
                                                                )}
                                                              </div>
                                                              <div className="text-[11px] text-muted-faint mt-1 flex items-center gap-2 flex-wrap">
                                                                <span>No. Bukti: <strong className="text-navy-text font-mono">{t.breakdown?.noBukti || "-"}</strong></span>
                                                                <span>·</span>
                                                                <span>Bank: <strong className="text-navy-text">{t.breakdown?.bank || "-"}</strong></span>
                                                                <span>·</span>
                                                                <span>Tgl: {t.breakdown?.tanggalTerimaFmt || "-"}</span>
                                                                {t.auditedAt && (
                                                                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">· Diaudit</span>
                                                                )}
                                                              </div>
                                                            </td>

                                                            {/* Kolom 2: Bruto Kwitansi */}
                                                            <td className="py-3 px-3.5 text-right">
                                                              <div className="font-mono font-bold text-navy-text text-sm">
                                                                {t.nominalFmt}
                                                              </div>
                                                              <div className="text-[11px] text-muted-faint mt-0.5">
                                                                Nilai tagihan bruto
                                                              </div>
                                                            </td>

                                                            {/* Kolom 3: Potongan Pajak */}
                                                            <td className="py-3 px-3.5 text-right">
                                                              <div className="font-mono font-semibold text-amber-700 dark:text-amber-300 text-sm">
                                                                {formatRupiah(totalPajak)}
                                                              </div>
                                                              <div className="text-[11px] text-muted-faint mt-0.5">
                                                                {t.breakdown ? (
                                                                  <span>PPN: {t.breakdown.ppnFmt} · PPh: {t.breakdown.pphFmt}</span>
                                                                ) : (
                                                                  <span>PPN & PPh</span>
                                                                )}
                                                              </div>
                                                            </td>

                                                            {/* Kolom 4: Net Masuk Bank */}
                                                            <td className="py-3 px-3.5 text-right">
                                                              <div className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                                                                {t.breakdown?.netBankFmt || t.nominalFmt}
                                                              </div>
                                                              <div className="text-[11px] text-muted-faint mt-0.5">
                                                                {t.breakdown?.bank ? `Masuk ke ${t.breakdown.bank}` : "Bersih rekening bank"}
                                                              </div>
                                                            </td>

                                                            {/* Kolom 5: Status & Aksi */}
                                                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                                              <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                                                                {isManajer && t.status !== "ON_TRACK" && (
                                                                  <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                      e.stopPropagation();
                                                                      handleAudit(t.id);
                                                                    }}
                                                                    disabled={isPending}
                                                                    className="h-7 px-2.5 rounded-lg border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors shadow-2xs"
                                                                    title="Verifikasi dan tandai termin telah diaudit (status kembali ke On Track)"
                                                                  >
                                                                    <CheckCircle size={12} className="text-emerald-600 dark:text-emerald-400" />
                                                                    <span>Audit</span>
                                                                  </button>
                                                                )}

                                                                {isManajer ? (
                                                                  <div className="relative inline-flex items-center">
                                                                    <select
                                                                      value={t.status}
                                                                      onClick={(e) => e.stopPropagation()}
                                                                      onChange={(e) =>
                                                                        handleStatusChange(t.id, e.target.value as TerminStatus)
                                                                      }
                                                                      disabled={isPending}
                                                                      className={`h-7 text-[11px] font-bold pl-2.5 pr-6 py-0.5 rounded-lg border cursor-pointer whitespace-nowrap appearance-none transition-colors shadow-2xs ${STATUS_BADGE[t.status]}`}
                                                                      title="Klik untuk mengubah status termin"
                                                                    >
                                                                      <option value="ON_TRACK" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">On Track</option>
                                                                      <option value="AT_RISK" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">At Risk</option>
                                                                      <option value="NEEDS_AUDIT" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Perlu Audit</option>
                                                                    </select>
                                                                    <ChevronDown size={11} className="absolute right-1.5 pointer-events-none text-current opacity-70" />
                                                                  </div>
                                                                ) : (
                                                                  <span className={`h-7 inline-flex items-center text-[11px] font-bold px-2.5 rounded-lg whitespace-nowrap border ${STATUS_BADGE[t.status]}`}>
                                                                    {STATUS_LABEL[t.status]}
                                                                  </span>
                                                                )}

                                                                <button
                                                                  type="button"
                                                                  onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedTerminForModal({ project: p, termin: t });
                                                                  }}
                                                                  className="h-7 px-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                                                                  title="Lihat rincian lengkap formula perpajakan & jurnal akuntansi termin ini"
                                                                >
                                                                  <FileText size={12} />
                                                                  <span>Breakdown Pajak</span>
                                                                </button>
                                                              </div>
                                                            </td>
                                                          </tr>
                                                        );
                                                      })}
                                                    </tbody>
                                                    <tfoot className="bg-surface-subtle font-bold border-t border-border text-xs">
                                                      <tr>
                                                        <td className="py-3 px-3.5 text-navy-text font-bold">
                                                          Total Termin Cair ({p.termin.length} Termin):
                                                        </td>
                                                        <td className="py-3 px-3.5 text-right font-mono text-navy-text text-sm">
                                                          {p.breakdownSummary?.totalGrossFmt ?? p.terminTagihFmt}
                                                        </td>
                                                        <td className="py-3 px-3.5 text-right font-mono text-amber-700 dark:text-amber-300 text-sm">
                                                          {formatRupiah((p.breakdownSummary?.totalPpn ?? 0) + (p.breakdownSummary?.totalPph ?? 0))}
                                                        </td>
                                                        <td className="py-3 px-3.5 text-right font-mono text-emerald-700 dark:text-emerald-300 text-sm">
                                                          {p.breakdownSummary?.totalNetBankFmt ?? p.terminTagihFmt}
                                                        </td>
                                                        <td className="py-3 px-3.5" />
                                                      </tr>
                                                    </tfoot>
                                                  </table>
                                                </div>
                                              </div>

                                              {/* Strip Ringkasan Perpajakan Termin Proyek */}
                                              <div className="p-3.5 rounded-xl bg-surface-subtle/50 border border-border flex items-center justify-between gap-4 flex-wrap text-xs">
                                                <div className="flex items-center gap-2 text-muted-stronger font-semibold">
                                                  <Calculator size={14} className="text-brand" />
                                                  <span>Rekapitulasi Pajak Termin:</span>
                                                </div>
                                                <div className="flex items-center gap-4 sm:gap-6 flex-wrap text-xs font-mono">
                                                  <div>
                                                    <span className="text-muted-faint font-sans text-[11px] mr-1.5">DPP:</span>
                                                    <strong className="text-navy-text">{p.breakdownSummary?.totalDppFmt ?? "Rp 0"}</strong>
                                                    {(p.breakdownSummary?.totalDppNilaiLain ?? 0) > 0 && (
                                                      <span className="text-[10px] text-muted-faint font-sans ml-1">(Nilai Lain: {p.breakdownSummary?.totalDppNilaiLainFmt})</span>
                                                    )}
                                                  </div>
                                                  <div>
                                                    <span className="text-muted-faint font-sans text-[11px] mr-1.5">PPN 11%/12%:</span>
                                                    <strong className="text-amber-700 dark:text-amber-300">{p.breakdownSummary?.totalPpnFmt ?? "Rp 0"}</strong>
                                                  </div>
                                                  <div>
                                                    <span className="text-muted-faint font-sans text-[11px] mr-1.5">PPh Final Konstruksi:</span>
                                                    <strong className="text-purple-700 dark:text-purple-300">{p.breakdownSummary?.totalPphFmt ?? "Rp 0"}</strong>
                                                  </div>
                                                  <div>
                                                    <span className="text-muted-faint font-sans text-[11px] mr-1.5">Net Diterima Bank:</span>
                                                    <strong className="text-emerald-700 dark:text-emerald-300">{p.breakdownSummary?.totalNetBankFmt ?? p.terminTagihFmt}</strong>
                                                  </div>
                                                </div>
                                              </div>
                                            </>
                                          ) : (
                                            <div className="p-6 rounded-xl border border-dashed border-border bg-surface-subtle/30 text-center text-xs text-muted-faint">
                                              Belum ada termin penagihan yang terbit untuk proyek ini.
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* TAB 2: DETAIL PENGELUARAN PROYEK */}
                                      {currentTab === "pengeluaran" && (
                                        <div className="space-y-3.5">
                                          {/* Mini summary strip kategori pengeluaran */}
                                          <div className="p-3 rounded-xl bg-surface-subtle/50 border border-border flex items-center justify-between gap-3 flex-wrap text-xs">
                                            <div className="flex items-center gap-2 font-semibold text-navy-text">
                                              <Wallet size={14} className="text-rose-600" />
                                              <span>Total Pengeluaran: <strong className="font-mono text-status-red text-sm">{p.expensesSummary?.totalPengeluaranFmt ?? "Rp 0"}</strong></span>
                                            </div>
                                            <div className="flex items-center gap-4 flex-wrap text-[11.5px]">
                                              <div className="flex items-center gap-1.5">
                                                <ShoppingBag size={12} className="text-blue-600" />
                                                <span className="text-muted-faint">Material:</span>
                                                <strong className="font-mono text-navy-text">{p.expensesSummary?.totalMaterialFmt ?? "Rp 0"}</strong>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                <Users size={12} className="text-amber-600" />
                                                <span className="text-muted-faint">Upah:</span>
                                                <strong className="font-mono text-navy-text">{p.expensesSummary?.totalGajiFmt ?? "Rp 0"}</strong>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                <Truck size={12} className="text-emerald-600" />
                                                <span className="text-muted-faint">Operasional:</span>
                                                <strong className="font-mono text-navy-text">{p.expensesSummary?.totalOperasionalFmt ?? "Rp 0"}</strong>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                <Receipt size={12} className="text-rose-600" />
                                                <span className="text-muted-faint">Pajak:</span>
                                                <strong className="font-mono text-navy-text">{p.expensesSummary?.totalPajakFmt ?? "Rp 0"}</strong>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                <FileText size={12} className="text-purple-600" />
                                                <span className="text-muted-faint">Lainnya:</span>
                                                <strong className="font-mono text-navy-text">{p.expensesSummary?.totalLainnyaFmt ?? "Rp 0"}</strong>
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
                                                      <th className="py-2.5 px-3.5 w-28">Tanggal</th>
                                                      <th className="py-2.5 px-3 w-28">No. Bukti</th>
                                                      <th className="py-2.5 px-3">Uraian Pengeluaran</th>
                                                      <th className="py-2.5 px-3 w-56">Kategori & Akun Beban</th>
                                                      <th className="py-2.5 px-3 w-36">Sumber Kas/Bank</th>
                                                      <th className="py-2.5 px-3.5 text-right w-36">Nominal</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-border bg-surface-card">
                                                    {p.expensesSummary.items.map((exp) => (
                                                      <tr key={exp.id} className="hover:bg-surface-hover/30 transition-colors">
                                                        <td className="py-2.5 px-3.5 text-muted-stronger whitespace-nowrap font-medium">
                                                          {exp.tanggalFmt}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-mono font-semibold text-navy-text whitespace-nowrap">
                                                          {exp.noBukti}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-navy-text font-medium max-w-xs break-words">
                                                          {exp.keterangan}
                                                        </td>
                                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border mr-1.5 ${
                                                            exp.kategoriBeban === "Gaji & Upah"
                                                              ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                                              : exp.kategoriBeban === "Bahan & Material"
                                                              ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                                              : exp.kategoriBeban === "Operasional & Transport"
                                                              ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                                              : exp.kategoriBeban === "Pajak Proyek"
                                                              ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
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
                                                        <td className="py-2.5 px-3.5 text-right font-mono font-bold tabular-nums text-status-red whitespace-nowrap text-sm">
                                                          {exp.nominalFmt}
                                                        </td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                  <tfoot className="bg-surface-subtle font-bold border-t border-border text-xs">
                                                    <tr>
                                                      <td colSpan={5} className="py-3 px-3.5 text-right text-muted-stronger font-bold">
                                                        Total Realisasi Pengeluaran:
                                                      </td>
                                                      <td className="py-3 px-3.5 text-right font-mono text-status-red tabular-nums text-sm font-bold">
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
                    Rincian Termin & Perpajakan ({selectedTerminForModal.termin.name.replace(/\s*\[.*?\]\s*$/, "")})
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
