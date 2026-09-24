/**
 * Script untuk menghapus semua data transaksi keuangan dari database.
 * Data master (User, Entity, Project, COA, JenisInput) TIDAK dihapus.
 *
 * Jalankan dengan:
 *   DATABASE_URL="mysql://..." npx tsx prisma/reset-financial-data.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Menghapus data keuangan...");

  const [transactions, termin, loadingDock, notifikasi, activityLog] = await prisma.$transaction([
    prisma.transaction.deleteMany({}),
    prisma.termin.deleteMany({}),
    prisma.loadingDockTransaksi.deleteMany({}),
    prisma.notifikasi.deleteMany({}),
    prisma.activityLog.deleteMany({}),
  ]);

  console.log(`✓ Transaction    : ${transactions.count} dihapus`);
  console.log(`✓ Termin         : ${termin.count} dihapus`);
  console.log(`✓ LoadingDock    : ${loadingDock.count} dihapus`);
  console.log(`✓ Notifikasi     : ${notifikasi.count} dihapus`);
  console.log(`✓ ActivityLog    : ${activityLog.count} dihapus`);
  console.log("\nSelesai. Data master (User, Entity, Project, COA) tetap ada.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
