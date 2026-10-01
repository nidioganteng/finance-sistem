import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const entities = await prisma.entity.findMany();
  const entityMap = Object.fromEntries(entities.map((e) => [e.key, e.id]));

  if (!entityMap.gaharu) {
    console.error("Entitas belum tersedia di database. Jalankan 'npm run prisma:seed' terlebih dahulu.");
    process.exit(1);
  }

  const sampleProjects = [
    { entityId: entityMap.gaharu, code: "GHR-001", name: "Pembangunan Gedung RSUD Doris Sylvanus", contractValue: 1250000000 },
    { entityId: entityMap.gaharu, code: "GHR-002", name: "Perencanaan Jembatan Sei Kahayan Tahap 2", contractValue: 480000000 },
    { entityId: entityMap.gaharu, code: "GHR-003", name: "Pengawasan Pembangunan Saluran Drainase Kota", contractValue: 320000000 },
    { entityId: entityMap.gaharu, code: "GHR-004", name: "Renovasi Gedung Bappeda Prov. Kalteng", contractValue: 750000000 },
    { entityId: entityMap.gaharu, code: "GHR-005", name: "Pengawasan Pembangunan Puskesmas Pahandut", contractValue: 280000000 },
    { entityId: entityMap.gaharu, code: "GHR-006", name: "Perencanaan Laboratorium Kesehatan Dinkes", contractValue: 390000000 },
    { entityId: entityMap.gaharu, code: "GHR-007", name: "Pengawasan Konstruksi Jalan Akses Pelabuhan", contractValue: 620000000 },
    { entityId: entityMap.gaharu, code: "GHR-008", name: "Perencanaan Gedung Arsip Daerah", contractValue: 450000000 },
    { entityId: entityMap.gaharu, code: "GHR-009", name: "Pengawasan Rehabilitasi Jaringan Irigasi Primer", contractValue: 540000000 },
    { entityId: entityMap.gaharu, code: "GHR-010", name: "Perencanaan Ruang Terbuka Hijau Bundaran Besar", contractValue: 880000000 },
    { entityId: entityMap.kencana, code: "KAK-001", name: "Perencanaan Perumahan Griya Kencana Asri", contractValue: 650000000 },
    { entityId: entityMap.kencana, code: "KAK-002", name: "Pembangunan Ruko Komersial Sentra Niaga", contractValue: 1100000000 },
    { entityId: entityMap.kencana, code: "KAK-003", name: "Pengawasan Kawasan Hunian Mandiri", contractValue: 420000000 },
    { entityId: entityMap.tataring, code: "TB-001", name: "Perencanaan Gedung Serbaguna Tataring", contractValue: 520000000 },
    { entityId: entityMap.tataring, code: "TB-002", name: "Pengawasan Konstruksi Baja Pabrik", contractValue: 780000000 },
    { entityId: entityMap.ciptaAsri, code: "CAD-001", name: "Landscape Taman Kota Palangka Raya", contractValue: 350000000 },
  ];

  console.log("Seeding master proyek dummy...");
  for (const p of sampleProjects) {
    if (!p.entityId) continue;
    await prisma.project.upsert({
      where: { code: p.code },
      update: { name: p.name, contractValue: p.contractValue, entityId: p.entityId, status: "ACTIVE" },
      create: {
        code: p.code,
        name: p.name,
        contractValue: p.contractValue,
        spend: 0,
        deadline: new Date("2026-12-31"),
        status: "ACTIVE",
        entityId: p.entityId,
      },
    });
  }

  const count = await prisma.project.count();
  console.log(`✅ Berhasil menambahkan ${count} kode proyek aktif ke database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
