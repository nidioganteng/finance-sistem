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
  tanggalTerima: string; // YYYY-MM-DD
  bank: string;
  nominalDiterima: number;
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
  pajakTerlapor: number;
  selisihPajak: number;
  keterangan: string;
  status: "MATCH" | "SELISIH" | "BELUM_DILAPORKAN";

  dppRekapFmt: string;
  dppTerlaporFmt: string;
  selisihDppFmt: string;
  ppnRekapFmt: string;
  pajakTerlaporFmt: string;
  selisihPajakFmt: string;
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
      { tanggalTerima: "asc" },
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
          orderBy: [{ masaPajak: "asc" }, { tanggalTerima: "asc" }],
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

  // Map Lapis 1: Faktur List
  const fakturList: FakturPendapatanItem[] = fakturRaw.map((f) => {
    const dpp = Number(f.dpp);
    const dppNilaiLain = Number(f.dppNilaiLain);
    const tarifPpnPersen = Number(f.tarifPpnPersen);
    const tarifPphPersen = Number(f.tarifPphPersen);
    const ppn = Number(f.ppn);
    const pph = Number(f.pph);
    const nilaiProyek = Number(f.nilaiProyek);
    const labaSetelahPajak = Number(f.labaSetelahPajak);
    const nominalDiterima = Number(f.nominalDiterima);
    const pekerjaanPerusahaan = Number(f.pekerjaanPerusahaan);
    const pekerjaanYangDipinjam = Number(f.pekerjaanYangDipinjam);

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
      tanggalTerima: f.tanggalTerima.toISOString().split("T")[0],
      bank: f.bank,
      nominalDiterima,
      projectId: f.projectId,
      projectName: f.project?.name ?? null,
      projectCode: f.project?.code ?? null,
      bankTransactionId: f.bankTransactionId,
      createdAt: f.createdAt.toISOString(),

      dppFmt: formatRupiah(dpp),
      dppNilaiLainFmt: formatRupiah(dppNilaiLain),
      ppnFmt: formatRupiah(ppn),
      pphFmt: formatRupiah(pph),
      nilaiProyekFmt: formatRupiah(nilaiProyek),
      labaSetelahPajakFmt: formatRupiah(labaSetelahPajak),
      nominalDiterimaFmt: formatRupiah(nominalDiterima),
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
      monthlyBuckets[m].jumlahFaktur += 1;
      monthlyBuckets[m].dpp += Number(f.dpp);
      monthlyBuckets[m].dppNilaiLain += Number(f.dppNilaiLain);
      monthlyBuckets[m].ppn += Number(f.ppn);
      monthlyBuckets[m].pph += Number(f.pph);
      monthlyBuckets[m].nilaiProyek += Number(f.nilaiProyek);
      monthlyBuckets[m].labaSetelahPajak += Number(f.labaSetelahPajak);
      monthlyBuckets[m].nominalDiterima += Number(f.nominalDiterima);
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
    const dppTerlapor = rec ? Number(rec.dppTerlapor) : 0;
    const pajakTerlapor = rec ? Number(rec.pajakTerlapor) : 0;
    const keterangan = rec?.keterangan ?? "";

    const selisihDpp = dppRekap - dppTerlapor;
    const selisihPajak = ppnRekap - pajakTerlapor;

    const hasRekap = dppRekap > 0 || ppnRekap > 0;
    const hasTerlapor = dppTerlapor > 0 || pajakTerlapor > 0;

    let status: "MATCH" | "SELISIH" | "BELUM_DILAPORKAN" = "MATCH";
    if (Math.abs(selisihDpp) > 0.01 || Math.abs(selisihPajak) > 0.01) {
      if (hasRekap && !hasTerlapor) {
        status = "BELUM_DILAPORKAN";
      } else {
        status = "SELISIH";
      }
      jumlahBulanSelisih += 1;
      totalSelisihPajak += Math.abs(selisihPajak);
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
      keterangan,
      status,

      dppRekapFmt: formatRupiah(dppRekap),
      dppTerlaporFmt: formatRupiah(dppTerlapor),
      selisihDppFmt: formatRupiah(selisihDpp),
      ppnRekapFmt: formatRupiah(ppnRekap),
      pajakTerlaporFmt: formatRupiah(pajakTerlapor),
      selisihPajakFmt: formatRupiah(selisihPajak),
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
