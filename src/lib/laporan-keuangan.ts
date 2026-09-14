import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { CoaKategori } from "@prisma/client";

const DEBET_NORMAL: CoaKategori[] = [CoaKategori.ASET, CoaKategori.BEBAN];

export type CoaLine = { code: string; name: string; saldo: number; saldoFmt: string };

export async function getLaporanKeuanganData(entityId: string, year: number) {
  const transactions = await prisma.transaction.findMany({
    where: {
      entityId,
      coaAccountId: { not: null },
      tanggal: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31T23:59:59`),
      },
    },
    include: { coaAccount: true },
    orderBy: { tanggal: "asc" },
  });

  // Build saldo per COA (correct normal balance direction)
  const coaMap = new Map<string, { id: string; code: string; name: string; kategori: CoaKategori; saldo: number }>();

  for (const t of transactions) {
    if (!t.coaAccount) continue;
    const id = t.coaAccountId!;
    if (!coaMap.has(id)) {
      coaMap.set(id, { id, code: t.coaAccount.code, name: t.coaAccount.name, kategori: t.coaAccount.kategori, saldo: 0 });
    }
    const item = coaMap.get(id)!;
    item.saldo += DEBET_NORMAL.includes(t.coaAccount.kategori)
      ? Number(t.debit) - Number(t.kredit)
      : Number(t.kredit) - Number(t.debit);
  }

  const bySaldo = (kat: CoaKategori): CoaLine[] =>
    Array.from(coaMap.values())
      .filter((i) => i.kategori === kat)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((i) => ({ code: i.code, name: i.name, saldo: i.saldo, saldoFmt: formatRupiah(Math.abs(i.saldo)) }));

  const aset = bySaldo(CoaKategori.ASET);
  const kewajiban = bySaldo(CoaKategori.KEWAJIBAN);
  const modal = bySaldo(CoaKategori.MODAL);
  const pendapatan = bySaldo(CoaKategori.PENDAPATAN);
  const beban = bySaldo(CoaKategori.BEBAN);

  // ── Laba Rugi ──────────────────────────────────────────────────────
  const totalPendapatan = pendapatan.reduce((s, i) => s + i.saldo, 0);
  const totalBeban = beban.reduce((s, i) => s + i.saldo, 0);
  const labaBersih = totalPendapatan - totalBeban; // angka ini SAMA di Neraca & Arus Kas

  // ── Neraca ─────────────────────────────────────────────────────────
  const totalAset = aset.reduce((s, i) => s + i.saldo, 0);
  const totalKewajiban = kewajiban.reduce((s, i) => s + i.saldo, 0);
  const totalModal = modal.reduce((s, i) => s + i.saldo, 0);
  // Laba Tahun Berjalan diinjeksi ke Modal (angka sama dari Laba Rugi)
  const totalPassiva = totalKewajiban + totalModal + labaBersih;
  const neracaBalanced = Math.abs(totalAset - totalPassiva) < 1;

  // ── Arus Kas — Metode Tidak Langsung ──────────────────────────────
  // Kas/bank ASET = accounts with code starting "1-"
  const kasAset = aset.filter((i) => i.code.startsWith("1-"));
  const asetNonKas = aset.filter((i) => !i.code.startsWith("1-"));
  const totalKasBank = kasAset.reduce((s, i) => s + i.saldo, 0);

  const kasAwal = 0; // saldo awal periode (belum ada carry-over)

  // Aktivitas Operasi (indirect): Laba Bersih ± penyesuaian
  const perubahanAsetNonKas = -(asetNonKas.reduce((s, i) => s + i.saldo, 0));
  const perubahanKewajiban = totalKewajiban;
  const kasOperasi = labaBersih + perubahanAsetNonKas + perubahanKewajiban;

  // Aktivitas Investasi: perolehan/pelepasan aset tetap
  // Aset tetap = ASET non-kas non-piutang; untuk saat ini belum ada
  const kasInvestasi = 0;

  // Aktivitas Pendanaan: perubahan modal bersih dari transaksi
  const kasPendanaan = totalModal;

  const kenaikanBersihKas = kasOperasi + kasInvestasi + kasPendanaan;
  const kasAkhir = kasAwal + kenaikanBersihKas;
  // Validasi: kasAkhir harus sama dengan total Kas+Bank di Neraca
  const arusKasBalanced = Math.abs(kasAkhir - totalKasBank) < 1;

  return {
    // ── Laba Rugi
    pendapatan,
    beban,
    totalPendapatan,
    totalBeban,
    labaBersih,
    totalPendapatanFmt: formatRupiah(totalPendapatan),
    totalBebanFmt: formatRupiah(totalBeban),
    labaBersihFmt: formatRupiah(Math.abs(labaBersih)),
    labaBersihPositive: labaBersih >= 0,

    // ── Neraca
    aset,
    kewajiban,
    modal,
    totalAset,
    totalKewajiban,
    totalModal,
    totalPassiva,
    neracaBalanced,
    totalAsetFmt: formatRupiah(totalAset),
    totalKewajibanFmt: formatRupiah(totalKewajiban),
    totalModalFmt: formatRupiah(totalModal),
    totalPassivaFmt: formatRupiah(totalPassiva),

    // ── Arus Kas
    kasAwal,
    kasOperasi,
    kasInvestasi,
    kasPendanaan,
    kenaikanBersihKas,
    kasAkhir,
    totalKasBank,
    arusKasBalanced,
    perubahanAsetNonKas,
    perubahanKewajiban,
    kasAwalFmt: formatRupiah(Math.abs(kasAwal)),
    kasOperasiFmt: formatRupiah(Math.abs(kasOperasi)),
    kasInvestasiFmt: formatRupiah(Math.abs(kasInvestasi)),
    kasPendanaanFmt: formatRupiah(Math.abs(kasPendanaan)),
    kenaikanBersihFmt: formatRupiah(Math.abs(kenaikanBersihKas)),
    kasAkhirFmt: formatRupiah(Math.abs(kasAkhir)),
    kasAsetFmt: formatRupiah(totalKasBank),
  };
}
