import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { CoaKategori } from "@prisma/client";
import { DEBET_NORMAL, hitungSaldoAkhir } from "./akuntansi";

// ── Tampilan Rekap ───────────────────────────────────────────────
// Satu baris per akun COA: Saldo Awal | Total Debet | Total Kredit | Saldo Akhir
export async function getBukuBesarRekap(entityId: string, year: number) {
  const [transactions, saldoAwalRows] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        entityId,
        coaAccountId: { not: null },
        tanggal: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) },
      },
      include: { coaAccount: true },
      orderBy: [{ tanggal: "asc" }, { createdAt: "asc" }],
    }),
    prisma.saldoAwal.findMany({ where: { entityId, year } }),
  ]);

  const saldoAwalByAccount = new Map(saldoAwalRows.map((s) => [s.coaAccountId, Number(s.nominal)]));

  const grouped = new Map<
    string,
    { coaId: string; code: string; name: string; kategori: CoaKategori; totalDebet: number; totalKredit: number }
  >();

  for (const t of transactions) {
    if (!t.coaAccount) continue;
    if (!grouped.has(t.coaAccountId!)) {
      grouped.set(t.coaAccountId!, {
        coaId: t.coaAccountId!,
        code: t.coaAccount.code,
        name: t.coaAccount.name,
        kategori: t.coaAccount.kategori,
        totalDebet: 0,
        totalKredit: 0,
      });
    }
    const g = grouped.get(t.coaAccountId!)!;
    g.totalDebet += Number(t.debit);
    g.totalKredit += Number(t.kredit);
  }

  const rows = Array.from(grouped.values())
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((g) => {
      const saldoAwal = saldoAwalByAccount.get(g.coaId) ?? 0;
      const saldoAkhir = hitungSaldoAkhir(g.kategori, saldoAwal, g.totalDebet, g.totalKredit);
      return {
        coaId: g.coaId,
        code: g.code,
        name: g.name,
        kategori: g.kategori,
        saldoAwal,
        totalDebet: g.totalDebet,
        totalKredit: g.totalKredit,
        saldoAkhir,
        saldoAwalFmt: formatRupiah(Math.abs(saldoAwal)),
        totalDebetFmt: formatRupiah(g.totalDebet),
        totalKreditFmt: formatRupiah(g.totalKredit),
        saldoAkhirFmt: formatRupiah(Math.abs(saldoAkhir)),
        saldoAkhirNegatif: saldoAkhir < 0,
      };
    });

  const totalSemuaDebet = rows.reduce((s, r) => s + r.totalDebet, 0);
  const totalSemuaKredit = rows.reduce((s, r) => s + r.totalKredit, 0);
  const isBalanced = Math.round(totalSemuaDebet * 100) === Math.round(totalSemuaKredit * 100);

  return {
    rows,
    totalSemuaDebet,
    totalSemuaKredit,
    totalSemuaDebetFmt: formatRupiah(totalSemuaDebet),
    totalSemuaKreditFmt: formatRupiah(totalSemuaKredit),
    isBalanced,
  };
}

// ── Tampilan Drill-down ──────────────────────────────────────────
// Semua baris jurnal yang menyentuh satu akun, dengan saldo berjalan per akun
export async function getBukuBesarDrilldown(entityId: string, coaId: string, year: number) {
  const [coa, saldoAwalRow] = await Promise.all([
    prisma.coaAccount.findUnique({ where: { id: coaId } }),
    prisma.saldoAwal.findUnique({ where: { entityId_coaAccountId_year: { entityId, coaAccountId: coaId, year } } }),
  ]);
  if (!coa) return null;

  const saldoAwal = Number(saldoAwalRow?.nominal ?? 0);

  const transactions = await prisma.transaction.findMany({
    where: {
      entityId,
      coaAccountId: coaId,
      tanggal: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) },
    },
    orderBy: [{ tanggal: "asc" }, { createdAt: "asc" }],
  });

  const isDebetNormal = DEBET_NORMAL.includes(coa.kategori);
  let saldo = saldoAwal;

  const entries = transactions.map((t) => {
    const debit = Number(t.debit);
    const kredit = Number(t.kredit);
    saldo += isDebetNormal ? debit - kredit : kredit - debit;
    return {
      tanggal: t.tanggal.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      noBukti: t.noBukti,
      keterangan: t.keterangan,
      debitFmt: debit > 0 ? formatRupiah(debit) : "-",
      kreditFmt: kredit > 0 ? formatRupiah(kredit) : "-",
      saldoFmt: formatRupiah(Math.abs(saldo)),
      saldoNegatif: saldo < 0,
    };
  });

  const totalDebet = transactions.reduce((s, t) => s + Number(t.debit), 0);
  const totalKredit = transactions.reduce((s, t) => s + Number(t.kredit), 0);

  return {
    coa: { id: coa.id, code: coa.code, name: coa.name, kategori: coa.kategori },
    entries,
    saldoAwal,
    saldoAwalFmt: formatRupiah(Math.abs(saldoAwal)),
    saldoAwalNegatif: saldoAwal < 0,
    totalDebetFmt: formatRupiah(totalDebet),
    totalKreditFmt: formatRupiah(totalKredit),
    saldoAkhirFmt: formatRupiah(Math.abs(saldo)),
    saldoAkhirNegatif: saldo < 0,
  };
}
