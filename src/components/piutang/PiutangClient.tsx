"use client";

import { useState, useTransition } from "react";
import { TerminStatus } from "@prisma/client";
import { auditTermin, updateTerminStatus } from "@/lib/actions/piutang";
import { CheckCircle } from "lucide-react";

type TerminItem = {
  id: string;
  name: string;
  percentage: number;
  status: TerminStatus;
  auditedAt: string | null;
  auditedByName: string | null;
  projectCode: string;
  projectName: string;
  contractValueFmt: string;
};

type DockItem = {
  id: string;
  nama: string;
  totalFmt: string;
  status: string;
  createdAt: string;
};

const STATUS_BADGE: Record<TerminStatus, string> = {
  ON_TRACK: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  AT_RISK: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  NEEDS_AUDIT: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
};
const STATUS_LABEL: Record<TerminStatus, string> = {
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  NEEDS_AUDIT: "Perlu Audit",
};
const DOCK_STATUS_LABEL: Record<string, string> = {
  MENUNGGU_ALOKASI: "Menunggu Alokasi",
  DI_LOADING_DOCK: "Di Loading Dock",
  DIALOKASI: "Dialokasi",
};

export function PiutangClient({
  terminList,
  loadingDockList,
  userRole,
  isUmumEntity,
}: {
  terminList: TerminItem[];
  loadingDockList: DockItem[];
  userRole: string;
  isUmumEntity: boolean;
}) {
  const [tab, setTab] = useState<"termin" | "dock">("termin");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isManajer = userRole === "MANAJER_KEUANGAN" || userRole === "SUPER_ADMIN";

  function handleAudit(id: string) {
    startTransition(async () => {
      try {
        await auditTermin(id);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handleStatusChange(id: string, status: TerminStatus) {
    startTransition(async () => {
      await updateTerminStatus(id, status);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-status-red text-sm">{error}</div>
      )}

      <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-xl w-fit">
        <button
          onClick={() => setTab("termin")}
          className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-colors ${tab === "termin" ? "bg-navy text-white" : "text-muted-stronger hover:bg-surface-hover"}`}
        >
          Daftar Termin
        </button>
        {isUmumEntity && (
          <button
            onClick={() => setTab("dock")}
            className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-colors ${tab === "dock" ? "bg-navy text-white" : "text-muted-stronger hover:bg-surface-hover"}`}
          >
            Loading Dock
          </button>
        )}
      </div>

      {tab === "termin" && (
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-hover text-left">
                <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Proyek</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Termin</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Progress</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Status</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Diaudit</th>
                {isManajer && (
                  <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase text-right">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody>
              {terminList.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-muted">
                    Belum ada data termin untuk entitas ini.
                  </td>
                </tr>
              )}
              {terminList.map((t) => (
                <tr key={t.id} className="border-b border-surface-subtle hover:bg-surface-hover/30">
                  <td className="py-3 px-6">
                    <div className="font-semibold text-navy-text text-[13px]">{t.projectCode}</div>
                    <div className="text-[12px] text-muted">{t.projectName}</div>
                    <div className="text-[11.5px] text-muted-faint">{t.contractValueFmt}</div>
                  </td>
                  <td className="py-3 px-3 text-[13px] text-muted-stronger">{t.name}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand rounded-full"
                          style={{ width: `${Math.min(t.percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-[12.5px] font-semibold text-muted-stronger">{t.percentage}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${STATUS_BADGE[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[12px] text-muted">
                    {t.auditedAt ? (
                      <>
                        <div>{t.auditedAt}</div>
                        <div className="text-muted-faint">{t.auditedByName}</div>
                      </>
                    ) : (
                      <span className="text-muted-faint">Belum diaudit</span>
                    )}
                  </td>
                  {isManajer && (
                    <td className="py-3 px-6 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {t.status !== "ON_TRACK" && (
                          <button
                            onClick={() => handleAudit(t.id)}
                            disabled={isPending}
                            className="px-3 py-1.5 rounded-lg bg-navy text-white text-[12px] font-semibold flex items-center gap-1"
                          >
                            <CheckCircle size={12} /> Audit
                          </button>
                        )}
                        <select
                          value={t.status}
                          onChange={(e) => handleStatusChange(t.id, e.target.value as TerminStatus)}
                          disabled={isPending}
                          className="px-2 py-1.5 rounded-lg border border-border text-[12px] bg-surface-card"
                        >
                          <option value="ON_TRACK">On Track</option>
                          <option value="AT_RISK">At Risk</option>
                          <option value="NEEDS_AUDIT">Perlu Audit</option>
                        </select>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "dock" && (
        <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-hover text-left">
                <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Nama</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Total</th>
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
                  <td className="py-3 px-3 text-[13px] tabular-nums">{d.totalFmt}</td>
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
