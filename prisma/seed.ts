import { PrismaClient, Role, UserStatus, TerminStatus, CoaKategori, NotifikasiType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // --- Entities ---
  const entityDefs = [
    { key: "gaharu", name: "Gaharu", legalName: "PT Gaharu Sempana Konstruksi", colorHex: "#3b6fed" },
    { key: "kencana", name: "Kencana", legalName: "PT Kencana Mitra Properti", colorHex: "#e0433f" },
    { key: "tataring", name: "Tataring", legalName: "PT Tataring Cipta Bangun", colorHex: "#1f9d55" },
    { key: "ciptaAsri", name: "Cipta Asri", legalName: "PT Cipta Asri Landscape", colorHex: "#8b5cf6" },
    { key: "umum", name: "Umum", legalName: "Ruang Transit Antar Entitas", colorHex: "#64748b", isUmum: true },
  ];

  const entities: Record<string, { id: string }> = {};
  for (const e of entityDefs) {
    entities[e.key] = await prisma.entity.upsert({
      where: { key: e.key },
      update: {},
      create: e,
    });
  }

  // --- Users (satu akun per role untuk mulai) ---
  const passwordHash = await bcrypt.hash("password123", 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@gaharusempana.com" },
    update: {},
    create: {
      name: "Nidio Ganteng",
      email: "superadmin@gaharusempana.com",
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      entityAccess: {
        create: entityDefs.map((e) => ({ entityId: entities[e.key].id })),
      },
    },
  });

  const manajer = await prisma.user.upsert({
    where: { email: "manajer@gaharusempana.com" },
    update: {},
    create: {
      name: "Siti Rahmawati",
      email: "manajer@gaharusempana.com",
      passwordHash,
      role: Role.MANAJER_KEUANGAN,
      status: UserStatus.ACTIVE,
      entityAccess: {
        create: entityDefs.map((e) => ({ entityId: entities[e.key].id })),
      },
    },
  });

  const staf = await prisma.user.upsert({
    where: { email: "staf@gaharusempana.com" },
    update: {},
    create: {
      name: "Rina Kartika",
      email: "staf@gaharusempana.com",
      passwordHash,
      role: Role.STAF_KEUANGAN,
      status: UserStatus.ACTIVE,
    },
  });
  // Sync entity access staf ke semua entitas (hapus lama, buat ulang)
  await prisma.userEntityAccess.deleteMany({ where: { userId: staf.id } });
  await prisma.userEntityAccess.createMany({
    data: entityDefs.map((e) => ({ userId: staf.id, entityId: entities[e.key].id })),
  });

  // --- Jenis Input bawaan sistem ---
  const jenisInputDefs = [
    { key: "kasKecil", nama: "Kas Kecil" },
    { key: "kasBesar", nama: "Kas Besar" },
    { key: "bankBuku", nama: "Bank Buku" },
  ];
  const jenisInput: Record<string, { id: string }> = {};
  for (const j of jenisInputDefs) {
    jenisInput[j.key] = await prisma.jenisInputTransaksi.upsert({
      where: { key: j.key },
      update: {},
      create: { key: j.key, nama: j.nama, active: true },
    });
  }

  // --- COA contoh ---
  const coaDefs = [
    { code: "4-001", name: "Penerimaan Termin", kategori: CoaKategori.PENDAPATAN },
    { code: "5-001", name: "Pembayaran Material", kategori: CoaKategori.BEBAN },
    { code: "5-002", name: "Biaya Operasional", kategori: CoaKategori.BEBAN },
  ];
  const coa: Record<string, { id: string }> = {};
  for (const c of coaDefs) {
    coa[c.code] = await prisma.coaAccount.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  // --- Contoh project & termin per entity ---
  const projectSeed = [
    { entityKey: "gaharu", code: "GHR-091", name: "Gudang Distribusi Cikarang", contractValue: 6.2e9, spend: 4.1e9, terminPct: 90 },
    { entityKey: "gaharu", code: "GHR-088", name: "Pabrik Komponen Bekasi", contractValue: 9.4e9, spend: 6.0e9, terminPct: 84 },
    { entityKey: "kencana", code: "KCN-041", name: "Ruko Kencana Blok C", contractValue: 3.1e9, spend: 1.9e9, terminPct: 84 },
    { entityKey: "tataring", code: "TTR-018", name: "Renovasi Kantor Tataring", contractValue: 1.8e9, spend: 1.1e9, terminPct: 45 },
    { entityKey: "ciptaAsri", code: "CAS-009", name: "Taman Cipta Asri Residence", contractValue: 2.4e9, spend: 1.3e9, terminPct: 30 },
  ];

  for (const p of projectSeed) {
    const project = await prisma.project.upsert({
      where: { code: p.code },
      update: {},
      create: {
        entityId: entities[p.entityKey].id,
        code: p.code,
        name: p.name,
        contractValue: p.contractValue,
        spend: p.spend,
      },
    });
    await prisma.termin.create({
      data: {
        projectId: project.id,
        name: p.name,
        percentage: p.terminPct,
        status: p.terminPct >= 80 ? TerminStatus.ON_TRACK : TerminStatus.AT_RISK,
      },
    });
  }

  // --- Contoh transaksi Kas Kecil untuk entity Gaharu (biar halaman Kas & Jurnal ada isinya) ---
  const gaharuProject = await prisma.project.findUnique({ where: { code: "GHR-091" } });
  const kasKecilSeed = [
    { tanggal: "2026-09-05", noBukti: "KK/09-001", keterangan: "Pembelian ATK proyek", coa: "5-002", debit: 0, kredit: 350_000, saldo: 4_650_000 },
    { tanggal: "2026-09-08", noBukti: "KK/09-002", keterangan: "Uang muka mandor harian", coa: "5-001", debit: 0, kredit: 1_200_000, saldo: 3_450_000 },
    { tanggal: "2026-09-10", noBukti: "KK/09-003", keterangan: "Pengisian kembali kas kecil", coa: "4-001", debit: 5_000_000, kredit: 0, saldo: 8_450_000 },
  ];
  for (const t of kasKecilSeed) {
    await prisma.transaction.create({
      data: {
        entityId: entities["gaharu"].id,
        jenisInputId: jenisInput["kasKecil"].id,
        tanggal: new Date(t.tanggal),
        noBukti: t.noBukti,
        keterangan: t.keterangan,
        projectId: gaharuProject?.id,
        coaAccountId: coa[t.coa].id,
        debit: t.debit,
        kredit: t.kredit,
        saldoSetelah: t.saldo,
        staffId: staf.id,
      },
    });
  }

  // --- Contoh notifikasi ---
  await prisma.notifikasi.createMany({
    data: [
      {
        type: NotifikasiType.TERMIN_BARU,
        targetRole: Role.SUPER_ADMIN,
        text: "Staf Rina Kartika menginput termin baru — Proyek Gudang Cikarang",
        read: false,
      },
      {
        type: NotifikasiType.PROGRES_80,
        targetRole: Role.SUPER_ADMIN,
        text: "Progres termin Proyek Ruko Kencana Blok C telah melewati 80%",
        read: false,
      },
      {
        type: NotifikasiType.PENDAFTARAN,
        targetRole: Role.MANAJER_KEUANGAN,
        text: "Pendaftaran akun baru dari Budi Santoso menunggu persetujuan",
        read: false,
      },
      {
        type: NotifikasiType.TERMIN_AUDIT,
        targetRole: Role.MANAJER_KEUANGAN,
        text: "Termin Proyek Gudang Distribusi Cikarang baru diinput oleh Staf, perlu diaudit",
        read: false,
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seed selesai. Akun contoh (password semua: password123):");
  console.log("- superadmin@gaharusempana.com (Super Admin)");
  console.log("- manajer@gaharusempana.com (Manajer Keuangan)");
  console.log("- staf@gaharusempana.com (Staf Keuangan)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
