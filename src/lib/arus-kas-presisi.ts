import { prisma } from "./prisma";
import { getPenyusutanSummary } from "./aset-tetap";
import { getExcludedNoBuktiForVersion } from "./akuntansi";
import type { ReportVersion } from "./laba-rugi";
import type { ReportCategory } from "@prisma/client";

export interface ArusKasRow {
  label: string;
  amount: number;
  level: number; // 0 = section header/major subtotal, 1 = parent item, 2 = child item, 3 = detail sub-child
  isHeader?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  code?: string;
}

export interface ArusKasPresisiData {
  entityName: string;
  year: number;
  version: ReportVersion;

  // I. Aktivitas Operasi
  labaBersihSetelahPajak: number;
  penyusutanAsetTetap: number;
  amortisasiAset: number;
  cadanganCKPN: number;
  labaOperasiSetelahPenyesuaian: number;

  // Modal Kerja: Piutang (Kenaikan = negatif, Penurunan = positif)
  piutangUsaha: number;
  piutangKAK: number;
  piutangGS: number;
  piutangTB: number;
  piutangKP: number;
  piutangCAD: number;
  piutangLainnya: number;

  // Modal Kerja: Utang (Kenaikan = positif, Penurunan = negatif)
  utangPajak: number;
  utangKAK: number;
  utangGS: number;
  utangTB: number;
  utangCAD: number;
  utangKP: number;
  titipan: number;
  utangImbalanPascaKerja: number;

  totalModalKerja: number;
  totalArusKasOperasi: number;

  // II. Aktivitas Investasi
  perolehanAsetTetap: number;
  perolehanAsetTidakBerwujud: number;
  totalArusKasInvestasi: number;

  // III. Aktivitas Pendanaan
  labaDitahan: number;
  totalArusKasPendanaan: number;

  // Rekapitulasi Kas
  kenaikanBersihKas: number;
  kasAwalPeriode: number;
  kasAkhirPeriode: number;

  // Flattened row list untuk rendering tabel yang 100% presisi
  rows: ArusKasRow[];
}

export function formatRupiahArusKas(val: number): string {
  if (val === 0 || Math.round(val) === 0) return "Rp -";
  const abs = Math.abs(Math.round(val)).toLocaleString("id-ID");
  return val < 0 ? `-Rp ${abs}` : `Rp ${abs}`;
}

