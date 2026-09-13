import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

const SUMBER_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  kasKecil: { bg: "#fef3c7", color: "#92400e", label: "Kas Kecil" },
  kasBesar: { bg: "#dbe3f7", color: "#1e40af", label: "Kas Besar" },
  bankBuku: { bg: "#dcfce7", color: "#166534", label: "Bank Buku" },
};

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
      const style = SUMBER_STYLE[r.jenisInput.key] ?? { bg: "#ede9fe", color: "#6d28d9", label: r.jenisInput.nama };
      return {
        id: r.id,
        tanggal: r.tanggal.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
        sumberBg: style.bg,
        sumberColor: style.color,
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
