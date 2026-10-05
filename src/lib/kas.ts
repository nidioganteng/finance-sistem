import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { getRekeningCoaCode, KAS_BESAR_COA, KAS_KECIL_COA } from "./bank-accounts";

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

export async function getJenisInput(key: string) {
  return prisma.jenisInputTransaksi.findUnique({ where: { key } });
}

export async function getCoaOptions() {
  const accounts = await prisma.coaAccount.findMany();
  return accounts.sort((a, b) => parseInt(a.code) - parseInt(b.code));
}

// Ambil Saldo Awal akun kas/bank dari tabel SaldoAwal (yang diisi di Daftar Akun)
export async function getInitialSaldoAwal(
  entityId: string,
  jenisInputKeyOrId: string,
  rekeningNamaOrId?: string,
  year = new Date().getFullYear()
): Promise<number> {
  let coaCode: string | undefined;

  if (rekeningNamaOrId) {
    coaCode = getRekeningCoaCode(rekeningNamaOrId);
  }

  const entity = await prisma.entity.findUnique({ where: { id: entityId }, select: { key: true } });
  if (!coaCode && entity) {
    const jenisInput = await prisma.jenisInputTransaksi.findFirst({
      where: { OR: [{ id: jenisInputKeyOrId }, { key: jenisInputKeyOrId }] },
      select: { key: true },
    });
    if (jenisInput?.key === "kasKecil") {
      coaCode = KAS_KECIL_COA[entity.key];
    } else if (jenisInput?.key === "kasBesar") {
      coaCode = KAS_BESAR_COA[entity.key];
    }
  }

  if (!coaCode) return 0;

  const coa = await prisma.coaAccount.findUnique({
    where: { code: coaCode },
    select: { id: true },
  });
  if (!coa) return 0;

  const sa = await prisma.saldoAwal.findUnique({
    where: {
      entityId_coaAccountId_year: {
        entityId,
        coaAccountId: coa.id,
        year,
      },
    },
    select: { nominal: true },
  });

  return sa ? Number(sa.nominal) : 0;
}

// rekeningNama dipakai untuk Buku Bank agar saldo dihitung per rekening, bukan per entity
export async function getRunningSaldo(
  entityId: string,
  jenisInputId: string,
  rekeningNama?: string,
  year?: number
) {
  const currentYear = year ?? new Date().getFullYear();
  const initialSaldoAwal = await getInitialSaldoAwal(entityId, jenisInputId, rekeningNama, currentYear);

  const rows = await prisma.transaction.findMany({
    where: {
      entityId,
      jenisInputId,
      extraFieldsJson: { path: "$.isKasEntry", equals: true },
    },
    select: {
      debit: true,
      kredit: true,
      saldoSetelah: true,
      extraFieldsJson: true,
    },
  });

  const filtered = rekeningNama
    ? rows.filter((e) => (e.extraFieldsJson as Record<string, unknown> | null)?.rekeningNama === rekeningNama)
    : rows;

  if (filtered.length === 0) {
    return initialSaldoAwal;
  }

  const totalMasuk = filtered.reduce((s, r) => s + Number(r.debit), 0);
  const totalKeluar = filtered.reduce((s, r) => s + Number(r.kredit), 0);

  return initialSaldoAwal + totalMasuk - totalKeluar;
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
  year?: number
): Promise<number> {
  const currentYear = year ?? new Date(sebelum).getFullYear();
  const initialSaldoAwal = await getInitialSaldoAwal(entityId, jenisInputId, rekeningNama, currentYear);

  const rows = await prisma.transaction.findMany({
    where: {
      entityId,
      jenisInputId,
      tanggal: { lt: new Date(sebelum) },
      extraFieldsJson: { path: "$.isKasEntry", equals: true },
    },
    select: {
      debit: true,
      kredit: true,
      extraFieldsJson: true,
    },
  });

  const filtered = rekeningNama
    ? rows.filter((r) => (r.extraFieldsJson as Record<string, unknown> | null)?.rekeningNama === rekeningNama)
    : rows;

  const totalMasuk = filtered.reduce((s, r) => s + Number(r.debit), 0);
  const totalKeluar = filtered.reduce((s, r) => s + Number(r.kredit), 0);

  return initialSaldoAwal + totalMasuk - totalKeluar;
}

const KAS_PAGE_SIZE = 25;

export async function getKasLedger(
  entityId: string,
  jenisInputId: string,
  rekeningNama?: string,
  dari?: string,
  sampai?: string,
  page = 1,
  year?: number
) {
  const currentYear =
    year ??
    (dari ? new Date(dari).getFullYear() : sampai ? new Date(sampai).getFullYear() : new Date().getFullYear());

  const startingBalance = dari
    ? await getSaldoSebelum(entityId, jenisInputId, dari, rekeningNama, currentYear)
    : await getInitialSaldoAwal(entityId, jenisInputId, rekeningNama, currentYear);

  const tanggalFilter =
    dari || sampai
      ? {
          ...(dari ? { gte: new Date(dari) } : {}),
          ...(sampai ? { lte: new Date(`${sampai}T23:59:59`) } : {}),
        }
      : undefined;

  // Urutkan asc terlebih dahulu agar kalkulasi saldo akumulatif per baris tepat
  const rows = await prisma.transaction.findMany({
    where: {
      entityId,
      jenisInputId,
      ...(tanggalFilter ? { tanggal: tanggalFilter } : {}),
    },
    include: {
      coaAccount: true,
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ tanggal: "asc" }, { noBukti: "asc" }, { createdAt: "asc" }],
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
      project?: { id: string; code: string; name: string } | null;
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
        saldo: 0,
        hasKasEntry: false,
        allTxIds: [],
        coaRows: [],
        project: r.project ?? null,
      });
    }
    const g = groups.get(key)!;
    g.allTxIds.push(r.id);
    if (r.project && !g.project) {
      g.project = r.project;
    }

    const extra = r.extraFieldsJson as Record<string, unknown> | null;
    const isKasEntry = extra?.isKasEntry === true;

    if (isKasEntry) {
      g.hasKasEntry = true;
      g.masuk = Number(r.debit);
      g.keluar = Number(r.kredit);
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
        g.coaRows.push({ id: r.id, coaAccountId: r.coaAccount.id, coaName: r.coaAccount.name, nominal: Number(r.debit) || Number(r.kredit), isDebit: Number(r.debit) > 0, itemDescription: itemDesc });
      }
      if (!extra && !g.hasKasEntry) {
        g.masuk += Number(r.debit);
        g.keluar += Number(r.kredit);
      }
    }
  }

  const allGroups = Array.from(groups.values());

  const filtered = rekeningNama
    ? allGroups.filter((g) => !g.hasKasEntry || g.rekening === rekeningNama)
    : allGroups;

  // Akumulasikan saldo secara kronologis mulai dari startingBalance (yang menyertakan Saldo Awal)
  let running = startingBalance;
  for (const g of filtered) {
    running += g.masuk - g.keluar;
    g.saldo = running;
  }

  // Tampilkan secara descending (transaksi terbaru di atas)
  const displayGroups = [...filtered].reverse();

  const totalGroups = displayGroups.length;
  const totalPages = Math.max(1, Math.ceil(totalGroups / KAS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginated = displayGroups.slice((safePage - 1) * KAS_PAGE_SIZE, safePage * KAS_PAGE_SIZE);

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
      project: g.project ?? null,
    })),
  };
}

