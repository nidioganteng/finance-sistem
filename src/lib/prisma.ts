import { PrismaClient } from "@prisma/client";

// Mencegah banyak instance PrismaClient saat hot-reload di development,
// tapi otomatis re-instantiate jika ada model baru seperti fakturPendapatan.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma && "fakturPendapatan" in globalForPrisma.prisma
    ? globalForPrisma.prisma
    : new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
