import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

export async function getNeracaData(entityId: string, year: number) {
  const transactions = await prisma.transaction.findMany({
    where: {
      entityId,
      tanggal: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31T23:59:59`),
      },
      coaAccountId: { not: null },
    },
    include: { coaAccount: true },
  });

  const maps: Record<string, Map<string, { code: string; name: string; saldo: number }>> = {
    ASET: new Map(),
    KEWAJIBAN: new Map(),
    MODAL: new Map(),
  };
  let totalPendapatan = 0;
  let totalBeban = 0;

  for (const t of transactions) {
    if (!t.coaAccount) continue;
    const kat = t.coaAccount.kategori;
    if (kat === "PENDAPATAN") { totalPendapatan += Number(t.kredit); continue; }
    if (kat === "BEBAN") { totalBeban += Number(t.kredit); continue; }
    if (!["ASET", "KEWAJIBAN", "MODAL"].includes(kat)) continue;
    const map = maps[kat];
    if (!map.has(t.coaAccountId!)) {
      map.set(t.coaAccountId!, { code: t.coaAccount.code, name: t.coaAccount.name, saldo: 0 });
    }
    const item = map.get(t.coaAccountId!)!;
    if (kat === "ASET") {
      item.saldo += Number(t.debit) - Number(t.kredit);
    } else {
      item.saldo += Number(t.kredit) - Number(t.debit);
    }
  }

  const formatList = (map: Map<string, { code: string; name: string; saldo: number }>) =>
    Array.from(map.values()).map((i) => ({ ...i, saldoFmt: formatRupiah(Math.abs(i.saldo)) }));

  const aset = formatList(maps["ASET"]);
  const kewajiban = formatList(maps["KEWAJIBAN"]);
  const modal = formatList(maps["MODAL"]);
  const totalAset = aset.reduce((s, i) => s + i.saldo, 0);
  const totalKewajiban = kewajiban.reduce((s, i) => s + i.saldo, 0);
  const totalModal = modal.reduce((s, i) => s + i.saldo, 0);
  const labaBersih = totalPendapatan - totalBeban;
  const totalPassiva = totalKewajiban + totalModal + labaBersih;

  return {
    aset,
    kewajiban,
    modal,
    labaBersih,
    labaBersihFmt: formatRupiah(Math.abs(labaBersih)),
    labaBersihPositive: labaBersih >= 0,
    totalAsetFmt: formatRupiah(totalAset),
    totalKewajibanFmt: formatRupiah(totalKewajiban),
    totalModalFmt: formatRupiah(totalModal),
    totalModalDanLabaFmt: formatRupiah(totalModal + labaBersih),
    totalPassivaFmt: formatRupiah(totalPassiva),
    balanced: Math.abs(totalAset - totalPassiva) < 1,
  };
}
