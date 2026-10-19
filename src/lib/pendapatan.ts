import { phpFetch, getPhpToken } from "./api-client";
import { REKENING_BY_ENTITY } from "./bank-accounts";
import { formatRupiah } from "./dashboard-data";

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

/**
 * Menghitung DPP & PPN Otomatis berbasis Nilai Kuitansi Bruto:
 * DPP = (100 / 111) * Nilai Kuitansi Bruto
 * PPN = (11 / 111) * Nilai Kuitansi Bruto
 */
export function hitungDppDanPpnDariKuitansi(nilaiKwitansi: number, tarifPphPersen = 3.5) {
  if (!nilaiKwitansi || nilaiKwitansi <= 0) {
    return { dpp: 0, ppn: 0, pph: 0, nilaiProyek: 0, labaSetelahPajak: 0 };
  }
  const dpp = Math.round((nilaiKwitansi * 100) / 111);
  const ppn = Math.round((nilaiKwitansi * 11) / 111);
  const pph = Math.round((dpp * tarifPphPersen) / 100);
  const nilaiProyek = nilaiKwitansi;
  const labaSetelahPajak = Math.round(dpp - pph);
  return { dpp, ppn, pph, nilaiProyek, labaSetelahPajak };
}

export function hitungPajakFaktur(
  dpp: number,
  dppNilaiLain: number,
  tarifPpnPersen = 12,
  tarifPphPersen = 3.5,
  nilaiKwitansiManual?: number
): HitungPajakResult {
  let ppn: number;
  let nilaiProyek: number;
  const effectiveDppNilaiLain = dppNilaiLain > 0 ? dppNilaiLain : hitungDppNilaiLain(dpp);

  if (tarifPpnPersen === 0) {
    ppn = 0;
    nilaiProyek =
      nilaiKwitansiManual !== undefined && nilaiKwitansiManual > 0 ? nilaiKwitansiManual : dpp;
  } else if (nilaiKwitansiManual !== undefined && nilaiKwitansiManual > 0) {
    nilaiProyek = nilaiKwitansiManual;
    ppn = Math.round((nilaiKwitansiManual * 11) / 111);
  } else {
    ppn = Math.round((effectiveDppNilaiLain * tarifPpnPersen) / 100);
    nilaiProyek = Math.round((dpp * 111) / 100);
  }

  const pph = Math.round((dpp * tarifPphPersen) / 100);
  const labaSetelahPajak = Math.round(nilaiProyek - ppn - pph);

  return {
    ppn,
    pph,
    nilaiProyek,
    labaSetelahPajak,
  };
}

export interface FakturPendapatanItem {
  ppnRealisasi: number | null;
  pphRealisasi: number | null;
  ppnRealisasiFmt: string;
  pphRealisasiFmt: string;
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
  kodeJenisProyek: number;
  jenisProyekLabel: string;
  pekerjaanPerusahaan: number;
  pekerjaanYangDipinjam: number;
  tanggalTerima: string;
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
  ceklisPpn: boolean;
  ceklisPph: boolean;
  ceklisBuktiPotong: boolean;
  isRealized: boolean;
  selisihBank: number;
  selisihBankFmt: string;
  selisihPpn: number;
  selisihPph: number;
  selisihTotal: number;
  selisihTotalFmt: string;
  balanceStatus: "BALANCE" | "SELISIH" | "BELUM_CAIR";
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
  pphRekap: number;
  pphTerlapor: number;
  selisihPph: number;
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
  masaPajak: number | null;
  fakturList: FakturPendapatanItem[];
  totalPeriod: {
    ppnRealisasi: number;
    pphRealisasi: number;
    ppnRealisasiFmt: string;
    pphRealisasiFmt: string;
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
    entityId?: string | null;
    entityKey?: string | null;
    entityName?: string | null;
    contractValue: number;
    contractValueFmt: string;
    clientName: string | null;
    startDate: string | null;
    endDate: string | null;
    termins: Array<{
      id: string;
      name: string;
      percentage: number;
      nominal: number;
      nominalFmt: string;
    }>;
    existingFakturs?: Array<{
      id: string;
      noFaktur: string;
      namaRekanan: string;
      npwp: string | null;
      namaJkp: string;
      masaPajak: number;
      dpp: number;
      dppNilaiLain: number;
      ppn: number;
      pph: number;
      nilaiProyek: number;
      nominalDiterima: number;
      tarifPpnPersen: number;
      tarifPphPersen: number;
      bank: string | null;
    }>;
  }>;
  bankOptions: Array<{
    id: string;
    nama: string;
  }>;
  rekananOptions: Array<{
    id: string;
    nama: string;
    npwp: string | null;
    tipe?: string;
  }>;
}

