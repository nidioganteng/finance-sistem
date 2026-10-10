import { phpFetch, getPhpToken } from "./api-client";
import { formatRupiah } from "./dashboard-data";
import { AsetTetap } from "@/types/app-enums";

// 4 kategori aktiva tetap standar PSAK 16
export const STANDAR_KATEGORI_ASET = [
  { key: "TANAH",     label: "Tanah" },
  { key: "BANGUNAN",  label: "Bangunan & Gedung" },
  { key: "KENDARAAN", label: "Kendaraan" },
  { key: "PERALATAN", label: "Peralatan & Inventaris" },
];

export function getKategoriLabel(kategori: string): string {
  return STANDAR_KATEGORI_ASET.find((k) => k.key === kategori)?.label ?? kategori;
}

function normalizeKategori(raw: string): string {
  const map: Record<string, string> = {
    TANAH: "TANAH",
    BANGUNAN: "BANGUNAN",
    GEDUNG: "BANGUNAN",
    KENDARAAN: "KENDARAAN",
    PERALATAN: "PERALATAN",
    MESIN: "PERALATAN",
    INVENTARIS: "PERALATAN",
    LAINNYA: "PERALATAN",
  };
  return map[(raw ?? "").toUpperCase()] ?? "PERALATAN";
}

export type RekapKategoriAset = {
  kategori: string;
  label: string;
  jumlahAset: number;
  totalHargaPerolehan: number;
  totalHargaPerolehanFmt: string;
  totalAkumulasiPenyusutan: number;
  totalAkumulasiPenyusutanFmt: string;
  totalNilaiBuku: number;
  totalNilaiBukuFmt: string;
};

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
  kategoriStandar: string;
  kategoriLabel: string;
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
  rekapPerKategori: RekapKategoriAset[];
  year: number;
  month?: number;
};

