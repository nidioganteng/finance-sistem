import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { isAutoPostedMirror } from "./akuntansi";

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

export interface RekonsiliasiGajiPph21Item {
  month: number;
  namaBulan: string;
  // Komparasi Beban Gaji (Bruto)
  gajiPegawaiJurnal: number;
  gajiTaJurnal: number;
  gajiTotalJurnal: number;
  gajiTotalPayroll: number;
  gajiTerlapor: number;
  gajiPegawaiTerlapor: number;
  gajiTaTerlapor: number;
  selisihGaji: number;
  // Komparasi Pajak PPh 21
  pph21Jurnal: number;
  pph21Payroll: number;
  pph21Basis: number;
  pph21Terlapor: number;
  selisihPph21: number;
  // Status Audit & Balance Check
  status: "MATCH" | "SELISIH" | "BELUM_DILAPORKAN" | "NIHIL";
  ntpn: string | null;
  keterangan: string | null;
  // Formatted
  gajiTotalJurnalFmt: string;
  gajiTotalPayrollFmt: string;
  gajiTerlaporFmt: string;
  selisihGajiFmt: string;
  pph21BasisFmt: string;
  pph21TerlaporFmt: string;
  selisihPph21Fmt: string;
}

export interface RekonsiliasiPajakGajiSummary {
  totalGajiJurnal: number;
  totalGajiJurnalFmt: string;
  totalGajiPayroll: number;
  totalGajiPayrollFmt: string;
  totalGajiTerlapor: number;
  totalGajiTerlaporFmt: string;
  totalSelisihGaji: number;
  totalSelisihGajiFmt: string;

  totalPph21Basis: number;
  totalPph21BasisFmt: string;
  totalPph21Terlapor: number;
  totalPph21TerlaporFmt: string;
  totalSelisihPph21: number;
  totalSelisihPph21Fmt: string;

  jumlahBulanMatch: number;
  jumlahBulanSelisih: number;
  jumlahBulanBelumLapor: number;
  jumlahBulanNihil: number;
  overallStatus: "ALL_BALANCED" | "HAS_DIFF" | "UNREPORTED" | "NO_DATA";
}

export interface RekonsiliasiPajakGajiData {
  entityId: string;
  entityName: string;
  isGrup: boolean;
  year: number;
  items: RekonsiliasiGajiPph21Item[];
  summary: RekonsiliasiPajakGajiSummary;
}