// ─── Raw shapes returned directly by PHP ────────────────────────────────────

type RawFaktur = {
  ppnRealisasi: number | null;
  pphRealisasi: number | null;
  id: string;
  entityId: string;
  npwp: string;
  noFaktur: string;
  masaPajak: number;
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
  kodeJenisProyek: number;
  pekerjaanPerusahaan: number;
  pekerjaanYangDipinjam: number;
  tanggalTerima: string;
  bank: string;
  nominalDiterima: number;
  projectId: string | null;
  project_code: string | null;
  bankTransactionId: string | null;
  createdAt: string;
  entity_name: string;
  ceklisPpn: boolean | number;
  ceklisPph: boolean | number;
  ceklisBuktiPotong: boolean | number;
  isRealized?: boolean;
};

type RawRekonsiliasi = {
  id: string;
  entityId: string;
  year: number;
  month: number;
  dppTerlapor: number;
  pajakTerlapor: number;
  pphTerlapor?: number;
  keterangan: string | null;
};

type RawTarifPajak = {
  id: string;
  nama: string;
  jenis: string;
  tarifPersen: number;
};

type RawProjectTermin = {
  id: string;
  code: string;
  name: string;
  entityId?: string;
  entityKey?: string;
  entityName?: string;
  contractValue: number;
  termins: Array<{
    id: string;
    name: string;
    percentage: number;
    nominal: number;
  }>;
};

// ─── Jenis proyek label mapping ──────────────────────────────────────────────
const JENIS_PROYEK_LABEL: Record<number, string> = {
  1: "Proyek Sendiri",
  2: "Proyek KSO",
  3: "Sub-kontraktor",
};

// ─── Helper ──────────────────────────────────────────────────────────────────
function makeFakturItem(f: RawFaktur): FakturPendapatanItem {
  const isRealized = f.isRealized !== undefined ? Boolean(f.isRealized) : (f.nominalDiterima > 0);
  const selisihBank = isRealized ? f.nominalDiterima - f.labaSetelahPajak : 0;
  const ppnReal = f.ppnRealisasi != null ? f.ppnRealisasi : f.ppn;
  const selisihPpn = isRealized && f.ppnRealisasi != null ? f.ppnRealisasi - f.ppn : 0;
  const pphReal = f.pphRealisasi != null ? f.pphRealisasi : f.pph;
  const selisihPph = isRealized && f.pphRealisasi != null ? f.pphRealisasi - f.pph : 0;
  const totalRealisasi = isRealized ? (f.nominalDiterima || 0) + ppnReal + pphReal : 0;
  const selisihTotal = isRealized ? totalRealisasi - f.nilaiProyek : 0;

  // Faktur benar-benar BALANCE jika seluruh komponen (uang masuk bank, PPN, dan PPh) cocok dengan estimasi faktur
  const isBalanced =
    isRealized &&
    Math.abs(selisihBank) <= 1 &&
    Math.abs(selisihPpn) <= 1 &&
    Math.abs(selisihPph) <= 1 &&
    Math.abs(selisihTotal) <= 1;

  const balanceStatus: "BALANCE" | "SELISIH" | "BELUM_CAIR" = isRealized
    ? isBalanced
      ? "BALANCE"
      : "SELISIH"
    : "BELUM_CAIR";

  return {
    ppnRealisasi: f.ppnRealisasi,
    pphRealisasi: f.pphRealisasi,
    ppnRealisasiFmt: f.ppnRealisasi == null ? "-" : formatRupiah(f.ppnRealisasi),
    pphRealisasiFmt: f.pphRealisasi == null ? "-" : formatRupiah(f.pphRealisasi),
    id: f.id,
    entityId: f.entityId,
    npwp: f.npwp,
    noFaktur: f.noFaktur,
    masaPajak: f.masaPajak,
    namaBulan: NAMA_BULAN[(f.masaPajak ?? 1) - 1] ?? "",
    tahunPajak: f.tahunPajak,
    namaRekanan: f.namaRekanan,
    namaJkp: f.namaJkp,
    dpp: f.dpp,
    dppNilaiLain: f.dppNilaiLain,
    tarifPpnPersen: f.tarifPpnPersen,
    tarifPphPersen: f.tarifPphPersen,
    ppn: f.ppn,
    pph: f.pph,
    nilaiProyek: f.nilaiProyek,
    labaSetelahPajak: f.labaSetelahPajak,
    kodeJenisProyek: f.kodeJenisProyek ?? 1,
    jenisProyekLabel: JENIS_PROYEK_LABEL[f.kodeJenisProyek ?? 1] ?? "Proyek Sendiri",
    pekerjaanPerusahaan: f.pekerjaanPerusahaan,
    pekerjaanYangDipinjam: f.pekerjaanYangDipinjam,
    tanggalTerima: f.tanggalTerima,
    bank: f.bank,
    nominalDiterima: f.nominalDiterima,
    projectId: f.projectId ?? null,
    projectName: null, // resolved later if projectOptions available
    projectCode: f.project_code ?? null,
    bankTransactionId: f.bankTransactionId ?? null,
    createdAt: f.createdAt,
    dppFmt: formatRupiah(f.dpp),
    dppNilaiLainFmt: formatRupiah(f.dppNilaiLain),
    ppnFmt: formatRupiah(f.ppn),
    pphFmt: formatRupiah(f.pph),
    nilaiProyekFmt: formatRupiah(f.nilaiProyek),
    labaSetelahPajakFmt: formatRupiah(f.labaSetelahPajak),
    nominalDiterimaFmt: formatRupiah(f.nominalDiterima),
    pekerjaanPerusahaanFmt: formatRupiah(f.pekerjaanPerusahaan),
    pekerjaanYangDipinjamFmt: formatRupiah(f.pekerjaanYangDipinjam),
    ceklisPpn: Boolean(f.ceklisPpn),
    ceklisPph: Boolean(f.ceklisPph),
    ceklisBuktiPotong: Boolean(f.ceklisBuktiPotong),
    isRealized,
    selisihBank,
    selisihBankFmt: formatRupiah(selisihBank),
    selisihPpn,
    selisihPph,
    selisihTotal,
    selisihTotalFmt: formatRupiah(selisihTotal),
    balanceStatus,
  };
}

