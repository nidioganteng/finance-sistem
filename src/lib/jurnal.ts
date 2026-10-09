import { phpFetch, getPhpToken } from "./api-client";
import { formatRupiah } from "./dashboard-data";

export async function getJenisInputChips(_entityId: string) {
  const token = await getPhpToken();
  const result = await phpFetch<{ data: { key: string; nama: string }[] }>(
    `/api/jenis-input`,
    token
  );
  return result.data.map((j) => ({ key: j.key, label: j.nama }));
}

export async function getCoaList() {
  const token = await getPhpToken();
  const result = await phpFetch<{ data: { code: string; name: string }[] }>(
    `/api/coa`,
    token
  );
  return result.data.sort((x, y) => parseInt(x.code) - parseInt(y.code));
}

export type JurnalRow = {
  id: string;
  tanggal: string;
  noBukti: string;
  keterangan: string;
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  sumberBg: string;
  sumberColor: string;
  sumberLabel: string;
  isKasEntry: boolean;
  isKredit: boolean;
  kodeAkun: string;
  namaAkun: string;
  canEditKodeAkun: boolean;
  debit: number;
  kredit: number;
  debitFmt: string;
  kreditFmt: string;
  staffName: string;
  staffInitial: string;
  arahLaporan: string[];
};

export type JurnalRowsResult = {
  rows: JurnalRow[];
  totalDebit: number;
  totalKredit: number;
  isBalanced: boolean;
  totalDebitFmt: string;
  totalKreditFmt: string;
  totalCount: number;
  totalPages: number;
  page: number;
};

export async function getJurnalRows(
  entityId: string,
  jenisInputKey?: string,
  dari?: string,
  akunCode?: string,
  page = 1,
  projectId?: string
): Promise<JurnalRowsResult> {
  const token = await getPhpToken();
  const params = new URLSearchParams();
  params.set("entityId", entityId);
  if (jenisInputKey) params.set("jenisInputKey", jenisInputKey);
  if (dari) params.set("dari", dari);
  if (akunCode) params.set("akunCode", akunCode);
  params.set("page", String(page));
  if (projectId) params.set("projectId", projectId);

  type RawRow = Omit<JurnalRow, "debitFmt" | "kreditFmt">;
  type RawResult = Omit<JurnalRowsResult, "rows" | "totalDebitFmt" | "totalKreditFmt"> & { rows: RawRow[] };

  const raw = await phpFetch<RawResult>(`/api/jurnal?${params.toString()}`, token);

  return {
    ...raw,
    totalDebitFmt: formatRupiah(raw.totalDebit),
    totalKreditFmt: formatRupiah(raw.totalKredit),
    rows: raw.rows.map((r) => ({
      ...r,
      debitFmt: formatRupiah(r.debit),
      kreditFmt: formatRupiah(r.kredit),
    })),
  };
}
