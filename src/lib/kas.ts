import { phpFetch, getPhpToken } from "./api-client";
import { formatRupiah } from "./dashboard-data";
import { KAS_BESAR_COA, KAS_KECIL_COA } from "./bank-accounts";

export { KAS_BESAR_COA, KAS_KECIL_COA };

export const ENTITY_PREFIX: Record<string, string> = {
  gaharu: "GH",
  kencana: "KC",
  tataring: "TT",
  ciptaAsri: "CA",
  umum: "UM",
};

export const ENTITY_PREFIX_UMUM: Record<string, string> = {
  kencana: "UK",
  gaharu: "UG",
  tataring: "UT",
  ciptaAsri: "UC",
  umum: "UU",
};

export type JenisInputItem = { id: string; key: string; nama: string; active: boolean; extraFieldsJson: Record<string, unknown> | null };

export async function getJenisInput(key: string): Promise<JenisInputItem | null> {
  const token = await getPhpToken();
  try {
    const result = await phpFetch<{ data: JenisInputItem[] }>(
      `/api/jenis-input`,
      token
    );
    return (result.data ?? []).find((j) => j.key === key) ?? null;
  } catch {
    return null;
  }
}

export async function getCoaOptions() {
  const token = await getPhpToken();
  const result = await phpFetch<{ data: { id: string; code: string; name: string }[] }>(
    `/api/coa`,
    token
  );
  return result.data.sort((a, b) => parseInt(a.code) - parseInt(b.code));
}

// Saldo awal dihitung di PHP side — fungsi-fungsi ini disederhanakan
export async function getInitialSaldoAwal(
  _entityId: string,
  _jenisInputKeyOrId: string,
  _rekeningNamaOrId?: string,
  _year?: number
): Promise<number> {
  return 0;
}

export async function getRunningSaldo(
  _entityId: string,
  _jenisInputId: string,
  _rekeningNama?: string,
  _year?: number
): Promise<number> {
  return 0;
}

export async function getSaldoSebelum(
  _entityId: string,
  _jenisInputId: string,
  _sebelum: string,
  _rekeningNama?: string,
  _year?: number
): Promise<number> {
  return 0;
}

export type KasLedgerEntry = {
  tanggal: string;
  tanggalRaw: string;
  noBukti: string;
  keterangan: string;
  akunTags: string[];
  rekening?: string;
  crossingEntityKeys?: string[];
  crossingFromEntityKey?: string;
  masuk: number;
  keluar: number;
  saldo: number;
  masukFmt: string;
  keluarFmt: string;
  saldoFmt: string;
  allTxIds: string[];
  coaRows: { id: string; coaAccountId: string; coaName: string; nominal: number; isDebit: boolean; itemDescription?: string }[];
  project?: { id: string; code: string; name: string } | null;
};

export type KasLedgerResult = {
  totalCount: number;
  totalPages: number;
  page: number;
  entries: KasLedgerEntry[];
};

export async function getKasLedger(
  entityId: string,
  jenisInputKey: string,
  rekeningNama?: string,
  dari?: string,
  sampai?: string,
  page = 1,
  _year?: number
): Promise<KasLedgerResult> {
  const token = await getPhpToken();
  const params = new URLSearchParams();
  params.set("entityId", entityId);
  params.set("jenisInputKey", jenisInputKey);
  if (rekeningNama) params.set("rekeningNama", rekeningNama);
  if (dari) params.set("dari", dari);
  if (sampai) params.set("sampai", sampai);
  params.set("page", String(page));

  type RawEntry = Omit<KasLedgerEntry, "tanggal" | "masukFmt" | "keluarFmt" | "saldoFmt">;
  type RawResult = { totalCount: number; totalPages: number; page: number; entries: RawEntry[] };

  const raw = await phpFetch<RawResult>(`/api/kas/ledger?${params.toString()}`, token);

  return {
    ...raw,
    entries: raw.entries.map((e) => ({
      ...e,
      tanggal: e.tanggalRaw,
      masukFmt: formatRupiah(e.masuk),
      keluarFmt: formatRupiah(e.keluar),
      saldoFmt: formatRupiah(e.saldo),
    })),
  };
}
