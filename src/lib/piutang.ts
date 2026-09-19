import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

// Daftar proyek satu entitas buat dropdown "Proyek Terkait" di form transaksi
// Kas/Bank Buku — dipakai staf/manajer keuangan pas mencatat uang masuk yang
// sekalian jadi pembayaran termin proyek tertentu.
export async function getProjectOptions(entityId: string) {
  const projects = await prisma.project.findMany({
    where: { entityId, status: "ACTIVE" },
    select: { id: true, code: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  return projects;
}

// Persentase termin baru dihitung dari akumulasi uang masuk (termin-termin
// sebelumnya + pembayaran baru ini) dibanding nilai kontrak — bukan input
// manual. Dipakai saat mencatat transaksi "uang masuk" yang terkait proyek.
export function computeNewTerminPercentage(
  contractValue: number,
  existingTerminPercentages: number[],
  nominalMasuk: number
): number {
  const maxPctSoFar = existingTerminPercentages.reduce((max, p) => Math.max(max, p), 0);
  const cumulativeBefore = (maxPctSoFar / 100) * contractValue;
  const cumulativeAfter = cumulativeBefore + nominalMasuk;
  return Math.min(100, Math.round((cumulativeAfter / contractValue) * 100));
}

export async function getPiutangData(entityId: string) {
  const [projects, loadingDockList] = await Promise.all([
    prisma.project.findMany({
      where: { entityId, status: { in: ["ACTIVE", "CANCELLED"] } },
      include: {
        termin: {
          include: { auditedBy: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.loadingDockTransaksi.findMany({
      where: { entityId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const now = new Date();
  let totalKontrak = 0;
  let totalTerminTagih = 0;

  const projectList = projects.map((p) => {
    const contractValue = Number(p.contractValue);
    const isCancelled = p.status === "CANCELLED" || p.status === "COMPLETED";

    // Progress tertagih = persentase termin tertinggi × nilai kontrak
    const maxPct = p.termin.reduce((max, t) => Math.max(max, t.percentage), 0);
    const terminTagih = (maxPct / 100) * contractValue;
    const sisaTagih = isCancelled ? 0 : contractValue - terminTagih;

    // "Total Nilai Kontrak Aktif" cuma menjumlah proyek yang masih aktif
    if (!isCancelled) {
      totalKontrak += contractValue;
      totalTerminTagih += terminTagih;
    }

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      contractValue,
      contractValueFmt: formatRupiah(contractValue),
      deadlineFmt: p.deadline.toLocaleDateString("id-ID"),
      isOverdue: !isCancelled && maxPct < 80 && p.deadline < now,
      status: p.status,
      maxPercentage: maxPct,
      terminTagih,
      terminTagihFmt: formatRupiah(terminTagih),
      sisaTagih,
      sisaTagihFmt: formatRupiah(sisaTagih),
      // Tiap termin ditampilkan sebagai nominal uang masuk-nya sendiri (bukan
      // persentase) — dihitung dari selisih persentase kumulatif dgn termin
      // sebelumnya × nilai kontrak. Persentase tetap dipakai di belakang layar
      // (lihat maxPct di atas), tampilan persen itu bagian Admin Sidamon.
      termin: p.termin.map((t, i) => {
        const prevPct = i === 0 ? 0 : p.termin[i - 1].percentage;
        const nominalTermin = ((t.percentage - prevPct) / 100) * contractValue;
        return {
          id: t.id,
          name: t.name,
          nominalFmt: formatRupiah(nominalTermin),
          status: t.status,
          auditedAt: t.auditedAt ? t.auditedAt.toLocaleDateString("id-ID") : null,
          auditedByName: t.auditedBy?.name ?? null,
        };
      }),
    };
  });

  const sisaPiutang = totalKontrak - totalTerminTagih;

  return {
    projectList,
    summary: {
      totalKontrak,
      totalKontrakFmt: formatRupiah(totalKontrak),
      totalTerminTagih,
      totalTerminTagihFmt: formatRupiah(totalTerminTagih),
      sisaPiutang,
      sisaPiutangFmt: formatRupiah(Math.abs(sisaPiutang)),
      jumlahProyek: projects.filter((p) => p.status !== "CANCELLED").length,
    },
    loadingDockList: loadingDockList.map((d) => ({
      id: d.id,
      nama: d.nama,
      totalFmt: formatRupiah(Number(d.total)),
      status: d.status,
      createdAt: d.createdAt.toLocaleDateString("id-ID"),
    })),
  };
}
