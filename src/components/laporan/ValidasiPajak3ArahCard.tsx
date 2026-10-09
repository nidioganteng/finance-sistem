"use client";

import { CheckCircle2, AlertTriangle, ShieldCheck, HelpCircle } from "lucide-react";
import type { ValidasiPajak3ArahResult } from "@/lib/validasi-pajak-3arah";

export function ValidasiPajak3ArahCard({
  data,
  entityName,
}: {
  data: ValidasiPajak3ArahResult;
  entityName: string;
}) {
  return (
    <div className="bg-surface-card rounded-[22px] border border-border-soft p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 pb-4 border-b border-border-soft">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted-faint uppercase tracking-wider">
                {entityName} • Tahun {data.year}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-border-soft" />
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Audit Kepatuhan Pajak & Omzet
              </span>
            </div>
            <h3 className="text-[17px] font-extrabold text-navy-text mt-0.5">
              Validasi Balance 3-Arah (Faktur vs Jurnal vs Laba Rugi)
            </h3>
            <p className="text-[12.5px] text-muted mt-0.5 leading-relaxed">
              Memastikan kepatuhan dan sinkronisasi mutlak antara nilai tercatat pada{" "}
              <strong>Laporan Pendapatan (E-Faktur)</strong>, <strong>Jurnal Umum</strong>, dan{" "}
              <strong>Laporan Laba Rugi</strong>.
            </p>
          </div>
        </div>

        <div className="shrink-0 self-start md:self-center">
          {data.allBalanced ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-emerald-500 text-white shadow-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>3-ARAH SEIMBANG (100% MATCH)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-rose-500 text-white shadow-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>TERDAPAT {data.jumlahSelisih} SELISIH LAPORAN</span>
            </span>
          )}
        </div>
      </div>

      {/* Tabel Perbandingan 3-Arah */}
      <div className="overflow-x-auto rounded-xl border border-border-soft">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-surface-subtle text-navy-text border-b border-border-soft font-semibold">
            <tr>
              <th className="p-3.5">Komponen Validasi</th>
              <th className="p-3.5 text-right bg-blue-50/40 dark:bg-blue-500/10 text-blue-900 dark:text-blue-300">
                1. Laporan Pendapatan (Faktur)
              </th>
              <th className="p-3.5 text-right bg-purple-50/40 dark:bg-purple-500/10 text-purple-900 dark:text-purple-300">
                2. Jurnal Umum (Akun Riil)
              </th>
              <th className="p-3.5 text-right bg-amber-50/40 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300">
                3. Laba Rugi (Komersial)
              </th>
              <th className="p-3.5 text-right">Selisih</th>
              <th className="p-3.5 text-center">Status Audit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft text-navy-text">
            {data.items.map((item) => (
              <tr
                key={item.key}
                className={`hover:bg-surface-hover/50 transition-colors ${
                  item.isBalance ? "" : "bg-rose-50/40 dark:bg-rose-500/10"
                }`}
              >
                <td className="p-3.5">
                  <div className="font-bold text-navy-text text-[13px]">{item.label}</div>
                  <div className="text-[11px] text-muted mt-0.5">{item.sublabel}</div>
                </td>
                <td className="p-3.5 text-right font-mono font-semibold bg-blue-50/20 dark:bg-blue-500/5 text-blue-950 dark:text-blue-200 text-[12.5px]">
                  {item.nilaiFakturFmt}
                </td>
                <td className="p-3.5 text-right font-mono font-semibold bg-purple-50/20 dark:bg-purple-500/5 text-purple-950 dark:text-purple-200 text-[12.5px]">
                  {item.nilaiJurnalFmt}
                </td>
                <td className="p-3.5 text-right font-mono font-semibold bg-amber-50/20 dark:bg-amber-500/5 text-amber-950 dark:text-amber-200 text-[12.5px]">
                  {item.nilaiLabaRugiFmt}
                </td>
                <td className="p-3.5 text-right font-mono">
                  <span
                    className={`font-black text-[13px] ${
                      item.isBalance ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {item.selisihFmt}
                  </span>
                </td>
                <td className="p-3.5 text-center">
                  {item.isBalance ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      SESUAI
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      SELISIH
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer catatan audit */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-subtle text-[11.5px] text-muted">
        <HelpCircle className="w-4 h-4 shrink-0 text-blue-600" />
        <span>
          Jika seluruh status bertuliskan <strong>SESUAI</strong>, data pencatatan akuntansi, faktur pajak, dan laporan laba rugi dijamin konsisten dan siap untuk proses audit fiskal tahunan.
        </span>
      </div>
    </div>
  );
}
