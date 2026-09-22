import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { CoaKategori } from "@prisma/client";

const DEBET_NORMAL: CoaKategori[] = [CoaKategori.ASET, CoaKategori.BEBAN];

export type CoaLine = { code: string; name: string; saldo: number; saldoFmt: string };

const SUMBER_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  kasKecil: { bg: "#fef3c7", color: "#92400e", label: "Kas Kecil" },
  kasBesar: { bg: "#dbeafe", color: "#1e40af", label: "Kas Besar" },
  bankBuku: { bg: "#dcfce7", color: "#166534", label: "Buku Bank" },
};

export async function getLaporanKeuanganData(entityIds: string[] | string, year: number) {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  const transactions = await prisma.transaction.findMany({
    where: {
      entityId: { in: ids },
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

export type LaporanJurnalRow = {
  id: string;
  tanggal: string;
  tanggalRaw: Date;
  noBukti: string;
  entityKey: string;
  entityName: string;
  entityColor: string;
  sumberKey: string;
  sumberLabel: string;
  sumberBg: string;
  sumberColor: string;
  keterangan: string;
  isKasEntry: boolean;
  kodeAkun: string;
  namaAkun: string;
  debit: number;
  kredit: number;
  debitFmt: string;
  kreditFmt: string;
  staffName: string;
};

export async function getLaporanJurnalData(
  entityIds: string[] | string,
  year: number,
  limit = 80,
  filterSumber?: string
) {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31T23:59:59`);

  const whereClause = {
    entityId: { in: ids },
    tanggal: { gte: startDate, lte: endDate },
    ...(filterSumber && filterSumber !== "semua" ? { jenisInput: { key: filterSumber } } : {}),
  };

  const [totalCount, rows] = await Promise.all([
    prisma.transaction.count({ where: whereClause }),
    prisma.transaction.findMany({
      where: whereClause,
      include: {
        entity: true,
        jenisInput: true,
        coaAccount: true,
        staff: true,
      },
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
  ]);

  const totalDebit = rows.reduce((s, r) => s + Number(r.debit), 0);
  const totalKredit = rows.reduce((s, r) => s + Number(r.kredit), 0);
  const isBalanced = Math.round(totalDebit * 100) === Math.round(totalKredit * 100);

  const formattedRows: LaporanJurnalRow[] = rows.map((r) => {
    const style = SUMBER_STYLE[r.jenisInput.key] ?? { bg: "#ede9fe", color: "#6d28d9", label: r.jenisInput.nama };
    const extra = r.extraFieldsJson as Record<string, unknown> | null;
    const isKasEntry = extra?.isKasEntry === true;

    let kodeAkun = r.coaAccount?.code ?? "—";
    let namaAkun = r.coaAccount?.name ?? "—";
    if (isKasEntry && !r.coaAccount) {
      kodeAkun = "—";
      namaAkun =
        r.jenisInput.key === "kasKecil" ? "Kas Kecil" :
        r.jenisInput.key === "kasBesar" ? "Kas" :
        typeof extra?.rekeningNama === "string" ? extra.rekeningNama : "Rekening Bank";
    }

    const debit = Number(r.debit);
    const kredit = Number(r.kredit);

    return {
      id: r.id,
      tanggal: r.tanggal.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      tanggalRaw: r.tanggal,
      noBukti: r.noBukti,
      entityKey: r.entity.key,
      entityName: r.entity.name,
      entityColor: r.entity.colorHex,
      sumberKey: r.jenisInput.key,
      sumberLabel: style.label,
      sumberBg: style.bg,
      sumberColor: style.color,
      keterangan: r.keterangan,
      isKasEntry,
      kodeAkun,
      namaAkun,
      debit,
      kredit,
      debitFmt: debit > 0 ? formatRupiah(debit) : "-",
      kreditFmt: kredit > 0 ? formatRupiah(kredit) : "-",
      staffName: r.staff.name,
    };
  });

  return {
    totalCount,
    totalDebit,
    totalKredit,
    totalDebitFmt: formatRupiah(totalDebit),
    totalKreditFmt: formatRupiah(totalKredit),
    isBalanced,
    rows: formattedRows,
  };
}

export type LaporanBankRow = {
  id: string;
  tanggal: string;
  tanggalRaw: Date;
  noBukti: string;
  entityKey: string;
  entityName: string;
  entityColor: string;
  rekeningNama: string;
  keterangan: string;
  isKasEntry: boolean;
  kodeAkun: string;
  namaAkun: string;
  penerimaan: number;
  pengeluaran: number;
  penerimaanFmt: string;
  pengeluaranFmt: string;
  saldoSetelah: number;
  saldoSetelahFmt: string;
  staffName: string;
};

export async function getLaporanBankData(
  entityIds: string[] | string,
  year: number,
  limit = 80
) {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31T23:59:59`);

  const whereClause = {
    entityId: { in: ids },
    jenisInput: { key: "bankBuku" },
    tanggal: { gte: startDate, lte: endDate },
  };

  const [totalCount, rows] = await Promise.all([
    prisma.transaction.count({ where: whereClause }),
    prisma.transaction.findMany({
      where: whereClause,
      include: {
        entity: true,
        coaAccount: true,
        staff: true,
      },
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
  ]);

  let totalPenerimaan = 0;
  let totalPengeluaran = 0;

  const formattedRows: LaporanBankRow[] = rows.map((r) => {
    const extra = r.extraFieldsJson as Record<string, unknown> | null;
    const isKasEntry = extra?.isKasEntry === true;
    const rekeningNama = typeof extra?.rekeningNama === "string" ? extra.rekeningNama : "Rekening Bank";

    const debit = Number(r.debit);
    const kredit = Number(r.kredit);

    let penerimaan = 0;
    let pengeluaran = 0;
    if (isKasEntry) {
      penerimaan = debit;
      pengeluaran = kredit;
    } else {
      penerimaan = kredit;
      pengeluaran = debit;
    }
    totalPenerimaan += penerimaan;
    totalPengeluaran += pengeluaran;

    let kodeAkun = r.coaAccount?.code ?? "—";
    let namaAkun = r.coaAccount?.name ?? (isKasEntry ? rekeningNama : "—");

    return {
      id: r.id,
      tanggal: r.tanggal.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      tanggalRaw: r.tanggal,
      noBukti: r.noBukti,
      entityKey: r.entity.key,
      entityName: r.entity.name,
      entityColor: r.entity.colorHex,
      rekeningNama,
      keterangan: r.keterangan,
      isKasEntry,
      kodeAkun,
      namaAkun,
      penerimaan,
      pengeluaran,
      penerimaanFmt: penerimaan > 0 ? formatRupiah(penerimaan) : "-",
      pengeluaranFmt: pengeluaran > 0 ? formatRupiah(pengeluaran) : "-",
      saldoSetelah: Number(r.saldoSetelah),
      saldoSetelahFmt: formatRupiah(Number(r.saldoSetelah)),
      staffName: r.staff.name,
    };
  });

  return {
    totalCount,
    totalPenerimaan,
    totalPengeluaran,
    totalPenerimaanFmt: formatRupiah(totalPenerimaan),
    totalPengeluaranFmt: formatRupiah(totalPengeluaran),
    netMutasi: totalPenerimaan - totalPengeluaran,
    netMutasiFmt: formatRupiah(Math.abs(totalPenerimaan - totalPengeluaran)),
    netPositive: totalPenerimaan >= totalPengeluaran,
    rows: formattedRows,
  };
}
