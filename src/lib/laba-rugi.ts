import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { getPenyusutanSummary } from "./aset-tetap";
import { getExcludedNoBuktiForVersion } from "./akuntansi";

import { ReportCategory } from "@prisma/client";

export type ReportVersion = "INTERNAL" | "UMUM";

// month opsional (1-12) — kalau diisi, scope laporan ke satu bulan itu saja
// (dipakai fitur komparasi antar-periode), kalau tidak diisi tetap satu tahun penuh.
// version (issue #40): "INTERNAL" (default) atau "UMUM"
export async function getLabaRugiData(
  entityId: string,
  year: number,
  month?: number,
  version: ReportVersion | string = "INTERNAL"
) {
  const normVersion: ReportVersion = version?.toString().toUpperCase() === "UMUM" ? "UMUM" : "INTERNAL";
  const allowedCategories: ReportCategory[] =
    normVersion === "UMUM" ? [ReportCategory.UMUM, ReportCategory.SEMUA] : [ReportCategory.INTERNAL, ReportCategory.SEMUA];

  const { start, end } = month
    ? { start: new Date(year, month - 1, 1), end: new Date(year, month, 0, 23, 59, 59) }
    : { start: new Date(`${year}-01-01`), end: new Date(`${year}-12-31T23:59:59`) };

  const [excludedNoBukti, penyusutanSummary] = await Promise.all([
    getExcludedNoBuktiForVersion(entityId, year, normVersion),
    getPenyusutanSummary(entityId, year, month),
  ]);

  const transactions = await prisma.transaction.findMany({
    where: {
      entityId,
      tanggal: { gte: start, lte: end },
      coaAccountId: { not: null },
      coaAccount: {
        reportCategory: { in: allowedCategories },
      },
      ...(excludedNoBukti.length > 0 ? { noBukti: { notIn: excludedNoBukti } } : {}),
    },
    include: { coaAccount: true },
  });

  const pendapatan = new Map<string, { code: string; name: string; total: number }>();
  const beban = new Map<string, { code: string; name: string; total: number }>();

  for (const t of transactions) {
    if (!t.coaAccount) continue;
    if (t.coaAccount.kategori === "PENDAPATAN") {
      if (!pendapatan.has(t.coaAccountId!)) {
        pendapatan.set(t.coaAccountId!, {
          code: t.coaAccount.code,
          name: t.coaAccount.name,
          total: 0,
        });
      }
      pendapatan.get(t.coaAccountId!)!.total += Number(t.kredit);
    } else if (t.coaAccount.kategori === "BEBAN") {
      if (!beban.has(t.coaAccountId!)) {
        beban.set(t.coaAccountId!, {
          code: t.coaAccount.code,
          name: t.coaAccount.name,
          total: 0,
        });
      }
      beban.get(t.coaAccountId!)!.total += Number(t.debit);
    }
  }

  // Issue 39 & SRS v2.0: Biaya penyusutan aset dihitung otomatis dan ditarik (linked) dari Modul Aktiva Tetap
  if (penyusutanSummary.totalBebanPenyusutan > 0) {
    let foundDepreciationKey: string | null = null;
    for (const [key, val] of beban.entries()) {
      if (val.code === "512" || val.code === "540" || /penyusutan/i.test(val.name)) {
        foundDepreciationKey = key;
        break;
      }
    }

    if (foundDepreciationKey) {
      beban.get(foundDepreciationKey)!.total = penyusutanSummary.totalBebanPenyusutan;
    } else {
      const coaPenyusutan = await prisma.coaAccount.findFirst({
        where: {
          kategori: "BEBAN",
          OR: [{ code: "512" }, { code: "540" }, { name: { contains: "penyusutan" } }],
        },
      });
      const key = coaPenyusutan?.id ?? "auto_depreciation";
      beban.set(key, {
        code: coaPenyusutan?.code ?? "512",
        name: coaPenyusutan?.name ?? "Beban Penyusutan Aset Tetap",
        total: penyusutanSummary.totalBebanPenyusutan,
      });
    }
  }

  const pendapatanList = Array.from(pendapatan.values()).map((i) => ({
    ...i,
    totalFmt: formatRupiah(i.total),
  }));
  const bebanList = Array.from(beban.values()).map((i) => ({
    ...i,
    totalFmt: formatRupiah(i.total),
  }));
  const totalPendapatan = pendapatanList.reduce((s, i) => s + i.total, 0);
  const totalBeban = bebanList.reduce((s, i) => s + i.total, 0);
  const labaBersih = totalPendapatan - totalBeban;

  return {
    pendapatanList,
    bebanList,
    totalPendapatan,
    totalBeban,
    totalPendapatanFmt: formatRupiah(totalPendapatan),
    totalBebanFmt: formatRupiah(totalBeban),
    labaBersih,
    labaBersihFmt: formatRupiah(Math.abs(labaBersih)),
    labaBersihPositive: labaBersih >= 0,
    penyusutanOtomatis: penyusutanSummary.totalBebanPenyusutan,
    penyusutanOtomatisFmt: formatRupiah(penyusutanSummary.totalBebanPenyusutan),
    version: normVersion,
  };
}
