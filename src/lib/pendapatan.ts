import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { REKENING_BY_ENTITY } from "./bank-accounts";

export const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export interface HitungPajakResult {
  ppn: number;
  pph: number;
  nilaiProyek: number;
  labaSetelahPajak: number;
}

/**
 * Menghitung DPP Dasar dari Nilai Kwitansi (Kredit Akun Pendapatan):
 * DPP = 100 / 111 * Nilai Kwitansi
 */
export function hitungDppDariKwitansi(nilaiKwitansi: number): number {
  if (!nilaiKwitansi || nilaiKwitansi <= 0) return 0;
  return Math.round((nilaiKwitansi * 100) / 111);
}

/**
 * Menghitung DPP Nilai Lain dari DPP Dasar:
 * DPP Nilai Lain = 11 / 12 * DPP Awal
 */
export function hitungDppNilaiLain(dpp: number): number {
  if (!dpp || dpp <= 0) return 0;
  return Math.round((dpp * 11) / 12);
}

export function hitungPajakFaktur(
  dpp: number,
  dppNilaiLain: number,
  tarifPpnPersen = 12,
  tarifPphPersen = 3.5,
  nilaiKwitansiManual?: number
): HitungPajakResult {
  const ppn = Math.round((dppNilaiLain * tarifPpnPersen) / 100);
  const pph = Math.round((dpp * tarifPphPersen) / 100);
  const nilaiProyek =
    nilaiKwitansiManual !== undefined && nilaiKwitansiManual > 0
      ? nilaiKwitansiManual
      : (tarifPpnPersen === 0 ? dpp : Math.round((dpp * 111) / 100));
  const labaSetelahPajak = Math.round(nilaiProyek - ppn - pph);

  return {
    ppn,
    pph,
    nilaiProyek,
    labaSetelahPajak,
  };
}

export interface FakturPendapatanItem {
  id: string;
  entityId: string;
  npwp: string;
  noFaktur: string;
  masaPajak: number;
  namaBulan: string;
  tahunPajak: number;
  namaRekanan: string;
  namaJkp: string;
  dpp: number;
  dppNilaiLain: number;
  tarifPpnPersen: number;
  tarifPphPersen: number;
  ppn: number;
  pph: number;
  nilaiProyek: number;
  labaSetelahPajak: number;
  kodeJenisProyek: number; // 1 = Perencanaan, 2 = Pengawasan
  jenisProyekLabel: string;
  pekerjaanPerusahaan: number;
  pekerjaanYangDipinjam: number;
  tanggalTerima: string | null; // YYYY-MM-DD or null
  bank: string | null;
  nominalDiterima: number;
  isRealized: boolean; // uang sudah masuk kas/bank
  ceklisPpn: boolean; // ceklis fisik dokumen PPN
  ceklisPph: boolean; // ceklis fisik dokumen PPh
  ceklisBuktiPotong: boolean; // ceklis fisik bukti potong
  selisihBank: number;
  selisihBankFmt: string;
  balanceStatus: "BALANCE" | "SELISIH" | "BELUM_CAIR";
  matchedJurnalNoBukti: string | null;
  projectId: string | null;
  projectName: string | null;
  projectCode: string | null;
  bankTransactionId: string | null;
  createdAt: string;

  dppFmt: string;
  dppNilaiLainFmt: string;
  ppnFmt: string;
  pphFmt: string;
  nilaiProyekFmt: string;
  labaSetelahPajakFmt: string;
  nominalDiterimaFmt: string;
  pekerjaanPerusahaanFmt: string;
  pekerjaanYangDipinjamFmt: string;
}

export interface RekapBulananItem {
  month: number;
  namaBulan: string;
  jumlahFaktur: number;
  dpp: number;
  dppNilaiLain: number;
  ppn: number;
  pph: number;
  nilaiProyek: number;
  labaSetelahPajak: number;
  nominalDiterima: number;
  pekerjaanPerusahaan: number;
  pekerjaanYangDipinjam: number;

  dppFmt: string;
  dppNilaiLainFmt: string;
  ppnFmt: string;
  pphFmt: string;
  nilaiProyekFmt: string;
  labaSetelahPajakFmt: string;
  nominalDiterimaFmt: string;
}

