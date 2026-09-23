import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities, formatRupiah } from "@/lib/dashboard-data";
import { getLaporanKeuanganData } from "@/lib/laporan-keuangan";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { PageHeader } from "@/components/layout/PageHeader";
import { logActivity } from "@/lib/actions/log";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PrintButton } from "@/components/shared/PrintButton";
import { LaporanKeuanganTabs } from "@/components/laporan-keuangan/LaporanKeuanganTabs";
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { PageTransition } from "@/components/layout/PageTransition";

import { ReportVersionSwitcher, ReportVersion } from "@/components/shared/ReportVersionSwitcher";

export default async function LaporanKeuanganPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string; tab?: string; version?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  logActivity(session!.user.id, "Buka halaman Laporan Keuangan", "USER_ACTIVITY", { path: "/laporan-keuangan" });
  if (role === "SUPER_ADMIN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();
  const currentVersion: ReportVersion = (searchParams.version ?? "internal").toUpperCase() === "UMUM" ? "UMUM" : "INTERNAL";
  const tab = searchParams.tab ?? "neraca";

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const data = await getLaporanKeuanganData(selectedEntity.id, currentYear, currentVersion);
  const hasData = data.pendapatan.length > 0 || data.beban.length > 0 || data.aset.length > 0;

  return (
    <PageTransition>
      <PageHeader
        title={`Laporan Keuangan – ${selectedEntity.name}`}
        subtitle={`Ringkasan laporan keuangan — Periode ${currentYear} (${currentVersion === "UMUM" ? "Versi Umum" : "Versi Internal"})`}
        rightSlot={
          <>
            <ReportVersionSwitcher currentVersion={currentVersion} />
            <PrintButton />
            <YearSelect currentYear={currentYear} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedKey}
            />
          </>
        }
      />

      <div className="print:hidden"><LaporanKeuanganTabs currentTab={tab} /></div>

      {!hasData && (
        <div className="bg-surface-card rounded-[20px] border border-border-soft py-16 text-center">
          <div className="text-sm font-semibold text-muted-stronger mb-1">Tidak ada data</div>
          <p className="text-[13px] text-muted">Belum ada transaksi dengan akun COA untuk periode ini.</p>
        </div>
      )}

      {hasData && tab === "neraca" && <NeracaTab data={data} year={currentYear} entityName={selectedEntity.name} />}
      {hasData && tab === "laba-rugi" && <LabaRugiTab data={data} year={currentYear} entityName={selectedEntity.name} />}
      {hasData && tab === "arus-kas" && <ArusKasTab data={data} year={currentYear} entityName={selectedEntity.name} />}
    </PageTransition>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────

function ReportHeader({
  entityName,
  title,
  period,
  note,
  badge,
}: {
  entityName: string;
  title: string;
  period: string;
  note: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="bg-surface-card border border-border-soft rounded-[20px] px-6 py-5 flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold text-muted-faintest uppercase tracking-[0.15em] mb-1.5">{entityName}</p>
        <h2 className="text-[17px] font-extrabold text-navy-text">{title}</h2>
        <p className="text-[12.5px] text-muted mt-1">{period}</p>
        <p className="text-[11px] text-muted-faintest mt-0.5">{note}</p>
      </div>
      {badge && <div className="shrink-0 mt-1">{badge}</div>}
    </div>
  );
}

function SectionHeader({ color, label }: { color: string; label: string }) {
  const map: Record<string, { bar: string; bg: string; border: string; text: string }> = {
    blue:   { bar: "bg-blue-500",   bg: "bg-blue-50/60 dark:bg-blue-500/10",   border: "border-blue-100 dark:border-blue-500/20",   text: "text-blue-700 dark:text-blue-400" },
    green:  { bar: "bg-green-500",  bg: "bg-green-50/60 dark:bg-green-500/10",  border: "border-green-100 dark:border-green-500/20",  text: "text-green-700 dark:text-green-400" },
    red:    { bar: "bg-red-500",    bg: "bg-red-50/60 dark:bg-red-500/10",    border: "border-red-100 dark:border-red-500/20",    text: "text-red-700 dark:text-red-400" },
    orange: { bar: "bg-orange-500", bg: "bg-orange-50/60 dark:bg-orange-500/10", border: "border-orange-100 dark:border-orange-500/20", text: "text-orange-700 dark:text-orange-400" },
    violet: { bar: "bg-violet-500", bg: "bg-violet-50/60 dark:bg-violet-500/10", border: "border-violet-100 dark:border-violet-500/20", text: "text-violet-700 dark:text-violet-400" },
    amber:  { bar: "bg-amber-500",  bg: "bg-amber-50/60 dark:bg-amber-500/10",  border: "border-amber-100 dark:border-amber-500/20",  text: "text-amber-700 dark:text-amber-400" },
  };
  const c = map[color] ?? map.blue;
  return (
    <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b ${c.bg} ${c.border}`}>
      <div className={`w-1 h-5 rounded-full shrink-0 ${c.bar}`} />
      <span className={`text-[10.5px] font-extrabold uppercase tracking-widest ${c.text}`}>{label}</span>
    </div>
  );
}

function ItemRow({ code, name, amount, amountClass = "text-navy-text" }: {
  code: string; name: string; amount: string; amountClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-2.5 px-5 gap-4">
      <div className="flex items-baseline gap-2 min-w-0">
        <code className="text-[10.5px] text-muted-faintest font-mono shrink-0">{code}</code>
        <span className="text-[13px] text-muted-stronger">{name}</span>
      </div>
      <span className={`tabular-nums text-[13px] font-semibold shrink-0 ${amountClass}`}>{amount}</span>
    </div>
  );
}

function TotalRow({ label, amount, amountClass, bgClass, borderClass }: {
  label: string; amount: string; amountClass: string; bgClass: string; borderClass: string;
}) {
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 border-t-2 ${bgClass} ${borderClass}`}>
      <span className="font-extrabold text-[13px] text-navy-text">{label}</span>
      <span className={`tabular-nums font-extrabold text-[14px] shrink-0 ${amountClass}`}>{amount}</span>
    </div>
  );
}

