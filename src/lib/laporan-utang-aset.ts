import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { isAutoPostedMirror } from "./akuntansi";

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

export interface AkunUtangAsetRow {
  code: string;
  name: string;
  saldoAwal: number;
  masuk: number;
  keluar: number;
  saldo: number;
  saldoAwalFmt: string;
  masukFmt: string;
  keluarFmt: string;
  saldoFmt: string;
  saldoPositif: boolean;
}

export async function getLaporanUtangAsetData(entityIds: string[], year: number) {
  const gte = new Date(year, 0, 1);
  const lt = new Date(year + 1, 0, 1);

  const [allKewajibanCoa, allAsetCoa, saldoAwalRows, utangTx, asetTx] = await Promise.all([
    prisma.coaAccount.findMany({
      where: { kategori: "KEWAJIBAN" },
      orderBy: { code: "asc" },
    }),
    prisma.coaAccount.findMany({
      where: { kategori: "ASET" },
      orderBy: { code: "asc" },
    }),
    prisma.saldoAwal.findMany({
      where: {
        entityId: { in: entityIds },
        year,
      },
    }),
    prisma.transaction.findMany({
      where: {
        entityId: { in: entityIds },
        tanggal: { gte, lt },
        coaAccount: { kategori: "KEWAJIBAN" },
      },
      select: { coaAccountId: true, debit: true, kredit: true, extraFieldsJson: true },
    }),
    prisma.transaction.findMany({
      where: {
        entityId: { in: entityIds },
        tanggal: { gte, lt },
        coaAccount: { kategori: "ASET" },
      },
      select: { coaAccountId: true, debit: true, kredit: true, extraFieldsJson: true },
    }),
  ]);

  // Map saldo awal per COA ID
  const saldoAwalByAccount = new Map<string, number>();
  for (const s of saldoAwalRows) {
    saldoAwalByAccount.set(
      s.coaAccountId,
      (saldoAwalByAccount.get(s.coaAccountId) ?? 0) + Number(s.nominal)
    );
  }

  // Mutasi Utang: kredit = penambahan utang, debit = pembayaran utang
  const utangMutasi = new Map<string, { masuk: number; keluar: number }>();
  for (const tx of utangTx) {
    if (!tx.coaAccountId) continue;
    if (isAutoPostedMirror(tx)) continue;
    const cur = utangMutasi.get(tx.coaAccountId) ?? { masuk: 0, keluar: 0 };
    cur.masuk += Number(tx.kredit);
    cur.keluar += Number(tx.debit);
    utangMutasi.set(tx.coaAccountId, cur);
  }

  // Susun seluruh akun kewajiban lengkap (Issue 88 Poin 4)
  const utangRows: AkunUtangAsetRow[] = allKewajibanCoa.map((coa) => {
    const sa = saldoAwalByAccount.get(coa.id) ?? 0;
    const mut = utangMutasi.get(coa.id) ?? { masuk: 0, keluar: 0 };
    const saldoAkhir = sa + mut.masuk - mut.keluar;

    return {
      code: coa.code,
      name: coa.name,
      saldoAwal: sa,
      masuk: mut.masuk,
      keluar: mut.keluar,
      saldo: saldoAkhir,
      saldoAwalFmt: formatRupiah(Math.abs(sa)),
      masukFmt: formatRupiah(mut.masuk),
      keluarFmt: formatRupiah(mut.keluar),
      saldoFmt: formatRupiah(Math.abs(saldoAkhir)),
      saldoPositif: saldoAkhir >= 0,
    };
  });

  // Urutkan akun yang memiliki nilai di atas, lalu yang 0 di bawah
  utangRows.sort((a, b) => {
    const hasValA = a.saldoAwal !== 0 || a.masuk !== 0 || a.keluar !== 0;
    const hasValB = b.saldoAwal !== 0 || b.masuk !== 0 || b.keluar !== 0;
    if (hasValA && !hasValB) return -1;
    if (!hasValA && hasValB) return 1;
    return a.code.localeCompare(b.code);
  });

  const totalUtang = utangRows.reduce((s, r) => s + r.saldo, 0);

  // Mutasi Aset: debit = penambahan aset, kredit = pengurangan aset
  const asetMutasi = new Map<string, { masuk: number; keluar: number }>();
  for (const tx of asetTx) {
    if (!tx.coaAccountId) continue;
    if (isAutoPostedMirror(tx)) continue;
    const cur = asetMutasi.get(tx.coaAccountId) ?? { masuk: 0, keluar: 0 };
    cur.masuk += Number(tx.debit);
    cur.keluar += Number(tx.kredit);
    asetMutasi.set(tx.coaAccountId, cur);
  }

  const asetRows: AkunUtangAsetRow[] = allAsetCoa
    .map((coa) => {
      const sa = saldoAwalByAccount.get(coa.id) ?? 0;
      const mut = asetMutasi.get(coa.id) ?? { masuk: 0, keluar: 0 };
      const saldoAkhir = sa + mut.masuk - mut.keluar;

      return {
        code: coa.code,
        name: coa.name,
        saldoAwal: sa,
        masuk: mut.masuk,
        keluar: mut.keluar,
        saldo: saldoAkhir,
        saldoAwalFmt: formatRupiah(Math.abs(sa)),
        masukFmt: formatRupiah(mut.masuk),
        keluarFmt: formatRupiah(mut.keluar),
        saldoFmt: formatRupiah(Math.abs(saldoAkhir)),
        saldoPositif: saldoAkhir >= 0,
      };
    })
    .filter((a) => a.saldoAwal !== 0 || a.masuk !== 0 || a.keluar !== 0);

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
