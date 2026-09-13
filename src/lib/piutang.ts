import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

export async function getPiutangData(entityId: string) {
  const [terminList, loadingDockList] = await Promise.all([
    prisma.termin.findMany({
      where: { project: { entityId } },
      include: {
        project: { select: { code: true, name: true, contractValue: true } },
        auditedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.loadingDockTransaksi.findMany({
      where: { entityId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    terminList: terminList.map((t) => ({
      id: t.id,
      name: t.name,
      percentage: t.percentage,
      status: t.status,
      auditedAt: t.auditedAt ? t.auditedAt.toLocaleDateString("id-ID") : null,
      auditedByName: t.auditedBy?.name ?? null,
      projectCode: t.project.code,
      projectName: t.project.name,
      contractValueFmt: formatRupiah(Number(t.project.contractValue)),
    })),
    loadingDockList: loadingDockList.map((d) => ({
      id: d.id,
      nama: d.nama,
      totalFmt: formatRupiah(Number(d.total)),
      status: d.status,
      createdAt: d.createdAt.toLocaleDateString("id-ID"),
    })),
  };
}
