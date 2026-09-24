"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { CoaLine } from "@/lib/laporan-keuangan";
import { getMetricValueFontSize } from "@/lib/dashboard-data";

interface NeracaViewProps {
  data: {
    aktivaLancar?: CoaLine[];
    aktivaTetap?: CoaLine[];
    totalAktivaLancar?: number;
    totalAktivaTetap?: number;
    totalAktivaLancarFmt?: string;
    totalAktivaTetapFmt?: string;
    totalAktiva?: number;
    totalAktivaFmt?: string;

    aset: CoaLine[];
    kewajiban: CoaLine[];
    modal: CoaLine[];
    totalAset: number;
    totalKewajiban: number;
    totalModal: number;
    totalPassiva: number;
    labaDitahan?: number;
    labaDitahanFmt?: string;
    totalLabaDitahan?: number;
    totalLabaDitahanFmt?: string;
    totalEkuitas?: number;
    totalEkuitasFmt?: string;
    totalModalDanLabaFmt?: string;
    labaBersih: number;
    labaBersihPositive: boolean;
    labaBersihFmt: string;
    neracaBalanced: boolean;
    totalAsetFmt: string;
    totalKewajibanFmt: string;
    totalModalFmt: string;
    totalPassivaFmt: string;
  };
  year: number;
  entityName: string;
}