function makeEmptyRekap(month: number): RekapBulananItem {
  return {
    month,
    namaBulan: NAMA_BULAN[month - 1] ?? "",
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
    dppFmt: formatRupiah(0),
    dppNilaiLainFmt: formatRupiah(0),
    ppnFmt: formatRupiah(0),
    pphFmt: formatRupiah(0),
    nilaiProyekFmt: formatRupiah(0),
    labaSetelahPajakFmt: formatRupiah(0),
    nominalDiterimaFmt: formatRupiah(0),
  };
}

function aggregateFakturToRekap(items: FakturPendapatanItem[]): RekapBulananItem {
  const month = items[0]?.masaPajak ?? 0;
  const totals = items.reduce(
    (acc, f) => ({
      dpp: acc.dpp + f.dpp,
      dppNilaiLain: acc.dppNilaiLain + f.dppNilaiLain,
      ppn: acc.ppn + f.ppn,
      pph: acc.pph + f.pph,
      nilaiProyek: acc.nilaiProyek + f.nilaiProyek,
      labaSetelahPajak: acc.labaSetelahPajak + f.labaSetelahPajak,
      nominalDiterima: acc.nominalDiterima + f.nominalDiterima,
      pekerjaanPerusahaan: acc.pekerjaanPerusahaan + f.pekerjaanPerusahaan,
      pekerjaanYangDipinjam: acc.pekerjaanYangDipinjam + f.pekerjaanYangDipinjam,
    }),
    {
      dpp: 0, dppNilaiLain: 0, ppn: 0, pph: 0, nilaiProyek: 0,
      labaSetelahPajak: 0, nominalDiterima: 0, pekerjaanPerusahaan: 0, pekerjaanYangDipinjam: 0,
    }
  );
  return {
    month,
    namaBulan: NAMA_BULAN[month - 1] ?? "",
    jumlahFaktur: items.length,
    ...totals,
    dppFmt: formatRupiah(totals.dpp),
    dppNilaiLainFmt: formatRupiah(totals.dppNilaiLain),
    ppnFmt: formatRupiah(totals.ppn),
    pphFmt: formatRupiah(totals.pph),
    nilaiProyekFmt: formatRupiah(totals.nilaiProyek),
    labaSetelahPajakFmt: formatRupiah(totals.labaSetelahPajak),
    nominalDiterimaFmt: formatRupiah(totals.nominalDiterima),
  };
}

