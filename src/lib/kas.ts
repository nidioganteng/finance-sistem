import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

export const ENTITY_PREFIX: Record<string, string> = {
  gaharu: "GS",
  kencana: "KAK",
  tataring: "TB",
  ciptaAsri: "CAD",
  umum: "KP",
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
  const kasEntries = await prisma.transaction.findMany({
    where: {
      entityId,
      jenisInputId,
      extraFieldsJson: { path: "$.isKasEntry", equals: true },
    },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
  });

  if (rekeningNama) {
    const match = kasEntries.find((e) => {
      const extra = e.extraFieldsJson as Record<string, unknown> | null;
      return extra?.rekeningNama === rekeningNama;
    });
    return match ? Number(match.saldoSetelah) : 0;
  }

  if (kasEntries.length > 0) return Number(kasEntries[0].saldoSetelah);

  const last = await prisma.transaction.findFirst({
    where: { entityId, jenisInputId },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
  });
  return last ? Number(last.saldoSetelah) : 0;
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

export async function getKasLedger(
  entityId: string,
  jenisInputId: string,
  rekeningNama?: string,
  dari?: string,
  sampai?: string,
) {
  const tanggalFilter =
    dari || sampai
      ? {
          ...(dari ? { gte: new Date(dari) } : {}),
          ...(sampai ? { lte: new Date(`${sampai}T23:59:59`) } : {}),
        }
      : undefined;

  const rows = await prisma.transaction.findMany({
    where: {
      entityId,
      jenisInputId,
      ...(tanggalFilter ? { tanggal: tanggalFilter } : {}),
    },
    include: { coaAccount: true },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
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
      coaRows: { id: string; coaAccountId: string; coaName: string; nominal: number }[];
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
        g.akunTags.push(r.coaAccount.name);
        g.coaRows.push({ id: r.id, coaAccountId: r.coaAccount.id, coaName: r.coaAccount.name, nominal: Number(r.debit || r.kredit) });
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

  return filtered.map((g) => ({
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
  }));
}
