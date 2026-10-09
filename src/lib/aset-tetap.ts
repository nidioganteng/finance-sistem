import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { AsetTetap } from "@prisma/client";

export type KategoriAsetTetap = "TANAH" | "BANGUNAN" | "KENDARAAN" | "PERALATAN_KANTOR";

export const STANDAR_KATEGORI_ASET: {
  key: KategoriAsetTetap;
  label: string;
  order: number;
}[] = [
  { key: "TANAH", label: "Tanah", order: 1 },
  { key: "BANGUNAN", label: "Bangunan", order: 2 },
  { key: "KENDARAAN", label: "Kendaraan", order: 3 },
  { key: "PERALATAN_KANTOR", label: "Peralatan Kantor", order: 4 },
];

export function normalizeKategoriAset(raw: string | null | undefined): KategoriAsetTetap {
  if (!raw) return "PERALATAN_KANTOR";
  const up = raw.toUpperCase().trim();
  if (up === "TANAH") return "TANAH";
  if (up === "BANGUNAN" || up === "GEDUNG") return "BANGUNAN";
  if (up === "KENDARAAN") return "KENDARAAN";
  return "PERALATAN_KANTOR";
}

export function getKategoriLabel(kategori: string): string {
  const norm = normalizeKategoriAset(kategori);
  switch (norm) {
    case "TANAH":
      return "Tanah";
    case "BANGUNAN":
      return "Bangunan";
    case "KENDARAAN":
      return "Kendaraan";
    case "PERALATAN_KANTOR":
      return "Peralatan Kantor";
  }
}

export interface RekapKategoriAset {
  kategori: KategoriAsetTetap;
  label: string;
  totalHargaPerolehan: number;
  totalAkumulasiPenyusutan: number;
  totalBebanPenyusutan: number;
  totalNilaiBuku: number;
  totalHargaPerolehanFmt: string;
  totalAkumulasiPenyusutanFmt: string;
  totalBebanPenyusutanFmt: string;
  totalNilaiBukuFmt: string;
  jumlahAset: number;
}

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
  kategoriStandar: KategoriAsetTetap;
  kategoriLabel: string;
};

export type PenyusutanSummary = {
  assets: AsetTetapWithDepreciation[];
  rekapPerKategori: RekapKategoriAset[];
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
  const kategoriStandar = normalizeKategoriAset(asset.kategori);
  const kategoriLabel = getKategoriLabel(kategoriStandar);
  const tglBeli = new Date(asset.tanggalPerolehan);
  const tglStr = tglBeli.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Standar Akuntansi (PSAK 16): Tanah tidak memiliki masa manfaat terbatas sehingga tidak disusutkan
  if (kategoriStandar === "TANAH") {
    return {
      ...asset,
      kategoriStandar,
      kategoriLabel,
      hargaPerolehanNum: hargaPerolehan,
      nilaiResiduNum: hargaPerolehan,
      penyusutanPerBulan: 0,
      bebanPeriodeIni: 0,
      akumulasiPenyusutan: 0,
      nilaiBuku: hargaPerolehan,
      hargaPerolehanFmt: formatRupiah(hargaPerolehan),
      penyusutanPerBulanFmt: "Rp 0",
      bebanPeriodeIniFmt: "Rp 0",
      akumulasiPenyusutanFmt: "Rp 0",
      nilaiBukuFmt: formatRupiah(hargaPerolehan),
      tanggalPerolehanFmt: tglStr,
      umurTahun: 0,
    };
  }
  const umurBulan = Math.max(1, asset.umurBulan);
  const depreciableBase = Math.max(0, hargaPerolehan - nilaiResidu);
  const penyusutanPerBulan = depreciableBase / umurBulan;

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

  return {
    ...asset,
    kategoriStandar,
    kategoriLabel,
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
 * ke Laba Rugi dan Neraca (Issue 39, Issue 88 & SRS v2.0).
 */
export async function getPenyusutanSummary(
  entityId: string,
  year: number,
  month?: number
): Promise<PenyusutanSummary> {
  const assetsRaw = await prisma.asetTetap.findMany({
    where: { entityId },
    orderBy: [{ tanggalPerolehan: "asc" }, { kode: "asc" }],
  });

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

  // Agregasi 4 Kategori Utama Aktiva Tetap (Issue 88 Poin 3)
  const rekapPerKategori: RekapKategoriAset[] = STANDAR_KATEGORI_ASET.map((kat) => {
    const groupAssets = activeAssets.filter((a) => a.kategoriStandar === kat.key);
    const hp = groupAssets.reduce((s, a) => s + a.hargaPerolehanNum, 0);
    const ak = groupAssets.reduce((s, a) => s + a.akumulasiPenyusutan, 0);
    const bp = groupAssets.reduce((s, a) => s + a.bebanPeriodeIni, 0);
    const nb = hp - ak;

    return {
      kategori: kat.key,
      label: kat.label,
      totalHargaPerolehan: hp,
      totalAkumulasiPenyusutan: ak,
      totalBebanPenyusutan: bp,
      totalNilaiBuku: nb,
      totalHargaPerolehanFmt: formatRupiah(hp),
      totalAkumulasiPenyusutanFmt: formatRupiah(ak),
      totalBebanPenyusutanFmt: formatRupiah(bp),
      totalNilaiBukuFmt: formatRupiah(nb),
      jumlahAset: groupAssets.length,
    };
  });

  return {
    assets,
    rekapPerKategori,
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
