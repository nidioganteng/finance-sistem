import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { hitungSaldoAkhir, hitungAlokasi } from "./akuntansi";

// Semua akun COA (termasuk yang belum pernah dipakai transaksi), LEFT JOIN
// saldo awal + rekap debit/kredit periode berjalan (issue #37).
export async function getDaftarAkunData(entityId: string, year: number) {
  const [allCoa, transactions, saldoAwalRows] = await Promise.all([
    prisma.coaAccount.findMany({ orderBy: { urutan: "asc" } }),
    prisma.transaction.findMany({
      where: {
        entityId,
        coaAccountId: { not: null },
        tanggal: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) },
      },
      select: { coaAccountId: true, debit: true, kredit: true },
    }),
    prisma.saldoAwal.findMany({ where: { entityId, year } }),
  ]);

  const totalsByAccount = new Map<string, { debit: number; kredit: number }>();
  for (const t of transactions) {
    if (!t.coaAccountId) continue;
    const cur = totalsByAccount.get(t.coaAccountId) ?? { debit: 0, kredit: 0 };
    cur.debit += Number(t.debit);
    cur.kredit += Number(t.kredit);
    totalsByAccount.set(t.coaAccountId, cur);
  }

  const saldoAwalByAccount = new Map(saldoAwalRows.map((s) => [s.coaAccountId, Number(s.nominal)]));

  const rows = allCoa.map((coa) => {
    const { debit, kredit } = totalsByAccount.get(coa.id) ?? { debit: 0, kredit: 0 };
    const saldoAwal = saldoAwalByAccount.get(coa.id) ?? 0;
    const saldoAkhir = hitungSaldoAkhir(coa.kategori, coa.code, saldoAwal, debit, kredit);
    return {
      coaId: coa.id,
      code: coa.code,
      name: coa.name,
      kategori: coa.kategori,
      saldoAwal,
      totalDebet: debit,
      totalKredit: kredit,
      saldoAkhir,
      saldoAwalFmt: formatRupiah(Math.abs(saldoAwal)),
      totalDebetFmt: debit > 0 ? formatRupiah(debit) : "-",
      totalKreditFmt: kredit > 0 ? formatRupiah(kredit) : "-",
      saldoAkhirFmt: formatRupiah(Math.abs(saldoAkhir)),
      saldoAkhirNegatif: saldoAkhir < 0,
      punyaTransaksi: debit > 0 || kredit > 0,
      alokasi: hitungAlokasi(coa.kategori),
    };
  });

  return { rows };
}
