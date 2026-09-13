import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

export async function getProfitabilitasData(entityId: string) {
  const projects = await prisma.project.findMany({
    where: { entityId },
    include: { termin: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { code: "asc" },
  });

  const totalKontrak = projects.reduce((s, p) => s + Number(p.contractValue), 0);
  const totalTerpakai = projects.reduce((s, p) => s + Number(p.spend), 0);
  const totalLaba = totalKontrak - totalTerpakai;

  return {
    projects: projects.map((p) => {
      const kontrak = Number(p.contractValue);
      const terpakai = Number(p.spend);
      const laba = kontrak - terpakai;
      const margin = kontrak > 0 ? (laba / kontrak) * 100 : 0;
      const latestTermin = p.termin[0];
      return {
        code: p.code,
        name: p.name,
        kontrakFmt: formatRupiah(kontrak),
        terpakaiiFmt: formatRupiah(terpakai),
        laba,
        labaFmt: formatRupiah(Math.abs(laba)),
        labaPositive: laba >= 0,
        margin: margin.toFixed(1),
        terminStatus: latestTermin?.status ?? null,
        terminPct: latestTermin?.percentage ?? null,
      };
    }),
    summary: {
      totalKontrakFmt: formatRupiah(totalKontrak),
      totalTerpakaiiFmt: formatRupiah(totalTerpakai),
      totalLaba,
      totalLabaFmt: formatRupiah(Math.abs(totalLaba)),
      totalLabaPositive: totalLaba >= 0,
      avgMargin:
        projects.length > 0 && totalKontrak > 0
          ? ((totalLaba / totalKontrak) * 100).toFixed(1)
          : "0.0",
      projectCount: projects.length,
    },
  };
}
