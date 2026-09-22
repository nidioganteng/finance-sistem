import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { getJenisInputChips, getJurnalRows, getCoaList } from "@/lib/jurnal";
import { canManageTransaksi } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { PrintButton } from "@/components/shared/PrintButton";
import { JurnalFilterChips } from "@/components/jurnal/JurnalFilterChips";
import { JurnalExtraFilters } from "@/components/jurnal/JurnalExtraFilters";
import { JurnalTable } from "@/components/jurnal/JurnalTable";
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

      <JurnalTable
        rows={rows}
        entityId={selectedEntity.id}
        isBalanced={isBalanced}
        totalDebitFmt={totalDebitFmt}
        totalKreditFmt={totalKreditFmt}
        coaOptions={coaList}
        canEditAkun={canManageTransaksi(role)}
      />
    </PageTransition>
  );
}
