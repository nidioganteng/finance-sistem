import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

const SUMBER_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  kasKecil: { bg: "#fef3c7", color: "#92400e", label: "Kas Kecil" },
  kasBesar: { bg: "#dbeafe", color: "#1e40af", label: "Kas Besar" },
  bankBuku: { bg: "#dcfce7", color: "#166534", label: "Buku Bank" },
};

export async function getJenisInputChips(entityId: string) {
  const jenis = await prisma.jenisInputTransaksi.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  return jenis.map((j) => ({ key: j.key, label: j.nama }));
}

export async function getCoaList() {
  const all = await prisma.coaAccount.findMany({ select: { code: true, name: true } });
  // Dedup by (code, name) — KAS dan BANK scope bisa punya kode sama dengan nama berbeda,
  // keduanya ditampilkan; kode sama + nama sama hanya ditampilkan sekali.
  const seen = new Set<string>();
  const unique: { code: string; name: string }[] = [];
  for (const a of all.sort((x, y) => parseInt(x.code) - parseInt(y.code))) {
    const key = `${a.code}|${a.name}`;
    if (!seen.has(key)) { seen.add(key); unique.push(a); }
  }
  return unique;
}

export async function getJurnalRows(
  entityId: string,
  filterKey?: string,
  bulan?: string,    // format "YYYY-MM"
  akunCode?: string, // filter by code akun (bisa match KAS & BANK)
) {
  // Bangun filter tanggal dari bulan jika ada
  let tanggalFilter: { gte?: Date; lt?: Date } | undefined;
  if (bulan && /^\d{4}-\d{2}$/.test(bulan)) {
    const [y, m] = bulan.split("-").map(Number);
    tanggalFilter = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }

  const rows = await prisma.transaction.findMany({
    where: {
      entityId,
      ...(filterKey && filterKey !== "semua" ? { jenisInput: { key: filterKey } } : {}),
      ...(tanggalFilter ? { tanggal: tanggalFilter } : {}),
      ...(akunCode ? { coaAccount: { code: akunCode } } : {}),
    },
    include: { jenisInput: true, coaAccount: true, project: true, staff: true },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
  });

  // Kalau filter akun aktif, juga ambil kas entry pasangan dari noBukti yang sama
  // supaya pembaca bisa lihat jurnal lengkap per transaksi
  let allRows = rows;
  if (akunCode && rows.length > 0) {
    const noBuktiSet = [...new Set(rows.map((r) => r.noBukti))];
    const kasEntries = await prisma.transaction.findMany({
      where: {
        entityId,
        noBukti: { in: noBuktiSet },
        extraFieldsJson: { path: "$.isKasEntry", equals: true },
        NOT: { coaAccount: { code: akunCode } },
      },
      include: { jenisInput: true, coaAccount: true, project: true, staff: true },
    });
    // Gabung dan urutkan ulang
    const combined = [...rows, ...kasEntries];
    combined.sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
    allRows = combined;
  }

  const totalDebit = allRows.reduce((s, r) => s + Number(r.debit), 0);
  const totalKredit = allRows.reduce((s, r) => s + Number(r.kredit), 0);
  const isBalanced = Math.round(totalDebit * 100) === Math.round(totalKredit * 100);

  return {
    rows: allRows.map((r) => {
      const style = SUMBER_STYLE[r.jenisInput.key] ?? { bg: "#ede9fe", color: "#6d28d9", label: r.jenisInput.nama };
      const extra = r.extraFieldsJson as Record<string, unknown> | null;
      const isKasEntry = extra?.isKasEntry === true;

      let kodeAkun = r.coaAccount?.code ?? "—";
      let namaAkun = r.coaAccount?.name ?? "—";
      if (isKasEntry && !r.coaAccount) {
        kodeAkun = "—";
        namaAkun =
          r.jenisInput.key === "kasKecil" ? "Kas Kecil" :
          r.jenisInput.key === "kasBesar" ? "Kas" :
          typeof extra?.rekeningNama === "string" ? extra.rekeningNama : "Rekening Bank";
      }

      const debit = Number(r.debit);
      const kredit = Number(r.kredit);

      const arahLaporan = Array.isArray(extra?.arahLaporan) ? (extra.arahLaporan as string[]) : [];

      return {
        id: r.id,
        tanggal: r.tanggal.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
        noBukti: r.noBukti,
        keterangan: r.keterangan,
        sumberBg: style.bg,
        sumberColor: style.color,
        sumberLabel: style.label,
        isKasEntry,
        kodeAkun,
        namaAkun,
        debitFmt: debit > 0 ? formatRupiah(debit) : "-",
        kreditFmt: kredit > 0 ? formatRupiah(kredit) : "-",
        staffName: r.staff.name,
        staffInitial: r.staff.name.split(" ").map((p) => p[0]).slice(0, 2).join(""),
        arahLaporan,
      };
    }),
    totalDebit,
    totalKredit,
    isBalanced,
    totalDebitFmt: formatRupiah(totalDebit),
    totalKreditFmt: formatRupiah(totalKredit),
  };
}
