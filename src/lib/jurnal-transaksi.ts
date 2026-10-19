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
  terminId?: string | null;
  rows: { coaAccountId: string; coaName: string; coaCode: string; keterangan: string; debit: number; kredit: number }[];
  totalDebit: number;
  totalKredit: number;
  allTxIds: string[];
  periodeBulanGaji?: number | null;
  periodeTahunGaji?: number | null;
  tanggalNota?: string | null;
};

export type JurnalTransaksiResult = {
  groups: JurnalTransaksiGroup[];
  totalPages: number;
  page: number;
};

export function sortJurnalRows<T extends { debit?: number; kredit?: number; coaCode?: string; coaName?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aDebit = (a.debit || 0) > 0;
    const bDebit = (b.debit || 0) > 0;
    const aCredit = (a.kredit || 0) > 0;
    const bCredit = (b.kredit || 0) > 0;

    // Debits first, credits after
    if (aDebit && !bDebit) return -1;
    if (!aDebit && bDebit) return 1;

    // If both are credits, put Pendapatan (4xx or containing "pendapatan") at the bottom
    if (aCredit && bCredit) {
      const aIsPendapatan = (a.coaCode && a.coaCode.startsWith("4")) || /pendapatan/i.test(a.coaName || "");
      const bIsPendapatan = (b.coaCode && b.coaCode.startsWith("4")) || /pendapatan/i.test(b.coaName || "");
      if (!aIsPendapatan && bIsPendapatan) return -1;
      if (aIsPendapatan && !bIsPendapatan) return 1;
    }

    return 0;
  });
}

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
    groups: (raw.groups || []).map((g) => ({
      ...g,
      tanggal: g.tanggal || (g.tanggalRaw ? g.tanggalRaw.slice(0, 10) : ""),
      rows: sortJurnalRows(g.rows || []),
    })),
  };
}

export { formatRupiah };
