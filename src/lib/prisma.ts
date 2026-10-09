import { PrismaClient } from "@prisma/client";

// Mencegah banyak instance PrismaClient saat hot-reload di development,
// tapi otomatis re-instantiate jika ada schema update baru.
const globalForPrisma = global as unknown as { prisma?: PrismaClient; _prismaVersion?: string };

const PRISMA_SCHEMA_VERSION = "2026-10-09-faktur-id-v2";

if (globalForPrisma._prismaVersion !== PRISMA_SCHEMA_VERSION) {
  if (globalForPrisma.prisma) {
    try {
      globalForPrisma.prisma.$disconnect?.();
    } catch {
      // ignore
    }
    delete globalForPrisma.prisma;
  }
  globalForPrisma._prismaVersion = PRISMA_SCHEMA_VERSION;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
