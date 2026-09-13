import { prisma } from "./prisma";
import { Role } from "@prisma/client";

export function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export async function getAccessibleEntities(entityKeys: string[]) {
  const entities = await prisma.entity.findMany({
    where: { key: { in: entityKeys } },
    include: {
      projects: { include: { termin: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Revenue & spend dihitung langsung dari data project asli, bukan angka
  // terpisah seperti di mockup, supaya nggak ada dua sumber data yang bisa beda.
  return entities.map((e) => {
    const revenue = e.projects.reduce((sum, p) => sum + Number(p.contractValue), 0);
    const spend = e.projects.reduce((sum, p) => sum + Number(p.spend), 0);
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
