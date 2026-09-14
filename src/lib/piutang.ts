import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

export async function getPiutangData(entityId: string) {
  const [projects, loadingDockList] = await Promise.all([
    prisma.project.findMany({
      where: { entityId },
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

  let totalKontrak = 0;
  let totalTerminTagih = 0;

  const projectList = projects.map((p) => {
    const contractValue = Number(p.contractValue);
    totalKontrak += contractValue;

    // Progress tertagih = persentase termin tertinggi × nilai kontrak
    const maxPct = p.termin.reduce((max, t) => Math.max(max, t.percentage), 0);
    const terminTagih = (maxPct / 100) * contractValue;
    totalTerminTagih += terminTagih;

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      contractValue,
      contractValueFmt: formatRupiah(contractValue),
      maxPercentage: maxPct,
      terminTagih,
      terminTagihFmt: formatRupiah(terminTagih),
      sisaTagih: contractValue - terminTagih,
      sisaTagihFmt: formatRupiah(contractValue - terminTagih),
      termin: p.termin.map((t) => ({
        id: t.id,
        name: t.name,
        percentage: t.percentage,
        status: t.status,
        auditedAt: t.auditedAt ? t.auditedAt.toLocaleDateString("id-ID") : null,
        auditedByName: t.auditedBy?.name ?? null,
      })),
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
      jumlahProyek: projects.length,
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
