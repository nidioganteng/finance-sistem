import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

async function getTxByKategori(entityIds: string[], kategori: "KEWAJIBAN" | "ASET", year: number) {
  const gte = new Date(year, 0, 1);
  const lt = new Date(year + 1, 0, 1);

  return prisma.transaction.findMany({
    where: {
      entityId: { in: entityIds },
      tanggal: { gte, lt },
      coaAccount: { kategori },
    },
    include: { coaAccount: true },
    orderBy: { tanggal: "asc" },
  });
}

export async function getLaporanUtangAsetData(entityIds: string[], year: number) {
  const [utangTx, asetTx] = await Promise.all([
    getTxByKategori(entityIds, "KEWAJIBAN", year),
    getTxByKategori(entityIds, "ASET", year),
  ]);

  // Utang: kredit ke akun KEWAJIBAN = nambah utang, debit = bayar utang
  const utangByAkun = new Map<string, { code: string; name: string; masuk: number; keluar: number }>();
  for (const tx of utangTx) {
    if (!tx.coaAccount) continue;
    const key = tx.coaAccount.id;
    if (!utangByAkun.has(key)) {
      utangByAkun.set(key, { code: tx.coaAccount.code, name: tx.coaAccount.name, masuk: 0, keluar: 0 });
    }
    const rec = utangByAkun.get(key)!;
    rec.masuk += Number(tx.kredit); // kredit = tambah utang
    rec.keluar += Number(tx.debit); // debit = bayar utang
  }

  const utangRows = [...utangByAkun.values()].map((r) => ({
    ...r,
    saldo: r.masuk - r.keluar,
    masukFmt: formatRupiah(r.masuk),
    keluarFmt: formatRupiah(r.keluar),
    saldoFmt: formatRupiah(Math.abs(r.masuk - r.keluar)),
    saldoPositif: r.masuk >= r.keluar,
  }));
  const totalUtang = utangRows.reduce((s, r) => s + r.saldo, 0);

  // Aset: debit ke akun ASET = tambah aset, kredit = pengurangan/penyusutan
  const asetByAkun = new Map<string, { code: string; name: string; masuk: number; keluar: number }>();
  for (const tx of asetTx) {
    if (!tx.coaAccount) continue;
    const key = tx.coaAccount.id;
    if (!asetByAkun.has(key)) {
      asetByAkun.set(key, { code: tx.coaAccount.code, name: tx.coaAccount.name, masuk: 0, keluar: 0 });
    }
    const rec = asetByAkun.get(key)!;
    rec.masuk += Number(tx.debit);  // debit = tambah aset
    rec.keluar += Number(tx.kredit); // kredit = kurang aset
  }

  const asetRows = [...asetByAkun.values()].map((r) => ({
    ...r,
    saldo: r.masuk - r.keluar,
    masukFmt: formatRupiah(r.masuk),
    keluarFmt: formatRupiah(r.keluar),
    saldoFmt: formatRupiah(Math.abs(r.masuk - r.keluar)),
    saldoPositif: r.masuk >= r.keluar,
  }));
  const totalAset = asetRows.reduce((s, r) => s + r.saldo, 0);

  return {
    utang: {
      rows: utangRows,
      total: totalUtang,
      totalFmt: formatRupiah(Math.abs(totalUtang)),
    },
    aset: {
      rows: asetRows,
      total: totalAset,
      totalFmt: formatRupiah(Math.abs(totalAset)),
    },
    networth: totalAset - totalUtang,
    networthFmt: formatRupiah(Math.abs(totalAset - totalUtang)),
    networthPositif: totalAset >= totalUtang,
    year,
  };
}
