import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

// Class Tailwind (bukan hex manual) supaya badge sumber ikut tema gelap.
const SUMBER_STYLE: Record<string, { className: string; label: string }> = {
  kasKecil: { className: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300", label: "Kas Kecil" },
  kasBesar: { className: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300", label: "Kas Besar" },
  bankBuku: { className: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300", label: "Bank Buku" },
};
const SUMBER_STYLE_DEFAULT = "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300";

export async function getJenisInputChips(entityId: string) {
  const jenis = await prisma.jenisInputTransaksi.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  return jenis.map((j) => ({
    key: j.key,
    label: j.nama,
  }));
}

export async function getJurnalRows(entityId: string, filterKey?: string) {
  const rows = await prisma.transaction.findMany({
    where: {
      entityId,
      ...(filterKey && filterKey !== "semua" ? { jenisInput: { key: filterKey } } : {}),
    },
    include: { jenisInput: true, coaAccount: true, project: true, staff: true },
    orderBy: { tanggal: "desc" },
  });

  const totalDebit = rows.reduce((sum, r) => sum + Number(r.debit), 0);
  const totalKredit = rows.reduce((sum, r) => sum + Number(r.kredit), 0);

  return {
    rows: rows.map((r) => {
      const style = SUMBER_STYLE[r.jenisInput.key] ?? { className: SUMBER_STYLE_DEFAULT, label: r.jenisInput.nama };
      return {
        id: r.id,
        tanggal: r.tanggal.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
        sumberClassName: style.className,
        sumberLabel: style.label,
        kodeProyek: r.project?.code ?? "-",
        kategori: r.coaAccount?.name ?? "-",
        debitFmt: formatRupiah(Number(r.debit)),
        kreditFmt: formatRupiah(Number(r.kredit)),
        saldoFmt: formatRupiah(Number(r.saldoSetelah)),
        staffName: r.staff.name,
        staffInitial: r.staff.name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join(""),
      };
    }),
    totalDebitFmt: formatRupiah(totalDebit),
    totalKreditFmt: formatRupiah(totalKredit),
  };
}
