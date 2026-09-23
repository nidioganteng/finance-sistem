import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { AsetTetap } from "@prisma/client";

export type AsetTetapWithDepreciation = AsetTetap & {
  hargaPerolehanNum: number;
  nilaiResiduNum: number;
  penyusutanPerBulan: number;
  bebanPeriodeIni: number;
  akumulasiPenyusutan: number;
  nilaiBuku: number;
  hargaPerolehanFmt: string;
  penyusutanPerBulanFmt: string;
  bebanPeriodeIniFmt: string;
  akumulasiPenyusutanFmt: string;
  nilaiBukuFmt: string;
  tanggalPerolehanFmt: string;
  umurTahun: number;
};

export type PenyusutanSummary = {
  assets: AsetTetapWithDepreciation[];
  totalHargaPerolehan: number;
  totalBebanPenyusutan: number;
  totalAkumulasiPenyusutan: number;
  totalNilaiBuku: number;
  totalHargaPerolehanFmt: string;
  totalBebanPenyusutanFmt: string;
  totalAkumulasiPenyusutanFmt: string;
  totalNilaiBukuFmt: string;
  year: number;
  month?: number;
};

/**
 * Menghitung jadwal penyusutan garis lurus (Straight-Line Depreciation)
 * sesuai standar PSAK 16 dan ALUR_DAN_RUMUS_LAPORAN_KEUANGAN.md.
 *
 * Rumus:
 *   Depreciable Base = Harga Perolehan - Nilai Residu
 *   Penyusutan Per Bulan = Depreciable Base / Umur Bulan
 *   Akumulasi Penyusutan = Bulan Efektif Terpakai * Penyusutan Per Bulan
 *   Nilai Buku = Harga Perolehan - Akumulasi Penyusutan
 */
export function calculateAsetDepreciation(
  asset: AsetTetap,
  targetYear: number,
  targetMonth?: number
): AsetTetapWithDepreciation {
  const hargaPerolehan = Number(asset.hargaPerolehan);
  const nilaiResidu = Number(asset.nilaiResidu);
  const umurBulan = Math.max(1, asset.umurBulan);
  const depreciableBase = Math.max(0, hargaPerolehan - nilaiResidu);
  const penyusutanPerBulan = depreciableBase / umurBulan;

  const tglBeli = new Date(asset.tanggalPerolehan);
  const buyYear = tglBeli.getFullYear();
  const buyMonth = tglBeli.getMonth() + 1; // 1-12

  const endMonth = targetMonth ? Math.min(12, Math.max(1, targetMonth)) : 12;

  // 1. Akumulasi bulan terlewati sejak pembelian hingga akhir periode target
  let totalMonthsElapsed = (targetYear - buyYear) * 12 + (endMonth - buyMonth + 1);
  if (totalMonthsElapsed < 0) totalMonthsElapsed = 0;

  const effectiveMonthsTotal = Math.min(umurBulan, totalMonthsElapsed);
  const akumulasiPenyusutan = Math.min(
    depreciableBase,
    Math.round(effectiveMonthsTotal * penyusutanPerBulan)
  );

  // 2. Bulan terlewati sebelum awal periode target (untuk menghitung beban khusus periode ini)
  let monthsElapsedPrior = 0;
  if (targetMonth) {
    // Jika filter bulan M spesifik, periode prior adalah hingga M - 1
    monthsElapsedPrior = (targetYear - buyYear) * 12 + (targetMonth - 1 - buyMonth + 1);
  } else {
    // Jika tahun penuh, periode prior adalah hingga akhir tahun sebelumnya (targetYear - 1)
    monthsElapsedPrior = (targetYear - 1 - buyYear) * 12 + (12 - buyMonth + 1);
  }
  if (monthsElapsedPrior < 0) monthsElapsedPrior = 0;

  const effectiveMonthsPrior = Math.min(umurBulan, monthsElapsedPrior);
  const akumulasiPrior = Math.min(
    depreciableBase,
    Math.round(effectiveMonthsPrior * penyusutanPerBulan)
  );

  const bebanPeriodeIni = Math.max(0, akumulasiPenyusutan - akumulasiPrior);
  const nilaiBuku = Math.max(nilaiResidu, hargaPerolehan - akumulasiPenyusutan);

  const tglStr = tglBeli.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return {
    ...asset,
    hargaPerolehanNum: hargaPerolehan,
    nilaiResiduNum: nilaiResidu,
    penyusutanPerBulan,
    bebanPeriodeIni,
    akumulasiPenyusutan,
    nilaiBuku,
    hargaPerolehanFmt: formatRupiah(hargaPerolehan),
    penyusutanPerBulanFmt: formatRupiah(Math.round(penyusutanPerBulan)),
    bebanPeriodeIniFmt: formatRupiah(bebanPeriodeIni),
    akumulasiPenyusutanFmt: formatRupiah(akumulasiPenyusutan),
    nilaiBukuFmt: formatRupiah(nilaiBuku),
    tanggalPerolehanFmt: tglStr,
    umurTahun: Number((umurBulan / 12).toFixed(1)),
  };
}

/**
 * Mengambil rekapitulasi penyusutan seluruh aset tetap per entitas dan periode.
 * Fungsi ini menjadi Single Source of Truth penarikan otomatis (linking)
 * ke Laba Rugi dan Neraca (Issue 39 & SRS v2.0).
 */
export async function getPenyusutanSummary(
  entityId: string,
  year: number,
  month?: number
): Promise<PenyusutanSummary> {
  const assetsRaw = Boolean((prisma as any).asetTetap)
    ? await prisma.asetTetap.findMany({
        where: { entityId },
        orderBy: [{ tanggalPerolehan: "asc" }, { kode: "asc" }],
      })
    : [];

  const assets = assetsRaw.map((a) => calculateAsetDepreciation(a, year, month));

  // Hanya hitung aset yang sudah diperoleh pada atau sebelum akhir periode
  const activeAssets = assets.filter((a) => {
    const tgl = new Date(a.tanggalPerolehan);
    const endMonth = month ? month : 12;
    const endDate = new Date(year, endMonth - 1, 31, 23, 59, 59);
    return tgl <= endDate;
  });

  const totalHargaPerolehan = activeAssets.reduce((s, a) => s + a.hargaPerolehanNum, 0);
  const totalBebanPenyusutan = activeAssets.reduce((s, a) => s + a.bebanPeriodeIni, 0);
  const totalAkumulasiPenyusutan = activeAssets.reduce((s, a) => s + a.akumulasiPenyusutan, 0);
  const totalNilaiBuku = totalHargaPerolehan - totalAkumulasiPenyusutan;

  return {
    assets,
    totalHargaPerolehan,
    totalBebanPenyusutan,
    totalAkumulasiPenyusutan,
    totalNilaiBuku,
    totalHargaPerolehanFmt: formatRupiah(totalHargaPerolehan),
    totalBebanPenyusutanFmt: formatRupiah(totalBebanPenyusutan),
    totalAkumulasiPenyusutanFmt: formatRupiah(totalAkumulasiPenyusutan),
    totalNilaiBukuFmt: formatRupiah(totalNilaiBuku),
    year,
    month,
  };
}
