import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

export async function getLabaRugiData(entityId: string, year: number) {
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

  const pendapatan = new Map<string, { code: string; name: string; total: number }>();
  const beban = new Map<string, { code: string; name: string; total: number }>();

  for (const t of transactions) {
    if (!t.coaAccount) continue;
    if (t.coaAccount.kategori === "PENDAPATAN") {
      if (!pendapatan.has(t.coaAccountId!)) {
        pendapatan.set(t.coaAccountId!, {
          code: t.coaAccount.code,
          name: t.coaAccount.name,
          total: 0,
        });
      }
      pendapatan.get(t.coaAccountId!)!.total += Number(t.kredit);
    } else if (t.coaAccount.kategori === "BEBAN") {
      if (!beban.has(t.coaAccountId!)) {
        beban.set(t.coaAccountId!, {
          code: t.coaAccount.code,
          name: t.coaAccount.name,
          total: 0,
        });
      }
      beban.get(t.coaAccountId!)!.total += Number(t.kredit);
    }
  }

  const pendapatanList = Array.from(pendapatan.values()).map((i) => ({
    ...i,
    totalFmt: formatRupiah(i.total),
  }));
  const bebanList = Array.from(beban.values()).map((i) => ({
    ...i,
    totalFmt: formatRupiah(i.total),
  }));
  const totalPendapatan = pendapatanList.reduce((s, i) => s + i.total, 0);
  const totalBeban = bebanList.reduce((s, i) => s + i.total, 0);
  const labaBersih = totalPendapatan - totalBeban;

  return {
    pendapatanList,
    bebanList,
    totalPendapatanFmt: formatRupiah(totalPendapatan),
    totalBebanFmt: formatRupiah(totalBeban),
    labaBersih,
    labaBersihFmt: formatRupiah(Math.abs(labaBersih)),
    labaBersihPositive: labaBersih >= 0,
  };
}
