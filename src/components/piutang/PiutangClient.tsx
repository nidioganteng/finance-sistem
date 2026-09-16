"use client";

import { useState, useTransition } from "react";
import { TerminStatus } from "@prisma/client";
import { auditTermin, updateTerminStatus, createProject, recordTerminPayment } from "@/lib/actions/piutang";
import { CheckCircle, ChevronDown, ChevronRight, Plus, Banknote } from "lucide-react";

type TerminItem = {
  id: string;
  name: string;
  percentage: number;
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
  entityId,
  projectList,
  summary,
  loadingDockList,
  userRole,
  isUmumEntity,
}: {
  entityId: string;
  projectList: ProjectItem[];
  summary: Summary;
  loadingDockList: DockItem[];
  userRole: string;
  isUmumEntity: boolean;
}) {
  const [tab, setTab] = useState<"termin" | "dock">("termin");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(projectList.map((p) => p.id))
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [showNewProject, setShowNewProject] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newContractValue, setNewContractValue] = useState("");

  const [terminFormFor, setTerminFormFor] = useState<string | null>(null);
  const [nominalMasuk, setNominalMasuk] = useState("");

  const isManajer = userRole === "MANAJER_KEUANGAN";
  // Proyek baru & catat uang masuk (termin) — Staf Keuangan ikut dikasih akses
  // karena mereka yang langsung input transaksi "uang masuk" via Kas/Bank Buku.
  const canManagePiutang = isManajer || userRole === "STAF_KEUANGAN";

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

  function handleCreateProject() {
    const contractValue = Number(newContractValue.replace(/[^0-9]/g, ""));
    startTransition(async () => {
      try {
        await createProject({ entityId, code: newCode, name: newName, contractValue });
        setShowNewProject(false);
        setNewCode("");
        setNewName("");
        setNewContractValue("");
      } catch (e: unknown) {
        setError((e as Error).message);
      }
    });
  }

  function handleRecordTermin(projectId: string) {
    const nominal = Number(nominalMasuk.replace(/[^0-9]/g, ""));
    startTransition(async () => {
      try {
        await recordTerminPayment({ projectId, nominalMasuk: nominal });
        setTerminFormFor(null);
        setNominalMasuk("");
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
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface-card rounded-[16px] border border-border-soft p-5">
              <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5">
                Total Nilai Kontrak Aktif
              </div>
              <div className="text-[20px] font-extrabold text-navy-text tabular-nums">
                {summary.totalKontrakFmt}
              </div>
              <div className="text-[12px] text-muted mt-0.5">{summary.jumlahProyek} proyek</div>
            </div>
            <div className="bg-surface-card rounded-[16px] border border-border-soft p-5">
              <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5">
                Total Termin Tertagih
              </div>
              <div className="text-[20px] font-extrabold text-status-green tabular-nums">
                {summary.totalTerminTagihFmt}
              </div>
              <div className="text-[12px] text-muted mt-0.5">
                {summary.totalKontrak > 0
                  ? `${Math.round((summary.totalTerminTagih / summary.totalKontrak) * 100)}% dari total kontrak`
                  : "—"}
              </div>
            </div>
            <div className="bg-surface-card rounded-[16px] border border-border-soft p-5">
              <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5">
                Sisa Piutang Belum Tertagih
              </div>
              <div className="text-[20px] font-extrabold text-status-red tabular-nums">
                {summary.sisaPiutangFmt}
              </div>
              <div className="text-[12px] text-muted mt-0.5">belum masuk kas</div>
            </div>
          </div>

          {/* Tambah proyek baru — cuma nilai kontrak, termin diisi belakangan tiap ada uang masuk */}
          {canManagePiutang && (
            <div className="bg-surface-card rounded-[16px] border border-border-soft p-4">
              {!showNewProject ? (
                <button
                  onClick={() => setShowNewProject(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-white text-[12.5px] font-semibold"
                >
                  <Plus size={13} /> Proyek Baru
                </button>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-muted-faint mb-1">Kode Proyek</label>
                    <input
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      placeholder="mis. GHR-099"
                      className="px-2.5 py-1.5 rounded-lg border border-border text-[13px] bg-surface-input text-navy-text w-36"
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-[11px] font-bold text-muted-faint mb-1">Nama Proyek</label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="mis. Gudang Distribusi Cikarang"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border text-[13px] bg-surface-input text-navy-text"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-muted-faint mb-1">Nilai Kontrak (Rp)</label>
                    <input
                      value={newContractValue}
                      onChange={(e) => setNewContractValue(e.target.value)}
                      placeholder="0"
                      inputMode="numeric"
                      className="px-2.5 py-1.5 rounded-lg border border-border text-[13px] bg-surface-input text-navy-text w-40"
                    />
                  </div>
                  <button
                    onClick={handleCreateProject}
                    disabled={isPending || !newCode.trim() || !newName.trim() || !newContractValue}
                    className="px-3 py-1.5 rounded-lg bg-navy text-white text-[12.5px] font-semibold disabled:opacity-50"
                  >
                    Simpan
                  </button>
                  <button
                    onClick={() => {
                      setShowNewProject(false);
                      setNewCode("");
                      setNewName("");
                      setNewContractValue("");
                    }}
                    disabled={isPending}
                    className="px-3 py-1.5 rounded-lg border border-border text-[12.5px] font-semibold text-muted-stronger"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>
          )}

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
                            <div className="font-bold text-navy-text text-[13px]">{p.code}</div>
                            <div className="text-[12px] text-muted-stronger">{p.name}</div>
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-[13px] font-semibold text-navy-text">
                            {p.contractValueFmt}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-[13px] font-semibold text-status-green">
                            {p.terminTagihFmt}
                          </td>
                          <td className="py-3 px-3">
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
                          </td>
                          <td className="py-3 px-5 text-right tabular-nums text-[13px] font-semibold text-status-red">
                            {p.sisaTagihFmt}
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
                              <td className="py-2.5 px-3 text-right tabular-nums text-[12px] text-muted">
                                {t.percentage}% dari kontrak
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

                        {/* Catat uang masuk — persentase termin baru dihitung otomatis dari akumulasi uang masuk / nilai kontrak */}
                        {isExpanded && canManagePiutang && (
                          <tr className="border-b border-surface-subtle bg-surface-subtle/20">
                            <td className="py-2.5 px-5" />
                            <td colSpan={5} className="py-2.5 px-3 pl-8">
                              {terminFormFor !== p.id ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTerminFormFor(p.id);
                                  }}
                                  className="flex items-center gap-1.5 text-[11.5px] font-semibold text-brand"
                                >
                                  <Banknote size={12} /> Catat Uang Masuk
                                </button>
                              ) : (
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <span className="text-[11.5px] text-muted-stronger">Rp</span>
                                  <input
                                    value={nominalMasuk}
                                    onChange={(e) => setNominalMasuk(e.target.value)}
                                    placeholder="0"
                                    inputMode="numeric"
                                    autoFocus
                                    className="px-2 py-1 rounded-lg border border-border text-[12.5px] bg-surface-input text-navy-text w-36"
                                  />
                                  <button
                                    onClick={() => handleRecordTermin(p.id)}
                                    disabled={isPending || !nominalMasuk}
                                    className="px-2.5 py-1 rounded-lg bg-navy text-white text-[11.5px] font-semibold disabled:opacity-50"
                                  >
                                    Simpan
                                  </button>
                                  <button
                                    onClick={() => {
                                      setTerminFormFor(null);
                                      setNominalMasuk("");
                                    }}
                                    disabled={isPending}
                                    className="px-2.5 py-1 rounded-lg border border-border text-[11.5px] font-semibold text-muted-stronger"
                                  >
                                    Batal
                                  </button>
                                  <span className="text-[11px] text-muted-faint">
                                    Persentase termin baru dihitung otomatis dari kontrak.
                                  </span>
                                </div>
                              )}
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
                  <td className="py-3 px-3 text-right tabular-nums text-[13px]">{d.totalFmt}</td>
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
    </div>
  );
}