export interface RekonsiliasiPajakItem {
  month: number;
  namaBulan: string;
  dppRekap: number;
  dppTerlapor: number;
  selisihDpp: number;
  ppnRekap: number;
  pajakTerlapor: number; // PPN Terlapor di SPT
  selisihPajak: number; // Selisih PPN
  pphRekap: number;
  pphTerlapor: number; // PPh Terlapor di SPT
  selisihPph: number; // Selisih PPh
  totalPajakRekap: number;
  totalPajakTerlapor: number;
  selisihTotalPajak: number;
  keterangan: string;
  status: "MATCH" | "SELISIH" | "BELUM_DILAPORKAN";

  dppRekapFmt: string;
  dppTerlaporFmt: string;
  selisihDppFmt: string;
  ppnRekapFmt: string;
  pajakTerlaporFmt: string;
  selisihPajakFmt: string;
  pphRekapFmt: string;
  pphTerlaporFmt: string;
  selisihPphFmt: string;
  totalPajakRekapFmt: string;
  totalPajakTerlaporFmt: string;
  selisihTotalPajakFmt: string;
}

export interface LaporanPendapatanData {
  entity: {
    id: string;
    key: string;
    name: string;
    legalName: string;
  };
  year: number;
  masaPajak: number | null; // null jika setahun
  fakturList: FakturPendapatanItem[];
  totalPeriod: {
    jumlahFaktur: number;
    dpp: number;
    dppNilaiLain: number;
    ppn: number;
    pph: number;
    nilaiProyek: number;
    labaSetelahPajak: number;
    nominalDiterima: number;
    pekerjaanPerusahaan: number;
    pekerjaanYangDipinjam: number;

    dppFmt: string;
    dppNilaiLainFmt: string;
    ppnFmt: string;
    pphFmt: string;
    nilaiProyekFmt: string;
    labaSetelahPajakFmt: string;
    nominalDiterimaFmt: string;
    pekerjaanPerusahaanFmt: string;
    pekerjaanYangDipinjamFmt: string;
  };
  rekapBulanan: RekapBulananItem[];
  totalTahunanRekap: RekapBulananItem;
  rekonsiliasiList: RekonsiliasiPajakItem[];
  kpiSummary: {
    totalNilaiProyek: number;
    totalNilaiProyekFmt: string;
    totalDpp: number;
    totalDppFmt: string;
    totalPajak: number;
    totalPajakFmt: string;
    totalLabaSetelahPajak: number;
    totalLabaSetelahPajakFmt: string;
    totalNominalDiterima: number;
    totalNominalDiterimaFmt: string;
    totalSelisihPajak: number;
    totalSelisihPajakFmt: string;
    jumlahBulanSelisih: number;
    statusAudit: "SEMUA_SESUAI" | "PERLU_REKONSILIASI";
  };
  tarifList: Array<{
    id: string;
    nama: string;
    jenis: string;
    tarifPersen: number;
  }>;
  projectOptions: Array<{
    id: string;
    code: string;
    name: string;
    contractValue: number;
    contractValueFmt: string;
    termins: Array<{
      id: string;
      name: string;
      percentage: number;
      nominal: number;
      nominalFmt: string;
    }>;
  }>;
  bankOptions: Array<{
    id: string;
    nama: string;
  }>;
}

