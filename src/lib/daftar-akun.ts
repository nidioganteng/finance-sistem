import { phpFetch, getPhpToken } from "./api-client";

export type DaftarAkunRow = {
  coaId: string;
  code: string;
  name: string;
  kategori: string;
  saldoAwal: number;
  totalDebet: number;
  totalKredit: number;
  saldoAkhir: number;
  saldoAwalFmt: string;
  totalDebetFmt: string;
  totalKreditFmt: string;
  saldoAkhirFmt: string;
  saldoAkhirNegatif: boolean;
  punyaTransaksi: boolean;
  alokasi: "NERACA" | "LABA_RUGI";
};

export type DaftarAkunData = {
  rows: DaftarAkunRow[];
};

// PHP returns { entityId, year, akun: [...] } — we map akun -> rows
type PhpDaftarAkunResponse = {
  entityId: string;
  year: number;
  akun: DaftarAkunRow[];
};

export async function getDaftarAkunData(entityId: string, year: number): Promise<DaftarAkunData> {
  const token = await getPhpToken();
  const result = await phpFetch<PhpDaftarAkunResponse>(
    `/api/daftar-akun?entityId=${encodeURIComponent(entityId)}&year=${year}`,
    token
  );
  return { rows: result.akun ?? [] };
}
