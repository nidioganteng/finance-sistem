import { phpFetch, getPhpToken } from "./api-client";
import { formatRupiah } from "./dashboard-data";

export type JurnalTransaksiGroup = {
  noBukti: string;
  tanggal: string;
  tanggalRaw: string;
  keterangan: string;
  projectId?: string | null;
  project?: { id: string; code: string; name: string } | null;
  fakturId?: string | null;
  faktur?: { noFaktur: string; namaRekanan: string; ppn: number; pph: number } | null;
  rows: { coaAccountId: string; coaName: string; coaCode: string; keterangan: string; debit: number; kredit: number }[];
  totalDebit: number;
  totalKredit: number;
  allTxIds: string[];
};

export type JurnalTransaksiResult = {
  groups: JurnalTransaksiGroup[];
  totalPages: number;
  page: number;
};

export async function getJurnalTransaksiHistory(
  entityId: string,
  page = 1,
  dari?: string,
  sampai?: string
): Promise<JurnalTransaksiResult> {
  const token = await getPhpToken();
  const params = new URLSearchParams();
  params.set("entityId", entityId);
  params.set("page", String(page));
  if (dari) params.set("dari", dari);
  if (sampai) params.set("sampai", sampai);

  const raw = await phpFetch<JurnalTransaksiResult>(`/api/jurnal-transaksi?${params.toString()}`, token);

  // PHP sets tanggalRaw but leaves tanggal as ""; derive tanggal from tanggalRaw
  return {
    ...raw,
    groups: raw.groups.map((g) => ({
      ...g,
      tanggal: g.tanggal || (g.tanggalRaw ? g.tanggalRaw.slice(0, 10) : ""),
    })),
  };
}

export { formatRupiah };
