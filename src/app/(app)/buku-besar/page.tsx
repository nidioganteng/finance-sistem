import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getBukuBesarRekap, getBukuBesarDrilldown } from "@/lib/buku-besar";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { PrintButton } from "@/components/shared/PrintButton";
import { AlertTriangle, ChevronRight, ChevronLeft } from "lucide-react";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";

const KATEGORI_BADGE: Record<string, string> = {
  PENDAPATAN: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  BEBAN:      "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
  ASET:       "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  KEWAJIBAN:  "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  MODAL:      "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400",
};

export default async function BukuBesarPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string; akun?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  logActivity(session!.user.id, "Buka halaman Buku Besar", "USER_ACTIVITY", { path: "/buku-besar" });
  if (role === "SUPER_ADMIN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  // URL builder untuk navigasi antar view
  const baseQ = `entity=${selectedKey}&year=${currentYear}`;
  const rekapHref = (coaId: string) => `/buku-besar?${baseQ}&akun=${coaId}`;
  const backHref = `/buku-besar?${baseQ}`;

  const isDrilldown = !!searchParams.akun;

  return (
    <PageTransition>
      <PageHeader
        title={`Buku Besar – ${selectedEntity.name}`}
        subtitle={`Ledger per akun COA — ${currentYear}`}
        rightSlot={
          <>
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

      {isDrilldown
        ? <DrilldownView entityId={selectedEntity.id} coaId={searchParams.akun!} year={currentYear} backHref={backHref} />
        : <RekapView entityId={selectedEntity.id} year={currentYear} rekapHref={rekapHref} />
      }
    </PageTransition>
  );
}

// ── Tampilan Rekap ────────────────────────────────────────────────
async function RekapView({
  entityId,
  year,
  rekapHref,
}: {
  entityId: string;
  year: number;
  rekapHref: (coaId: string) => string;
}) {
  const { rows, totalSemuaDebetFmt, totalSemuaKreditFmt, isBalanced, totalSemuaDebet, totalSemuaKredit } =
    await getBukuBesarRekap(entityId, year);

  const selisih = Math.abs(totalSemuaDebet - totalSemuaKredit);

  return (
    <div className="flex flex-col gap-4">
      {!isBalanced && rows.length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[14px] px-4 py-3.5">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-none" />
          <div className="text-[13px] text-red-700 dark:text-red-400">
            <span className="font-bold">Buku Besar tidak seimbang!</span> Total Debet dan Kredit
            seluruh akun berbeda sebesar{" "}
            <span className="font-bold">Rp {selisih.toLocaleString("id-ID")}</span>. Periksa Jurnal Umum
            untuk menemukan sumber ketidakseimbangan.
          </div>
        </div>
      )}

      <div className="bg-surface-card border border-border-soft rounded-[20px] overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint">
              <th className="py-3 px-5 whitespace-nowrap">KODE AKUN</th>
              <th className="py-3 px-3 whitespace-nowrap">NAMA AKUN</th>
              <th className="py-3 px-3 whitespace-nowrap">KATEGORI</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">SALDO AWAL</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">TOTAL DEBET</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">TOTAL KREDIT</th>
              <th className="py-3 px-5 text-right whitespace-nowrap">SALDO AKHIR</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-muted">
                  Tidak ada transaksi dengan akun COA untuk periode ini.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.coaId}
                  className="border-b border-surface-subtle hover:bg-surface-hover/40 cursor-pointer group"
                >
                  <td className="py-3 px-5">
                    <a href={rekapHref(r.coaId)} className="font-mono font-bold text-navy-text text-[13px]">
                      {r.code}
                    </a>
                  </td>
                  <td className="py-3 px-3">
                    <a href={rekapHref(r.coaId)} className="flex items-center gap-1 text-[13px] font-semibold text-navy-text">
                      {r.name}
                      <ChevronRight size={13} className="text-muted-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${KATEGORI_BADGE[r.kategori] ?? "bg-surface-hover text-muted"}`}>
                      {r.kategori}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-[13px] text-muted whitespace-nowrap">{r.saldoAwalFmt}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[13px] text-navy-text whitespace-nowrap">{r.totalDebetFmt}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[13px] text-navy-text whitespace-nowrap">{r.totalKreditFmt}</td>
                  <td className="py-3 px-5 text-right tabular-nums text-[13px] font-bold whitespace-nowrap">
                    <a href={rekapHref(r.coaId)} className={r.saldoAkhirNegatif ? "text-status-red" : "text-navy-text"}>
                      {r.saldoAkhirNegatif ? "-" : ""}{r.saldoAkhirFmt}
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className={`border-t-2 ${isBalanced ? "border-border" : "border-red-300"}`}>
                <td colSpan={4} className="py-3.5 px-5 text-[13px] font-extrabold text-navy-text">
                  Total Semua Akun
                  {!isBalanced && (
                    <span className="ml-2 text-[11px] font-bold text-red-500">⚠ tidak seimbang</span>
                  )}
                </td>
                <td className={`py-3.5 px-3 text-right tabular-nums text-[13.5px] font-extrabold whitespace-nowrap ${isBalanced ? "text-navy-text" : "text-red-600 dark:text-red-400"}`}>
                  {totalSemuaDebetFmt}
                </td>
                <td className={`py-3.5 px-3 text-right tabular-nums text-[13.5px] font-extrabold whitespace-nowrap ${isBalanced ? "text-navy-text" : "text-red-600 dark:text-red-400"}`}>
                  {totalSemuaKreditFmt}
                </td>
                <td className="py-3.5 px-5" />
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>
    </div>
  );
}

