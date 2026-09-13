import { prisma } from "./prisma";

export async function getUserList() {
  return prisma.user.findMany({
    include: {
      entityAccess: { include: { entity: { select: { id: true, name: true, key: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllEntities() {
  return prisma.entity.findMany({ orderBy: { name: "asc" } });
}
