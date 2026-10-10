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
  isActive: boolean;
  currentGaji?: GajiBulananItem | null;
  akumulasiTahun?: {
    totalGajiKotor: number;
    totalGajiBersih: number;
    totalPph21: number;
    bulanTerbayar: number;
  };
};

export type GajiBulananItem = {
  id: string;
  pegawaiId: string;
  pegawaiNama: string;
  pegawaiNik: string;
  pegawaiJabatan: string;
  bulan: number;
  tahun: number;
  gajiPokok: number;
  gajiPokokFmt: string;
  tunjanganJabatan: number;
  tunjanganJabatanFmt: string;
  tunjanganTransport: number;
  tunjanganTransportFmt: string;
  insentif: number;
  insentifFmt: string;
  bpjsKesehatan: number;
  bpjsKesehatanFmt: string;
  bpjsKetenagakerjaan: number;
  bpjsKetenagakerjaanFmt: string;
  potonganLain: number;
  potonganLainFmt: string;
  pph21: number;
  pph21Fmt: string;
  totalGajiKotor: number;
  totalGajiKotorFmt: string;
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
  uraian: string;
  tanggal: string;
  tanggalFmt: string;
  bulan: number;
  tahun: number;
  nominalHonor: number;
  nominalHonorFmt: string;
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
  totalGajiKotor: number;
  totalGajiKotorFmt: string;
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
