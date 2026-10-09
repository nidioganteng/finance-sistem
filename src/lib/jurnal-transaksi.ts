import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

const PAGE_SIZE = 25;

export type JurnalTransaksiGroup = {
  noBukti: string;
  tanggal: string;
  tanggalRaw: string;
  keterangan: string;
  projectId?: string | null;
  project?: { id: string; code: string; name: string } | null;
  fakturId?: string | null;
  faktur?: {
    id: string;
    noFaktur: string;
    namaRekanan: string;
    dpp: number;
    ppn: number;
    pph: number;
    labaSetelahPajak: number;
  } | null;
  rows: { coaAccountId: string; coaName: string; coaCode: string; keterangan: string; debit: number; kredit: number }[];
  totalDebit: number;
  totalKredit: number;
  allTxIds: string[];
};

export async function getJurnalTransaksiHistory(entityId: string, page = 1, dari?: string, sampai?: string) {
  // Count distinct noBukti for this jenis input
  const jenisInput = await prisma.jenisInputTransaksi.findUnique({
    where: { key: "jurnalTransaksi" },
    select: { id: true },
  });

  if (!jenisInput) {
    return { groups: [] as JurnalTransaksiGroup[], totalPages: 1, page };
  }

  const tanggalFilter = dari || sampai ? {
    ...(dari ? { gte: new Date(dari) } : {}),
    ...(sampai ? { lte: new Date(sampai + "T23:59:59") } : {}),
  } : undefined;

  const where = {
    entityId,
    jenisInputId: jenisInput.id,
    ...(tanggalFilter ? { tanggal: tanggalFilter } : {}),
  };

  // Get distinct noBukti ordered by tanggal desc — use a subquery approach:
  // 1. Get all transactions, group in JS (simple approach, bounded by PAGE_SIZE * max rows per group)
  const allNoBuktis = await prisma.transaction.findMany({
    where,
    select: { noBukti: true, tanggal: true },
    distinct: ["noBukti"],
    orderBy: [{ tanggal: "desc" }, { noBukti: "desc" }],
  });

  const totalPages = Math.max(1, Math.ceil(allNoBuktis.length / PAGE_SIZE));
  const pagedNoBuktis = allNoBuktis
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    .map((r) => r.noBukti);

  if (pagedNoBuktis.length === 0) {
    return { groups: [] as JurnalTransaksiGroup[], totalPages, page };
  }

  const rows = await prisma.transaction.findMany({
    where: { entityId, jenisInputId: jenisInput.id, noBukti: { in: pagedNoBuktis } },
    include: {
      coaAccount: true,
      project: { select: { id: true, code: true, name: true } },
      faktur: {
        select: {
          id: true,
          noFaktur: true,
          namaRekanan: true,
          dpp: true,
          ppn: true,
          pph: true,
          labaSetelahPajak: true,
        },
      },
    },
    orderBy: [{ tanggal: "desc" }, { noBukti: "desc" }, { createdAt: "asc" }],
  });

  // Group by noBukti, preserving the paged order
  const grouped = new Map<string, JurnalTransaksiGroup>();
  for (const noBukti of pagedNoBuktis) {
    grouped.set(noBukti, {
      noBukti,
      tanggal: "",
      tanggalRaw: "",
      keterangan: "",
      projectId: null,
      project: null,
      fakturId: null,
      faktur: null,
      rows: [],
      totalDebit: 0,
      totalKredit: 0,
      allTxIds: [],
    });
  }

  for (const row of rows) {
    const group = grouped.get(row.noBukti);
    if (!group) continue;

    if (!group.tanggalRaw) {
      group.tanggalRaw = row.tanggal.toISOString();
      group.tanggal = row.tanggal.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      group.keterangan = row.keterangan;
      group.projectId = row.projectId ?? null;
      group.project = row.project ?? null;
      group.fakturId = row.fakturId ?? null;
      group.faktur = row.faktur
        ? {
            id: row.faktur.id,
            noFaktur: row.faktur.noFaktur,
            namaRekanan: row.faktur.namaRekanan,
            dpp: Number(row.faktur.dpp),
            ppn: Number(row.faktur.ppn),
            pph: Number(row.faktur.pph),
            labaSetelahPajak: Number(row.faktur.labaSetelahPajak),
          }
        : null;
    } else {
      if (!group.projectId && row.projectId) {
        group.projectId = row.projectId;
        group.project = row.project ?? null;
      }
      if (!group.fakturId && row.fakturId) {
        group.fakturId = row.fakturId;
        group.faktur = row.faktur
          ? {
              id: row.faktur.id,
              noFaktur: row.faktur.noFaktur,
              namaRekanan: row.faktur.namaRekanan,
              dpp: Number(row.faktur.dpp),
              ppn: Number(row.faktur.ppn),
              pph: Number(row.faktur.pph),
              labaSetelahPajak: Number(row.faktur.labaSetelahPajak),
            }
          : null;
      }
    }

    const debit = Number(row.debit);
    const kredit = Number(row.kredit);
    group.rows.push({
      coaAccountId: row.coaAccountId ?? "",
      coaCode: row.coaAccount?.code ?? "—",
      coaName: row.coaAccount?.name ?? "—",
      keterangan: row.keterangan,
      debit,
      kredit,
    });
    group.allTxIds.push(row.id);
    group.totalDebit += debit;
    group.totalKredit += kredit;
  }

  const groups = pagedNoBuktis
    .map((nb) => grouped.get(nb)!)
    .filter(Boolean);

  return { groups, totalPages, page };
}

export { formatRupiah };
