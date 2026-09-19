import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

export async function getLaporanPiutangData(entityIds: string[]) {
  const projects = await prisma.project.findMany({
    where: { entityId: { in: entityIds } },
    include: {
      entity: { select: { name: true, key: true } },
      termin: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  let totalKontrak = 0;
  let totalTagih = 0;
  let totalBelumTagih = 0;

  const rows = projects.map((p) => {
    const contractValue = Number(p.contractValue);
    const maxPct = p.termin.reduce((max, t) => Math.max(max, t.percentage), 0);
    const tertagih = (maxPct / 100) * contractValue;
    const belumTagih = contractValue - tertagih;
    const isSelesai = p.status === "COMPLETED" || p.status === "CANCELLED";
    const isOverdue = !isSelesai && maxPct < 100 && p.deadline < now;

    if (!isSelesai) {
      totalKontrak += contractValue;
      totalTagih += tertagih;
      totalBelumTagih += belumTagih;
    }

    return {
      id: p.id,
      entityName: p.entity.name,
      code: p.code,
      name: p.name,
      contractValue,
      contractValueFmt: formatRupiah(contractValue),
      tertagih,
      tertagihFmt: formatRupiah(tertagih),
      belumTagih,
      belumTagihFmt: formatRupiah(Math.max(0, belumTagih)),
      maxPct,
      deadlineFmt: p.deadline.toLocaleDateString("id-ID"),
      isOverdue,
      status: p.status as "ACTIVE" | "COMPLETED" | "CANCELLED",
      jumlahTermin: p.termin.length,
    };
  });

  const aktif = rows.filter((r) => r.status === "ACTIVE");
  const selesai = rows.filter((r) => r.status === "COMPLETED" || r.status === "CANCELLED");

  return {
    aktif,
    selesai,
    summary: {
      totalKontrak,
      totalKontrakFmt: formatRupiah(totalKontrak),
      totalTagih,
      totalTagihFmt: formatRupiah(totalTagih),
      totalBelumTagih,
      totalBelumTagihFmt: formatRupiah(totalBelumTagih),
      pctTagih: totalKontrak > 0 ? Math.round((totalTagih / totalKontrak) * 100) : 0,
      jumlahAktif: aktif.length,
      jumlahOverdue: aktif.filter((r) => r.isOverdue).length,
    },
  };
}
