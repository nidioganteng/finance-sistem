import { phpFetch, getPhpToken } from "./api-client";

export const PTKP_RATES: Record<string, number> = {
  "TK/0": 54000000,
  "TK/1": 58500000,
  "TK/2": 63000000,
  "TK/3": 67500000,
  "K/0": 58500000,
  "K/1": 63000000,
  "K/2": 67500000,
  "K/3": 72000000,
};

export type KategoriTer = "A" | "B" | "C";

export type HasilHitungPph21Ter = {
  kategori: KategoriTer;
  tarifPersen: number;
  nominal: number;
};

export const TER_A_BRACKETS: [number, number][] = [
  [5400000, 0],
  [5650000, 0.25],
  [5950000, 0.5],
  [6300000, 0.75],
  [6750000, 1.0],
  [7500000, 1.25],
  [8550000, 1.5],
  [9650000, 1.75],
  [10050000, 2.0],
  [10350000, 2.25],
  [10700000, 2.5],
  [11050000, 3.0],
  [11600000, 3.5],
  [12500000, 4.0],
  [13750000, 5.0],
  [15100000, 6.0],
  [16950000, 7.0],
  [19750000, 8.0],
  [24150000, 9.0],
  [26450000, 10.0],
  [28000000, 11.0],
  [30050000, 12.0],
  [32400000, 13.0],
  [35400000, 14.0],
  [39100000, 15.0],
  [43850000, 16.0],
  [47800000, 17.0],
  [51400000, 18.0],
  [56300000, 19.0],
  [62200000, 20.0],
  [68600000, 21.0],
  [77500000, 22.0],
  [89000000, 23.0],
  [103000000, 24.0],
  [125000000, 25.0],
  [157000000, 26.0],
  [206000000, 27.0],
  [337000000, 28.0],
  [454000000, 29.0],
  [550000000, 30.0],
  [695000000, 31.0],
  [910000000, 32.0],
  [1400000000, 33.0],
  [Infinity, 34.0],
];

export const TER_B_BRACKETS: [number, number][] = [
  [6200000, 0],
  [6500000, 0.25],
  [6850000, 0.5],
  [7300000, 0.75],
  [9200000, 1.0],
  [10750000, 1.5],
  [11250000, 2.0],
  [11600000, 2.5],
  [12600000, 3.0],
  [13600000, 4.0],
  [14950000, 5.0],
  [16400000, 6.0],
  [18450000, 7.0],
  [21850000, 8.0],
  [26000000, 9.0],
  [27700000, 10.0],
  [29350000, 11.0],
  [31450000, 12.0],
  [33950000, 13.0],
  [37100000, 14.0],
  [41100000, 15.0],
  [45800000, 16.0],
  [49500000, 17.0],
  [53800000, 18.0],
  [58500000, 19.0],
  [64000000, 20.0],
  [71000000, 21.0],
  [80000000, 22.0],
  [93000000, 23.0],
  [109000000, 24.0],
  [129000000, 25.0],
  [163000000, 26.0],
  [211000000, 27.0],
  [374000000, 28.0],
  [459000000, 29.0],
  [555000000, 30.0],
  [704000000, 31.0],
  [957000000, 32.0],
  [1405000000, 33.0],
  [Infinity, 34.0],
];

export const TER_C_BRACKETS: [number, number][] = [
  [6600000, 0],
  [6950000, 0.25],
  [7350000, 0.5],
  [7800000, 0.75],
  [8850000, 1.0],
  [9800000, 1.25],
  [10950000, 1.5],
  [11200000, 1.75],
  [12050000, 2.0],
  [12950000, 3.0],
  [14150000, 4.0],
  [15550000, 5.0],
  [17050000, 6.0],
  [19500000, 7.0],
  [22700000, 8.0],
  [26600000, 9.0],
  [28100000, 10.0],
  [30100000, 11.0],
  [32600000, 12.0],
  [35400000, 13.0],
  [38900000, 14.0],
  [43000000, 15.0],
  [47400000, 16.0],
  [51200000, 17.0],
  [55800000, 18.0],
  [60800000, 19.0],
  [66700000, 20.0],
  [74500000, 21.0],
  [83200000, 22.0],
  [95600000, 23.0],
  [110000000, 24.0],
  [134000000, 25.0],
  [169500000, 26.0],
  [221000000, 27.0],
  [390000000, 28.0],
  [463000000, 29.0],
  [561000000, 30.0],
  [709000000, 31.0],
  [965000000, 32.0],
  [1419000000, 33.0],
  [Infinity, 34.0],
];

