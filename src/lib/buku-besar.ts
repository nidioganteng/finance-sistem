import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

export async function getBukuBesarData(entityId: string, year: number) {
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
    orderBy: [{ tanggal: "asc" }, { createdAt: "asc" }],
  });

  const grouped = new Map<
    string,
    {
      coa: { code: string; name: string; kategori: string };
      entries: Array<{
        tanggal: string;
        noBukti: string;
        keterangan: string;
        debitFmt: string;
        kreditFmt: string;
        saldoFmt: string;
      }>;
      totalDebit: number;
      totalKredit: number;
    }
  >();

  for (const t of transactions) {
    if (!t.coaAccount) continue;
    const key = t.coaAccountId!;
    if (!grouped.has(key)) {
      grouped.set(key, {
        coa: {
          code: t.coaAccount.code,
          name: t.coaAccount.name,
          kategori: t.coaAccount.kategori,
        },
        entries: [],
        totalDebit: 0,
        totalKredit: 0,
      });
    }
    const g = grouped.get(key)!;
    g.entries.push({
      tanggal: t.tanggal.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      noBukti: t.noBukti,
      keterangan: t.keterangan,
      debitFmt: Number(t.debit) > 0 ? formatRupiah(Number(t.debit)) : "-",
      kreditFmt: Number(t.kredit) > 0 ? formatRupiah(Number(t.kredit)) : "-",
      saldoFmt: formatRupiah(Number(t.saldoSetelah)),
    });
    g.totalDebit += Number(t.debit);
    g.totalKredit += Number(t.kredit);
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.coa.code.localeCompare(b.coa.code))
    .map((g) => ({
      ...g,
      totalDebitFmt: formatRupiah(g.totalDebit),
      totalKreditFmt: formatRupiah(g.totalKredit),
    }));
}
