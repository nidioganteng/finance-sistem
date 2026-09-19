import { AlertTriangle } from "lucide-react";
import type { getLaporanPiutangData } from "@/lib/laporan-piutang";

type Data = Awaited<ReturnType<typeof getLaporanPiutangData>>;

export function PiutangView({ data }: { data: Data }) {
  const { summary, aktif, selesai } = data;

  return (
    <div className="flex flex-col gap-5">
      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface-card border border-border-soft rounded-[16px] p-5">
          <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5">Total Kontrak Aktif</div>
          <div className="text-[18px] font-extrabold text-navy-text tabular-nums">{summary.totalKontrakFmt}</div>
          <div className="text-[12px] text-muted mt-0.5">{summary.jumlahAktif} proyek</div>
        </div>
        <div className="bg-surface-card border border-border-soft rounded-[16px] p-5">
          <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5">Sudah Tertagih</div>
          <div className="text-[18px] font-extrabold text-status-green tabular-nums">{summary.totalTagihFmt}</div>
          <div className="text-[12px] text-muted mt-0.5">{summary.pctTagih}% dari kontrak</div>
        </div>
        <div className="bg-surface-card border border-border-soft rounded-[16px] p-5">
          <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5">Belum Tertagih</div>
          <div className="text-[18px] font-extrabold text-status-red tabular-nums">{summary.totalBelumTagihFmt}</div>
          <div className="text-[12px] text-muted mt-0.5">sisa piutang</div>
        </div>
        <div className="bg-surface-card border border-border-soft rounded-[16px] p-5">
          <div className="text-[11px] font-bold text-muted-faint uppercase mb-1.5">Lewat Tempo</div>
          <div className={`text-[18px] font-extrabold tabular-nums ${summary.jumlahOverdue > 0 ? "text-status-red" : "text-status-green"}`}>
            {summary.jumlahOverdue} proyek
          </div>
          <div className="text-[12px] text-muted mt-0.5">dari {summary.jumlahAktif} aktif</div>
        </div>
      </div>

      {summary.jumlahOverdue > 0 && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[14px] px-4 py-3.5">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-none" />
          <p className="text-[13px] text-red-700 dark:text-red-400">
            <span className="font-bold">{summary.jumlahOverdue} proyek lewat batas kontrak</span> dan belum mencapai 100% pembayaran. Segera tindak lanjuti.
          </p>
        </div>
      )}

      {/* Tabel proyek aktif */}
      <div className="bg-surface-card border border-border-soft rounded-[20px] overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-subtle">
          <h3 className="text-sm font-bold text-navy-text">Proyek Aktif</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-surface-hover text-left">
                <th className="py-3 px-5 text-[11px] font-bold text-muted-faint uppercase">Proyek</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Entitas</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Nilai Kontrak</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Tertagih</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Belum Tagih</th>
                <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Progress</th>
                <th className="py-3 px-5 text-[11px] font-bold text-muted-faint uppercase">Batas Kontrak</th>
              </tr>
            </thead>
            <tbody>
              {aktif.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-sm text-muted">Tidak ada proyek aktif.</td></tr>
              ) : aktif.map((p) => (
                <tr key={p.id} className={`border-b border-surface-subtle ${p.isOverdue ? "bg-red-50/30 dark:bg-red-500/5" : "hover:bg-surface-hover/30"}`}>
                  <td className="py-3 px-5">
                    <div className="font-bold text-navy-text text-[13px]">{p.code}</div>
                    <div className="text-[12px] text-muted-stronger">{p.name}</div>
                  </td>
                  <td className="py-3 px-3 text-[12.5px] text-muted">{p.entityName}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[13px] font-semibold text-navy-text">{p.contractValueFmt}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[13px] font-semibold text-status-green">{p.tertagihFmt}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[13px] font-semibold text-status-red">{p.belumTagihFmt}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-surface-hover rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.maxPct >= 80 ? "bg-status-green" : p.maxPct >= 50 ? "bg-brand" : "bg-orange-400"}`}
                          style={{ width: `${Math.min(p.maxPct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[12px] font-bold text-muted-stronger">{p.maxPct}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-5">
                    <div className={`text-[12.5px] font-semibold ${p.isOverdue ? "text-status-red" : "text-muted-stronger"}`}>
                      {p.deadlineFmt}
                    </div>
                    {p.isOverdue && (
                      <div className="text-[11px] text-status-red font-bold mt-0.5">Lewat tempo</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabel proyek selesai/dibatalkan */}
      {selesai.length > 0 && (
        <div className="bg-surface-card border border-border-soft rounded-[20px] overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-subtle">
            <h3 className="text-sm font-bold text-navy-text">Proyek Selesai / Dibatalkan</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-surface-hover text-left">
                  <th className="py-3 px-5 text-[11px] font-bold text-muted-faint uppercase">Proyek</th>
                  <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Entitas</th>
                  <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Nilai Kontrak</th>
                  <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Tertagih</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-muted-faint uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {selesai.map((p) => (
                  <tr key={p.id} className="border-b border-surface-subtle hover:bg-surface-hover/30">
                    <td className="py-3 px-5">
                      <div className="font-bold text-navy-text text-[13px]">{p.code}</div>
                      <div className="text-[12px] text-muted-stronger">{p.name}</div>
                    </td>
                    <td className="py-3 px-3 text-[12.5px] text-muted">{p.entityName}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-[13px] font-semibold text-navy-text">{p.contractValueFmt}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-[13px] font-semibold text-status-green">{p.tertagihFmt}</td>
                    <td className="py-3 px-5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        p.status === "COMPLETED"
                          ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                          : "bg-surface-hover text-muted-faint"
                      }`}>
                        {p.status === "COMPLETED" ? "Selesai" : "Dibatalkan"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
