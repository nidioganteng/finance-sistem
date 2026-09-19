import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getJenisInputChips, getJurnalRows, getCoaList } from "@/lib/jurnal";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { PrintButton } from "@/components/shared/PrintButton";
import { JurnalFilterChips } from "@/components/jurnal/JurnalFilterChips";
import { JurnalExtraFilters } from "@/components/jurnal/JurnalExtraFilters";
import { AlertTriangle } from "lucide-react";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function JurnalPage({
  searchParams,
}: {
  searchParams: { entity?: string; filter?: string; bulan?: string; akunCode?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  logActivity(session!.user.id, "Buka halaman Jurnal Umum", "USER_ACTIVITY", { path: "/jurnal" });

  if (role === "SUPER_ADMIN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const filter = searchParams.filter ?? "semua";
  const bulan = searchParams.bulan ?? "";
  const akunCode = searchParams.akunCode ?? "";

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const [chips, coaList, { rows, totalDebit, totalKredit, isBalanced, totalDebitFmt, totalKreditFmt }] =
    await Promise.all([
      getJenisInputChips(selectedEntity.id),
      getCoaList(),
      getJurnalRows(selectedEntity.id, filter, bulan || undefined, akunCode || undefined),
    ]);

  const selisih = Math.abs(totalDebit - totalKredit);

  return (
    <PageTransition>
      <PageHeader
        title={`Jurnal Umum – ${selectedEntity.name}`}
        subtitle="Seluruh transaksi kas dan bank, tercatat otomatis dari setiap input"
        rightSlot={
          <>
            <PrintButton />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedEntity.key}
            />
          </>
        }
      />

      {/* Warning balance — muncul kalau Total Debit ≠ Total Kredit */}
      {!isBalanced && rows.length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[14px] px-4 py-3.5">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-none" />
          <div className="text-[13px] text-red-700 dark:text-red-400">
            <span className="font-bold">Jurnal tidak seimbang!</span> Total Debit dan Kredit berbeda sebesar{" "}
            <span className="font-bold">Rp {selisih.toLocaleString("id-ID")}</span>. Kemungkinan ada transaksi lama
            yang belum punya entri pasangan. Periksa kembali data atau hubungi Manajer Keuangan.
          </div>
        </div>
      )}

      {/* Filter row */}
      <div className="print:hidden flex items-center justify-between flex-wrap gap-3">
        <JurnalFilterChips chips={chips} current={filter} entityKey={selectedEntity.key} />
        <JurnalExtraFilters
          coaList={coaList}
          currentBulan={bulan}
          currentAkunCode={akunCode}
          entityKey={selectedEntity.key}
        />
      </div>

      <div className="bg-surface-card border border-border-soft rounded-[20px] p-5 overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint">
              <td className="py-2 px-1.5 whitespace-nowrap">TANGGAL</td>
              <td className="py-2 px-1.5 whitespace-nowrap">NO. BUKTI</td>
              <td className="py-2 px-1.5">SUMBER</td>
              <td className="py-2 px-1.5">KETERANGAN</td>
              <td className="py-2 px-1.5 whitespace-nowrap">KODE AKUN</td>
              <td className="py-2 px-1.5">NAMA AKUN</td>
              <td className="py-2 px-1.5 text-right whitespace-nowrap">DEBET</td>
              <td className="py-2 px-1.5 text-right whitespace-nowrap">KREDIT</td>
              <td className="py-2 px-1.5">DIINPUT OLEH</td>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-sm text-muted">
                  Belum ada transaksi untuk filter yang dipilih.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-surface-subtle ${r.isKasEntry ? "bg-surface-subtle/40" : ""}`}
                >
                  <td className="py-2.5 px-1.5 text-[12.5px] text-muted whitespace-nowrap">{r.tanggal}</td>
                  <td className="py-2.5 px-1.5 text-[11.5px] text-muted font-mono whitespace-nowrap">{r.noBukti}</td>
                  <td className="py-2.5 px-1.5">
                    <span
                      className="text-[10.5px] font-bold px-2.5 py-1 rounded-md whitespace-nowrap"
                      style={{ background: r.sumberBg, color: r.sumberColor }}
                    >
                      {r.sumberLabel}
                    </span>
                  </td>
                  <td className="py-2.5 px-1.5 text-[13px] text-navy-text max-w-[200px]">
                    {r.isKasEntry ? (
                      <span className="text-muted-faint italic text-[12px]">{r.keterangan}</span>
                    ) : (
                      <>
                        {r.keterangan}
                        {r.arahLaporan.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.arahLaporan.map((a) => {
                              const LABEL: Record<string, string> = {
                                JURNAL_UMUM: "Jurnal", BUKU_BESAR: "Buku Besar",
                                LAPORAN_KEUANGAN: "Lap. Keuangan", PIUTANG: "Piutang", PAJAK: "Pajak",
                              };
                              return (
                                <span key={a} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-navy/10 dark:bg-navy/30 text-navy dark:text-blue-300">
                                  {LABEL[a] ?? a}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="py-2.5 px-1.5 text-[12px] font-mono text-muted">{r.kodeAkun}</td>
                  <td className="py-2.5 px-1.5 text-[13px] font-semibold text-navy-text">
                    {r.namaAkun}
                    {r.isKasEntry && (
                      <span className="ml-1.5 text-[10px] font-bold text-muted-faint bg-surface-hover px-1.5 py-0.5 rounded">
                        auto
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-1.5 text-[13px] text-navy-text text-right tabular-nums font-medium">
                    {r.debitFmt}
                  </td>
                  <td className="py-2.5 px-1.5 text-[13px] text-navy-text text-right tabular-nums font-medium">
                    {r.kreditFmt}
                  </td>
                  <td className="py-2.5 px-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-[22px] h-[22px] rounded-full bg-navy text-white text-[9.5px] font-bold flex items-center justify-center flex-none">
                        {r.staffInitial}
                      </div>
                      <span className="text-[12px] text-muted-strong whitespace-nowrap">{r.staffName}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className={`border-t-2 ${isBalanced ? "border-border" : "border-red-300"}`}>
                <td colSpan={6} className="py-3.5 px-1.5 text-[13px] font-extrabold text-navy-text">
                  Total Periode Berjalan
                  {!isBalanced && (
                    <span className="ml-2 text-[11px] font-bold text-red-500 normal-case">
                      ⚠ tidak seimbang
                    </span>
                  )}
                </td>
                <td
                  className={`py-3.5 px-1.5 text-[13.5px] font-extrabold text-right tabular-nums ${
                    isBalanced ? "text-navy-text" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {totalDebitFmt}
                </td>
                <td
                  className={`py-3.5 px-1.5 text-[13.5px] font-extrabold text-right tabular-nums ${
                    isBalanced ? "text-navy-text" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {totalKreditFmt}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </PageTransition>
  );
}
