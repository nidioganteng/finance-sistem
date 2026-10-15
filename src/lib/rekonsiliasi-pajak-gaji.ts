import { phpFetch, getPhpToken } from "./api-client";

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

export async function getRekonsiliasiPajakGajiData(
  entityId: string | string[],
  year: number
): Promise<RekonsiliasiPajakGajiData> {
  const token = await getPhpToken();
  const ids = Array.isArray(entityId) ? entityId : [entityId];

  const params =
    ids.length > 1
      ? `entityIds=${encodeURIComponent(ids.join(","))}&year=${year}`
      : `entityId=${encodeURIComponent(ids[0])}&year=${year}`;

  return phpFetch<RekonsiliasiPajakGajiData>(
    `/api/rekonsiliasi-pajak-gaji?${params}`,
    token
  );
}
