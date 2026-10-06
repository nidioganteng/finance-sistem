import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, Building2 } from "lucide-react";
import type { OverdueProjectAlert } from "@/lib/dashboard-data";

export function TerminWaspadaAlert({
  projects,
}: {
  projects: OverdueProjectAlert[];
}) {
  if (!projects || projects.length === 0) return null;

  return (
    <div className="rounded-[20px] border border-amber-300 dark:border-amber-800/60 bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-amber-50/90 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-amber-950/30 p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header Alert */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-navy-text">
                Termin Perlu Diwaspadai
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200/80 dark:bg-amber-800/60 text-amber-950 dark:text-amber-100 border border-amber-300 dark:border-amber-700">
                {projects.length} Proyek Lewat Batas Kontrak
              </span>
            </div>
            <p className="text-xs text-muted-stronger mt-0.5">
              Proyek aktif yang telah melewati batas tanggal kontrak, namun pencairan termin masih di bawah 80%.
            </p>
          </div>
        </div>
      </div>

      {/* Tabel / Daftar Proyek Overdue */}
      <div className="rounded-xl border border-amber-200/80 dark:border-amber-800/40 bg-surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-amber-100/50 dark:bg-amber-950/40 border-b border-amber-200/70 dark:border-amber-800/40 text-muted-stronger font-bold">
              <tr>
                <th className="py-2.5 px-3.5">Entitas</th>
                <th className="py-2.5 px-3">Proyek</th>
                <th className="py-2.5 px-3">Batas Kontrak</th>
                <th className="py-2.5 px-3 text-right">Nilai Kontrak</th>
                <th className="py-2.5 px-3 text-center">Progres Termin</th>
                <th className="py-2.5 px-3 text-right">Sisa Belum Cair</th>
                <th className="py-2.5 px-3.5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface-card">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors">
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <Building2 size={11} />
                      {p.entityName}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-navy-text">{p.code}</div>
                    <div className="text-[11px] text-muted-faint max-w-xs truncate">{p.name}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="font-medium text-navy-text flex items-center gap-1">
                      <Clock size={12} className="text-rose-500" />
                      <span>{p.deadlineFmt}</span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                      Lewat {p.daysOverdue} hari
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-navy-text whitespace-nowrap">
                    {p.contractValueFmt}
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: `${Math.min(p.maxPercentage, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                        {p.maxPercentage}%
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-faint mt-0.5">
                      Cair: {p.terminTagihFmt}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-status-red whitespace-nowrap text-sm">
                    {p.sisaPiutangFmt}
                  </td>
                  <td className="py-3 px-3.5 text-right whitespace-nowrap">
                    <Link
                      href={`/piutang?entity=${p.entityKey}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy text-white text-[11px] font-semibold hover:bg-navy-light transition-colors shadow-2xs"
                    >
                      Kontrol Termin <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