// ── Tampilan Drill-down ───────────────────────────────────────────
async function DrilldownView({
  entityId,
  coaId,
  year,
  backHref,
}: {
  entityId: string;
  coaId: string;
  year: number;
  backHref: string;
}) {
  const data = await getBukuBesarDrilldown(entityId, coaId, year);

  if (!data) {
    return (
      <div className="bg-surface-card rounded-[20px] border border-border-soft py-16 text-center">
        <p className="text-sm text-muted">Akun tidak ditemukan.</p>
        <a href={backHref} className="text-brand text-[13px] font-bold mt-2 inline-block">← Kembali</a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header drill-down */}
      <div className="flex items-center gap-3 flex-wrap">
        <a
          href={backHref}
          className="flex items-center gap-1.5 text-[13px] font-bold text-muted-stronger hover:text-navy-text transition-colors"
        >
          <ChevronLeft size={15} />
          Semua Akun
        </a>
        <span className="text-muted-faint">/</span>
        <span className="font-mono font-bold text-navy-text text-[13px]">{data.coa.code}</span>
        <span className="font-semibold text-muted-stronger text-[13px]">{data.coa.name}</span>
        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${KATEGORI_BADGE[data.coa.kategori] ?? "bg-surface-hover text-muted"}`}>
          {data.coa.kategori}
        </span>
      </div>

      <div className="bg-surface-card border border-border-soft rounded-[20px] overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint">
              <th className="py-3 px-5 whitespace-nowrap">TANGGAL</th>
              <th className="py-3 px-3 whitespace-nowrap">NO. BUKTI</th>
              <th className="py-3 px-3">KETERANGAN</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">DEBET</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">KREDIT</th>
              <th className="py-3 px-5 text-right whitespace-nowrap">SALDO BERJALAN</th>
            </tr>
          </thead>
          <tbody>
            {/* Baris saldo awal */}
            <tr className="border-b border-surface-subtle bg-surface-subtle/50">
              <td colSpan={5} className="py-2.5 px-5 text-[12px] font-semibold text-muted-faint italic">
                Saldo Awal {year}
              </td>
              <td className={`py-2.5 px-5 text-right tabular-nums text-[12px] font-bold whitespace-nowrap ${data.saldoAwalNegatif ? "text-status-red" : "text-muted"}`}>
                {data.saldoAwalNegatif ? "-" : ""}{data.saldoAwalFmt}
              </td>
            </tr>

            {data.entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-muted">
                  Tidak ada transaksi untuk akun ini di periode ini.
                </td>
              </tr>
            ) : (
              data.entries.map((e, i) => (
                <tr key={i} className="border-b border-surface-subtle hover:bg-surface-hover/30">
                  <td className="py-2.5 px-5 text-[12.5px] text-muted whitespace-nowrap">{e.tanggal}</td>
                  <td className="py-2.5 px-3 font-mono text-[12px] text-muted whitespace-nowrap">{e.noBukti}</td>
                  <td className="py-2.5 px-3 text-[13px] text-muted-stronger">{e.keterangan}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-[13px] text-navy-text whitespace-nowrap">{e.debitFmt}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-[13px] text-navy-text whitespace-nowrap">{e.kreditFmt}</td>
                  <td className={`py-2.5 px-5 text-right tabular-nums text-[13px] font-bold whitespace-nowrap ${e.saldoNegatif ? "text-status-red" : "text-navy-text"}`}>
                    {e.saldoNegatif ? "-" : ""}{e.saldoFmt}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={3} className="py-3.5 px-5 text-[13px] font-extrabold text-navy-text">Saldo Akhir</td>
              <td className="py-3.5 px-3 text-right tabular-nums text-[13.5px] font-extrabold text-navy-text whitespace-nowrap">{data.totalDebetFmt}</td>
              <td className="py-3.5 px-3 text-right tabular-nums text-[13.5px] font-extrabold text-navy-text whitespace-nowrap">{data.totalKreditFmt}</td>
              <td className={`py-3.5 px-5 text-right tabular-nums text-[14px] font-extrabold whitespace-nowrap ${data.saldoAkhirNegatif ? "text-status-red" : "text-navy-text"}`}>
                {data.saldoAkhirNegatif ? "-" : ""}{data.saldoAkhirFmt}
              </td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </div>
  );
}
