"use client";

import { useState, useTransition } from "react";
import { TerminStatus } from "@prisma/client";
import { auditTermin, updateTerminStatus, cancelProject, completeProject, createPelunasan, type CreatePelunasanInput } from "@/lib/actions/piutang";
import { generateNoBukti } from "@/lib/actions/kas";
import { CheckCircle, ChevronDown, ChevronRight, Ban, CheckSquare, ArrowDownCircle, ArrowUpCircle, X } from "lucide-react";
import { getMetricValueFontSize } from "@/lib/dashboard-data";

type TerminItem = {
  id: string;
  name: string;
  nominalFmt: string;
  status: TerminStatus;
  auditedAt: string | null;
  auditedByName: string | null;
};

type ProjectItem = {
  id: string;
  code: string;
  name: string;
  contractValue: number;
  contractValueFmt: string;
  deadlineFmt: string;
  isOverdue: boolean;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
  maxPercentage: number;
  terminTagih: number;
  terminTagihFmt: string;
  sisaTagih: number;
  sisaTagihFmt: string;
  termin: TerminItem[];
};

type Summary = {
  totalKontrak: number;
  totalKontrakFmt: string;
  totalTerminTagih: number;
  totalTerminTagihFmt: string;
  sisaPiutang: number;
  sisaPiutangFmt: string;
  jumlahProyek: number;
};

type DockItem = {
  id: string;
  nama: string;
  totalFmt: string;
  status: string;
  createdAt: string;
};

