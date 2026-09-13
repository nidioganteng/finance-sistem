import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

export async function getJenisInput(key: string) {
  return prisma.jenisInputTransaksi.findUnique({ where: { key } });
}

export async function getCoaOptions() {
  return prisma.coaAccount.findMany({ orderBy: { code: "asc" } });
}

export async function getRunningSaldo(entityId: string, jenisInputId: string) {
  const last = await prisma.transaction.findFirst({
    where: { entityId, jenisInputId },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
  });
  return last ? Number(last.saldoSetelah) : 0;
}

// Ledger ditampilkan ter-grup per noBukti (satu "transaksi" bisa punya beberapa
// baris akun), meniru perilaku kasInfo.rows di mockup.
export async function getKasLedger(entityId: string, jenisInputId: string) {
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
      masuk: number;
      keluar: number;
      saldo: number;
    }
  >();

  for (const r of rows) {
    const key = r.noBukti + "|" + r.tanggal.toISOString();
    if (!groups.has(key)) {
      groups.set(key, {
        tanggal: r.tanggal.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
        noBukti: r.noBukti,
        keterangan: r.keterangan,
        akunTags: [],
        masuk: 0,
        keluar: 0,
        saldo: Number(r.saldoSetelah),
      });
    }
    const g = groups.get(key)!;
    g.akunTags.push(r.coaAccount?.name ?? "-");
    g.masuk += Number(r.debit);
    g.keluar += Number(r.kredit);
  }

  return Array.from(groups.values()).map((g) => ({
    ...g,
    masukFmt: g.masuk > 0 ? formatRupiah(g.masuk) : "-",
    keluarFmt: g.keluar > 0 ? formatRupiah(g.keluar) : "-",
    saldoFmt: formatRupiah(g.saldo),
  }));
}
