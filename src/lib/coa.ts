import { prisma } from "./prisma";

export async function getCOAList() {
  return prisma.coaAccount.findMany({ orderBy: { code: "asc" } });
}