export function getKategoriTer(statusKeluarga: string): KategoriTer {
  const norm = (statusKeluarga || "").trim().toUpperCase();
  if (["TK/0", "TK/1", "K/0"].includes(norm)) return "A";
  if (["TK/2", "TK/3", "K/1", "K/2"].includes(norm)) return "B";
  if (norm === "K/3") return "C";
  return "A";
}

export function hitungPph21Ter(bruto: number, statusKeluarga: string): HasilHitungPph21Ter {
  const safeBruto = Math.max(0, Math.round(bruto || 0));
  const kategori = getKategoriTer(statusKeluarga);
  const brackets =
    kategori === "A" ? TER_A_BRACKETS : kategori === "B" ? TER_B_BRACKETS : TER_C_BRACKETS;

  let tarifPersen = 0;
  for (const [limit, rate] of brackets) {
    if (safeBruto <= limit) {
      tarifPersen = rate;
      break;
    }
  }

  const nominal = Math.round((safeBruto * tarifPersen) / 100);
  return {
    kategori,
    tarifPersen,
    nominal,
  };
};

export type PegawaiItem = {
  id: string;
  entityId: string;
  nik: string;
  nama: string;
  jabatan: string;
  statusKeluarga: string;
  ptkp: number;
  ptkpFmt: string;
  gajiPokok: number;
  gajiPokokFmt: string;
  tunjanganJabatan: number;
  tunjanganJabatanFmt: string;
  tarifTransportHarian?: number;
  tarifTransportHarianFmt?: string;
  tunjanganBpjsKes?: number;
  tunjanganBpjsKesFmt?: string;
  tunjanganBpjsTk?: number;
  tunjanganBpjsTkFmt?: string;
  tunjanganBpjs?: number;
  tunjanganBpjsFmt?: string;
  bpjsKesehatan?: number;
  bpjsKesehatanFmt?: string;
  bpjsKetenagakerjaan?: number;
  bpjsKetenagakerjaanFmt?: string;
  potonganBpjs?: number;
  potonganBpjsFmt?: string;
  totalGajiTetap?: number;
  totalGajiTetapFmt?: string;
  tanggalMasuk?: string | null;
  tanggalMasukFmt?: string | null;
  masaKerja?: string | null;
  status?: "AKTIF" | "RESIGN" | "PENSIUN";
  tanggalResign?: string | null;
  tanggalResignFmt?: string | null;
  isActive: boolean;
  currentGaji?: GajiBulananItem | null;
  riwayatGajiBulan?: Record<number, GajiBulananItem>;
  akumulasiTahun?: {
    totalGajiKotor: number;
    totalGajiTerlaporPajak: number;
    totalGajiBersih: number;
    totalPph21: number;
    bulanTerbayar: number;
  };
};

export function hitungMasaKerja(tanggalMasuk: Date, refDate: Date = new Date()): string {
  let thn = refDate.getFullYear() - tanggalMasuk.getFullYear();
  let bln = refDate.getMonth() - tanggalMasuk.getMonth();
  if (refDate.getDate() < tanggalMasuk.getDate()) {
    bln--;
  }
  if (bln < 0) {
    thn--;
    bln += 12;
  }
  if (thn < 0) return "0 bulan";
  if (thn === 0 && bln === 0) return "< 1 bulan";
  if (thn === 0) return `${bln} bulan`;
  if (bln === 0) return `${thn} tahun`;
  return `${thn} tahun ${bln} bulan`;
}

export type GajiBulananItem = {
  id: string;
  pegawaiId: string;
  pegawaiNama: string;
  pegawaiNik: string;
  pegawaiJabatan: string;
  pegawaiTanggalMasuk?: string | null;
  pegawaiMasaKerja?: string | null;
  bulan: number;
  tahun: number;
  gajiPokok: number;
  gajiPokokFmt: string;
  tunjanganJabatan: number;
  tunjanganJabatanFmt: string;
  hariKerja: number;
  tarifTransportHarian: number;
  tarifTransportHarianFmt: string;
  tunjanganTransport: number;
  tunjanganTransportFmt: string;
  insentif: number;
  insentifFmt: string;
  tunjanganLainnya: number;
  tunjanganLainnyaFmt: string;
  tunjanganBpjs: number;
  tunjanganBpjsFmt: string;
  tunjanganBpjsKes: number;
  tunjanganBpjsKesFmt: string;
  tunjanganBpjsTk: number;
  tunjanganBpjsTkFmt: string;
  tunjanganPph: number;
  tunjanganPphFmt: string;
  thr: number;
  thrFmt: string;
  bpjsKesehatan: number;
  bpjsKesehatanFmt: string;
  bpjsKetenagakerjaan: number;
  bpjsKetenagakerjaanFmt: string;
  potonganBpjs: number;
  potonganBpjsFmt: string;
  potonganLain: number;
  potonganLainFmt: string;
  pph21: number;
  pph21Fmt: string;
  totalGajiKotor: number;
  totalGajiKotorFmt: string;
  totalGajiTerlaporPajak: number;
  totalGajiTerlaporPajakFmt: string;
  totalGajiBersih: number;
  totalGajiBersihFmt: string;
  catatan?: string | null;
};