function SubtotalRow({ label, amount, amountClass = "text-navy-text", bgClass = "bg-surface-subtle/60", borderClass = "border-surface-hover" }: {
  label: string; amount: string; amountClass?: string; bgClass?: string; borderClass?: string;
}) {
  return (
    <div className={`flex items-center justify-between px-5 py-3 border-t ${bgClass} ${borderClass}`}>
      <span className="font-bold text-[13px] text-muted-stronger">{label}</span>
      <span className={`tabular-nums font-bold text-[13px] shrink-0 ${amountClass}`}>{amount}</span>
    </div>
  );
}

// ── Tab: Neraca ──────────────────────────────────────────────────────
function NeracaTab({
  data,
  year,
  entityName,
}: {
  data: Awaited<ReturnType<typeof getLaporanKeuanganData>>;
  year: number;
  entityName: string;
}) {
  const balancedBadge = (
    <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${
      data.neracaBalanced
        ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
        : "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
    }`}>
      {data.neracaBalanced ? "✓ Seimbang" : "✗ Tidak Seimbang"}
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        entityName={entityName}
        title="Neraca"
        period={`Per 31 Desember ${year}`}
        note="Dalam Rupiah"
        badge={balancedBadge}
      />

      {!data.neracaBalanced && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[14px] px-4 py-3.5">
          <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-[13px] text-red-700 dark:text-red-400">
            <span className="font-bold">Neraca tidak seimbang!</span>{" "}
            Total Aktiva ({data.totalAsetFmt}) ≠ Total Pasiva ({data.totalPassivaFmt}).
            Periksa entri akun COA untuk menemukan sumber ketidakseimbangan.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Aktiva ── */}
        <div className="flex flex-col gap-4">
          {/* I. Aktiva Lancar */}
          <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
            <SectionHeader color="blue" label="I. Aktiva Lancar" />
            <div className="divide-y divide-surface-subtle">
              {data.aktivaLancar.length === 0 ? (
                <p className="py-5 px-5 text-[13px] text-muted-faint italic">Tidak ada akun aktiva lancar.</p>
              ) : (
                data.aktivaLancar.map((item) => (
                  <ItemRow
                    key={item.code}
                    code={item.code}
                    name={item.name + (item.isContra ? " (Kontra)" : "")}
                    amount={item.saldoFmt}
                    amountClass={item.isContra ? "text-status-amber" : "text-navy-text"}
                  />
                ))
              )}
            </div>
            <SubtotalRow
              label="Total Aktiva Lancar"
              amount={data.totalAktivaLancarFmt}
              bgClass="bg-blue-50/50 dark:bg-blue-500/10"
              borderClass="border-blue-100 dark:border-blue-500/20"
            />
          </div>

          {/* II. Aktiva Tetap */}
          <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
            <SectionHeader color="blue" label="II. Aktiva Tetap" />
            <div className="divide-y divide-surface-subtle">
              {data.aktivaTetap.length === 0 ? (
                <p className="py-5 px-5 text-[13px] text-muted-faint italic">Tidak ada akun aktiva tetap.</p>
              ) : (
                data.aktivaTetap.map((item) => (
                  <ItemRow
                    key={item.code}
                    code={item.code}
                    name={item.name + (item.isContra ? " (Pengurang)" : "")}
                    amount={item.saldoFmt}
                    amountClass={item.isContra ? "text-status-amber" : "text-navy-text"}
                  />
                ))
              )}
            </div>
            <SubtotalRow
              label="Total Aktiva Tetap (Net)"
              amount={data.totalAktivaTetapFmt}
              bgClass="bg-cyan-50/50 dark:bg-cyan-500/10"
              borderClass="border-cyan-100 dark:border-cyan-500/20"
            />
          </div>

          {/* Total Aktiva */}
          <TotalRow
            label="Total Aktiva (Lancar + Tetap)"
            amount={data.totalAsetFmt}
            amountClass={data.neracaBalanced ? "text-blue-700 dark:text-blue-400" : "text-status-red"}
            bgClass="bg-blue-50 dark:bg-blue-500/15"
            borderClass="border-blue-200 dark:border-blue-500/30"
          />
        </div>

        {/* ── Pasiva ── */}
        <div className="flex flex-col gap-4">
          {/* Kewajiban */}
          <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
            <SectionHeader color="orange" label="I. Kewajiban" />
            <div className="divide-y divide-surface-subtle">
              {data.kewajiban.length === 0 ? (
                <p className="py-4 px-5 text-[13px] text-muted-faint italic">Tidak ada kewajiban.</p>
              ) : (
                data.kewajiban.map((item) => (
                  <ItemRow key={item.code} code={item.code} name={item.name} amount={item.saldoFmt} />
                ))
              )}
            </div>
            <SubtotalRow
              label="Total Kewajiban"
              amount={data.totalKewajibanFmt}
              bgClass="bg-orange-50/50 dark:bg-orange-500/10"
              borderClass="border-orange-100 dark:border-orange-500/20"
            />
          </div>

          {/* Modal & Ekuitas */}
          <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
            <SectionHeader color="violet" label="II. Modal & Ekuitas" />
            <div className="divide-y divide-surface-subtle">
              {data.modal.map((item) => (
                <ItemRow key={item.code} code={item.code} name={item.name} amount={item.saldoFmt} />
              ))}
              {/* Laba Ditahan (Akun 310) */}
              <div className="flex items-baseline justify-between py-2.5 px-5 gap-4 bg-violet-50/30 dark:bg-violet-500/5">
                <div className="flex items-baseline gap-2 min-w-0">
                  <code className="text-[10.5px] text-muted-faintest font-mono shrink-0">310</code>
                  <span className="text-[13px] text-muted-stronger">Laba Ditahan</span>
                </div>
                <span className="tabular-nums text-[13px] font-semibold shrink-0 text-navy-text">
                  {data.labaDitahanFmt}
                </span>
              </div>
              {/* Laba Tahun Berjalan */}
              <div className="flex items-baseline justify-between py-2.5 px-5 gap-4 bg-green-50/40 dark:bg-green-500/10">
                <span className="text-[13px] font-semibold text-muted-stronger">Laba Tahun Berjalan {year}</span>
                <span className={`tabular-nums text-[13px] font-bold shrink-0 ${data.labaBersihPositive ? "text-status-green" : "text-status-red"}`}>
                  {data.labaBersihPositive ? "" : "–"}{data.labaBersihFmt}
                </span>
              </div>
            </div>
            <SubtotalRow
              label="Total Modal & Laba"
              amount={data.totalModalDanLabaFmt}
              bgClass="bg-violet-50/50 dark:bg-violet-500/10"
              borderClass="border-violet-100 dark:border-violet-500/20"
            />
          </div>

          {/* Total Pasiva summary */}
          <div className={`rounded-[16px] border-2 px-5 py-4 flex items-center justify-between gap-4 ${
            data.neracaBalanced
              ? "border-green-300 dark:border-green-500/40 bg-green-50 dark:bg-green-500/10"
              : "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10"
          }`}>
            <div>
              <p className="font-extrabold text-[13px] text-navy-text">Total Pasiva (Kewajiban + Modal + Laba)</p>
              <p className={`text-[11.5px] font-semibold mt-0.5 ${
                data.neracaBalanced ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
              }`}>
                {data.neracaBalanced ? "✓ Neraca seimbang" : "✗ Neraca tidak seimbang"}
              </p>
            </div>
            <span className={`tabular-nums font-extrabold text-[15px] shrink-0 ${
              data.neracaBalanced ? "text-navy-text" : "text-status-red"
            }`}>
              {data.totalPassivaFmt}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Laba Rugi ───────────────────────────────────────────────────
function LabaRugiTab({
  data,
  year,
  entityName,
}: {
  data: Awaited<ReturnType<typeof getLaporanKeuanganData>>;
  year: number;
  entityName: string;
}) {
  const statusBadge = (
    <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${
      data.labaBersihPositive
        ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
        : "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
    }`}>
      {data.labaBersihPositive ? "Laba" : "Rugi"}
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        entityName={entityName}
        title="Laporan Laba Rugi"
        period={`Periode 1 Januari s/d 31 Desember ${year}`}
        note="Dalam Rupiah"
        badge={statusBadge}
      />

      {/* Pendapatan */}
      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
        <SectionHeader color="green" label="Pendapatan Usaha" />
        <div className="divide-y divide-surface-subtle">
          {data.pendapatan.length === 0 ? (
            <p className="py-5 px-5 text-[13px] text-muted-faint italic">Tidak ada akun pendapatan.</p>
          ) : (
            data.pendapatan.map((item) => (
              <ItemRow key={item.code} code={item.code} name={item.name} amount={item.saldoFmt} amountClass="text-status-green" />
            ))
          )}
        </div>
        <TotalRow
          label="Total Pendapatan Usaha"
          amount={data.totalPendapatanFmt}
          amountClass="text-status-green"
          bgClass="bg-green-50 dark:bg-green-500/15"
          borderClass="border-green-200 dark:border-green-500/30"
        />
      </div>

      {/* Beban */}
      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
        <SectionHeader color="red" label="Beban Usaha" />
        <div className="divide-y divide-surface-subtle">
          {data.beban.length === 0 ? (
            <p className="py-5 px-5 text-[13px] text-muted-faint italic">Tidak ada akun beban.</p>
          ) : (
            data.beban.map((item) => (
              <ItemRow key={item.code} code={item.code} name={item.name} amount={item.saldoFmt} amountClass="text-status-red" />
            ))
          )}
        </div>
        <TotalRow
          label="Total Beban Usaha"
          amount={data.totalBebanFmt}
          amountClass="text-status-red"
          bgClass="bg-red-50 dark:bg-red-500/15"
          borderClass="border-red-200 dark:border-red-500/30"
        />
      </div>

      {/* Laba / Rugi Bersih — hero card */}
      <div className={`rounded-[20px] border-2 overflow-hidden ${
        data.labaBersihPositive
          ? "border-green-300 dark:border-green-500/40"
          : "border-red-300 dark:border-red-500/40"
      }`}>
        <div className={`px-6 py-5 flex items-start justify-between gap-4 ${
          data.labaBersihPositive
            ? "bg-green-50 dark:bg-green-500/10"
            : "bg-red-50 dark:bg-red-500/10"
        }`}>
          <div>
            <p className={`text-[10.5px] font-extrabold uppercase tracking-widest mb-1.5 ${
              data.labaBersihPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}>
              {data.labaBersihPositive ? "Laba Bersih" : "Rugi Bersih"}
            </p>
            <p className={`text-[30px] font-extrabold tabular-nums leading-none ${
              data.labaBersihPositive ? "text-status-green" : "text-status-red"
            }`}>
              {data.labaBersihPositive ? "" : "–"}{data.labaBersihFmt}
            </p>
            <p className="text-[12px] text-muted mt-2.5">
              Pendapatan {data.totalPendapatanFmt} — Beban {data.totalBebanFmt}
            </p>
          </div>
          <div className={`w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0 ${
            data.labaBersihPositive ? "bg-green-500" : "bg-red-500"
          }`}>
            {data.labaBersihPositive
              ? <TrendingUp size={20} className="text-white" />
              : <TrendingDown size={20} className="text-white" />
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Arus Kas ────────────────────────────────────────────────────
function ArusKasTab({
  data,
  year,
  entityName,
}: {
  data: Awaited<ReturnType<typeof getLaporanKeuanganData>>;
  year: number;
  entityName: string;
}) {
  function FmtSigned({ val, fmt }: { val: number; fmt: string }) {
    if (val === 0) return <span className="text-muted-faint">—</span>;
    if (val > 0) return <span className="text-navy-text font-semibold tabular-nums">{fmt}</span>;
    return <span className="text-status-red font-semibold tabular-nums">({fmt})</span>;
  }

  function AkRow({ label, val, fmt, italic = false }: { label: string; val: number; fmt: string; italic?: boolean }) {
    return (
      <div className="flex items-baseline justify-between py-2.5 px-8 gap-4 border-b border-surface-subtle last:border-0">
        <span className={`text-[13px] ${italic ? "text-muted-faint italic" : "text-muted-stronger"}`}>{label}</span>
        {italic
          ? <span className="text-[13px] text-muted-faint shrink-0">—</span>
          : <span className="shrink-0 text-[13px]"><FmtSigned val={val} fmt={fmt} /></span>
        }
      </div>
    );
  }

  function AkSubtotal({ label, val, fmt, color }: { label: string; val: number; fmt: string; color: string }) {
    const bgMap: Record<string, string> = {
      blue:   "bg-blue-50/40 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20",
      violet: "bg-violet-50/40 dark:bg-violet-500/10 border-violet-100 dark:border-violet-500/20",
      amber:  "bg-amber-50/40 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20",
    };
    return (
      <div className={`flex items-center justify-between px-5 py-3 border-t ${bgMap[color] ?? bgMap.blue}`}>
        <span className="font-bold text-[13px] text-navy-text">{label}</span>
        <span className="text-[13px] shrink-0"><FmtSigned val={val} fmt={fmt} /></span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        entityName={entityName}
        title="Laporan Arus Kas"
        period={`Periode 1 Januari s/d 31 Desember ${year}`}
        note="Dalam Rupiah · Metode Tidak Langsung"
        badge={
          <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${
            data.arusKasBalanced
              ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
              : "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
          }`}>
            {data.arusKasBalanced ? "✓ Konsisten" : "✗ Tidak Konsisten"}
          </span>
        }
      />

      {!data.arusKasBalanced && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[14px] px-4 py-3.5">
          <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-[13px] text-red-700 dark:text-red-400">
            <span className="font-bold">Arus Kas tidak seimbang!</span>{" "}
            Kas Akhir Periode ({data.kasAkhirFmt}) ≠ total saldo Kas+Bank di Neraca ({data.kasAsetFmt}).
          </p>
        </div>
      )}

      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
        {/* Aktivitas Operasi */}
        <SectionHeader color="blue" label="Aktivitas Operasi" />
        <AkRow label="Laba/(Rugi) Bersih" val={data.labaBersih} fmt={data.labaBersihFmt} />
        <AkRow
          label="Penyesuaian non-kas (penyusutan aset tetap)"
          val={data.penyesuaianNonKas ?? 0}
          fmt={data.penyesuaianNonKasFmt ?? "Rp 0"}
          italic={!data.penyesuaianNonKas}
        />
        {data.perubahanAsetNonKas !== 0 && (
          <AkRow label="Penurunan/(Kenaikan) Aset Non-Kas" val={data.perubahanAsetNonKas} fmt={formatRupiah(Math.abs(data.perubahanAsetNonKas))} />
        )}
        {data.perubahanKewajiban !== 0 && (
          <AkRow label="Kenaikan/(Penurunan) Kewajiban" val={data.perubahanKewajiban} fmt={formatRupiah(Math.abs(data.perubahanKewajiban))} />
        )}
        <AkSubtotal label="Kas dari Aktivitas Operasi" val={data.kasOperasi} fmt={data.kasOperasiFmt} color="blue" />

        {/* Aktivitas Investasi */}
        <div className="border-t border-surface-hover">
          <SectionHeader color="violet" label="Aktivitas Investasi" />
          <AkRow label="Perolehan/Pelepasan Aset Tetap" val={0} fmt="" italic />
          <AkSubtotal label="Kas dari Aktivitas Investasi" val={data.kasInvestasi} fmt={data.kasInvestasiFmt} color="violet" />
        </div>

        {/* Aktivitas Pendanaan */}
        <div className="border-t border-surface-hover">
          <SectionHeader color="amber" label="Aktivitas Pendanaan" />
          {data.kasPendanaan !== 0 ? (
            <AkRow label="Perubahan Modal Bersih" val={data.kasPendanaan} fmt={data.kasPendanaanFmt} />
          ) : (
            <AkRow label="Setoran Modal / Dividen" val={0} fmt="" italic />
          )}
          <AkSubtotal label="Kas dari Aktivitas Pendanaan" val={data.kasPendanaan} fmt={data.kasPendanaanFmt} color="amber" />
        </div>

        {/* Summary */}
        <div className="border-t-2 border-border">
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-subtle">
            <span className="font-semibold text-[13px] text-muted-stronger">Kenaikan/(Penurunan) Bersih Kas & Setara Kas</span>
            <span className="text-[13px] shrink-0 ml-4"><FmtSigned val={data.kenaikanBersihKas} fmt={data.kenaikanBersihFmt} /></span>
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-subtle">
            <span className="font-semibold text-[13px] text-muted-stronger">Kas & Setara Kas Awal Periode</span>
            <span className="tabular-nums font-semibold text-[13px] text-muted shrink-0 ml-4">
              {data.kasAwal === 0 ? <span className="text-muted-faint">—</span> : data.kasAwalFmt}
            </span>
          </div>
          <div className={`flex items-center justify-between px-5 py-4 gap-4 ${
            data.arusKasBalanced
              ? "bg-green-50 dark:bg-green-500/10"
              : "bg-red-50 dark:bg-red-500/10"
          }`}>
            <div>
              <p className="font-extrabold text-[13px] text-navy-text">Kas & Setara Kas Akhir Periode</p>
              {data.arusKasBalanced && (
                <p className="text-[11px] text-green-600 dark:text-green-400 font-semibold mt-0.5">✓ Konsisten dengan Neraca</p>
              )}
            </div>
            <span className={`tabular-nums font-extrabold text-[16px] shrink-0 ${
              data.arusKasBalanced ? "text-navy-text" : "text-status-red"
            }`}>
              {data.kasAkhirFmt}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