export async function getRekonsiliasiPajakGajiData(
  entityId: string | string[],
  year: number
): Promise<RekonsiliasiPajakGajiData> {
  const ids = Array.isArray(entityId) ? entityId : [entityId];
  const isGrup = ids.length > 1;

  let entityName = "Semua Entitas (Konsolidasi Grup)";
  let primaryEntityId = ids[0] ?? "";

  if (!isGrup && primaryEntityId) {
    const ent = await prisma.entity.findUnique({
      where: { id: primaryEntityId },
      select: { name: true },
    });
    if (ent) entityName = ent.name;
  }

  // 1. Ambil data Transaksi Jurnal Umum akun Gaji & PPh 21
  const txRaw = await prisma.transaction.findMany({
    where: {
      entityId: { in: ids },
      tanggal: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31T23:59:59`),
      },
      coaAccountId: { not: null },
      coaAccount: {
        OR: [
          { code: "511" },
          { code: "612" },
          { code: "533" },
          { name: { contains: "Gaji" } },
          { name: { contains: "Honor" } },
          { name: { contains: "Tenaga Ahli" } },
          { name: { contains: "PPH 21" } },
          { name: { contains: "PPh 21" } },
        ],
      },
    },
    include: {
      coaAccount: { select: { code: true, name: true, kategori: true } },
    },
  });

  // 2. Ambil data Penggajian Pegawai Tetap
  const gajiPegawaiRaw = await prisma.gajiPegawaiBulanan.findMany({
    where: {
      entityId: { in: ids },
      tahun: year,
    },
    select: {
      bulan: true,
      totalGajiKotor: true,
      pph21: true,
      totalGajiBersih: true,
    },
  });

  // 3. Ambil data Honor Tenaga Ahli
  const honorTaRaw = await prisma.honorTenagaAhli.findMany({
    where: {
      entityId: { in: ids },
      tahun: year,
    },
    select: {
      bulan: true,
      nominalHonor: true,
      pph21: true,
      nominalBersih: true,
    },
  });

  // 4. Ambil data SPT Terlapor (RekonsiliasiGajiPph21)
  const sptRaw = await prisma.rekonsiliasiGajiPph21.findMany({
    where: {
      entityId: { in: ids },
      year,
    },
    orderBy: { month: "asc" },
  });

  // Map bulanan (1..12)
  interface MonthBucket {
    gajiPegawaiJurnal: number;
    gajiTaJurnal: number;
    pph21Jurnal: number;

    gajiPegawaiPayroll: number;
    pph21PegawaiPayroll: number;

    gajiTaPayroll: number;
    pph21TaPayroll: number;

    gajiTerlapor: number;
    pph21Terlapor: number;
    gajiPegawaiTerlapor: number;
    gajiTaTerlapor: number;
    ntpn: string | null;
    keterangan: string | null;
  }

  const buckets: Record<number, MonthBucket> = {};
  for (let m = 1; m <= 12; m++) {
    buckets[m] = {
      gajiPegawaiJurnal: 0,
      gajiTaJurnal: 0,
      pph21Jurnal: 0,

      gajiPegawaiPayroll: 0,
      pph21PegawaiPayroll: 0,

      gajiTaPayroll: 0,
      pph21TaPayroll: 0,

      gajiTerlapor: 0,
      pph21Terlapor: 0,
      gajiPegawaiTerlapor: 0,
      gajiTaTerlapor: 0,
      ntpn: null,
      keterangan: null,
    };
  }

  // Agregasi Transaksi Jurnal
  for (const t of txRaw) {
    if (isAutoPostedMirror(t)) continue;
    const m = new Date(t.tanggal).getMonth() + 1;
    if (m < 1 || m > 12) continue;

    const code = t.coaAccount?.code ?? "";
    const name = (t.coaAccount?.name ?? "").toLowerCase();
    const debit = Number(t.debit ?? 0);

    if (code === "612" || /tenaga ahli|honor/i.test(name)) {
      buckets[m].gajiTaJurnal += debit;
    } else if (code === "511" || (/gaji/i.test(name) && !/tenaga ahli|honor/i.test(name))) {
      buckets[m].gajiPegawaiJurnal += debit;
    }

    if (code === "533" || /pph 21/i.test(name)) {
      buckets[m].pph21Jurnal += debit;
    }
  }

  // Agregasi Payroll Pegawai
  for (const p of gajiPegawaiRaw) {
    if (p.bulan >= 1 && p.bulan <= 12) {
      buckets[p.bulan].gajiPegawaiPayroll += Number(p.totalGajiKotor ?? 0);
      buckets[p.bulan].pph21PegawaiPayroll += Number(p.pph21 ?? 0);
    }
  }

  // Agregasi Honor Tenaga Ahli
  for (const h of honorTaRaw) {
    if (h.bulan >= 1 && h.bulan <= 12) {
      buckets[h.bulan].gajiTaPayroll += Number(h.nominalHonor ?? 0);
      buckets[h.bulan].pph21TaPayroll += Number(h.pph21 ?? 0);
    }
  }

  // Agregasi Data SPT Terlapor
  for (const s of sptRaw) {
    if (s.month >= 1 && s.month <= 12) {
      buckets[s.month].gajiTerlapor += Number(s.gajiTerlapor ?? 0);
      buckets[s.month].pph21Terlapor += Number(s.pph21Terlapor ?? 0);
      buckets[s.month].gajiPegawaiTerlapor += Number(s.gajiPegawaiTerlapor ?? 0);
      buckets[s.month].gajiTaTerlapor += Number(s.gajiTaTerlapor ?? 0);
      if (s.ntpn) buckets[s.month].ntpn = s.ntpn;
      if (s.keterangan) buckets[s.month].keterangan = s.keterangan;
    }
  }

  // Buat Rekonsiliasi 12 Bulan (Format Serupa Lapis 3 PPN)
  const items: RekonsiliasiGajiPph21Item[] = [];

  let totalGajiJurnal = 0;
  let totalGajiPayroll = 0;
  let totalGajiTerlapor = 0;
  let totalSelisihGaji = 0;

  let totalPph21Basis = 0;
  let totalPph21Terlapor = 0;
  let totalSelisihPph21 = 0;

  let jumlahBulanMatch = 0;
  let jumlahBulanSelisih = 0;
  let jumlahBulanBelumLapor = 0;
  let jumlahBulanNihil = 0;

  for (let m = 1; m <= 12; m++) {
    const b = buckets[m];
    const gajiTotalJurnal = b.gajiPegawaiJurnal + b.gajiTaJurnal;
    const gajiTotalPayroll = b.gajiPegawaiPayroll + b.gajiTaPayroll;

    // Basis Pajak PPh 21 Jurnal/Payroll
    const pph21PayrollTotal = b.pph21PegawaiPayroll + b.pph21TaPayroll;
    const pph21Basis = b.pph21Jurnal > 0 ? b.pph21Jurnal : pph21PayrollTotal;

    const selisihGaji = gajiTotalJurnal - b.gajiTerlapor;
    const selisihPph21 = pph21Basis - b.pph21Terlapor;

    const hasDataInternal = gajiTotalJurnal > 0 || gajiTotalPayroll > 0 || pph21Basis > 0;
    const hasDataSPT = b.gajiTerlapor > 0 || b.pph21Terlapor > 0;

    let status: "MATCH" | "SELISIH" | "BELUM_DILAPORKAN" | "NIHIL" = "MATCH";

    if (!hasDataInternal && !hasDataSPT) {
      status = "NIHIL";
      jumlahBulanNihil += 1;
    } else if (hasDataInternal && !hasDataSPT) {
      status = "BELUM_DILAPORKAN";
      jumlahBulanBelumLapor += 1;
    } else if (Math.abs(selisihGaji) > 0.01 || Math.abs(selisihPph21) > 0.01) {
      status = "SELISIH";
      jumlahBulanSelisih += 1;
    } else {
      status = "MATCH";
      jumlahBulanMatch += 1;
    }

    totalGajiJurnal += gajiTotalJurnal;
    totalGajiPayroll += gajiTotalPayroll;
    totalGajiTerlapor += b.gajiTerlapor;
    totalSelisihGaji += selisihGaji;

    totalPph21Basis += pph21Basis;
    totalPph21Terlapor += b.pph21Terlapor;
    totalSelisihPph21 += selisihPph21;

    items.push({
      month: m,
      namaBulan: NAMA_BULAN[m - 1],
      gajiPegawaiJurnal: b.gajiPegawaiJurnal,
      gajiTaJurnal: b.gajiTaJurnal,
      gajiTotalJurnal,
      gajiTotalPayroll,
      gajiTerlapor: b.gajiTerlapor,
      gajiPegawaiTerlapor: b.gajiPegawaiTerlapor,
      gajiTaTerlapor: b.gajiTaTerlapor,
      selisihGaji,

      pph21Jurnal: b.pph21Jurnal,
      pph21Payroll: pph21PayrollTotal,
      pph21Basis,
      pph21Terlapor: b.pph21Terlapor,
      selisihPph21,

      status,
      ntpn: b.ntpn,
      keterangan: b.keterangan,

      gajiTotalJurnalFmt: formatRupiah(gajiTotalJurnal),
      gajiTotalPayrollFmt: formatRupiah(gajiTotalPayroll),
      gajiTerlaporFmt: formatRupiah(b.gajiTerlapor),
      selisihGajiFmt: formatRupiah(selisihGaji),
      pph21BasisFmt: formatRupiah(pph21Basis),
      pph21TerlaporFmt: formatRupiah(b.pph21Terlapor),
      selisihPph21Fmt: formatRupiah(selisihPph21),
    });
  }

  let overallStatus: "ALL_BALANCED" | "HAS_DIFF" | "UNREPORTED" | "NO_DATA" = "ALL_BALANCED";
  if (jumlahBulanSelisih > 0) {
    overallStatus = "HAS_DIFF";
  } else if (jumlahBulanBelumLapor > 0) {
    overallStatus = "UNREPORTED";
  } else if (jumlahBulanMatch === 0 && jumlahBulanNihil === 12) {
    overallStatus = "NO_DATA";
  }

  return {
    entityId: primaryEntityId,
    entityName,
    isGrup,
    year,
    items,
    summary: {
      totalGajiJurnal,
      totalGajiJurnalFmt: formatRupiah(totalGajiJurnal),
      totalGajiPayroll,
      totalGajiPayrollFmt: formatRupiah(totalGajiPayroll),
      totalGajiTerlapor,
      totalGajiTerlaporFmt: formatRupiah(totalGajiTerlapor),
      totalSelisihGaji,
      totalSelisihGajiFmt: formatRupiah(totalSelisihGaji),

      totalPph21Basis,
      totalPph21BasisFmt: formatRupiah(totalPph21Basis),
      totalPph21Terlapor,
      totalPph21TerlaporFmt: formatRupiah(totalPph21Terlapor),
      totalSelisihPph21,
      totalSelisihPph21Fmt: formatRupiah(totalSelisihPph21),

      jumlahBulanMatch,
      jumlahBulanSelisih,
      jumlahBulanBelumLapor,
      jumlahBulanNihil,
      overallStatus,
    },
  };
}