type InterEntityBalance = {
  type: "piutang" | "hutang";
  coaCode: string;
  coaId: string;
  counterpartyEntityKey: string;
  counterpartyEntityName: string;
  netAmount: number;
  netAmountFmt: string;
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

type PelunasanModalState = {
  balance: InterEntityBalance;
} | null;

function formatInputNominal(n: number): string {
  return Math.round(n).toString();
}

export function PiutangClient({
  projectList,
  summary,
  loadingDockList,
  userRole,
  isUmumEntity,
  interEntityBalances,
  currentEntityKey,
}: {
  projectList: ProjectItem[];
  summary: Summary;
  loadingDockList: DockItem[];
  userRole: string;
  isUmumEntity: boolean;
  interEntityBalances: InterEntityBalance[];
  currentEntityKey: string;
}) {
  const [tab, setTab] = useState<"termin" | "dock">("termin");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pelunasanModal, setPelunasanModal] = useState<PelunasanModalState>(null);
  const [pelunasanForm, setPelunasanForm] = useState({
    tanggal: new Date().toISOString().slice(0, 10),
    noBukti: "",
    keterangan: "",
    nominal: "",
    jenisKasSumber: "kasKecil" as "kasKecil" | "kasBesar",
    jenisKasTujuan: "kasKecil" as "kasKecil" | "kasBesar",
  });
  const [pelunasanError, setPelunasanError] = useState<string | null>(null);
  const [pelunasanPending, startPelunasanTransition] = useTransition();

  const isManajer = userRole === "MANAJER_KEUANGAN" || userRole === "STAF_KEUANGAN";

  function openPelunasanModal(balance: InterEntityBalance) {
    const today = new Date().toISOString().slice(0, 10);
    setPelunasanModal({ balance });
    setPelunasanForm({
      tanggal: today,
      noBukti: "",
      keterangan: `Pelunasan ${balance.type === "piutang" ? "piutang dari" : "hutang ke"} ${balance.counterpartyEntityName}`,
      nominal: formatInputNominal(balance.netAmount),
      jenisKasSumber: "kasKecil",
      jenisKasTujuan: "kasKecil",
    });
    setPelunasanError(null);
    generateNoBukti(currentEntityKey, today).then((nb) =>
      setPelunasanForm((f) => ({ ...f, noBukti: f.noBukti || nb }))
    ).catch(() => {});
  }

  function closePelunasanModal() {
    setPelunasanModal(null);
    setPelunasanError(null);
  }

  function handlePelunasanSubmit() {
    if (!pelunasanModal) return;
    const nominal = parseFloat(pelunasanForm.nominal.replace(/[^0-9.]/g, ""));
    if (isNaN(nominal) || nominal <= 0) {
      setPelunasanError("Nominal tidak valid.");
      return;
    }
    const payload: CreatePelunasanInput = {
      currentEntityKey,
      balanceType: pelunasanModal.balance.type,
      counterpartyEntityKey: pelunasanModal.balance.counterpartyEntityKey,
      tanggal: pelunasanForm.tanggal,
      noBukti: pelunasanForm.noBukti.trim(),
      keterangan: pelunasanForm.keterangan.trim(),
      nominal,
      jenisKasSumber: pelunasanForm.jenisKasSumber,
      jenisKasTujuan: pelunasanModal.balance.type === "piutang" ? pelunasanForm.jenisKasTujuan : undefined,
    };
    startPelunasanTransition(async () => {
      const result = await createPelunasan(payload);
      if (result.error) {
        setPelunasanError(result.error);
      } else {
        closePelunasanModal();
      }
    });
  }

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
      <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-xl w-fit">
        <button
          onClick={() => setTab("termin")}
          className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-colors ${
            tab === "termin" ? "bg-navy text-white" : "text-muted-stronger hover:bg-surface-hover"
          }`}
        >
          Daftar Termin
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
                            <div className="flex items-center gap-1.5">
                              <div className="font-bold text-navy-text text-[13px]">{p.code}</div>
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
                          <td className="py-3 px-3 text-right tabular-nums text-[13px] font-semibold text-status-green whitespace-nowrap">
                            {p.terminTagihFmt}
                          </td>
                          <td className="py-3 px-3">
                            {(p.status === "CANCELLED" || p.status === "COMPLETED") ? (
                              <span className="text-[12px] text-muted-faint">
                                {p.status === "COMPLETED" ? "Proyek selesai" : "Proyek dibatalkan"}
                              </span>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <div className="w-28 h-2 bg-surface-hover rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        p.maxPercentage >= 80
                                          ? "bg-status-green"
                                          : p.maxPercentage >= 50
                                          ? "bg-brand"
                                          : "bg-orange-400"
                                      }`}
                                      style={{ width: `${Math.min(p.maxPercentage, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[12.5px] font-bold text-muted-stronger">
                                    {p.maxPercentage}%
                                  </span>
                                </div>
                                <div className={`text-[11px] mt-1 ${p.isOverdue ? "text-status-red font-semibold" : "text-muted-faint"}`}>
                                  Batas kontrak: {p.deadlineFmt}{p.isOverdue ? " · Lewat tempo" : ""}
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

                        {/* Baris termin (expandable) */}
                        {isExpanded &&
                          p.termin.map((t) => (
                            <tr
                              key={`termin-${t.id}`}
                              className="border-b border-surface-subtle hover:bg-surface-hover/20"
                            >
                              <td className="py-2.5 px-5" />
                              <td className="py-2.5 px-3 pl-8">
                                <div className="text-[12.5px] text-muted-stronger font-medium">
                                  {t.name}
                                </div>
                                {t.auditedAt && (
                                  <div className="text-[11px] text-muted-faint mt-0.5">
                                    Diaudit {t.auditedAt} · {t.auditedByName}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-[12px] font-semibold text-status-green whitespace-nowrap">
                                {t.nominalFmt}
                              </td>
                              <td className="py-2.5 px-3" />
                              <td className="py-2.5 px-3">
                                <span
                                  className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${STATUS_BADGE[t.status]}`}
                                >
                                  {STATUS_LABEL[t.status]}
                                </span>
                              </td>
                              <td className="py-2.5 px-5 text-right">
                                {isManajer && (
                                  <div className="flex items-center gap-2 justify-end">
                                    {t.status !== "ON_TRACK" && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAudit(t.id);
                                        }}
                                        disabled={isPending}
                                        className="px-2.5 py-1 rounded-lg bg-navy text-white text-[11.5px] font-semibold flex items-center gap-1"
                                      >
                                        <CheckCircle size={11} /> Audit
                                      </button>
                                    )}
                                    <select
                                      value={t.status}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) =>
                                        handleStatusChange(t.id, e.target.value as TerminStatus)
                                      }
                                      disabled={isPending}
                                      className="px-2 py-1 rounded-lg border border-border text-[11.5px] bg-surface-input text-navy-text"
                                    >
                                      <option value="ON_TRACK">On Track</option>
                                      <option value="AT_RISK">At Risk</option>
                                      <option value="NEEDS_AUDIT">Perlu Audit</option>
                                    </select>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
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

      {/* ── Saldo Piutang/Hutang Antar Entitas ── */}
      {interEntityBalances.length > 0 && (
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-hover">
            <div className="text-[13px] font-bold text-navy-text">Saldo Piutang / Hutang Antar Entitas</div>
            <div className="text-[12px] text-muted mt-0.5">Saldo bersih berdasarkan transaksi yang dicatat pada akun piutang/hutang antar perusahaan</div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-hover text-left">
                <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Jenis</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Pihak</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Kode COA</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">
                  Saldo Bersih
                </th>
                {isManajer && (
                  <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase text-right">
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {interEntityBalances.map((b) => (
                <tr
                  key={`${b.type}-${b.coaCode}`}
                  className="border-b border-surface-subtle hover:bg-surface-hover/30"
                >
                  <td className="py-3 px-6">
                    {b.type === "piutang" ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-status-green">
                        <ArrowDownCircle size={13} />
                        Piutang
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-status-red">
                        <ArrowUpCircle size={13} />
                        Hutang
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-[13px] font-semibold text-navy-text">
                    {b.counterpartyEntityName}
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-surface-hover text-muted-stronger">
                      {b.coaCode}
                    </span>
                  </td>
                  <td className={`py-3 px-3 text-right tabular-nums text-[13px] font-bold ${
                    b.type === "piutang" ? "text-status-green" : "text-status-red"
                  }`}>
                    {b.netAmountFmt}
                  </td>
                  {isManajer && (
                    <td className="py-3 px-6 text-right">
                      <button
                        onClick={() => openPelunasanModal(b)}
                        disabled={isPending || pelunasanPending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy text-white text-[11.5px] font-semibold hover:bg-navy/90 transition-colors"
                      >
                        Lunasi
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal Pelunasan ── */}
      {pelunasanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-card rounded-[20px] border border-border-soft shadow-xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft">
              <div>
                <div className="text-[14px] font-bold text-navy-text">
                  Catat Pelunasan {pelunasanModal.balance.type === "piutang" ? "Piutang" : "Hutang"}
                </div>
                <div className="text-[12px] text-muted mt-0.5">
                  {pelunasanModal.balance.type === "piutang" ? "Terima dari" : "Bayar ke"}{" "}
                  <span className="font-semibold text-navy-text">{pelunasanModal.balance.counterpartyEntityName}</span>
                  {" · "}COA {pelunasanModal.balance.coaCode}
                </div>
              </div>
              <button
                onClick={closePelunasanModal}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-faint"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form body */}
            <div className="px-6 py-5 flex flex-col gap-4">
              {pelunasanError && (
                <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-status-red text-[13px]">
                  {pelunasanError}
                </div>
              )}

              {/* Tanggal */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-muted-stronger">Tanggal</label>
                <input
                  type="date"
                  value={pelunasanForm.tanggal}
                  onChange={(e) => setPelunasanForm((f) => ({ ...f, tanggal: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-border bg-surface-input text-navy-text text-[13px]"
                />
              </div>

              {/* No. Bukti */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-muted-stronger">No. Bukti</label>
                <input
                  type="text"
                  placeholder="Mis. KC/09241"
                  value={pelunasanForm.noBukti}
                  onChange={(e) => setPelunasanForm((f) => ({ ...f, noBukti: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-border bg-surface-input text-navy-text text-[13px] placeholder:text-muted-faint"
                />
              </div>

              {/* Keterangan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-muted-stronger">Keterangan</label>
                <input
                  type="text"
                  value={pelunasanForm.keterangan}
                  onChange={(e) => setPelunasanForm((f) => ({ ...f, keterangan: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-border bg-surface-input text-navy-text text-[13px]"
                />
              </div>

              {/* Nominal */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-muted-stronger">
                  Nominal
                  <span className="ml-1.5 text-muted-faint font-normal">(pre-isi dari saldo bersih)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={pelunasanForm.nominal}
                  onChange={(e) => setPelunasanForm((f) => ({ ...f, nominal: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-border bg-surface-input text-navy-text text-[13px]"
                />
              </div>

              {/* Jenis Kas Sumber */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-muted-stronger">
                  {pelunasanModal.balance.type === "piutang" ? "Kas Penerima (entitas ini)" : "Kas Pembayar (entitas ini)"}
                </label>
                <select
                  value={pelunasanForm.jenisKasSumber}
                  onChange={(e) =>
                    setPelunasanForm((f) => ({ ...f, jenisKasSumber: e.target.value as "kasKecil" | "kasBesar" }))
                  }
                  className="px-3 py-2 rounded-xl border border-border bg-surface-input text-navy-text text-[13px]"
                >
                  <option value="kasKecil">Kas Kecil</option>
                  <option value="kasBesar">Kas Besar</option>
                </select>
              </div>

              {/* Jenis Kas Tujuan — hanya untuk pelunasan piutang */}
              {pelunasanModal.balance.type === "piutang" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-muted-stronger">
                    Kas Pembayar ({pelunasanModal.balance.counterpartyEntityName})
                  </label>
                  <select
                    value={pelunasanForm.jenisKasTujuan}
                    onChange={(e) =>
                      setPelunasanForm((f) => ({ ...f, jenisKasTujuan: e.target.value as "kasKecil" | "kasBesar" }))
                    }
                    className="px-3 py-2 rounded-xl border border-border bg-surface-input text-navy-text text-[13px]"
                  >
                    <option value="kasKecil">Kas Kecil</option>
                    <option value="kasBesar">Kas Besar</option>
                  </select>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-soft">
              <button
                onClick={closePelunasanModal}
                disabled={pelunasanPending}
                className="px-4 py-2 rounded-xl border border-border text-[13px] font-semibold text-muted-stronger hover:bg-surface-hover transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handlePelunasanSubmit}
                disabled={pelunasanPending}
                className="px-5 py-2 rounded-xl bg-navy text-white text-[13px] font-semibold hover:bg-navy/90 transition-colors disabled:opacity-60"
              >
                {pelunasanPending ? "Menyimpan..." : "Simpan Pelunasan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
