import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { getJenisInputChips, getJurnalRows } from "@/lib/jurnal";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { JurnalFilterChips } from "@/components/jurnal/JurnalFilterChips";

export default async function JurnalPage({
  searchParams,
}: {
  searchParams: { entity?: string; filter?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role, entityKeys } = session!.user;

  // Jurnal Umum tidak ada di sidebar Super Admin pada desain aslinya.
  if (role === "SUPER_ADMIN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = searchParams.entity && entityKeys.includes(searchParams.entity) ? searchParams.entity : entityKeys[0];
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const filter = searchParams.filter ?? "semua";

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entity manapun.</p>;
  }

  const chips = await getJenisInputChips(selectedEntity.id);
  const { rows, totalDebitFmt, totalKreditFmt } = await getJurnalRows(selectedEntity.id, filter);

  return (
    <>
      <PageHeader
        title="Jurnal Umum"
        subtitle="Seluruh transaksi kas dan termin, tercatat otomatis"
        rightSlot={
          <EntitySwitcher
            entities={entities.map((e) => ({ key: e.key, name: e.name }))}
            showGrupOption={false}
            currentEntityKey={selectedEntity.key}
          />
        }
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <JurnalFilterChips chips={chips} current={filter} entityKey={selectedEntity.key} />
        <button
          disabled
          title="Export akan diimplementasikan di iterasi berikutnya"
          className="flex items-center gap-2 px-4 py-2.5 rounded-[11px] border border-border-soft text-[13px] font-semibold text-muted-faint bg-white opacity-60 cursor-not-allowed"
        >
          Ekspor ke Excel
        </button>
      </div>

      <div className="bg-white border border-black/[.06] rounded-[20px] p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-hover text-left text-[11px] font-bold text-muted-faint">
              <td className="py-2 px-1.5">TANGGAL</td>
              <td className="py-2 px-1.5">SUMBER</td>
              <td className="py-2 px-1.5">KODE PROYEK</td>
              <td className="py-2 px-1.5">KATEGORI</td>
              <td className="py-2 px-1.5 text-right">DEBIT</td>
              <td className="py-2 px-1.5 text-right">KREDIT</td>
              <td className="py-2 px-1.5 text-right">SALDO BERJALAN</td>
              <td className="py-2 px-1.5">DIINPUT OLEH</td>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-surface-subtle">
                <td className="py-2.5 px-1.5 text-[12.5px] text-muted whitespace-nowrap">{r.tanggal}</td>
                <td className="py-2.5 px-1.5">
                  <span
                    className="text-[10.5px] font-bold px-2.5 py-1 rounded-md"
                    style={{ background: r.sumberBg, color: r.sumberColor }}
                  >
                    {r.sumberLabel}
                  </span>
                </td>
                <td className="py-2.5 px-1.5 text-[12.5px] text-muted font-mono">{r.kodeProyek}</td>
                <td className="py-2.5 px-1.5 text-[13px] font-semibold text-navy-text">{r.kategori}</td>
                <td className="py-2.5 px-1.5 text-[13px] text-muted-stronger text-right tabular-nums">{r.debitFmt}</td>
                <td className="py-2.5 px-1.5 text-[13px] text-muted-stronger text-right tabular-nums">{r.kreditFmt}</td>
                <td className="py-2.5 px-1.5 text-[13px] font-bold text-navy-text text-right tabular-nums">{r.saldoFmt}</td>
                <td className="py-2.5 px-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-[22px] h-[22px] rounded-full bg-navy text-white text-[9.5px] font-bold flex items-center justify-center flex-none">
                      {r.staffInitial}
                    </div>
                    <span className="text-[12.5px] text-muted-strong">{r.staffName}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="py-3.5 px-1.5 text-[13px] font-extrabold text-navy-text">
                Total Periode Berjalan
              </td>
              <td className="py-3.5 px-1.5 text-[13.5px] font-extrabold text-navy-text text-right tabular-nums">{totalDebitFmt}</td>
              <td className="py-3.5 px-1.5 text-[13.5px] font-extrabold text-navy-text text-right tabular-nums">{totalKreditFmt}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
