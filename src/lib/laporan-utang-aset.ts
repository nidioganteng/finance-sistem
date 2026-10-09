import { phpFetch, getPhpToken } from "./api-client";
import { formatRupiah } from "./dashboard-data";

export type UtangAsetRow = {
  code: string;
  name: string;
  masuk: number;
  keluar: number;
  saldo: number;
  masukFmt: string;
  keluarFmt: string;
  saldoFmt: string;
  saldoPositif: boolean;
};

export type LaporanUtangAsetData = {
  utang: {
    rows: UtangAsetRow[];
    total: number;
    totalFmt: string;
  };
  aset: {
    rows: UtangAsetRow[];
    total: number;
    totalFmt: string;
  };
  networth: number;
  networthFmt: string;
  networthPositif: boolean;
  year: number;
};

export async function getLaporanUtangAsetData(entityKey: string, year: number): Promise<LaporanUtangAsetData> {
  const token = await getPhpToken();
  return phpFetch<LaporanUtangAsetData>(
    `/api/neraca?entityId=${encodeURIComponent(entityKey)}&year=${year}&type=utang-aset`,
    token
  );
}
