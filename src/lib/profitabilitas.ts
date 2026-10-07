import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

export async function getProfitabilitasData(entityId: string) {
  const projects = await prisma.project.findMany({
    where: { entityId },
    include: {
      termin: { orderBy: { createdAt: "desc" }, take: 1 },
      jurnal: { include: { coaAccount: true } },
    },
    orderBy: { code: "asc" },
  });

  const projectSpends = projects.map((p) => {
    let spendFromJurnal = 0;
    const projectJurnal = (p.jurnal || []).filter(
      (j) => !(j.extraFieldsJson && (j.extraFieldsJson as Record<string, unknown>).autoPostedFromJurnal === true)
    );
    if (projectJurnal.length > 0) {
      const incomeNoBuktis = new Set<string>();
      projectJurnal.forEach((j) => {
        if (
          j.noBukti &&
          (j.coaAccount?.kategori === "PENDAPATAN" ||
            j.coaAccount?.code === "400" ||
            /pendapatan/i.test(j.coaAccount?.name ?? ""))
        ) {
          incomeNoBuktis.add(j.noBukti);
        }
      });

      for (const j of projectJurnal) {
        if (j.noBukti && incomeNoBuktis.has(j.noBukti)) {
          const isTaxDeduction =
            Number(j.debit) > 0 &&
            (j.coaAccount?.kategori === "BEBAN" ||
              /pph|pajak|ppn|bupot/i.test(j.coaAccount?.name ?? "") ||
              /pph|pajak|ppn|potongan/i.test(j.keterangan ?? ""));
          if (isTaxDeduction) spendFromJurnal += Number(j.debit);
        } else {
          const isBeban =
            j.coaAccount?.kategori === "BEBAN" ||
            j.coaAccount?.code?.startsWith("5") ||
            j.coaAccount?.code?.startsWith("6");
          if (isBeban && Number(j.debit) > 0) {
            spendFromJurnal += Number(j.debit);
          } else if (Number(j.debit) > 0 && !/bank|kas|piutang/i.test(j.coaAccount?.name ?? "")) {
            spendFromJurnal += Number(j.debit);
          }
        }
      }
    }
    const terpakai = spendFromJurnal > 0 ? spendFromJurnal : Number(p.spend);
    return { p, terpakai };
  });

  const totalKontrak = projectSpends.reduce((s, { p }) => s + Number(p.contractValue), 0);
  const totalTerpakai = projectSpends.reduce((s, { terpakai }) => s + terpakai, 0);
  const totalLaba = totalKontrak - totalTerpakai;

  return {
    projects: projectSpends.map(({ p, terpakai }) => {
      const kontrak = Number(p.contractValue);
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
