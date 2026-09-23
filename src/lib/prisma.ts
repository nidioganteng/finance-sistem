import { PrismaClient } from "@prisma/client";

// Mencegah banyak instance PrismaClient saat hot-reload di development.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// Jika instance Prisma yang di-cache belum memuat model baru (AsetTetap), refresh instance
if (!globalForPrisma.prisma || !("asetTetap" in (globalForPrisma.prisma as any))) {
  globalForPrisma.prisma = new PrismaClient();
}

export const prisma = globalForPrisma.prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
