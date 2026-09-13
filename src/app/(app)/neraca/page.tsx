import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { getNeracaData } from "@/lib/neraca";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";

export default async function NeracaPage({
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

  const data = await getNeracaData(selectedEntity.id, currentYear);

  return (
    <>
      <PageHeader
        title="Neraca"
        subtitle={`Posisi keuangan per 31 Desember ${currentYear} — ${selectedEntity.name}`}
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

      <div className="px-4 py-3 rounded-xl bg-surface-subtle border border-border-soft text-[13px] text-muted-stronger">
        Data Neraca didasarkan pada transaksi yang tercatat dalam sistem dan akun COA yang telah dikonfigurasi.
      </div>

      {data.aset.length === 0 && data.kewajiban.length === 0 && data.modal.length === 0 ? (
        <div className="bg-white rounded-[20px] border border-black/[.06] py-16 text-center">
          <div className="text-sm font-semibold text-muted-stronger mb-1">Tidak ada data</div>
          <p className="text-[13px] text-muted">Isi data COA (Aset/Kewajiban/Modal) dan transaksi terlebih dahulu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-[20px] border border-black/[.06] overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-subtle">
              <div className="font-bold text-navy-text">ASET</div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {data.aset.map((item) => (
                  <tr key={item.code} className="border-b border-surface-subtle">
                    <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                    <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold">{item.saldoFmt}</td>
                  </tr>
                ))}
                <tr className="bg-surface-subtle">
                  <td className="py-3 px-6 font-extrabold text-navy-text">Total Aset</td>
                  <td className="py-3 px-6 text-right tabular-nums font-extrabold text-navy-text">{data.totalAsetFmt}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-5">
            <div className="bg-white rounded-[20px] border border-black/[.06] overflow-hidden">
              <div className="px-6 py-4 border-b border-surface-subtle">
                <div className="font-bold text-navy-text">KEWAJIBAN</div>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {data.kewajiban.length === 0 && (
                    <tr><td colSpan={2} className="py-4 px-6 text-sm text-muted">-</td></tr>
                  )}
                  {data.kewajiban.map((item) => (
                    <tr key={item.code} className="border-b border-surface-subtle">
                      <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                      <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold">{item.saldoFmt}</td>
                    </tr>
                  ))}
                  <tr className="bg-surface-subtle">
                    <td className="py-3 px-6 font-extrabold text-navy-text">Total Kewajiban</td>
                    <td className="py-3 px-6 text-right tabular-nums font-extrabold text-navy-text">{data.totalKewajibanFmt}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-[20px] border border-black/[.06] overflow-hidden">
              <div className="px-6 py-4 border-b border-surface-subtle">
                <div className="font-bold text-navy-text">MODAL</div>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {data.modal.length === 0 && (
                    <tr><td colSpan={2} className="py-4 px-6 text-sm text-muted">-</td></tr>
                  )}
                  {data.modal.map((item) => (
                    <tr key={item.code} className="border-b border-surface-subtle">
                      <td className="py-2.5 px-6 text-[13px] text-muted-stronger">{item.code} — {item.name}</td>
                      <td className="py-2.5 px-6 text-right tabular-nums text-[13px] font-semibold">{item.saldoFmt}</td>
                    </tr>
                  ))}
                  <tr className="bg-surface-subtle">
                    <td className="py-3 px-6 font-extrabold text-navy-text">Total Modal</td>
                    <td className="py-3 px-6 text-right tabular-nums font-extrabold text-navy-text">{data.totalModalFmt}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={`px-6 py-4 rounded-[16px] border-2 ${data.balanced ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-[13px]">Total Kewajiban + Modal</span>
                <span className="font-extrabold tabular-nums">{data.totalPassivaFmt}</span>
              </div>
              <div className={`text-[12px] mt-1 font-semibold ${data.balanced ? "text-green-700" : "text-red-700"}`}>
                {data.balanced ? "✓ Neraca seimbang" : "✗ Neraca tidak seimbang — periksa data COA"}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
