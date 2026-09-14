import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

export async function getJenisInput(key: string) {
  return prisma.jenisInputTransaksi.findUnique({ where: { key } });
}

export async function getCoaOptions() {
  return prisma.coaAccount.findMany({ orderBy: { code: "asc" } });
}

// rekeningNama dipakai untuk Bank Buku agar saldo dihitung per rekening, bukan per entity
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
    // Per-rekening saldo: cari entry terakhir untuk rekening ini
    const match = kasEntries.find((e) => {
      const extra = e.extraFieldsJson as Record<string, unknown> | null;
      return extra?.rekeningNama === rekeningNama;
    });
    return match ? Number(match.saldoSetelah) : 0;
  }

  // Saldo gabungan (Kas Kecil / Kas Besar): ambil entry terakhir
  if (kasEntries.length > 0) return Number(kasEntries[0].saldoSetelah);

  // Fallback untuk data lama sebelum double-entry
  const last = await prisma.transaction.findFirst({
    where: { entityId, jenisInputId },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
  });
  return last ? Number(last.saldoSetelah) : 0;
}

// Ledger dikelompokkan per noBukti.
// Data baru: kas entry (isKasEntry=true) menentukan masuk/keluar/saldo dan rekening.
// Data lama (tanpa extraFieldsJson): pakai logika lama.
// rekeningNama: kalau diisi, hanya tampilkan transaksi dari rekening tersebut (Bank Buku).
export async function getKasLedger(entityId: string, jenisInputId: string, rekeningNama?: string) {
  const rows = await prisma.transaction.findMany({
    where: { entityId, jenisInputId },
    include: { coaAccount: true },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
  });

  const groups = new Map<
    string,
    {
      tanggal: string;
      noBukti: string;
      keterangan: string;
      akunTags: string[];
      rekening?: string;
      masuk: number;
      keluar: number;
      saldo: number;
      hasKasEntry: boolean;
    }
  >();

  for (const r of rows) {
    const key = r.noBukti + "|" + r.tanggal.toISOString().slice(0, 10);
    if (!groups.has(key)) {
      groups.set(key, {
        tanggal: r.tanggal.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
        noBukti: r.noBukti,
        keterangan: r.keterangan,
        akunTags: [],
        masuk: 0,
        keluar: 0,
        saldo: Number(r.saldoSetelah),
        hasKasEntry: false,
      });
    }
    const g = groups.get(key)!;

    const extra = r.extraFieldsJson as Record<string, unknown> | null;
    const isKasEntry = extra?.isKasEntry === true;

    if (isKasEntry) {
      g.hasKasEntry = true;
      g.masuk = Number(r.debit);
      g.keluar = Number(r.kredit);
      g.saldo = Number(r.saldoSetelah);
      if (extra?.rekeningNama) g.rekening = String(extra.rekeningNama);
    } else {
      if (r.coaAccount) g.akunTags.push(r.coaAccount.name);
      if (!extra && !g.hasKasEntry) {
        g.masuk += Number(r.debit);
        g.keluar += Number(r.kredit);
        g.saldo = Number(r.saldoSetelah);
      }
    }
  }

  const allGroups = Array.from(groups.values());

  // Filter by rekening if specified (Bank Buku multi-rekening)
  const filtered = rekeningNama
    ? allGroups.filter((g) => !g.hasKasEntry || g.rekening === rekeningNama)
    : allGroups;

  return filtered.map((g) => ({
    tanggal: g.tanggal,
    noBukti: g.noBukti,
    keterangan: g.keterangan,
    akunTags: g.akunTags,
    rekening: g.rekening,
    masuk: g.masuk,
    keluar: g.keluar,
    saldo: g.saldo,
    masukFmt: g.masuk > 0 ? formatRupiah(g.masuk) : "-",
    keluarFmt: g.keluar > 0 ? formatRupiah(g.keluar) : "-",
    saldoFmt: formatRupiah(g.saldo),
  }));
}