export function NeracaView({ data, year, entityName }: NeracaViewProps) {
  const selisih = Math.abs(data.totalAset - data.totalPassiva);

  const aktivaLancar = data.aktivaLancar ?? data.aset.filter((i) => i.code !== "100" && i.code !== "1001");
  const aktivaTetap = data.aktivaTetap ?? data.aset.filter((i) => i.code === "100" || i.code === "1001");
  const totalLancarFmt = data.totalAktivaLancarFmt ?? data.totalAsetFmt;
  const totalTetapFmt = data.totalAktivaTetapFmt ?? "Rp 0";
  const totalEkuitasFmt = data.totalEkuitasFmt ?? data.totalModalDanLabaFmt ?? data.totalPassivaFmt;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header Laporan Resmi ── */}
      <div className="bg-surface-card border border-border-soft rounded-[22px] px-7 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-muted-faintest uppercase tracking-[0.16em]">
              {entityName}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-border-soft" />
            <span className="text-[11px] font-bold text-brand uppercase tracking-wider">Laporan Posisi Keuangan</span>
          </div>
          <h2 className="text-[22px] font-extrabold text-navy-text mt-1">Neraca (Balance Sheet)</h2>
          <p className="text-[13px] text-muted mt-1">
            Posisi Aset, Kewajiban, dan Ekuitas per 31 Desember {year} · Standar SAK
          </p>
        </div>
        <div className="shrink-0">
          <span
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12.5px] font-extrabold shadow-xs ${
              data.neracaBalanced
                ? "bg-green-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            {data.neracaBalanced ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {data.neracaBalanced ? "AKTIVA = PASIVA SEIMBANG" : "PERLU PENYESUAIAN"}
          </span>
        </div>
      </div>

      {/* ── Warning jika tidak seimbang ── */}
      {!data.neracaBalanced && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[16px] px-5 py-4">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="text-[13px] text-red-700 dark:text-red-400">
            <span className="font-extrabold">Neraca Belum Seimbang:</span> Terdapat perbedaan sebesar{" "}
            <span className="font-bold">Rp {Math.round(selisih).toLocaleString("id-ID")}</span> antara Total Aktiva (
            {data.totalAsetFmt}) dan Total Pasiva ({data.totalPassivaFmt}).
          </div>
        </div>
      )}

      {/* ── Top Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden">
          <div className="text-[12px] font-bold text-muted-faint uppercase tracking-wider mb-2 truncate">Total Aktiva</div>
          <div className={`${getMetricValueFontSize(data.totalAsetFmt)} text-blue-600 dark:text-blue-400 truncate`} title={data.totalAsetFmt}>
            {data.totalAsetFmt}
          </div>
          <div className="text-[11.5px] text-muted mt-2 truncate">Lancar: {totalLancarFmt} · Tetap: {totalTetapFmt}</div>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden">
          <div className="text-[12px] font-bold text-muted-faint uppercase tracking-wider mb-2 truncate">Total Kewajiban</div>
          <div className={`${getMetricValueFontSize(data.totalKewajibanFmt)} text-orange-600 dark:text-orange-400 truncate`} title={data.totalKewajibanFmt}>
            {data.totalKewajibanFmt}
          </div>
          <div className="text-[11.5px] text-muted mt-2 truncate">Kewajiban jangka pendek & panjang</div>
        </div>

        <div className="bg-surface-card rounded-[20px] border border-border-soft p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden">
          <div className="text-[12px] font-bold text-muted-faint uppercase tracking-wider mb-2 truncate">Total Ekuitas & Laba</div>
          <div className={`${getMetricValueFontSize(totalEkuitasFmt)} text-violet-600 dark:text-violet-400 truncate`} title={totalEkuitasFmt}>
            {totalEkuitasFmt}
          </div>
          <div className="text-[11.5px] text-muted mt-2 truncate">Modal, laba ditahan & tahun berjalan</div>
        </div>

        <div
          className={`rounded-[20px] border p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden ${
            data.neracaBalanced
              ? "bg-green-50/50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30"
              : "bg-red-50/50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30"
          }`}
        >
          <div className="text-[12px] font-bold uppercase tracking-wider mb-2 truncate">
            <span className={data.neracaBalanced ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
              Status Keseimbangan
            </span>
          </div>
          <div className={`text-[19px] sm:text-[20px] font-extrabold truncate ${data.neracaBalanced ? "text-status-green" : "text-status-red"}`}>
            {data.neracaBalanced ? "100% Balanced" : "Selisih Saldo"}
          </div>
          <div className="text-[11.5px] text-muted mt-2 truncate">
            {data.neracaBalanced ? "Aktiva = Pasiva Seimbang" : `Perbedaan Rp ${Math.round(selisih).toLocaleString("id-ID")}`}
          </div>
        </div>
      </div>

      {/* ── Layout 2 Kolom: Aktiva vs Pasiva ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── KOLOM KIRI: AKTIVA ── */}
        <div className="flex flex-col gap-5">
          {/* I. Aktiva Lancar */}
          <div className="bg-surface-card rounded-[22px] border border-border-soft shadow-xs overflow-hidden">
            <div className="px-6 py-3.5 border-b border-blue-100 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-5 rounded-full bg-blue-500" />
                <span className="text-[12.5px] font-extrabold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                  I. Aktiva Lancar
                </span>
              </div>
              <span className="text-[11px] font-bold text-muted-faint">{aktivaLancar.length} Akun</span>
            </div>

            <div className="divide-y divide-surface-subtle">
              {aktivaLancar.length === 0 ? (
                <p className="py-4 px-6 text-[12.5px] text-muted-faint italic">Tidak ada akun aktiva lancar.</p>
              ) : (
                aktivaLancar.map((item) => (
                  <div
                    key={item.code}
                    className="px-6 py-3 flex items-baseline justify-between hover:bg-surface-hover/30 transition-colors"
                  >
                    <div className="flex items-baseline gap-2 min-w-0">
                      <code className="text-[11px] font-mono text-muted-faint shrink-0">[{item.code}]</code>
                      <span className="text-[13px] font-semibold text-navy-text truncate">{item.name}</span>
                      {item.isContra && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                          Kontra
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[13px] font-bold tabular-nums shrink-0 whitespace-nowrap ${
                        item.isContra ? "text-status-amber" : "text-navy-text"
                      }`}
                    >
                      {item.saldoFmt}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 bg-blue-50/40 dark:bg-blue-500/10 border-t border-blue-100 dark:border-blue-500/20 flex items-center justify-between">
              <span className="text-[12.5px] font-bold text-blue-950 dark:text-blue-300">Total Aktiva Lancar</span>
              <span className="text-[13.5px] font-extrabold text-blue-700 dark:text-blue-400 tabular-nums">
                {totalLancarFmt}
              </span>
            </div>
          </div>

          {/* II. Aktiva Tetap */}
          <div className="bg-surface-card rounded-[22px] border border-border-soft shadow-xs overflow-hidden">
            <div className="px-6 py-3.5 border-b border-cyan-100 dark:border-cyan-500/20 bg-cyan-50/50 dark:bg-cyan-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-5 rounded-full bg-cyan-600" />
                <span className="text-[12.5px] font-extrabold text-cyan-900 dark:text-cyan-300 uppercase tracking-wider">
                  II. Aktiva Tetap
                </span>
              </div>
              <span className="text-[11px] font-bold text-muted-faint">{aktivaTetap.length} Akun</span>
            </div>

            <div className="divide-y divide-surface-subtle">
              {aktivaTetap.length === 0 ? (
                <p className="py-4 px-6 text-[12.5px] text-muted-faint italic">Tidak ada akun aktiva tetap.</p>
              ) : (
                aktivaTetap.map((item) => (
                  <div
                    key={item.code}
                    className="px-6 py-3 flex items-baseline justify-between hover:bg-surface-hover/30 transition-colors"
                  >
                    <div className="flex items-baseline gap-2 min-w-0">
                      <code className="text-[11px] font-mono text-muted-faint shrink-0">[{item.code}]</code>
                      <span className="text-[13px] font-semibold text-navy-text truncate">{item.name}</span>
                      {item.isContra && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                          Pengurang
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[13px] font-bold tabular-nums shrink-0 whitespace-nowrap ${
                        item.isContra ? "text-status-amber" : "text-navy-text"
                      }`}
                    >
                      {item.saldoFmt}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 bg-cyan-50/40 dark:bg-cyan-500/10 border-t border-cyan-100 dark:border-cyan-500/20 flex items-center justify-between">
              <span className="text-[12.5px] font-bold text-cyan-950 dark:text-cyan-300">Total Aktiva Tetap (Net)</span>
              <span className="text-[13.5px] font-extrabold text-cyan-700 dark:text-cyan-400 tabular-nums whitespace-nowrap">
                {totalTetapFmt}
              </span>
            </div>
          </div>

          {/* Grand Total Aktiva */}
          <div className="bg-surface-card rounded-[22px] border-2 border-blue-200 dark:border-blue-500/30 px-6 py-4 flex items-center justify-between shadow-xs bg-blue-50/60 dark:bg-blue-500/10">
            <div>
              <span className="text-[14px] font-extrabold text-navy-text uppercase">Total Aktiva</span>
              <p className="text-[11px] text-muted">Aktiva Lancar + Aktiva Tetap</p>
            </div>
            <span className="text-[18px] font-black text-blue-700 dark:text-blue-400 tabular-nums whitespace-nowrap">
              {data.totalAsetFmt}
            </span>
          </div>
        </div>

        {/* ── KOLOM KANAN: PASIVA (KEWAJIBAN & EKUITAS) ── */}
        <div className="flex flex-col gap-5">
          {/* I. Kewajiban */}
          <div className="bg-surface-card rounded-[22px] border border-border-soft shadow-xs overflow-hidden">
            <div className="px-6 py-3.5 border-b border-orange-100 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-5 rounded-full bg-orange-500" />
                <span className="text-[12.5px] font-extrabold text-orange-900 dark:text-orange-300 uppercase tracking-wider">
                  I. Kewajiban (Liabilitas)
                </span>
              </div>
              <span className="text-[11px] font-bold text-muted-faint">{data.kewajiban.length} Akun</span>
            </div>

            <div className="divide-y divide-surface-subtle">
              {data.kewajiban.length === 0 ? (
                <p className="py-4 px-6 text-[12.5px] text-muted-faint italic">Tidak ada kewajiban tercatat.</p>
              ) : (
                data.kewajiban.map((item) => (
                  <div key={item.code} className="px-6 py-3 flex items-baseline justify-between hover:bg-surface-hover/30 transition-colors">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <code className="text-[11px] font-mono text-muted-faint shrink-0">[{item.code}]</code>
                      <span className="text-[13px] font-semibold text-navy-text truncate">{item.name}</span>
                    </div>
                    <span className="text-[13px] font-bold text-navy-text tabular-nums shrink-0 whitespace-nowrap">
                      {item.saldoFmt}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 bg-orange-50/40 dark:bg-orange-500/10 border-t border-orange-100 dark:border-orange-500/20 flex items-center justify-between">
              <span className="text-[12.5px] font-bold text-orange-950 dark:text-orange-300">Total Kewajiban</span>
              <span className="text-[13.5px] font-extrabold text-orange-700 dark:text-orange-400 tabular-nums whitespace-nowrap">
                {data.totalKewajibanFmt}
              </span>
            </div>
          </div>

          {/* II. Modal & Ekuitas */}
          <div className="bg-surface-card rounded-[22px] border border-border-soft shadow-xs overflow-hidden">
            <div className="px-6 py-3.5 border-b border-violet-100 dark:border-violet-500/20 bg-violet-50/50 dark:bg-violet-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-5 rounded-full bg-violet-500" />
                <span className="text-[12.5px] font-extrabold text-violet-900 dark:text-violet-300 uppercase tracking-wider">
                  II. Modal & Ekuitas
                </span>
              </div>
              <span className="text-[11px] font-bold text-muted-faint">{data.modal.length + 2} Akun</span>
            </div>

            <div className="divide-y divide-surface-subtle">
              {data.modal.map((item) => (
                <div key={item.code} className="px-6 py-3 flex items-baseline justify-between hover:bg-surface-hover/30 transition-colors">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <code className="text-[11px] font-mono text-muted-faint shrink-0">[{item.code}]</code>
                    <span className="text-[13px] font-semibold text-navy-text truncate">{item.name}</span>
                  </div>
                  <span className="text-[13px] font-bold text-navy-text tabular-nums shrink-0 whitespace-nowrap">
                    {item.saldoFmt}
                  </span>
                </div>
              ))}

              {/* Laba Ditahan (Akun 310) */}
              <div className="px-6 py-3 flex items-baseline justify-between bg-violet-50/30 dark:bg-violet-500/5">
                <div className="flex items-baseline gap-2 min-w-0">
                  <code className="text-[11px] font-mono text-muted-faint shrink-0">[310]</code>
                  <span className="text-[13px] font-semibold text-navy-text">Laba Ditahan</span>
                </div>
                <span className="text-[13px] font-bold text-navy-text tabular-nums shrink-0 whitespace-nowrap">
                  {data.labaDitahanFmt ?? "Rp 0"}
                </span>
              </div>

              {/* Laba Tahun Berjalan */}
              <div className="px-6 py-3 flex items-baseline justify-between bg-green-50/40 dark:bg-green-500/10">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[11px] font-mono font-bold text-status-green shrink-0">[LABA]</span>
                  <span className="text-[13px] font-bold text-navy-text">Laba Tahun Berjalan {year}</span>
                </div>
                <span
                  className={`text-[13px] font-bold tabular-nums shrink-0 whitespace-nowrap ${
                    data.labaBersihPositive ? "text-status-green" : "text-status-red"
                  }`}
                >
                  {data.labaBersihPositive ? "" : "–"}
                  {data.labaBersihFmt}
                </span>
              </div>
            </div>

            <div className="px-6 py-3 bg-violet-50/40 dark:bg-violet-500/10 border-t border-violet-100 dark:border-violet-500/20 flex items-center justify-between">
              <span className="text-[12.5px] font-bold text-violet-950 dark:text-violet-300">Total Modal & Laba</span>
              <span className="text-[13.5px] font-extrabold text-violet-700 dark:text-violet-400 tabular-nums whitespace-nowrap">
                {totalEkuitasFmt}
              </span>
            </div>
          </div>

          {/* Grand Total Pasiva */}
          <div className="bg-surface-card rounded-[22px] border-2 border-border-soft px-6 py-4 flex items-center justify-between shadow-xs bg-surface-subtle/40">
            <div>
              <span className="text-[14px] font-extrabold text-navy-text uppercase">Total Pasiva</span>
              <p className="text-[11px] text-muted">Kewajiban + Modal + Laba Ditahan</p>
            </div>
            <span
              className={`text-[18px] font-black tabular-nums whitespace-nowrap ${
                data.neracaBalanced ? "text-navy-text" : "text-status-red"
              }`}
            >
              {data.totalPassivaFmt}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
