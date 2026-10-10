"use server";
import { phpFetch, getPhpToken } from "./api-client";

export interface ValidasiPajakItem {
  key: "dpp" | "ppn" | "pph";
  label: string;
  sublabel: string;
  nilaiFaktur: number;
  nilaiJurnal: number;
  nilaiLabaRugi: number;
  selisih: number;
  isBalance: boolean;
  nilaiFakturFmt: string;
  nilaiJurnalFmt: string;
  nilaiLabaRugiFmt: string;
  selisihFmt: string;
  keterangan: string;
}

export interface ValidasiPajak3ArahResult {
  year: number;
  allBalanced: boolean;
  jumlahSelisih: number;
  items: ValidasiPajakItem[];
}

export type ValidasiPajak3ArahData = ValidasiPajak3ArahResult;

export async function getValidasiPajak3Arah(
  entityIds: string[] | string,
  year: number,
  version: string = "INTERNAL"
): Promise<ValidasiPajak3ArahResult> {
  const token = await getPhpToken();
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  const params = new URLSearchParams();
  ids.forEach((id) => params.append("entityIds[]", id));
  params.set("year", String(year));
  params.set("version", version);
  return phpFetch<ValidasiPajak3ArahResult>(
    `/api/validasi-pajak-3arah?${params}`,
    token
  );
}
