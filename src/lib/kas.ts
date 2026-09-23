import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

export const ENTITY_PREFIX: Record<string, string> = {
  gaharu: "GH",
  kencana: "KC",
  tataring: "TT",
  ciptaAsri: "CA",
  umum: "UM",
};

export async function getJenisInput(key: string) {
  return prisma.jenisInputTransaksi.findUnique({ where: { key } });
}

export async function getCoaOptions() {
  const accounts = await prisma.coaAccount.findMany();
  return accounts.sort((a, b) => parseInt(a.code) - parseInt(b.code));
}

// rekeningNama dipakai untuk Buku Bank agar saldo dihitung per rekening, bukan per entity
export async function getRunningSaldo(entityId: string, jenisInputId: string, rekeningNama?: string) {
  if (rekeningNama) {
    const rows = await prisma.transaction.findMany({
      where: {
        entityId,
        jenisInputId,
        extraFieldsJson: { path: "$.isKasEntry", equals: true },
      },
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
    const match = rows.find((e) => (e.extraFieldsJson as Record<string, unknown> | null)?.rekeningNama === rekeningNama);
    return match ? Number(match.saldoSetelah) : 0;
  }

  const last = await prisma.transaction.findFirst({
    where: {
      entityId,
      jenisInputId,
      extraFieldsJson: { path: "$.isKasEntry", equals: true },
    },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
  });
  if (last) return Number(last.saldoSetelah);

  const fallback = await prisma.transaction.findFirst({
    where: { entityId, jenisInputId },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
  });
  return fallback ? Number(fallback.saldoSetelah) : 0;
}

// Ledger dikelompokkan per noBukti.
// crossingEntityKeys: transaksi ini dikirim DARI entitas ini KE entitas-entitas lain.
// crossingFromEntityKey: transaksi ini DITERIMA dari entitas lain (sisi destinasi crossing).
// Saldo terakhir yang tercatat SEBELUM tanggal `sebelum` (untuk hitung Saldo Awal periode)
export async function getSaldoSebelum(
  entityId: string,
  jenisInputId: string,
  sebelum: string,
  rekeningNama?: string,
): Promise<number> {
  const rows = await prisma.transaction.findMany({
    where: {
      entityId,
      jenisInputId,
      tanggal: { lt: new Date(sebelum) },
      extraFieldsJson: { path: "$.isKasEntry", equals: true },
    },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
    take: 10,
  });
  if (rekeningNama) {
    const match = rows.find((r) => (r.extraFieldsJson as Record<string, unknown>)?.rekeningNama === rekeningNama);
    return match ? Number(match.saldoSetelah) : 0;
  }
  return rows.length > 0 ? Number(rows[0].saldoSetelah) : 0;
}

const KAS_PAGE_SIZE = 25;

export async function getKasLedger(
  entityId: string,
  jenisInputId: string,
  rekeningNama?: string,
  dari?: string,
  sampai?: string,
  page = 1,
) {
  const tanggalFilter =
    dari || sampai
      ? {
          ...(dari ? { gte: new Date(dari) } : {}),
          ...(sampai ? { lte: new Date(`${sampai}T23:59:59`) } : {}),
        }
      : undefined;

  // Fetch all rows first (needed for group-by-noBukti logic),
  // then paginate the resulting groups.
  const rows = await prisma.transaction.findMany({
    where: {
      entityId,
      jenisInputId,
      ...(tanggalFilter ? { tanggal: tanggalFilter } : {}),
    },
    include: { coaAccount: true },
    orderBy: [{ tanggal: "desc" }, { noBukti: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });

  const groups = new Map<
    string,
    {
      tanggal: string;
      tanggalRaw: string;
      noBukti: string;
      keterangan: string;
      akunTags: string[];
      rekening?: string;
      crossingEntityKeys?: string[];
      crossingFromEntityKey?: string;
      crossingGroupId?: string;
      masuk: number;
      keluar: number;
      saldo: number;
      hasKasEntry: boolean;
      allTxIds: string[];
      coaRows: { id: string; coaAccountId: string; coaName: string; nominal: number; isDebit: boolean; itemDescription?: string }[];
    }
  >();

  for (const r of rows) {
    const tanggalRaw = r.tanggal.toISOString().slice(0, 10);
    const key = r.noBukti + "|" + tanggalRaw;
    if (!groups.has(key)) {
      groups.set(key, {
        tanggal: r.tanggal.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
        tanggalRaw,
        noBukti: r.noBukti,
        keterangan: r.keterangan,
        akunTags: [],
        masuk: 0,
        keluar: 0,
        saldo: Number(r.saldoSetelah),
        hasKasEntry: false,
        allTxIds: [],
        coaRows: [],
      });
    }
    const g = groups.get(key)!;
    g.allTxIds.push(r.id);

    const extra = r.extraFieldsJson as Record<string, unknown> | null;
    const isKasEntry = extra?.isKasEntry === true;

    if (isKasEntry) {
      g.hasKasEntry = true;
      g.masuk = Number(r.debit);
      g.keluar = Number(r.kredit);
      g.saldo = Number(r.saldoSetelah);
      if (extra?.rekeningNama) g.rekening = String(extra.rekeningNama);
      // crossing source side — new multi-entity format
      if (Array.isArray(extra?.crossingEntityKeys)) {
        g.crossingEntityKeys = extra.crossingEntityKeys as string[];
      } else if (extra?.crossingEntityKey) {
        // backward compat with old single-entity crossing
        g.crossingEntityKeys = [String(extra.crossingEntityKey)];
      }
      // crossing destination side
      if (extra?.crossingFromEntityKey) g.crossingFromEntityKey = String(extra.crossingFromEntityKey);
      if (extra?.crossingGroupId) g.crossingGroupId = String(extra.crossingGroupId);
    } else {
      if (r.coaAccount) {
        const itemDesc = typeof extra?.itemDescription === "string" ? extra.itemDescription : undefined;
        g.akunTags.push(itemDesc ?? r.coaAccount.name);
        g.coaRows.push({ id: r.id, coaAccountId: r.coaAccount.id, coaName: r.coaAccount.name, nominal: Number(r.debit || r.kredit), isDebit: Number(r.debit) > 0, itemDescription: itemDesc });
      }
      if (!extra && !g.hasKasEntry) {
        g.masuk += Number(r.debit);
        g.keluar += Number(r.kredit);
        g.saldo = Number(r.saldoSetelah);
      }
    }
  }

  const allGroups = Array.from(groups.values());

  const filtered = rekeningNama
    ? allGroups.filter((g) => !g.hasKasEntry || g.rekening === rekeningNama)
    : allGroups;

  const totalGroups = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalGroups / KAS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginated = filtered.slice((safePage - 1) * KAS_PAGE_SIZE, safePage * KAS_PAGE_SIZE);

  return {
    totalCount: totalGroups,
    totalPages,
    page: safePage,
    entries: paginated.map((g) => ({
      tanggal: g.tanggal,
      tanggalRaw: g.tanggalRaw,
      noBukti: g.noBukti,
      keterangan: g.keterangan,
      akunTags: g.akunTags,
      rekening: g.rekening,
      crossingEntityKeys: g.crossingEntityKeys,
      crossingFromEntityKey: g.crossingFromEntityKey,
      masuk: g.masuk,
      keluar: g.keluar,
      saldo: g.saldo,
      masukFmt: g.masuk > 0 ? formatRupiah(g.masuk) : "-",
      keluarFmt: g.keluar > 0 ? formatRupiah(g.keluar) : "-",
      saldoFmt: formatRupiah(g.saldo),
      allTxIds: g.allTxIds,
      coaRows: g.coaRows,
    })),
  };
}
