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

export type StatusAudit = "MATCH" | "SELISIH" | "BELUM_DILAPORKAN" | "NIHIL";

export interface RekonsiliasiGajiPph21Item {
  month: number;
  namaBulan: string;

  // ── Kategori 1: Pegawai Tetap (Akun 511) ─────────────────────────────
  gajiPegawaiJurnal: number;
  gajiPegawaiPayroll: number;
  gajiPegawaiTerlapor: number;
  selisihGajiPegawai: number;
  pph21PegawaiBasis: number;
  pph21PegawaiTerlapor: number;
  selisihPph21Pegawai: number;
  statusPegawai: StatusAudit;

  gajiPegawaiJurnalFmt: string;
  gajiPegawaiPayrollFmt: string;
  gajiPegawaiTerlaporFmt: string;
  selisihGajiPegawaiFmt: string;
  pph21PegawaiBasisFmt: string;
  pph21PegawaiTerlaporFmt: string;
  selisihPph21PegawaiFmt: string;

  // ── Kategori 2: Tenaga Ahli (Akun 612) ──────────────────────────────
  gajiTaJurnal: number;
  gajiTaPayroll: number;
  gajiTaTerlapor: number;
  selisihGajiTa: number;
  pph21TaBasis: number;
  pph21TaTerlapor: number;
  selisihPph21Ta: number;
  statusTa: StatusAudit;

  gajiTaJurnalFmt: string;
  gajiTaPayrollFmt: string;
  gajiTaTerlaporFmt: string;
  selisihGajiTaFmt: string;
  pph21TaBasisFmt: string;
  pph21TaTerlaporFmt: string;
  selisihPph21TaFmt: string;

  // ── Total Gabungan / Konsolidasi ─────────────────────────────────────
  gajiTotalJurnal: number;
  gajiTotalPayroll: number;
  gajiTerlapor: number;
  selisihGaji: number;
  pph21Jurnal: number;
  pph21Payroll: number;
  pph21Basis: number;
  pph21Terlapor: number;
  selisihPph21: number;
  status: StatusAudit;

  gajiTotalJurnalFmt: string;
  gajiTotalPayrollFmt: string;
  gajiTerlaporFmt: string;
  selisihGajiFmt: string;
  pph21BasisFmt: string;
  pph21TerlaporFmt: string;
  selisihPph21Fmt: string;

  // Metadata Audit
  ntpn: string | null;
  keterangan: string | null;
}

export interface KategoriSummary {
  totalGajiJurnal: number;
  totalGajiJurnalFmt: string;
  totalGajiTerlapor: number;
  totalGajiTerlaporFmt: string;
  totalSelisihGaji: number;
  totalSelisihGajiFmt: string;

  totalPphBasis: number;
  totalPphBasisFmt: string;
  totalPphTerlapor: number;
  totalPphTerlaporFmt: string;
  totalSelisihPph: number;
  totalSelisihPphFmt: string;

  jumlahBulanMatch: number;
  jumlahBulanSelisih: number;
  jumlahBulanBelumLapor: number;
  jumlahBulanNihil: number;
  status: "ALL_BALANCED" | "HAS_DIFF" | "UNREPORTED" | "NO_DATA";
}

export interface RekonsiliasiPajakGajiSummary {
  // Gabungan Total
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

  // Per Kategori Terpisah
  pegawai: KategoriSummary;
  tenagaAhli: KategoriSummary;
}

export interface RekonsiliasiPajakGajiData {
  entityId: string;
  entityName: string;
  isGrup: boolean;
  year: number;
  items: RekonsiliasiGajiPph21Item[];
  summary: RekonsiliasiPajakGajiSummary;
}

