import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export type ReportVersion = "INTERNAL" | "UMUM";

export async function getArusKasData(
  entityId: string,
  year: number,
  version: ReportVersion | string = "INTERNAL"
) {
  const normVersion: ReportVersion = version?.toString().toUpperCase() === "UMUM" ? "UMUM" : "INTERNAL";

  // Filter ke semua akun ber-reportType ARUS_KAS (kas & bank) — sama untuk internal dan umum
  const transactions = await prisma.transaction.findMany({
    where: {
      entityId,
      tanggal: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31T23:59:59`),
      },
      coaAccount: {
        reportType: "ARUS_KAS",
      },
    },
    orderBy: { tanggal: "asc" },
  });

  const monthly = MONTHS.map((bulan, i) => {
    const monthTx = transactions.filter((t) => t.tanggal.getMonth() === i);
    const masuk = monthTx.reduce((s, t) => s + Number(t.debit), 0);
    const keluar = monthTx.reduce((s, t) => s + Number(t.kredit), 0);
    const net = masuk - keluar;
    return {
      bulan,
      masuk,
      keluar,
      net,
      masukFmt: masuk > 0 ? formatRupiah(masuk) : "-",
      keluarFmt: keluar > 0 ? formatRupiah(keluar) : "-",
      netFmt: formatRupiah(Math.abs(net)),
      netPositive: net >= 0,
      hasData: monthTx.length > 0,
    };
  });

  const totalMasuk = transactions.reduce((s, t) => s + Number(t.debit), 0);
  const totalKeluar = transactions.reduce((s, t) => s + Number(t.kredit), 0);
  const netTotal = totalMasuk - totalKeluar;

  return {
    monthly,
    totalMasukFmt: formatRupiah(totalMasuk),
    totalKeluarFmt: formatRupiah(totalKeluar),
    netTotalFmt: formatRupiah(Math.abs(netTotal)),
    netTotalPositive: netTotal >= 0,
    version: normVersion,
  };
}
