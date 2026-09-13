import { prisma } from "./prisma";

export async function getJenisInputList() {
  return prisma.jenisInputTransaksi.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}