export type HonorTenagaAhliItem = {
  id: string;
  entityId: string;
  entityName: string;
  entityKey: string;
  rekananId?: string | null;
  nik: string;
  nama: string;
  npwp?: string | null;
  ptkp?: string | null;
  uraian: string;
  tanggal: string;
  tanggalFmt: string;
  bulan: number;
  tahun: number;
  nominalHonor: number;
  nominalHonorFmt: string;
  jenisPph?: string | null;
  tarifPph21Persen: number;
  pph21: number;
  pph21Fmt: string;
  nominalBersih: number;
  nominalBersihFmt: string;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  namaProyek?: string | null;
  noBukti?: string | null;
  isPendingPayment?: boolean;
  statusPembayaran?: "DIBAYAR" | "BELUM_DIBAYAR";
  isTurunLapangan?: boolean;
  tanggalMulaiTugas?: string | null;
  tanggalSelesaiTugas?: string | null;
};

export type TenagaAhliProjectAssignment = {
  id?: string | null;
  projectId: string;
  projectCode?: string | null;
  projectName?: string | null;
  tanggalMulaiTugas?: string | null;
  tanggalMulaiTugasFmt?: string | null;
  tanggalSelesaiTugas?: string | null;
  tanggalSelesaiTugasFmt?: string | null;
  isTurunLapangan: boolean;
  nominalHonorBulanan: number;
  nominalHonorBulananFmt?: string;
};

export type ProjectHoldingItem = {
  id: string;
  code: string;
  name: string;
  entityId?: string;
  entityName?: string;
};

export type RiwayatGajiTenagaAhliItem = {
  id: string;
  entityId: string;
  entityName: string;
  tanggal: string;
  tanggalFmt: string;
  bulan: number;
  bulanName: string;
  tahun: number;
  uraian: string;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  namaProyek: string;
  noBukti?: string | null;
  nominalHonor: number;
  nominalHonorFmt: string;
  pph21: number;
  pph21Fmt: string;
  nominalBersih: number;
  nominalBersihFmt: string;
};

export type RekananTenagaAhliItem = {
  id: string;
  nama: string;
  nik: string | null;
  npwp: string | null;
  kategori: string | null;
  ptkp?: string | null;
  entityId?: string | null;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  tanggalMulaiTugas?: string | null;
  tanggalMulaiTugasFmt?: string | null;
  tanggalSelesaiTugas?: string | null;
  tanggalSelesaiTugasFmt?: string | null;
  isTurunLapangan?: boolean;
  nominalHonorBulanan?: number;
  nominalHonorBulananFmt?: string;
  proyekList?: TenagaAhliProjectAssignment[];
  riwayatGaji?: RiwayatGajiTenagaAhliItem[];
};

