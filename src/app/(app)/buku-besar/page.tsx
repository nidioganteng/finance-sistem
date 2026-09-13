import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { getBukuBesarData } from "@/lib/buku-besar";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";

const KATEGORI_BADGE: Record<string, string> = {
  PENDAPATAN: "bg-green-100 text-green-700",
  BEBAN: "bg-red-100 text-red-700",
  ASET: "bg-blue-100 text-blue-700",
  KEWAJIBAN: "bg-orange-100 text-orange-700",
  MODAL: "bg-purple-100 text-purple-700",
};

export default async function BukuBesarPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;
  if (role === "SUPER_ADMIN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey =
    searchParams.entity && entityKeys.includes(searchParams.entity)
      ? searchParams.entity
      : entityKeys[0];
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const groups = await getBukuBesarData(selectedEntity.id, currentYear);

  return (
    <>
      <PageHeader
        title="Buku Besar"
        subtitle={`Ledger per akun COA — ${selectedEntity.name} ${currentYear}`}
        rightSlot={
          <>
            <YearSelect currentYear={currentYear} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedKey}
            />
          </>
        }
      />

      {groups.length === 0 ? (
        <div className="bg-white rounded-[20px] border border-black/[.06] py-16 text-center">
          <div className="text-sm font-semibold text-muted-stronger mb-1">Tidak ada data</div>
          <p className="text-[13px] text-muted">Tidak ada transaksi dengan akun COA untuk periode ini.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.coa.code} className="bg-white rounded-[20px] border border-black/[.06] overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-subtle">
                <span className="font-mono font-bold text-navy-text">{group.coa.code}</span>
                <span className="font-semibold text-muted-stronger">{group.coa.name}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${KATEGORI_BADGE[group.coa.kategori] ?? "bg-surface-hover text-muted"}`}>
                  {group.coa.kategori}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-hover text-left">
                    <th className="py-2.5 px-6 text-[11px] font-bold text-muted-faint uppercase">Tanggal</th>
                    <th className="py-2.5 px-3 text-[11px] font-bold text-muted-faint uppercase">No. Bukti</th>
                    <th className="py-2.5 px-3 text-[11px] font-bold text-muted-faint uppercase">Keterangan</th>
                    <th className="py-2.5 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Debit</th>
                    <th className="py-2.5 px-3 text-[11px] font-bold text-muted-faint uppercase text-right">Kredit</th>
                    <th className="py-2.5 px-6 text-[11px] font-bold text-muted-faint uppercase text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {group.entries.map((e, i) => (
                    <tr key={i} className="border-b border-surface-subtle hover:bg-surface-hover/30">
                      <td className="py-2.5 px-6 text-[12.5px] text-muted whitespace-nowrap">{e.tanggal}</td>
                      <td className="py-2.5 px-3 font-mono text-[12px] text-muted">{e.noBukti}</td>
                      <td className="py-2.5 px-3 text-[13px] text-muted-stronger">{e.keterangan}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[13px]">{e.debitFmt}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[13px]">{e.kreditFmt}</td>
                      <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-bold text-navy-text">{e.saldoFmt}</td>
                    </tr>
                  ))}
                  <tr className="bg-surface-subtle">
                    <td colSpan={3} className="py-2.5 px-6 text-[13px] font-extrabold text-navy-text">Total</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[13px] font-extrabold text-navy-text">{group.totalDebitFmt}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[13px] font-extrabold text-navy-text">{group.totalKreditFmt}</td>
                    <td className="py-2.5 px-6" />
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
