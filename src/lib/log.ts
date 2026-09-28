import { prisma } from "./prisma";

export async function getActivityLogs(category?: "USER_ACTIVITY" | "FINANCIAL_CHANGE") {
  return prisma.activityLog.findMany({
    where: {
      ...(category ? { category } : {}),
      NOT: [
        { action: { startsWith: "Buka " } },
        { action: { startsWith: "Lihat " } },
        { action: { startsWith: "Navigasi " } },
      ],
    },
    include: { actor: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