// ─── Main fetch + compute function ───────────────────────────────────────────

export async function getLaporanPendapatanData(
  entityKeyOrId: string,
  year: number,
  masaPajak?: number | null
): Promise<LaporanPendapatanData | null> {
  const token = await getPhpToken();
  const params = new URLSearchParams();
  params.set("entityId", entityKeyOrId);
  params.set("year", String(year));
  if (masaPajak) params.set("month", String(masaPajak));

  try {
    // 1. Fetch raw data from PHP (returns { faktur, rekonsiliasi })
    const raw = await phpFetch<{ faktur: RawFaktur[]; rekonsiliasi: RawRekonsiliasi[] }>(
      `/api/pendapatan?${params.toString()}`,
      token
    );

    // 2. Also fetch entity info, tarif pajak, and project options in parallel (best-effort)
    const [entityRow, tarifRaw, projectsRaw] = await Promise.all([
      phpFetch<Array<{ id: string; key: string; name: string; legalName: string }>>(
        `/api/entities`,
        token
      ).then((entities) => entities.find((entity) =>
        entity.id === entityKeyOrId || entity.key === entityKeyOrId
      ) ?? null).catch(() => null),
      phpFetch<RawTarifPajak[]>(`/api/tarifpajak`, token).catch(() => [] as RawTarifPajak[]),
      phpFetch<RawProjectTermin[]>(
        `/api/pendapatan/projects?entityId=${encodeURIComponent(entityKeyOrId)}`,
        token
      ).catch(() => [] as RawProjectTermin[]),
    ]);

    // 3. Build fakturList with formatted fields
    const fakturList: FakturPendapatanItem[] = (raw.faktur ?? []).map(makeFakturItem);

    // Resolve projectName from projectsRaw if available
    const projectMap = new Map(projectsRaw.map((p) => [p.id, p]));
    for (const f of fakturList) {
      if (f.projectId) {
        f.projectName = projectMap.get(f.projectId)?.name ?? null;
      }
    }

    // 4. Build rekapBulanan — group by month for all 12 months
    const byMonth = new Map<number, FakturPendapatanItem[]>();
    for (const f of fakturList) {
      const m = f.masaPajak;
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m)!.push(f);
    }
    const rekapBulanan: RekapBulananItem[] = [];
    for (let m = 1; m <= 12; m++) {
      const items = byMonth.get(m);
      if (items && items.length > 0) {
        rekapBulanan.push(aggregateFakturToRekap(items));
      } else {
        rekapBulanan.push(makeEmptyRekap(m));
      }
    }

    // 5. totalTahunanRekap — aggregate all faktur
    const totalTahunanRekap: RekapBulananItem =
      fakturList.length > 0
        ? aggregateFakturToRekap(fakturList)
        : makeEmptyRekap(0);
    totalTahunanRekap.month = 0;
    totalTahunanRekap.namaBulan = "Total Tahunan";

    // 6. totalPeriod — same as totalTahunanRekap but with extra fields
    const ppnRealisasi = fakturList.reduce((sum, f) => sum + (f.ppnRealisasi ?? 0), 0);
    const pphRealisasi = fakturList.reduce((sum, f) => sum + (f.pphRealisasi ?? 0), 0);
    const hasRealisasi = fakturList.some((f) => f.isRealized);
    const totalPeriod = {
      ppnRealisasi,
      pphRealisasi,
      ppnRealisasiFmt: hasRealisasi ? formatRupiah(ppnRealisasi) : "-",
      pphRealisasiFmt: hasRealisasi ? formatRupiah(pphRealisasi) : "-",
      jumlahFaktur: fakturList.length,
      dpp: totalTahunanRekap.dpp,
      dppNilaiLain: totalTahunanRekap.dppNilaiLain,
      ppn: totalTahunanRekap.ppn,
      pph: totalTahunanRekap.pph,
      nilaiProyek: totalTahunanRekap.nilaiProyek,
      labaSetelahPajak: totalTahunanRekap.labaSetelahPajak,
      nominalDiterima: totalTahunanRekap.nominalDiterima,
      pekerjaanPerusahaan: totalTahunanRekap.pekerjaanPerusahaan,
      pekerjaanYangDipinjam: totalTahunanRekap.pekerjaanYangDipinjam,
      dppFmt: totalTahunanRekap.dppFmt,
      dppNilaiLainFmt: totalTahunanRekap.dppNilaiLainFmt,
      ppnFmt: totalTahunanRekap.ppnFmt,
      pphFmt: totalTahunanRekap.pphFmt,
      nilaiProyekFmt: totalTahunanRekap.nilaiProyekFmt,
      labaSetelahPajakFmt: totalTahunanRekap.labaSetelahPajakFmt,
      nominalDiterimaFmt: totalTahunanRekap.nominalDiterimaFmt,
      pekerjaanPerusahaanFmt: formatRupiah(totalTahunanRekap.pekerjaanPerusahaan),
      pekerjaanYangDipinjamFmt: formatRupiah(totalTahunanRekap.pekerjaanYangDipinjam),
    };

    // 7. Build rekonsiliasiList
    const rekonMap = new Map<number, RawRekonsiliasi>();
    for (const r of raw.rekonsiliasi ?? []) {
      rekonMap.set(r.month, r);
    }
    const rekonsiliasiList: RekonsiliasiPajakItem[] = rekapBulanan.map((rekap) => {
      const rekon = rekonMap.get(rekap.month);
      const dppTerlapor = rekon?.dppTerlapor ?? 0;
      const pajakTerlapor = rekon?.pajakTerlapor ?? 0;
      const selisihDpp = rekap.dpp - dppTerlapor;
      const selisihPajak = rekap.ppn - pajakTerlapor;
      const pphRekap = rekap.pph;
      const pphTerlapor = 0; // not tracked separately in RekonsiliasiPajakBulanan
      const selisihPph = pphRekap - pphTerlapor;
      const totalPajakRekap = rekap.ppn + pphRekap;
      const totalPajakTerlapor = pajakTerlapor + pphTerlapor;
      const selisihTotalPajak = totalPajakRekap - totalPajakTerlapor;
      let status: RekonsiliasiPajakItem["status"] = "BELUM_DILAPORKAN";
      if (rekon) {
        status = selisihDpp === 0 && selisihPajak === 0 ? "MATCH" : "SELISIH";
      }
      return {
        month: rekap.month,
        namaBulan: rekap.namaBulan,
        dppRekap: rekap.dpp,
        dppTerlapor,
        selisihDpp,
        ppnRekap: rekap.ppn,
        pajakTerlapor,
        selisihPajak,
        pphRekap,
        pphTerlapor,
        selisihPph,
        totalPajakRekap,
        totalPajakTerlapor,
        selisihTotalPajak,
        keterangan: rekon?.keterangan ?? "",
        status,
        dppRekapFmt: formatRupiah(rekap.dpp),
        dppTerlaporFmt: formatRupiah(dppTerlapor),
        selisihDppFmt: formatRupiah(selisihDpp),
        ppnRekapFmt: formatRupiah(rekap.ppn),
        pajakTerlaporFmt: formatRupiah(pajakTerlapor),
        selisihPajakFmt: formatRupiah(selisihPajak),
        pphRekapFmt: formatRupiah(pphRekap),
        pphTerlaporFmt: formatRupiah(pphTerlapor),
        selisihPphFmt: formatRupiah(selisihPph),
        totalPajakRekapFmt: formatRupiah(totalPajakRekap),
        totalPajakTerlaporFmt: formatRupiah(totalPajakTerlapor),
        selisihTotalPajakFmt: formatRupiah(selisihTotalPajak),
      };
    });

    // 8. kpiSummary
    const totalSelisihPajak = rekonsiliasiList.reduce((s, r) => s + r.selisihPajak, 0);
    const jumlahBulanSelisih = rekonsiliasiList.filter((r) => r.status === "SELISIH").length;
    const kpiSummary = {
      totalNilaiProyek: totalPeriod.nilaiProyek,
      totalNilaiProyekFmt: formatRupiah(totalPeriod.nilaiProyek),
      totalDpp: totalPeriod.dpp,
      totalDppFmt: formatRupiah(totalPeriod.dpp),
      totalPajak: totalPeriod.ppn + totalPeriod.pph,
      totalPajakFmt: formatRupiah(totalPeriod.ppn + totalPeriod.pph),
      totalLabaSetelahPajak: totalPeriod.labaSetelahPajak,
      totalLabaSetelahPajakFmt: formatRupiah(totalPeriod.labaSetelahPajak),
      totalNominalDiterima: totalPeriod.nominalDiterima,
      totalNominalDiterimaFmt: formatRupiah(totalPeriod.nominalDiterima),
      totalSelisihPajak,
      totalSelisihPajakFmt: formatRupiah(totalSelisihPajak),
      jumlahBulanSelisih,
      statusAudit: (jumlahBulanSelisih === 0 ? "SEMUA_SESUAI" : "PERLU_REKONSILIASI") as
        | "SEMUA_SESUAI"
        | "PERLU_REKONSILIASI",
    };

    // 9. tarifList from PHP /api/tarifpajak
    const tarifList = (tarifRaw ?? []).map((t) => ({
      id: t.id,
      nama: t.nama,
      jenis: t.jenis,
      tarifPersen: t.tarifPersen,
    }));

    // 10. projectOptions from /api/pendapatan/projects (+ existingFakturs cross-ref)
    const fakturByProject = new Map<string, FakturPendapatanItem[]>();
    for (const f of fakturList) {
      if (!f.projectId) continue;
      const arr = fakturByProject.get(f.projectId) ?? [];
      arr.push(f);
      fakturByProject.set(f.projectId, arr);
    }
    const projectOptions = (projectsRaw ?? []).map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      entityId: p.entityId ?? null,
      entityKey: p.entityKey ?? null,
      entityName: p.entityName ?? null,
      contractValue: p.contractValue,
      contractValueFmt: formatRupiah(p.contractValue),
      clientName: (p as any).clientName ?? null,
      startDate: (p as any).startDate ?? null,
      endDate: (p as any).endDate ?? null,
      termins: (p.termins ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        percentage: t.percentage,
        nominal: t.nominal,
        nominalFmt: formatRupiah(t.nominal),
      })),
      existingFakturs: (fakturByProject.get(p.id) ?? []).map((f) => ({
        id: f.id,
        noFaktur: f.noFaktur,
        namaRekanan: f.namaRekanan,
        npwp: f.npwp ?? null,
        namaJkp: f.namaJkp ?? "",
        masaPajak: f.masaPajak,
        dpp: f.dpp,
        dppNilaiLain: f.dppNilaiLain,
        ppn: f.ppn,
        pph: f.pph,
        nilaiProyek: f.nilaiProyek,
        nominalDiterima: f.nominalDiterima,
        tarifPpnPersen: f.tarifPpnPersen,
        tarifPphPersen: f.tarifPphPersen,
        bank: f.bank ?? null,
      })),
    }));

    // 11. bankOptions from static REKENING_BY_ENTITY — derive entity key from entityRow or
    //     fall back to matching from entityKeyOrId directly
    const entityKey =
      entityRow?.key ??
      (Object.keys(REKENING_BY_ENTITY).includes(entityKeyOrId) ? entityKeyOrId : null);
    const bankOptions = entityKey
      ? (REKENING_BY_ENTITY[entityKey] ?? []).map((r) => ({ id: r.id, nama: r.nama }))
      : Object.values(REKENING_BY_ENTITY)
          .flat()
          .map((r) => ({ id: r.id, nama: r.nama }));

    // 12. Entity info
    const entity = {
      id: entityRow?.id ?? entityKeyOrId,
      key: entityRow?.key ?? entityKeyOrId,
      name: entityRow?.name ?? entityKeyOrId,
      legalName: entityRow?.legalName ?? entityRow?.name ?? entityKeyOrId,
    };

    return {
      entity,
      year,
      masaPajak: masaPajak ?? null,
      fakturList,
      totalPeriod,
      rekapBulanan,
      totalTahunanRekap,
      rekonsiliasiList,
      kpiSummary,
      tarifList,
      projectOptions,
      bankOptions,
      rekananOptions: await phpFetch<{ data: Array<{ id: string; nama: string; npwp: string | null; tipe?: string }> }>(
        `/api/rekanan?entityId=${encodeURIComponent(entity.id)}`,
        token
      ).then((r) => r.data ?? []).catch(() => []),
    };
  } catch {
    return null;
  }
}
