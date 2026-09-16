import { prisma } from "./prisma";
import { Role } from "@prisma/client";

export function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export async function getAccessibleEntities(entityKeys: string[]) {
  const [entities, txRows] = await Promise.all([
    prisma.entity.findMany({
      where: { key: { in: entityKeys } },
      include: { projects: { include: { termin: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Revenue & spend dihitung dari transaksi aktual (COA kategori PENDAPATAN/BEBAN)
    // supaya Dashboard Manager konsisten dengan Laporan Keuangan Staff.
    prisma.transaction.findMany({
      where: {
        entity: { key: { in: entityKeys } },
        coaAccount: { kategori: { in: ["PENDAPATAN", "BEBAN"] } },
      },
      select: {
        entityId: true,
        kredit: true,
        coaAccount: { select: { kategori: true } },
      },
    }),
  ]);

  const revenueMap = new Map<string, number>();
  const spendMap = new Map<string, number>();
  for (const tx of txRows) {
    const amt = Number(tx.kredit);
    if (tx.coaAccount?.kategori === "PENDAPATAN") {
      revenueMap.set(tx.entityId, (revenueMap.get(tx.entityId) ?? 0) + amt);
    } else if (tx.coaAccount?.kategori === "BEBAN") {
      spendMap.set(tx.entityId, (spendMap.get(tx.entityId) ?? 0) + amt);
    }
  }

  return entities.map((e) => {
    const revenue = revenueMap.get(e.id) ?? 0;
    const spend = spendMap.get(e.id) ?? 0;
    return {
      id: e.id,
      key: e.key,
      name: e.name,
      legalName: e.legalName,
      colorHex: e.colorHex,
      isUmum: e.isUmum,
      revenue,
      spend,
      profit: revenue - spend,
      projects: e.projects.map((p) => ({
        code: p.code,
        name: p.name,
        contractValue: Number(p.contractValue),
        spend: Number(p.spend),
        profit: Number(p.contractValue) - Number(p.spend),
        termin: p.termin.map((t) => ({ name: t.name, percentage: t.percentage, status: t.status })),
      })),
    };
  });
}

export async function getRecentNotifications(role: Role) {
  return prisma.notifikasi.findMany({
    where: { targetRole: role },
    orderBy: { createdAt: "desc" },
    take: 4,
  });
}

export async function getUnreadNotificationCount(role: Role) {
  return prisma.notifikasi.count({ where: { targetRole: role, read: false } });
}

export async function getGrupPiutangMetrics() {
  const terminPerluPerhatian = await prisma.termin.count({
    where: { status: { in: ["AT_RISK", "NEEDS_AUDIT"] } },
  });

  // Total piutang belum tertagih = contractValue - spend untuk proyek yang ada termin bermasalah
  const projekBermasalah = await prisma.project.findMany({
    where: { termin: { some: { status: { in: ["AT_RISK", "NEEDS_AUDIT"] } } } },
    select: { contractValue: true, spend: true },
  });
  const totalPiutangBelumTertagih = projekBermasalah.reduce(
    (s, p) => s + Math.max(0, Number(p.contractValue) - Number(p.spend)),
    0
  );

  return { terminPerluPerhatian, totalPiutangBelumTertagih };
}

const BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

export async function getMonthlyChartData(entityKeys: string[], year: number) {
  const start = new Date(`${year}-01-01`);
  const end = new Date(`${year + 1}-01-01`);

  const rows = await prisma.transaction.findMany({
    where: {
      entity: { key: { in: entityKeys } },
      tanggal: { gte: start, lt: end },
      coaAccount: { kategori: "PENDAPATAN" },
    },
    select: {
      tanggal: true,
      kredit: true,
      entity: { select: { key: true } },
    },
  });

  return BULAN.map((month, i) => {
    const entry: Record<string, string | number> = { month };
    for (const key of entityKeys) {
      entry[key] = rows
        .filter((r) => r.entity.key === key && new Date(r.tanggal).getMonth() === i)
        .reduce((s, r) => s + Number(r.kredit), 0);
    }
    return entry;
  });
}

export function formatMiliar(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return sign + "Rp " + (abs / 1e9).toFixed(1).replace(".", ",") + " M";
  if (abs >= 1e6) return sign + "Rp " + (abs / 1e6).toFixed(1).replace(".", ",") + " JT";
  if (abs >= 1e3) return sign + "Rp " + (abs / 1e3).toFixed(1).replace(".", ",") + " rb";
  return formatRupiah(n);
}