export async function getArusKasPresisiData(
  entityId: string,
  year: number,
  version: ReportVersion = "INTERNAL"
): Promise<ArusKasPresisiData> {
  const normVersion: ReportVersion = version?.toString().toUpperCase() === "UMUM" ? "UMUM" : "INTERNAL";
  const allowedCategories: ReportCategory[] = normVersion === "UMUM" ? ["UMUM", "SEMUA"] : ["INTERNAL", "SEMUA"];

  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    select: { name: true },
  });

  const start = new Date(`${year}-01-01`);
  const end = new Date(`${year}-12-31T23:59:59`);

  const [excludedNoBukti, penyusutanSummary, allAccounts, saldoAwalList, transactions, assetsList] = await Promise.all([
    getExcludedNoBuktiForVersion(entityId, year, normVersion),
    getPenyusutanSummary(entityId, year),
    prisma.coaAccount.findMany({
      where: { reportCategory: { in: allowedCategories } },
      orderBy: { code: "asc" },
    }),
    prisma.saldoAwal.findMany({
      where: {
        entityId,
        year,
        coaAccount: { reportCategory: { in: allowedCategories } },
      },
    }),
    prisma.transaction.findMany({
      where: {
        entityId,
        tanggal: { gte: start, lte: end },
        coaAccountId: { not: null },
        coaAccount: { reportCategory: { in: allowedCategories } },
      },
      include: { coaAccount: true },
    }),
    prisma.asetTetap.findMany({
      where: { entityId },
    }),
  ]);

  const excludedSet = new Set(excludedNoBukti);
  const activeTx = transactions.filter((t) => !excludedSet.has(t.noBukti));

  // Map Saldo Awal per CoaAccount ID & Code
  const saldoAwalMap = new Map<string, number>();
  for (const sa of saldoAwalList) {
    saldoAwalMap.set(sa.coaAccountId, Number(sa.nominal));
  }

  // Hitung mutasi debit & kredit per CoaAccount
  const mutasiDebitMap = new Map<string, number>();
  const mutasiKreditMap = new Map<string, number>();

  for (const t of activeTx) {
    if (!t.coaAccountId) continue;
    mutasiDebitMap.set(t.coaAccountId, (mutasiDebitMap.get(t.coaAccountId) ?? 0) + Number(t.debit));
    mutasiKreditMap.set(t.coaAccountId, (mutasiKreditMap.get(t.coaAccountId) ?? 0) + Number(t.kredit));
  }

  // Helper untuk mendapatkan saldo akhir akun neraca (Desimal / Int)
  const getAccountEndingBalance = (account: typeof allAccounts[0]) => {
    const sa = saldoAwalMap.get(account.id) ?? 0;
    const debit = mutasiDebitMap.get(account.id) ?? 0;
    const kredit = mutasiKreditMap.get(account.id) ?? 0;

    if (account.kategori === "ASET") {
      // Normal debit
      return sa + debit - kredit;
    } else {
      // Normal kredit (KEWAJIBAN, MODAL, PENDAPATAN)
      return sa + kredit - debit;
    }
  };

  // Helper perubahan saldo: (Akhir - Awal)
  const getAccountDelta = (account: typeof allAccounts[0]) => {
    const debit = mutasiDebitMap.get(account.id) ?? 0;
    const kredit = mutasiKreditMap.get(account.id) ?? 0;

    if (account.kategori === "ASET") {
      return debit - kredit;
    } else {
      return kredit - debit;
    }
  };

  // Map akun berdasarkan kode
  const accountByCode = new Map<string, typeof allAccounts[0]>();
  for (const acc of allAccounts) {
    accountByCode.set(acc.code, acc);
  }

  // 1. Laba Bersih Setelah Pajak
  let totalPendapatan = 0;
  let totalBeban = 0;

  for (const acc of allAccounts) {
    if (acc.kategori === "PENDAPATAN") {
      const d = mutasiDebitMap.get(acc.id) ?? 0;
      const k = mutasiKreditMap.get(acc.id) ?? 0;
      totalPendapatan += (k - d);
    } else if (acc.kategori === "BEBAN") {
      const d = mutasiDebitMap.get(acc.id) ?? 0;
      const k = mutasiKreditMap.get(acc.id) ?? 0;
      totalBeban += (d - k);
    }
  }

  // Sinkronisasi penyusutan aset tetap
  const penyusutanAsetTetap = penyusutanSummary.totalBebanPenyusutan;
  if (penyusutanAsetTetap > 0) {
    const accPenyusutan = allAccounts.find(
      (a) => a.code === "512" || a.code === "540" || /penyusutan/i.test(a.name)
    );
    if (accPenyusutan) {
      const existingTxPenyusutan = (mutasiDebitMap.get(accPenyusutan.id) ?? 0) - (mutasiKreditMap.get(accPenyusutan.id) ?? 0);
      totalBeban = totalBeban - existingTxPenyusutan + penyusutanAsetTetap;
    } else {
      totalBeban += penyusutanAsetTetap;
    }
  }

  const labaBersihSetelahPajak = totalPendapatan - totalBeban;

  // 2. Penyesuaian non-kas
  const amortisasiAset = 0;
  const accCKPN = accountByCode.get("210");
  const cadanganCKPN = accCKPN ? getAccountDelta(accCKPN) : 0;
  const labaOperasiSetelahPenyesuaian = labaBersihSetelahPajak + penyusutanAsetTetap + amortisasiAset + cadanganCKPN;

  // 3. Perubahan Modal Kerja:
  // Piutang: Aset lancar, kenaikan = kas keluar (negatif), penurunan = kas masuk (positif)
  const calcDeltaPiutang = (code: string) => {
    const acc = accountByCode.get(code);
    if (!acc) return 0;
    // kenaikan piutang (debit > kredit) mengurangi kas -> -delta
    return -getAccountDelta(acc);
  };

  const piutangUsaha = calcDeltaPiutang("116");
  const piutangKAK = calcDeltaPiutang("111");
  const piutangGS = calcDeltaPiutang("112");
  const piutangTB = calcDeltaPiutang("113");
  const piutangCAD = calcDeltaPiutang("114");
  const piutangKP = calcDeltaPiutang("115");
  const piutangLainnya = calcDeltaPiutang("117") + calcDeltaPiutang("118");

  // Utang & Kewajiban: kenaikan = kas masuk (positif), penurunan = kas keluar (negatif)
  const calcDeltaUtang = (code: string) => {
    const acc = accountByCode.get(code);
    if (!acc) return 0;
    return getAccountDelta(acc);
  };

  const utangPajak = calcDeltaUtang("301");
  const utangKAK = calcDeltaUtang("311");
  const utangGS = calcDeltaUtang("312");
  const utangTB = calcDeltaUtang("313");
  const utangCAD = calcDeltaUtang("314");
  const utangKP = calcDeltaUtang("315");
  const titipan = calcDeltaUtang("200");
  const utangImbalanPascaKerja = calcDeltaUtang("220");

  const totalModalKerja =
    piutangUsaha +
    piutangKAK +
    piutangGS +
    piutangTB +
    piutangCAD +
    piutangKP +
    piutangLainnya +
    utangPajak +
    utangKAK +
    utangGS +
    utangTB +
    utangCAD +
    utangKP +
    titipan +
    utangImbalanPascaKerja;

  const totalArusKasOperasi = labaOperasiSetelahPenyesuaian + totalModalKerja;

  // 4. Aktivitas Investasi
  // Perolehan aset baru di tahun berjalan (mengurangi kas)
  let perolehanAsetTetap = 0;
  for (const asset of assetsList) {
    const tgl = new Date(asset.tanggalPerolehan);
    if (tgl >= start && tgl <= end) {
      perolehanAsetTetap -= Number(asset.hargaPerolehan);
    }
  }
  const perolehanAsetTidakBerwujud = 0;
  const totalArusKasInvestasi = perolehanAsetTetap + perolehanAsetTidakBerwujud;

  // 5. Aktivitas Pendanaan
  // Laba Ditahan / Prive / Penarikan Modal
  const accLabaDitahan = accountByCode.get("310");
  const accPrive = accountByCode.get("531");
  const deltaLabaDitahan = accLabaDitahan ? getAccountDelta(accLabaDitahan) : 0;
  const deltaPrive = accPrive ? -getAccountDelta(accPrive) : 0;
  const labaDitahan = deltaLabaDitahan + deltaPrive;
  const totalArusKasPendanaan = labaDitahan;

  // 6. Rekapitulasi Kas & Setara Kas
  const kenaikanBersihKas = totalArusKasOperasi + totalArusKasInvestasi + totalArusKasPendanaan;

  // Kas & Setara Kas (Akun kas & bank: 11, 110, 1100, 12, 120, 1200, 13, 130, 1300, 14, 140, 1400, 1500, dll.)
  const kasBankAccounts = allAccounts.filter(
    (a) =>
      a.reportType === "ARUS_KAS" ||
      /kas|bank|bri|bpd|bni|mdr/i.test(a.name)
  );

  const kasAwalPeriode = kasBankAccounts.reduce((sum, acc) => {
    return sum + (saldoAwalMap.get(acc.id) ?? 0);
  }, 0);

  const kasAkhirPeriode = kasAwalPeriode + kenaikanBersihKas;

  // 7. Konstruksi Flat Row List persis sesuai template Excel acuan
  const rows: ArusKasRow[] = [
    // Operasi
    { label: "Arus Kas dan Setara Kas dari Aktivitas Operasi", amount: 0, level: 0, isHeader: true },
    { label: "Laba bersih setelah pajak", amount: labaBersihSetelahPajak, level: 1 },
    {
      label: "Penyesuaian untuk merekonsiliasi laba bersih menjadi kas bersih diperoleh dari kegiatan operasi :",
      amount: 0,
      level: 1,
      isHeader: true,
    },
    { label: "Penyusutan Aset Tetap", amount: penyusutanAsetTetap, level: 2 },
    { label: "Amortisasi aset tidak berwujud", amount: amortisasiAset, level: 2 },
    { label: "Cadangan Kerugian Penurunan Nilai", amount: cadanganCKPN, level: 2 },
    {
      label: "Laba Operasi setelah penyesuaian kas bersih",
      amount: labaOperasiSetelahPenyesuaian,
      level: 1,
      isSubtotal: true,
    },

    // Modal Kerja
    { label: "Perubahan Modal Kerja :", amount: 0, level: 1, isHeader: true },
    { label: "Piutang Usaha", amount: piutangUsaha, level: 2, code: "116" },
    { label: "Piutang Pihak Berelasi :", amount: 0, level: 2, isHeader: true },
    { label: "Piutang KAK", amount: piutangKAK, level: 3, code: "111" },
    { label: "Piutang GS", amount: piutangGS, level: 3, code: "112" },
    { label: "Piutang TB", amount: piutangTB, level: 3, code: "113" },
    { label: "Piutang KP", amount: piutangKP, level: 3, code: "115" },
    ...(piutangCAD !== 0 ? [{ label: "Piutang CAD", amount: piutangCAD, level: 3, code: "114" }] : []),
    ...(piutangLainnya !== 0 ? [{ label: "Piutang Lainnya", amount: piutangLainnya, level: 3, code: "118" }] : []),
    { label: "Utang Pajak", amount: utangPajak, level: 2, code: "301" },
    { label: "Utang Perusahaan Group :", amount: 0, level: 2, isHeader: true },
    { label: "Utang KAK", amount: utangKAK, level: 3, code: "311" },
    { label: "Utang GS", amount: utangGS, level: 3, code: "312" },
    { label: "Utang TB", amount: utangTB, level: 3, code: "313" },
    ...(utangCAD !== 0 ? [{ label: "Utang CAD", amount: utangCAD, level: 3, code: "314" }] : []),
    ...(utangKP !== 0 ? [{ label: "Utang KP", amount: utangKP, level: 3, code: "315" }] : []),
    { label: "Titipan", amount: titipan, level: 2, code: "200" },
    { label: "Utang Imbalan Pasca Kerja", amount: utangImbalanPascaKerja, level: 2, code: "220" },
    {
      label: "Arus Kas dan Setara Kas dari Aktivitas Operasi",
      amount: totalArusKasOperasi,
      level: 0,
      isSubtotal: true,
      isTotal: true,
    },

    // Investasi
    { label: "Arus Kas dan Setara Kas dari Aktivitas Investasi", amount: 0, level: 0, isHeader: true },
    { label: "Perolehan Aset Tetap", amount: perolehanAsetTetap, level: 1 },
    { label: "Perolehan Aset Tidak Berwujud", amount: perolehanAsetTidakBerwujud, level: 1 },
    {
      label: "Arus Kas dan Setara Kas dari Aktivitas Investasi",
      amount: totalArusKasInvestasi,
      level: 0,
      isSubtotal: true,
      isTotal: true,
    },

    // Pendanaan
    { label: "Arus Kas dan Setara Kas dari Aktivitas Pendanaan", amount: 0, level: 0, isHeader: true },
    { label: "Laba Ditahan", amount: labaDitahan, level: 1, code: "310" },
    {
      label: "Arus Kas dan Setara Kas dari Aktivitas Pendanaan",
      amount: totalArusKasPendanaan,
      level: 0,
      isSubtotal: true,
      isTotal: true,
    },

    // Rekapitulasi Akhir
    {
      label: "Kenaikan/ Penurunan Bersih Kas & Setara Kas",
      amount: kenaikanBersihKas,
      level: 0,
      isSubtotal: true,
      isTotal: true,
    },
    { label: "Kas & Setara Kas Pada Awal Periode", amount: kasAwalPeriode, level: 0 },
    { label: "Kas & Setara Kas Pada Akhir Periode", amount: kasAkhirPeriode, level: 0, isTotal: true },
  ];

  return {
    entityName: entity?.name ?? "Entitas",
    year,
    version: normVersion,
    labaBersihSetelahPajak,
    penyusutanAsetTetap,
    amortisasiAset,
    cadanganCKPN,
    labaOperasiSetelahPenyesuaian,
    piutangUsaha,
    piutangKAK,
    piutangGS,
    piutangTB,
    piutangKP,
    piutangCAD,
    piutangLainnya,
    utangPajak,
    utangKAK,
    utangGS,
    utangTB,
    utangCAD,
    utangKP,
    titipan,
    utangImbalanPascaKerja,
    totalModalKerja,
    totalArusKasOperasi,
    perolehanAsetTetap,
    perolehanAsetTidakBerwujud,
    totalArusKasInvestasi,
    labaDitahan,
    totalArusKasPendanaan,
    kenaikanBersihKas,
    kasAwalPeriode,
    kasAkhirPeriode,
    rows,
  };
}