export async function getLaporanPendapatanData(
  entityKeyOrId: string,
  year: number,
  masaPajak?: number | null
): Promise<LaporanPendapatanData | null> {
  const entity = await prisma.entity.findFirst({
    where: {
      OR: [{ id: entityKeyOrId }, { key: entityKeyOrId }],
    },
  });

  if (!entity) return null;

  // 1. Ambil data faktur untuk tahun terkait (dan filter bulan jika ada)
  const fakturRaw = await prisma.fakturPendapatan.findMany({
    where: {
      entityId: entity.id,
      tahunPajak: year,
      ...(masaPajak ? { masaPajak } : {}),
    },
    include: {
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: [
      { masaPajak: "asc" },
      { createdAt: "asc" },
    ],
  });

  // Ambil semua faktur tahun ini untuk rekap 12 bulan (meskipun filter masaPajak aktif)
  const allYearFakturRaw =
    masaPajak != null
      ? await prisma.fakturPendapatan.findMany({
          where: {
            entityId: entity.id,
            tahunPajak: year,
          },
          include: {
            project: { select: { id: true, code: true, name: true } },
          },
          orderBy: [{ masaPajak: "asc" }, { createdAt: "asc" }],
        })
      : fakturRaw;

  // 2. Ambil data rekonsiliasi tahun ini
  const rekonsiliasiRaw = await prisma.rekonsiliasiPajakBulanan.findMany({
    where: {
      entityId: entity.id,
      year,
    },
    orderBy: { month: "asc" },
  });

  const rekonsiliasiMap = new Map<number, (typeof rekonsiliasiRaw)[0]>();
  for (const r of rekonsiliasiRaw) {
    rekonsiliasiMap.set(r.month, r);
  }

  // 3. Ambil tarif pajak aktif
  const tarifRaw = await prisma.tarifPajak.findMany({
    where: { active: true },
    orderBy: [{ jenis: "asc" }, { tarifPersen: "asc" }],
  });

  // 4. Ambil opsi proyek beserta termin (semua proyek aktif, urutkan entitas ini dulu)
  const allProjectsRaw = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    include: {
      entity: { select: { id: true, key: true, name: true } },
      termin: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { code: "asc" },
  });

  const projects = [...allProjectsRaw].sort((a, b) => {
    const aCurrent = a.entityId === entity.id;
    const bCurrent = b.entityId === entity.id;
    if (aCurrent && !bCurrent) return -1;
    if (!aCurrent && bCurrent) return 1;
    return a.code.localeCompare(b.code);
  });

  // 5. Opsi Bank Rekening
  const defaultBankList = REKENING_BY_ENTITY[entity.key] ?? [
    { id: "bpd", nama: "BPD" },
    { id: "bri", nama: "BRI" },
    { id: "bni", nama: "BNI" },
    { id: "mdr", nama: "MANDIRI" },
  ];

  // Kumpulkan seluruh nomor faktur tahun ini untuk pencarian mutasi penerimaan bank di Jurnal Umum
  const allNoFakturs = [
    ...new Set(
      allYearFakturRaw
        .map((f) => f.noFaktur.trim())
        .filter(Boolean)
    ),
  ];

  const allFakturIds = allYearFakturRaw.map((f) => f.id);

  // Penarikan Data Berbasis Nomor Faktur & FakturId:
  // Ambil transaksi Jurnal Umum (Kas Masuk / Bank) yang memiliki relasi fakturId, noBukti, atau keterangan sesuai nomor faktur
  const matchingTransactions =
    allNoFakturs.length > 0 || allFakturIds.length > 0
      ? await prisma.transaction.findMany({
          where: {
            entityId: entity.id,
            OR: [
              ...(allFakturIds.length > 0 ? [{ fakturId: { in: allFakturIds } }] : []),
              ...(allNoFakturs.length > 0 ? [{ noBukti: { in: allNoFakturs } }] : []),
              ...allNoFakturs.map((nf) => ({ keterangan: { contains: nf } })),
            ],
          },
          include: {
            coaAccount: { select: { id: true, code: true, name: true, kategori: true } },
            jenisInput: { select: { id: true, key: true, nama: true } },
          },
          orderBy: { tanggal: "asc" },
        })
      : [];

  // Helper untuk mengekstrak data pencairan riil dari Jurnal Umum berdasarkan Nomor Faktur & fakturId
  function extractJurnalDataForFaktur(
    fakturId: string,
    noFaktur: string,
    fTanggalTerima: Date | null,
    fBank: string | null,
    fNominalDiterima: number,
    fPpn: number,
    fPph: number
  ) {
    const trimmed = noFaktur.trim().toLowerCase();
    const matches = matchingTransactions.filter(
      (tx) =>
        (tx.fakturId && tx.fakturId === fakturId) ||
        (tx.noBukti && tx.noBukti.trim().toLowerCase() === trimmed) ||
        (tx.keterangan && tx.keterangan.toLowerCase().includes(trimmed))
    );

    if (matches.length > 0) {
      // 1. Nominal masuk bank (Debit ke Kas/Bank/Aset)
      const bankRows = matches.filter(
        (tx) =>
          Number(tx.debit) > 0 &&
          (tx.coaAccount?.kategori === "ASET" ||
            /bank|kas|bpd|bri|bni|mandiri/i.test(tx.coaAccount?.name ?? ""))
      );
      const totalBankDebit = bankRows.reduce((sum, tx) => sum + Number(tx.debit), 0);

      // 2. Potongan PPN (Debit ke PPN / 535)
      const ppnRows = matches.filter(
        (tx) =>
          Number(tx.debit) > 0 &&
          (/ppn/i.test(tx.coaAccount?.name ?? "") || tx.coaAccount?.code === "535")
      );
      const totalPpnDebit = ppnRows.reduce((sum, tx) => sum + Number(tx.debit), 0);

      // 3. Potongan PPh (Debit ke PPh / 532, 533, 534)
      const pphRows = matches.filter(
        (tx) =>
          Number(tx.debit) > 0 &&
          (/pph/i.test(tx.coaAccount?.name ?? "") ||
            ["532", "533", "534"].includes(tx.coaAccount?.code ?? ""))
      );
      const totalPphDebit = pphRows.reduce((sum, tx) => sum + Number(tx.debit), 0);

      const earliestDate = matches[0]?.tanggal ?? null;
      const bankName = bankRows[0]?.coaAccount?.name || fBank || "Bank";
      const nominalMasuk = totalBankDebit > 0 ? totalBankDebit : fNominalDiterima;
      const isRealized = nominalMasuk > 0 || totalPpnDebit > 0 || totalPphDebit > 0;

      return {
        isRealized,
        nominalDiterima: nominalMasuk,
        ppn: totalPpnDebit > 0 ? totalPpnDebit : (isRealized ? fPpn : 0),
        pph: totalPphDebit > 0 ? totalPphDebit : (isRealized ? fPph : 0),
        tanggalTerima: earliestDate
          ? earliestDate.toISOString().split("T")[0]
          : fTanggalTerima
          ? fTanggalTerima.toISOString().split("T")[0]
          : null,
        bank: bankName,
        matchedJurnalNoBukti: matches[0]?.noBukti ?? null,
      };
    }

    // Jika belum ada Jurnal pencairan, periksa input manual
    const hasManualEntry = Boolean(fTanggalTerima) && fNominalDiterima > 0;
    if (hasManualEntry) {
      return {
        isRealized: true,
        nominalDiterima: fNominalDiterima,
        ppn: fPpn,
        pph: fPph,
        tanggalTerima: fTanggalTerima ? fTanggalTerima.toISOString().split("T")[0] : null,
        bank: fBank || null,
        matchedJurnalNoBukti: null,
      };
    }

    // Tagihan belum terealisasi: uang belum masuk bank, PPN & PPh dikosongkan (0)
    return {
      isRealized: false,
      nominalDiterima: 0,
      ppn: 0,
      pph: 0,
      tanggalTerima: null,
      bank: null,
      matchedJurnalNoBukti: null,
    };
  }

  // Map Lapis 1: Faktur List
  const fakturList: FakturPendapatanItem[] = fakturRaw.map((f) => {
    const dpp = Number(f.dpp);
    const dppNilaiLain = Number(f.dppNilaiLain);
    const tarifPpnPersen = Number(f.tarifPpnPersen);
    const tarifPphPersen = Number(f.tarifPphPersen);
    const calculated = hitungPajakFaktur(dpp, dppNilaiLain, tarifPpnPersen, tarifPphPersen);
    const nilaiProyek = Number(f.nilaiProyek) > 0 ? Number(f.nilaiProyek) : calculated.nilaiProyek;

    // Tarik data riil dari Jurnal Umum berdasarkan fakturId & noFaktur
    const real = extractJurnalDataForFaktur(
      f.id,
      f.noFaktur,
      f.tanggalTerima,
      f.bank,
      Number(f.nominalDiterima),
      Number(f.ppn) > 0 ? Number(f.ppn) : calculated.ppn,
      Number(f.pph) > 0 ? Number(f.pph) : calculated.pph
    );

    const ppn = real.ppn;
    const pph = real.pph;
    const nominalDiterima = real.nominalDiterima;
    const labaSetelahPajak = Math.round(
      nilaiProyek - (ppn > 0 ? ppn : calculated.ppn) - (pph > 0 ? pph : calculated.pph)
    );
    const pekerjaanPerusahaan = Number(f.pekerjaanPerusahaan);
    const pekerjaanYangDipinjam = Number(f.pekerjaanYangDipinjam);

    // Kontrol Selisih Pembayaran Bank (Balance Control):
    // Membandingkan nilai tagihan bersih (setelah pajak) dengan nominal riil yang masuk ke rekening bank
    const netTagihanBersih = Math.max(
      0,
      nilaiProyek - (ppn > 0 ? ppn : calculated.ppn) - (pph > 0 ? pph : calculated.pph)
    );
    let selisihBank = 0;
    let balanceStatus: "BALANCE" | "SELISIH" | "BELUM_CAIR" = "BELUM_CAIR";

    if (real.isRealized) {
      selisihBank = nominalDiterima - netTagihanBersih;
      if (Math.abs(selisihBank) < 1) {
        balanceStatus = "BALANCE";
        selisihBank = 0;
      } else {
        balanceStatus = "SELISIH";
      }
    }

    return {
      id: f.id,
      entityId: f.entityId,
      npwp: f.npwp,
      noFaktur: f.noFaktur,
      masaPajak: f.masaPajak,
      namaBulan: NAMA_BULAN[f.masaPajak - 1] ?? `Bulan ${f.masaPajak}`,
      tahunPajak: f.tahunPajak,
      namaRekanan: f.namaRekanan,
      namaJkp: f.namaJkp,
      dpp,
      dppNilaiLain,
      tarifPpnPersen,
      tarifPphPersen,
      ppn,
      pph,
      nilaiProyek,
      labaSetelahPajak,
      kodeJenisProyek: f.kodeJenisProyek,
      jenisProyekLabel: f.kodeJenisProyek === 2 ? "Pengawasan" : "Perencanaan",
      pekerjaanPerusahaan,
      pekerjaanYangDipinjam,
      tanggalTerima: real.tanggalTerima,
      bank: real.bank,
      nominalDiterima,
      isRealized: real.isRealized,
      ceklisPpn: Boolean(f.ceklisPpn),
      ceklisPph: Boolean(f.ceklisPph),
      ceklisBuktiPotong: Boolean(f.ceklisBuktiPotong),
      selisihBank,
      selisihBankFmt: formatRupiah(Math.abs(selisihBank)),
      balanceStatus,
      matchedJurnalNoBukti: real.matchedJurnalNoBukti,
      projectId: f.projectId,
      projectName: f.project?.name ?? null,
      projectCode: f.project?.code ?? null,
      bankTransactionId: f.bankTransactionId,
      createdAt: f.createdAt.toISOString(),

      dppFmt: formatRupiah(dpp),
      dppNilaiLainFmt: formatRupiah(dppNilaiLain),
      ppnFmt: real.isRealized ? formatRupiah(ppn) : "-",
      pphFmt: real.isRealized ? formatRupiah(pph) : "-",
      nilaiProyekFmt: formatRupiah(nilaiProyek),
      labaSetelahPajakFmt: formatRupiah(labaSetelahPajak),
      nominalDiterimaFmt: real.isRealized ? formatRupiah(nominalDiterima) : "-",
      pekerjaanPerusahaanFmt: formatRupiah(pekerjaanPerusahaan),
      pekerjaanYangDipinjamFmt: formatRupiah(pekerjaanYangDipinjam),
    };
  });

  // Total Periode (Lapis 1 Footer)
  const totalPeriod = fakturList.reduce(
    (acc, f) => {
      acc.jumlahFaktur += 1;
      acc.dpp += f.dpp;
      acc.dppNilaiLain += f.dppNilaiLain;
      acc.ppn += f.ppn;
      acc.pph += f.pph;
      acc.nilaiProyek += f.nilaiProyek;
      acc.labaSetelahPajak += f.labaSetelahPajak;
      acc.nominalDiterima += f.nominalDiterima;
      acc.pekerjaanPerusahaan += f.pekerjaanPerusahaan;
      acc.pekerjaanYangDipinjam += f.pekerjaanYangDipinjam;
      return acc;
    },
    {
      jumlahFaktur: 0,
      dpp: 0,
      dppNilaiLain: 0,
      ppn: 0,
      pph: 0,
      nilaiProyek: 0,
      labaSetelahPajak: 0,
      nominalDiterima: 0,
      pekerjaanPerusahaan: 0,
      pekerjaanYangDipinjam: 0,
      dppFmt: "Rp 0",
      dppNilaiLainFmt: "Rp 0",
      ppnFmt: "Rp 0",
      pphFmt: "Rp 0",
      nilaiProyekFmt: "Rp 0",
      labaSetelahPajakFmt: "Rp 0",
      nominalDiterimaFmt: "Rp 0",
      pekerjaanPerusahaanFmt: "Rp 0",
      pekerjaanYangDipinjamFmt: "Rp 0",
    }
  );

  totalPeriod.dppFmt = formatRupiah(totalPeriod.dpp);
  totalPeriod.dppNilaiLainFmt = formatRupiah(totalPeriod.dppNilaiLain);
  totalPeriod.ppnFmt = formatRupiah(totalPeriod.ppn);
  totalPeriod.pphFmt = formatRupiah(totalPeriod.pph);
  totalPeriod.nilaiProyekFmt = formatRupiah(totalPeriod.nilaiProyek);
  totalPeriod.labaSetelahPajakFmt = formatRupiah(totalPeriod.labaSetelahPajak);
  totalPeriod.nominalDiterimaFmt = formatRupiah(totalPeriod.nominalDiterima);
  totalPeriod.pekerjaanPerusahaanFmt = formatRupiah(totalPeriod.pekerjaanPerusahaan);
  totalPeriod.pekerjaanYangDipinjamFmt = formatRupiah(totalPeriod.pekerjaanYangDipinjam);

  // Map Lapis 2: Rekap Bulanan Dinamis (Bulan 1-12 berdasarkan Masa Pajak)
  const monthlyBuckets: Record<
    number,
    {
      jumlahFaktur: number;
      dpp: number;
      dppNilaiLain: number;
      ppn: number;
      pph: number;
      nilaiProyek: number;
      labaSetelahPajak: number;
      nominalDiterima: number;
      pekerjaanPerusahaan: number;
      pekerjaanYangDipinjam: number;
    }
  > = {};

  for (let m = 1; m <= 12; m++) {
    monthlyBuckets[m] = {
      jumlahFaktur: 0,
      dpp: 0,
      dppNilaiLain: 0,
      ppn: 0,
      pph: 0,
      nilaiProyek: 0,
      labaSetelahPajak: 0,
      nominalDiterima: 0,
      pekerjaanPerusahaan: 0,
      pekerjaanYangDipinjam: 0,
    };
  }

  for (const f of allYearFakturRaw) {
    const m = f.masaPajak;
    if (m >= 1 && m <= 12) {
      const dpp = Number(f.dpp);
      const dppNilaiLain = Number(f.dppNilaiLain);
      const tarifPpnPersen = Number(f.tarifPpnPersen);
      const tarifPphPersen = Number(f.tarifPphPersen);
      const calculated = hitungPajakFaktur(dpp, dppNilaiLain, tarifPpnPersen, tarifPphPersen);
      const nilaiProyek = Number(f.nilaiProyek) > 0 ? Number(f.nilaiProyek) : calculated.nilaiProyek;

      const real = extractJurnalDataForFaktur(
        f.id,
        f.noFaktur,
        f.tanggalTerima,
        f.bank,
        Number(f.nominalDiterima),
        Number(f.ppn) > 0 ? Number(f.ppn) : calculated.ppn,
        Number(f.pph) > 0 ? Number(f.pph) : calculated.pph
      );

      monthlyBuckets[m].jumlahFaktur += 1;
      monthlyBuckets[m].dpp += dpp;
      monthlyBuckets[m].dppNilaiLain += dppNilaiLain;
      monthlyBuckets[m].ppn += real.ppn;
      monthlyBuckets[m].pph += real.pph;
      monthlyBuckets[m].nilaiProyek += nilaiProyek;
      monthlyBuckets[m].labaSetelahPajak += Math.round(
        nilaiProyek - (real.ppn > 0 ? real.ppn : calculated.ppn) - (real.pph > 0 ? real.pph : calculated.pph)
      );
      monthlyBuckets[m].nominalDiterima += real.nominalDiterima;
      monthlyBuckets[m].pekerjaanPerusahaan += Number(f.pekerjaanPerusahaan);
      monthlyBuckets[m].pekerjaanYangDipinjam += Number(f.pekerjaanYangDipinjam);
    }
  }

  const rekapBulanan: RekapBulananItem[] = [];
  let totRekap = {
    month: 0,
    namaBulan: "Total 1 Tahun",
    jumlahFaktur: 0,
    dpp: 0,
    dppNilaiLain: 0,
    ppn: 0,
    pph: 0,
    nilaiProyek: 0,
    labaSetelahPajak: 0,
    nominalDiterima: 0,
    pekerjaanPerusahaan: 0,
    pekerjaanYangDipinjam: 0,
    dppFmt: "Rp 0",
    dppNilaiLainFmt: "Rp 0",
    ppnFmt: "Rp 0",
    pphFmt: "Rp 0",
    nilaiProyekFmt: "Rp 0",
    labaSetelahPajakFmt: "Rp 0",
    nominalDiterimaFmt: "Rp 0",
  };

  for (let m = 1; m <= 12; m++) {
    const b = monthlyBuckets[m];
    totRekap.jumlahFaktur += b.jumlahFaktur;
    totRekap.dpp += b.dpp;
    totRekap.dppNilaiLain += b.dppNilaiLain;
    totRekap.ppn += b.ppn;
    totRekap.pph += b.pph;
    totRekap.nilaiProyek += b.nilaiProyek;
    totRekap.labaSetelahPajak += b.labaSetelahPajak;
    totRekap.nominalDiterima += b.nominalDiterima;
    totRekap.pekerjaanPerusahaan += b.pekerjaanPerusahaan;
    totRekap.pekerjaanYangDipinjam += b.pekerjaanYangDipinjam;

    rekapBulanan.push({
      month: m,
      namaBulan: NAMA_BULAN[m - 1],
      jumlahFaktur: b.jumlahFaktur,
      dpp: b.dpp,
      dppNilaiLain: b.dppNilaiLain,
      ppn: b.ppn,
      pph: b.pph,
      nilaiProyek: b.nilaiProyek,
      labaSetelahPajak: b.labaSetelahPajak,
      nominalDiterima: b.nominalDiterima,
      pekerjaanPerusahaan: b.pekerjaanPerusahaan,
      pekerjaanYangDipinjam: b.pekerjaanYangDipinjam,

      dppFmt: formatRupiah(b.dpp),
      dppNilaiLainFmt: formatRupiah(b.dppNilaiLain),
      ppnFmt: formatRupiah(b.ppn),
      pphFmt: formatRupiah(b.pph),
      nilaiProyekFmt: formatRupiah(b.nilaiProyek),
      labaSetelahPajakFmt: formatRupiah(b.labaSetelahPajak),
      nominalDiterimaFmt: formatRupiah(b.nominalDiterima),
    });
  }

  totRekap.dppFmt = formatRupiah(totRekap.dpp);
  totRekap.dppNilaiLainFmt = formatRupiah(totRekap.dppNilaiLain);
  totRekap.ppnFmt = formatRupiah(totRekap.ppn);
  totRekap.pphFmt = formatRupiah(totRekap.pph);
  totRekap.nilaiProyekFmt = formatRupiah(totRekap.nilaiProyek);
  totRekap.labaSetelahPajakFmt = formatRupiah(totRekap.labaSetelahPajak);
  totRekap.nominalDiterimaFmt = formatRupiah(totRekap.nominalDiterima);

  // Map Lapis 3: Rekonsiliasi Audit Pajak (Bulan 1-12)
  const rekonsiliasiList: RekonsiliasiPajakItem[] = [];
  let totalSelisihPajak = 0;
  let jumlahBulanSelisih = 0;

  for (let m = 1; m <= 12; m++) {
    const bucket = monthlyBuckets[m];
    const rec = rekonsiliasiMap.get(m);

    const dppRekap = bucket.dpp;
    const ppnRekap = bucket.ppn;
    const pphRekap = bucket.pph;

    const dppTerlapor = rec ? Number(rec.dppTerlapor) : 0;
    const pajakTerlapor = rec ? Number(rec.pajakTerlapor) : 0; // PPN Terlapor
    const pphTerlapor = rec ? Number(rec.pphTerlapor ?? 0) : 0; // PPh Terlapor
    const keterangan = rec?.keterangan ?? "";

    const selisihDpp = dppRekap - dppTerlapor;
    const selisihPajak = ppnRekap - pajakTerlapor; // Selisih PPN
    const selisihPph = pphRekap - pphTerlapor; // Selisih PPh

    const totalPajakRekap = ppnRekap + pphRekap;
    const totalPajakTerlapor = pajakTerlapor + pphTerlapor;
    const selisihTotalPajak = totalPajakRekap - totalPajakTerlapor;

    const hasRekap = dppRekap > 0 || ppnRekap > 0 || pphRekap > 0;
    const hasTerlapor = dppTerlapor > 0 || pajakTerlapor > 0 || pphTerlapor > 0;

    let status: "MATCH" | "SELISIH" | "BELUM_DILAPORKAN" = "MATCH";
    if (
      Math.abs(selisihDpp) > 0.01 ||
      Math.abs(selisihPajak) > 0.01 ||
      Math.abs(selisihPph) > 0.01
    ) {
      if (hasRekap && !hasTerlapor) {
        status = "BELUM_DILAPORKAN";
      } else {
        status = "SELISIH";
      }
      jumlahBulanSelisih += 1;
      totalSelisihPajak += Math.abs(selisihPajak) + Math.abs(selisihPph);
    }

    rekonsiliasiList.push({
      month: m,
      namaBulan: NAMA_BULAN[m - 1],
      dppRekap,
      dppTerlapor,
      selisihDpp,
      ppnRekap,
      pajakTerlapor,
      selisihPajak,
      pphRekap,
      pphTerlapor,
      selisihPph,
      totalPajakRekap,
      totalPajakTerlapor,
      selisihTotalPajak,
      keterangan,
      status,

      dppRekapFmt: formatRupiah(dppRekap),
      dppTerlaporFmt: formatRupiah(dppTerlapor),
      selisihDppFmt: formatRupiah(selisihDpp),
      ppnRekapFmt: formatRupiah(ppnRekap),
      pajakTerlaporFmt: formatRupiah(pajakTerlapor),
      selisihPajakFmt: formatRupiah(selisihPajak),
      pphRekapFmt: formatRupiah(pphRekap),
      pphTerlaporFmt: formatRupiah(pphTerlapor),
      selisihPphFmt: formatRupiah(selisihPph),
      totalPajakRekapFmt: formatRupiah(totalPajakRekap),
      totalPajakTerlaporFmt: formatRupiah(totalPajakTerlapor),
      selisihTotalPajakFmt: formatRupiah(selisihTotalPajak),
    });
  }

  const kpiSummary = {
    totalNilaiProyek: totRekap.nilaiProyek,
    totalNilaiProyekFmt: formatRupiah(totRekap.nilaiProyek),
    totalDpp: totRekap.dpp,
    totalDppFmt: formatRupiah(totRekap.dpp),
    totalPajak: totRekap.ppn + totRekap.pph,
    totalPajakFmt: formatRupiah(totRekap.ppn + totRekap.pph),
    totalLabaSetelahPajak: totRekap.labaSetelahPajak,
    totalLabaSetelahPajakFmt: formatRupiah(totRekap.labaSetelahPajak),
    totalNominalDiterima: totRekap.nominalDiterima,
    totalNominalDiterimaFmt: formatRupiah(totRekap.nominalDiterima),
    totalSelisihPajak,
    totalSelisihPajakFmt: formatRupiah(totalSelisihPajak),
    jumlahBulanSelisih,
    statusAudit: (jumlahBulanSelisih === 0
      ? "SEMUA_SESUAI"
      : "PERLU_REKONSILIASI") as "SEMUA_SESUAI" | "PERLU_REKONSILIASI",
  };

  return {
    entity: {
      id: entity.id,
      key: entity.key,
      name: entity.name,
      legalName: entity.legalName ?? entity.name,
    },
    year,
    masaPajak: masaPajak ?? null,
    fakturList,
    totalPeriod,
    rekapBulanan,
    totalTahunanRekap: totRekap,
    rekonsiliasiList,
    kpiSummary,
    tarifList: tarifRaw.map((t) => ({
      id: t.id,
      nama: t.nama,
      jenis: t.jenis,
      tarifPersen: Number(t.tarifPersen),
    })),
    projectOptions: projects.map((p) => {
      const contractValue = Number(p.contractValue);
      const termins = p.termin.map((t, i) => {
        const prevPct = i === 0 ? 0 : p.termin[i - 1].percentage;
        const nominal =
          t.nominal && Number(t.nominal) > 0
            ? Number(t.nominal)
            : ((t.percentage - prevPct) / 100) * contractValue;
        return {
          id: t.id,
          name: t.name,
          percentage: t.percentage,
          nominal,
          nominalFmt: formatRupiah(nominal),
        };
      });

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        entityId: p.entityId,
        entityKey: p.entity.key,
        entityName: p.entity.name,
        contractValue,
        contractValueFmt: formatRupiah(contractValue),
        termins,
      };
    }),
    bankOptions: defaultBankList,
  };
}