/**
 * Menghitung jadwal penyusutan garis lurus (Straight-Line Depreciation) — pure function, tetap lokal.
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
  const buyMonth = tglBeli.getMonth() + 1;

  const endMonth = targetMonth ? Math.min(12, Math.max(1, targetMonth)) : 12;

  let totalMonthsElapsed = (targetYear - buyYear) * 12 + (endMonth - buyMonth + 1);
  if (totalMonthsElapsed < 0) totalMonthsElapsed = 0;

  const effectiveMonthsTotal = Math.min(umurBulan, totalMonthsElapsed);
  const akumulasiPenyusutan = Math.min(
    depreciableBase,
    Math.round(effectiveMonthsTotal * penyusutanPerBulan)
  );

  let monthsElapsedPrior = 0;
  if (targetMonth) {
    monthsElapsedPrior = (targetYear - buyYear) * 12 + (targetMonth - 1 - buyMonth + 1);
  } else {
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

  const kat = normalizeKategori(asset.kategori);
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
    kategoriStandar: kat,
    kategoriLabel: getKategoriLabel(kat),
  };
}

export async function getPenyusutanSummary(
  entityId: string,
  year: number,
  month?: number
): Promise<PenyusutanSummary> {
  const token = await getPhpToken();
  // PHP /api/aset-tetap returns a bare array with pre-computed penyusutan fields
  // (bebanPenyusutan, akumulasiPenyusutan, nilaiBuku) calculated for the requested year.
  // We build AsetTetapWithDepreciation from those raw values without re-running the local
  // depreciation calculation, which requires a Prisma AsetTetap object with a Date field.
  const rows = await phpFetch<RawAsetTetapRow[]>(
    `/api/aset-tetap?entityId=${encodeURIComponent(entityId)}&year=${year}`,
    token
  );

  const tglFmt = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  const assets: AsetTetapWithDepreciation[] = (rows ?? []).map((row) => {
    const hargaPerolehan = row.hargaPerolehan;
    const nilaiResidu = row.nilaiResidu;
    const umurBulan = Math.max(1, row.umurBulan);
    const depreciableBase = Math.max(0, hargaPerolehan - nilaiResidu);
    const penyusutanPerBulan = depreciableBase / umurBulan;

    return {
      // AsetTetap base fields (cast tanggalPerolehan to Date for type compatibility)
      id: row.id,
      entityId: row.entityId,
      kode: row.kode,
      nama: row.nama,
      kategori: row.kategori,
      tanggalPerolehan: new Date(row.tanggalPerolehan),
      hargaPerolehan,
      nilaiResidu,
      umurBulan: row.umurBulan,
      metode: row.metode,
      keterangan: row.keterangan ?? null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.createdAt),
      // Extended depreciation fields
      hargaPerolehanNum: hargaPerolehan,
      nilaiResiduNum: nilaiResidu,
      penyusutanPerBulan,
      bebanPeriodeIni: row.bebanPenyusutan,
      akumulasiPenyusutan: row.akumulasiPenyusutan,
      nilaiBuku: row.nilaiBuku,
      hargaPerolehanFmt: formatRupiah(hargaPerolehan),
      penyusutanPerBulanFmt: formatRupiah(Math.round(penyusutanPerBulan)),
      bebanPeriodeIniFmt: formatRupiah(row.bebanPenyusutan),
      akumulasiPenyusutanFmt: formatRupiah(row.akumulasiPenyusutan),
      nilaiBukuFmt: formatRupiah(row.nilaiBuku),
      tanggalPerolehanFmt: tglFmt(row.tanggalPerolehan),
      umurTahun: Number((row.umurBulan / 12).toFixed(1)),
      kategoriStandar: normalizeKategori(row.kategori),
      kategoriLabel: getKategoriLabel(normalizeKategori(row.kategori)),
    };
  });

  const totalHargaPerolehan = assets.reduce((s, a) => s + a.hargaPerolehanNum, 0);
  const totalBebanPenyusutan = assets.reduce((s, a) => s + a.bebanPeriodeIni, 0);
  const totalAkumulasiPenyusutan = assets.reduce((s, a) => s + a.akumulasiPenyusutan, 0);
  const totalNilaiBuku = assets.reduce((s, a) => s + a.nilaiBuku, 0);

  const rekapPerKategori: RekapKategoriAset[] = STANDAR_KATEGORI_ASET.map((kat) => {
    const group = assets.filter((a) => a.kategoriStandar === kat.key);
    const totalHP = group.reduce((s, a) => s + a.hargaPerolehanNum, 0);
    const totalAkum = group.reduce((s, a) => s + a.akumulasiPenyusutan, 0);
    const totalNB = group.reduce((s, a) => s + a.nilaiBuku, 0);
    return {
      kategori: kat.key,
      label: kat.label,
      jumlahAset: group.length,
      totalHargaPerolehan: totalHP,
      totalHargaPerolehanFmt: formatRupiah(totalHP),
      totalAkumulasiPenyusutan: totalAkum,
      totalAkumulasiPenyusutanFmt: formatRupiah(totalAkum),
      totalNilaiBuku: totalNB,
      totalNilaiBukuFmt: formatRupiah(totalNB),
    };
  });

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
    rekapPerKategori,
    year,
    month,
  };
}

// Raw shape returned by PHP GET /api/aset-tetap
type RawAsetTetapRow = {
  id: string;
  entityId: string;
  kode: string;
  nama: string;
  kategori: string;
  tanggalPerolehan: string;
  hargaPerolehan: number;
  nilaiResidu: number;
  umurBulan: number;
  metode: string;
  keterangan: string | null;
  createdAt: string;
  // Pre-computed penyusutan fields from PHP helper
  bebanPenyusutan: number;
  akumulasiPenyusutan: number;
  nilaiBuku: number;
};

export type AsetTetapListItem = {
  id: string;
  entityId: string;
  kode: string;
  nama: string;
  kategori: string;
  tanggalPerolehan: string;
  hargaPerolehan: number;
  hargaPerolehanFmt: string;
  nilaiResidu: number;
  umurBulan: number;
  metode: string;
  keterangan: string | null;
  createdAt: string;
  bebanPenyusutan: number;
  akumulasiPenyusutan: number;
  nilaiBuku: number;
  [key: string]: unknown;
};

export async function getAsetTetapList(entityId: string, year: number): Promise<AsetTetapListItem[]> {
  const token = await getPhpToken();
  // PHP returns a bare array (not wrapped in { data: [...] })
  const rows = await phpFetch<RawAsetTetapRow[]>(
    `/api/aset-tetap?entityId=${encodeURIComponent(entityId)}&year=${year}`,
    token
  );
  return (rows ?? []).map((row) => ({
    ...row,
    hargaPerolehanFmt: formatRupiah(row.hargaPerolehan),
  }));
}