function deriveAuditStatus(
  hasInternal: boolean,
  hasSPT: boolean,
  diffGaji: number,
  diffPph: number
): StatusAudit {
  if (!hasInternal && !hasSPT) return "NIHIL";
  if (hasInternal && !hasSPT) return "BELUM_DILAPORKAN";
  if (Math.abs(diffGaji) > 0.01 || Math.abs(diffPph) > 0.01) return "SELISIH";
  return "MATCH";
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

  // Bucket penampung per bulan (1..12)
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
    pph21PegawaiTerlapor: number;
    pph21TaTerlapor: number;
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
      pph21PegawaiTerlapor: 0,
      pph21TaTerlapor: 0,
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
      buckets[s.month].pph21PegawaiTerlapor += Number(s.pph21PegawaiTerlapor ?? 0);
      buckets[s.month].pph21TaTerlapor += Number(s.pph21TaTerlapor ?? 0);
      if (s.ntpn) buckets[s.month].ntpn = s.ntpn;
      if (s.keterangan) buckets[s.month].keterangan = s.keterangan;
    }
  }

  // Buat Rekonsiliasi 12 Bulan (Format Serupa Lapis 3 PPN)
  const items: RekonsiliasiGajiPph21Item[] = [];

  // Summary Counters: Total Gabungan
  let totGajiJurnal = 0;
  let totGajiPayroll = 0;
  let totGajiTerlapor = 0;
  let totSelisihGaji = 0;
  let totPphBasis = 0;
  let totPphTerlapor = 0;
  let totSelisihPph = 0;
  let cntMatch = 0;
  let cntSelisih = 0;
  let cntBelum = 0;
  let cntNihil = 0;

  // Summary Counters: Pegawai Tetap
  let totPegGajiJurnal = 0;
  let totPegGajiTerlapor = 0;
  let totPegSelisihGaji = 0;
  let totPegPphBasis = 0;
  let totPegPphTerlapor = 0;
  let totPegSelisihPph = 0;
  let cntPegMatch = 0;
  let cntPegSelisih = 0;
  let cntPegBelum = 0;
  let cntPegNihil = 0;

  // Summary Counters: Tenaga Ahli
  let totTaGajiJurnal = 0;
  let totTaGajiTerlapor = 0;
  let totTaSelisihGaji = 0;
  let totTaPphBasis = 0;
  let totTaPphTerlapor = 0;
  let totTaSelisihPph = 0;
  let cntTaMatch = 0;
  let cntTaSelisih = 0;
  let cntTaBelum = 0;
  let cntTaNihil = 0;

  for (let m = 1; m <= 12; m++) {
    const b = buckets[m];

    // ── 1. Pegawai Tetap ──────────────────────────────────────────────
    const gajiPegJurnal = b.gajiPegawaiJurnal;
    const gajiPegPayroll = b.gajiPegawaiPayroll;
    const gajiPegTerlapor = b.gajiPegawaiTerlapor > 0 ? b.gajiPegawaiTerlapor : (b.gajiTerlapor > 0 && b.gajiTaTerlapor === 0 ? b.gajiTerlapor : 0);
    const selisihGajiPeg = gajiPegJurnal - gajiPegTerlapor;

    const pphPegBasis = b.pph21PegawaiPayroll;
    const pphPegTerlapor = b.pph21PegawaiTerlapor > 0 ? b.pph21PegawaiTerlapor : (b.pph21Terlapor > 0 && b.pph21TaTerlapor === 0 ? b.pph21Terlapor : 0);
    const selisihPphPeg = pphPegBasis - pphPegTerlapor;

    const statusPeg = deriveAuditStatus(
      gajiPegJurnal > 0 || pphPegBasis > 0,
      gajiPegTerlapor > 0 || pphPegTerlapor > 0,
      selisihGajiPeg,
      selisihPphPeg
    );

    // ── 2. Tenaga Ahli ────────────────────────────────────────────────
    const gajiTaJurnal = b.gajiTaJurnal;
    const gajiTaPayroll = b.gajiTaPayroll;
    const gajiTaTerlapor = b.gajiTaTerlapor;
    const selisihGajiTa = gajiTaJurnal - gajiTaTerlapor;

    const pphTaBasis = b.pph21TaPayroll;
    const pphTaTerlapor = b.pph21TaTerlapor;
    const selisihPphTa = pphTaBasis - pphTaTerlapor;

    const statusTa = deriveAuditStatus(
      gajiTaJurnal > 0 || pphTaBasis > 0,
      gajiTaTerlapor > 0 || pphTaTerlapor > 0,
      selisihGajiTa,
      selisihPphTa
    );

    // ── 3. Total Gabungan ─────────────────────────────────────────────
    const gajiTotalJurnal = gajiPegJurnal + gajiTaJurnal;
    const gajiTotalPayroll = gajiPegPayroll + gajiTaPayroll;
    const gajiTerlapor = b.gajiTerlapor > 0 ? b.gajiTerlapor : (gajiPegTerlapor + gajiTaTerlapor);
    const selisihGaji = gajiTotalJurnal - gajiTerlapor;

    const pph21PayrollTotal = pphPegBasis + pphTaBasis;
    const pph21Basis = b.pph21Jurnal > 0 ? b.pph21Jurnal : pph21PayrollTotal;
    const pph21Terlapor = b.pph21Terlapor > 0 ? b.pph21Terlapor : (pphPegTerlapor + pphTaTerlapor);
    const selisihPph21 = pph21Basis - pph21Terlapor;

    const statusTotal = deriveAuditStatus(
      gajiTotalJurnal > 0 || pph21Basis > 0,
      gajiTerlapor > 0 || pph21Terlapor > 0,
      selisihGaji,
      selisihPph21
    );

    // Akumulasi Gabungan
    totGajiJurnal += gajiTotalJurnal;
    totGajiPayroll += gajiTotalPayroll;
    totGajiTerlapor += gajiTerlapor;
    totSelisihGaji += selisihGaji;
    totPphBasis += pph21Basis;
    totPphTerlapor += pph21Terlapor;
    totSelisihPph += selisihPph21;

    if (statusTotal === "MATCH") cntMatch++;
    else if (statusTotal === "SELISIH") cntSelisih++;
    else if (statusTotal === "BELUM_DILAPORKAN") cntBelum++;
    else cntNihil++;

    // Akumulasi Pegawai
    totPegGajiJurnal += gajiPegJurnal;
    totPegGajiTerlapor += gajiPegTerlapor;
    totPegSelisihGaji += selisihGajiPeg;
    totPegPphBasis += pphPegBasis;
    totPegPphTerlapor += pphPegTerlapor;
    totPegSelisihPph += selisihPphPeg;

    if (statusPeg === "MATCH") cntPegMatch++;
    else if (statusPeg === "SELISIH") cntPegSelisih++;
    else if (statusPeg === "BELUM_DILAPORKAN") cntPegBelum++;
    else cntPegNihil++;

    // Akumulasi Tenaga Ahli
    totTaGajiJurnal += gajiTaJurnal;
    totTaGajiTerlapor += gajiTaTerlapor;
    totTaSelisihGaji += selisihGajiTa;
    totTaPphBasis += pphTaBasis;
    totTaPphTerlapor += pphTaTerlapor;
    totTaSelisihPph += selisihPphTa;

    if (statusTa === "MATCH") cntTaMatch++;
    else if (statusTa === "SELISIH") cntTaSelisih++;
    else if (statusTa === "BELUM_DILAPORKAN") cntTaBelum++;
    else cntTaNihil++;

    items.push({
      month: m,
      namaBulan: NAMA_BULAN[m - 1],

      // Pegawai Tetap
      gajiPegawaiJurnal: gajiPegJurnal,
      gajiPegawaiPayroll: gajiPegPayroll,
      gajiPegawaiTerlapor: gajiPegTerlapor,
      selisihGajiPegawai: selisihGajiPeg,
      pph21PegawaiBasis: pphPegBasis,
      pph21PegawaiTerlapor: pphPegTerlapor,
      selisihPph21Pegawai: selisihPphPeg,
      statusPegawai: statusPeg,

      gajiPegawaiJurnalFmt: formatRupiah(gajiPegJurnal),
      gajiPegawaiPayrollFmt: formatRupiah(gajiPegPayroll),
      gajiPegawaiTerlaporFmt: formatRupiah(gajiPegTerlapor),
      selisihGajiPegawaiFmt: formatRupiah(selisihGajiPeg),
      pph21PegawaiBasisFmt: formatRupiah(pphPegBasis),
      pph21PegawaiTerlaporFmt: formatRupiah(pphPegTerlapor),
      selisihPph21PegawaiFmt: formatRupiah(selisihPphPeg),

      // Tenaga Ahli
      gajiTaJurnal,
      gajiTaPayroll,
      gajiTaTerlapor,
      selisihGajiTa,
      pph21TaBasis: pphTaBasis,
      pph21TaTerlapor: pphTaTerlapor,
      selisihPph21Ta: selisihPphTa,
      statusTa,

      gajiTaJurnalFmt: formatRupiah(gajiTaJurnal),
      gajiTaPayrollFmt: formatRupiah(gajiTaPayroll),
      gajiTaTerlaporFmt: formatRupiah(gajiTaTerlapor),
      selisihGajiTaFmt: formatRupiah(selisihGajiTa),
      pph21TaBasisFmt: formatRupiah(pphTaBasis),
      pph21TaTerlaporFmt: formatRupiah(pphTaTerlapor),
      selisihPph21TaFmt: formatRupiah(selisihPphTa),

      // Gabungan Total
      gajiTotalJurnal,
      gajiTotalPayroll,
      gajiTerlapor,
      selisihGaji,
      pph21Jurnal: b.pph21Jurnal,
      pph21Payroll: pph21PayrollTotal,
      pph21Basis,
      pph21Terlapor,
      selisihPph21,
      status: statusTotal,

      gajiTotalJurnalFmt: formatRupiah(gajiTotalJurnal),
      gajiTotalPayrollFmt: formatRupiah(gajiTotalPayroll),
      gajiTerlaporFmt: formatRupiah(gajiTerlapor),
      selisihGajiFmt: formatRupiah(selisihGaji),
      pph21BasisFmt: formatRupiah(pph21Basis),
      pph21TerlaporFmt: formatRupiah(pph21Terlapor),
      selisihPph21Fmt: formatRupiah(selisihPph21),

      ntpn: b.ntpn,
      keterangan: b.keterangan,
    });
  }

  function resolveOverall(cntS: number, cntB: number, cntM: number, cntN: number) {
    if (cntS > 0) return "HAS_DIFF" as const;
    if (cntB > 0) return "UNREPORTED" as const;
    if (cntM === 0 && cntN === 12) return "NO_DATA" as const;
    return "ALL_BALANCED" as const;
  }

  return {
    entityId: primaryEntityId,
    entityName,
    isGrup,
    year,
    items,
    summary: {
      totalGajiJurnal: totGajiJurnal,
      totalGajiJurnalFmt: formatRupiah(totGajiJurnal),
      totalGajiPayroll: totGajiPayroll,
      totalGajiPayrollFmt: formatRupiah(totGajiPayroll),
      totalGajiTerlapor: totGajiTerlapor,
      totalGajiTerlaporFmt: formatRupiah(totGajiTerlapor),
      totalSelisihGaji: totSelisihGaji,
      totalSelisihGajiFmt: formatRupiah(totSelisihGaji),

      totalPph21Basis: totPphBasis,
      totalPph21BasisFmt: formatRupiah(totPphBasis),
      totalPph21Terlapor: totPphTerlapor,
      totalPph21TerlaporFmt: formatRupiah(totPphTerlapor),
      totalSelisihPph21: totSelisihPph,
      totalSelisihPph21Fmt: formatRupiah(totSelisihPph),

      jumlahBulanMatch: cntMatch,
      jumlahBulanSelisih: cntSelisih,
      jumlahBulanBelumLapor: cntBelum,
      jumlahBulanNihil: cntNihil,
      overallStatus: resolveOverall(cntSelisih, cntBelum, cntMatch, cntNihil),

      pegawai: {
        totalGajiJurnal: totPegGajiJurnal,
        totalGajiJurnalFmt: formatRupiah(totPegGajiJurnal),
        totalGajiTerlapor: totPegGajiTerlapor,
        totalGajiTerlaporFmt: formatRupiah(totPegGajiTerlapor),
        totalSelisihGaji: totPegSelisihGaji,
        totalSelisihGajiFmt: formatRupiah(totPegSelisihGaji),

        totalPphBasis: totPegPphBasis,
        totalPphBasisFmt: formatRupiah(totPegPphBasis),
        totalPphTerlapor: totPegPphTerlapor,
        totalPphTerlaporFmt: formatRupiah(totPegPphTerlapor),
        totalSelisihPph: totPegSelisihPph,
        totalSelisihPphFmt: formatRupiah(totPegSelisihPph),

        jumlahBulanMatch: cntPegMatch,
        jumlahBulanSelisih: cntPegSelisih,
        jumlahBulanBelumLapor: cntPegBelum,
        jumlahBulanNihil: cntPegNihil,
        status: resolveOverall(cntPegSelisih, cntPegBelum, cntPegMatch, cntPegNihil),
      },

      tenagaAhli: {
        totalGajiJurnal: totTaGajiJurnal,
        totalGajiJurnalFmt: formatRupiah(totTaGajiJurnal),
        totalGajiTerlapor: totTaGajiTerlapor,
        totalGajiTerlaporFmt: formatRupiah(totTaGajiTerlapor),
        totalSelisihGaji: totTaSelisihGaji,
        totalSelisihGajiFmt: formatRupiah(totTaSelisihGaji),

        totalPphBasis: totTaPphBasis,
        totalPphBasisFmt: formatRupiah(totTaPphBasis),
        totalPphTerlapor: totTaPphTerlapor,
        totalPphTerlaporFmt: formatRupiah(totTaPphTerlapor),
        totalSelisihPph: totTaSelisihPph,
        totalSelisihPphFmt: formatRupiah(totTaSelisihPph),

        jumlahBulanMatch: cntTaMatch,
        jumlahBulanSelisih: cntTaSelisih,
        jumlahBulanBelumLapor: cntTaBelum,
        jumlahBulanNihil: cntTaNihil,
        status: resolveOverall(cntTaSelisih, cntTaBelum, cntTaMatch, cntTaNihil),
      },
    },
  };
}