export const BULAN_NAMES = [
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

export type RekapBulanPegawaiItem = {
  bulan: number;
  bulanName: string;
  totalPegawai: number;
  totalGajiPokok: number;
  totalGajiPokokFmt: string;
  totalTunjangan: number;
  totalTunjanganFmt: string;
  totalInsentif: number;
  totalInsentifFmt: string;
  totalThr: number;
  totalThrFmt: string;
  totalTunjanganBpjs: number;
  totalTunjanganBpjsFmt: string;
  totalTunjanganPph: number;
  totalTunjanganPphFmt: string;
  totalGajiKotor: number;
  totalGajiKotorFmt: string;
  totalGajiTerlaporPajak: number;
  totalGajiTerlaporPajakFmt: string;
  totalBpjs: number;
  totalBpjsFmt: string;
  totalPph21: number;
  totalPph21Fmt: string;
  totalPotonganLain: number;
  totalPotonganLainFmt: string;
  totalGajiBersih: number;
  totalGajiBersihFmt: string;
};

export type RekapBulanTenagaAhliItem = {
  bulan: number;
  bulanName: string;
  totalTransaksi: number;
  totalHonorBruto: number;
  totalHonorBrutoFmt: string;
  totalPph21: number;
  totalPph21Fmt: string;
  totalHonorBersih: number;
  totalHonorBersihFmt: string;
};

export type RekapTenagaAhliPerNamaItem = {
  nik: string;
  nama: string;
  npwp?: string | null;
  totalTransaksi: number;
  totalHonorBruto: number;
  totalHonorBrutoFmt: string;
  totalPph21: number;
  totalPph21Fmt: string;
  totalHonorBersih: number;
  totalHonorBersihFmt: string;
  daftarEntitas: string[];
  daftarProyek: string[];
  daftarBulan: string[];
  rincian: {
    id: string;
    entityId: string;
    entityName: string;
    tanggal: string;
    tanggalFmt: string;
    bulan: number;
    bulanName: string;
    uraian: string;
    namaProyek: string;
    noBukti?: string | null;
    nominalHonor: number;
    nominalHonorFmt: string;
    pph21: number;
    pph21Fmt: string;
    nominalBersih: number;
    nominalBersihFmt: string;
  }[];
};

export type KonsolidasiTenagaAhliItem = {
  nik: string;
  nama: string;
  npwp?: string | null;
  totalTransaksi: number;
  totalHonorBruto: number;
  totalHonorBrutoFmt: string;
  totalPph21: number;
  totalPph21Fmt: string;
  totalHonorBersih: number;
  totalHonorBersihFmt: string;
  perEntitas: {
    entityId: string;
    entityName: string;
    entityKey: string;
    nominalHonor: number;
    nominalHonorFmt: string;
    pph21: number;
    pph21Fmt: string;
    transaksiCount: number;
  }[];
};

export type RekapTenagaAhliPerProyekItem = {
  projectId?: string | null;
  projectCode?: string | null;
  projectName: string;
  entityName: string;
  totalTransaksi: number;
  totalHonorBruto: number;
  totalHonorBrutoFmt: string;
  totalPph: number;
  totalPphFmt: string;
  totalHonorBersih: number;
  totalHonorBersihFmt: string;
  tenagaAhliList: string[];
};

export type JurnalTransaksiGajiItem = {
  id: string;
  entityId: string;
  tanggal: string;
  tanggalFmt: string;
  bulan: number;
  tahun: number;
  noBukti: string;
  keterangan: string;
  coaAccountId: string | null;
  coaCode: string;
  coaName: string;
  jenisInputKey: string;
  jenisInputNama: string;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  namaProyek?: string | null;
  debit: number;
  debitFmt: string;
  kredit: number;
  kreditFmt: string;
  staffName?: string | null;
  isAkrual?: boolean;
  periodeBulanGaji?: number | null;
  periodeTahunGaji?: number | null;
  tanggalNota?: string | null;
};

export type PenyesuaianAkunGajiDetail = {
  coaCode: string;
  coaName: string;
  totalPayrollBulan: number;
  totalPayrollBulanFmt: string;
  totalJurnalBulan: number;
  totalJurnalBulanFmt: string;
  selisihBulan: number;
  selisihBulanFmt: string;
  isSinkronBulan: boolean;

  totalPayrollTahun: number;
  totalPayrollTahunFmt: string;
  totalJurnalTahun: number;
  totalJurnalTahunFmt: string;
  selisihTahun: number;
  selisihTahunFmt: string;
  isSinkronTahun: boolean;

  transaksiBulan: JurnalTransaksiGajiItem[];
  transaksiTahun: JurnalTransaksiGajiItem[];
};

export type PenyesuaianAkunGaji = {
  pegawai: PenyesuaianAkunGajiDetail;
  tenagaAhli: PenyesuaianAkunGajiDetail;
};

export type PayrollSyncLabaRugi = {
  tahun: number;
  bulan?: number;
  // Pegawai Tetap
  payrollGajiPegawai: number;
  payrollGajiPegawaiFmt: string;
  glBebanGaji511: number;
  glBebanGaji511Fmt: string;
  selisihGajiPegawai: number;
  selisihGajiPegawaiFmt: string;
  isGajiPegawaiSinkron: boolean;

  // Tenaga Ahli
  payrollHonorTenagaAhli: number;
  payrollHonorTenagaAhliFmt: string;
  glBebanTenagaAhli612: number;
  glBebanTenagaAhli612Fmt: string;
  selisihTenagaAhli: number;
  selisihTenagaAhliFmt: string;
  isTenagaAhliSinkron: boolean;

  // Total
  totalPayroll: number;
  totalPayrollFmt: string;
  totalGLBeban: number;
  totalGLBebanFmt: string;
  totalSelisih: number;
  totalSelisihFmt: string;
  isOverallSinkron: boolean;

  // Transaksi Jurnal Umum
  jurnalPegawaiRows: JurnalTransaksiGajiItem[];
  jurnalTenagaAhliRows: JurnalTransaksiGajiItem[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPayrollData(
  entityId: string,
  year: number,
  month: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const token = await getPhpToken();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return phpFetch<any>(
    `/api/payroll?entityId=${encodeURIComponent(entityId)}&year=${year}&month=${month}`,
    token
  );
}
