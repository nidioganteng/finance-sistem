import { PrismaClient, Role, UserStatus, CoaKategori } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.transaction.deleteMany({});
  await prisma.notifikasi.deleteMany({});
  await prisma.termin.deleteMany({});

  // ── Entities ────────────────────────────────────────────────────
  const entityDefs = [
    { key: "gaharu",    name: "Gaharu",     legalName: "PT Gaharu Sempana Konstruksi", colorHex: "#3b6fed" },
    { key: "kencana",   name: "Kencana",    legalName: "PT Kencana Mitra Properti",    colorHex: "#e0433f" },
    { key: "tataring",  name: "Tataring",   legalName: "PT Tataring Cipta Bangun",     colorHex: "#1f9d55" },
    { key: "ciptaAsri", name: "Cipta Asri", legalName: "PT Cipta Asri Landscape",      colorHex: "#8b5cf6", isUmum: false },
    { key: "umum",      name: "Umum",       legalName: "Ruang Transit Antar Entitas",  colorHex: "#64748b", isUmum: true },
  ];
  const entities: Record<string, { id: string }> = {};
  for (const e of entityDefs) {
    entities[e.key] = await prisma.entity.upsert({ where: { key: e.key }, update: {}, create: e });
  }

  // ── Users ────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "superadmin@gaharusempana.com" },
    update: {},
    create: {
      name: "Nidio Ganteng",
      email: "superadmin@gaharusempana.com",
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      entityAccess: { create: entityDefs.map((e) => ({ entityId: entities[e.key].id })) },
    },
  });

  await prisma.user.upsert({
    where: { email: "manajer@gaharusempana.com" },
    update: {},
    create: {
      name: "Siti Rahmawati",
      email: "manajer@gaharusempana.com",
      passwordHash,
      role: Role.MANAJER_KEUANGAN,
      status: UserStatus.ACTIVE,
      entityAccess: { create: entityDefs.map((e) => ({ entityId: entities[e.key].id })) },
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
  await prisma.userEntityAccess.deleteMany({ where: { userId: staf.id } });
  await prisma.userEntityAccess.createMany({
    data: entityDefs.map((e) => ({ userId: staf.id, entityId: entities[e.key].id })),
  });

  // ── Jenis Input ──────────────────────────────────────────────────
  for (const j of [
    { key: "kasKecil", nama: "Kas Kecil" },
    { key: "kasBesar", nama: "Kas Besar" },
    { key: "bankBuku", nama: "Bank Buku" },
  ]) {
    await prisma.jenisInputTransaksi.upsert({
      where: { key: j.key }, update: {}, create: { key: j.key, nama: j.nama, active: true },
    });
  }

  // ── COA ──────────────────────────────────────────────────────────
  await prisma.coaAccount.deleteMany({});

  type CoaDef = { code: string; name: string; kategori: CoaKategori; scope: string };
  const A = CoaKategori.ASET;
  const P = CoaKategori.PENDAPATAN;
  const B = CoaKategori.BEBAN;
  const K = CoaKategori.KEWAJIBAN;
  const M = CoaKategori.MODAL;

  const coaKas: CoaDef[] = [
    { code: "11",   name: "BRI KAK",                     kategori: A, scope: "KAS" },
    { code: "12",   name: "BPD KAK",                     kategori: A, scope: "KAS" },
    { code: "13",   name: "BNI KAK",                     kategori: A, scope: "KAS" },
    { code: "14",   name: "MDR KAK",                     kategori: A, scope: "KAS" },
    { code: "21",   name: "BRI GS",                      kategori: A, scope: "KAS" },
    { code: "22",   name: "BPD GS",                      kategori: A, scope: "KAS" },
    { code: "23",   name: "BNI GS",                      kategori: A, scope: "KAS" },
    { code: "24",   name: "MDR GS",                      kategori: A, scope: "KAS" },
    { code: "31",   name: "BPD TB",                      kategori: A, scope: "KAS" },
    { code: "41",   name: "BPD CAD",                     kategori: A, scope: "KAS" },
    { code: "51",   name: "BPD KP",                      kategori: A, scope: "KAS" },
    { code: "100",  name: "AKTIVA",                      kategori: A, scope: "KAS" },
    { code: "110",  name: "Kas KAK",                     kategori: A, scope: "KAS" },
    { code: "111",  name: "PIUTANG GS",                  kategori: A, scope: "KAS" },
    { code: "112",  name: "PIUTANG KAK",                 kategori: A, scope: "KAS" },
    { code: "113",  name: "PIUTANG CAD",                 kategori: A, scope: "KAS" },
    { code: "114",  name: "PIUTANG KP",                  kategori: A, scope: "KAS" },
    { code: "115",  name: "PIUTANG LAINNYA",             kategori: A, scope: "KAS" },
    { code: "120",  name: "Kas GS",                      kategori: A, scope: "KAS" },
    { code: "130",  name: "Kas TB",                      kategori: A, scope: "KAS" },
    { code: "140",  name: "Kas CAD",                     kategori: A, scope: "KAS" },
    { code: "210",  name: "Bank KAK",                    kategori: A, scope: "KAS" },
    { code: "220",  name: "Bank GS",                     kategori: A, scope: "KAS" },
    { code: "230",  name: "Bank TB",                     kategori: A, scope: "KAS" },
    { code: "240",  name: "Bank CAD",                    kategori: A, scope: "KAS" },
    { code: "250",  name: "Bank Kardi",                  kategori: A, scope: "KAS" },
    { code: "310",  name: "Proyek KAK",                  kategori: A, scope: "KAS" },
    { code: "320",  name: "Proyek GS",                   kategori: A, scope: "KAS" },
    { code: "330",  name: "Proyek TB",                   kategori: A, scope: "KAS" },
    { code: "340",  name: "Proyek CAD",                  kategori: A, scope: "KAS" },
    { code: "350",  name: "Proyek Lainnya",              kategori: A, scope: "KAS" },
    { code: "400",  name: "PENDAPATAN",                  kategori: P, scope: "KAS" },
    { code: "410",  name: "BUNGA BANK",                  kategori: P, scope: "KAS" },
    { code: "420",  name: "ADM & PJK",                   kategori: B, scope: "KAS" },
    { code: "500",  name: "BIAYA UMUM",                  kategori: B, scope: "KAS" },
    { code: "510",  name: "KAS KECIL",                   kategori: B, scope: "KAS" },
    { code: "511",  name: "Gaji",                        kategori: B, scope: "KAS" },
    { code: "512",  name: "Gaji Freelance",              kategori: B, scope: "KAS" },
    { code: "513",  name: "Beban Listrik",               kategori: B, scope: "KAS" },
    { code: "514",  name: "Beban Telepon",               kategori: B, scope: "KAS" },
    { code: "515",  name: "Beban PDAM",                  kategori: B, scope: "KAS" },
    { code: "516",  name: "BPJS Kesehatan",              kategori: B, scope: "KAS" },
    { code: "517",  name: "BPJS Ketenagakerjaan",        kategori: B, scope: "KAS" },
    { code: "518",  name: "Materai",                     kategori: B, scope: "KAS" },
    { code: "519",  name: "Pemeliharaan Aktiva",         kategori: B, scope: "KAS" },
    { code: "520",  name: "By Samsat",                   kategori: B, scope: "KAS" },
    { code: "522",  name: "Perlengkapan",                kategori: B, scope: "KAS" },
    { code: "523",  name: "By Transport",                kategori: B, scope: "KAS" },
    { code: "524",  name: "By Konsumsi",                 kategori: B, scope: "KAS" },
    { code: "525",  name: "By Fotocopy",                 kategori: B, scope: "KAS" },
    { code: "526",  name: "By SKA",                      kategori: B, scope: "KAS" },
    { code: "527",  name: "By Iuran",                    kategori: B, scope: "KAS" },
    { code: "528",  name: "By Umum",                     kategori: B, scope: "KAS" },
    { code: "529",  name: "By Upacara",                  kategori: B, scope: "KAS" },
    { code: "530",  name: 'By Lain"',                    kategori: B, scope: "KAS" },
    { code: "531",  name: "Prive",                       kategori: M, scope: "KAS" },
    { code: "532",  name: "By. Adm & Pjk bank",         kategori: B, scope: "KAS" },
    { code: "533",  name: "By. PPH 21",                  kategori: B, scope: "KAS" },
    { code: "534",  name: "PPH Final Pasal 4 Ayat 2",   kategori: B, scope: "KAS" },
    { code: "535",  name: "PPN",                         kategori: B, scope: "KAS" },
    { code: "600",  name: "BIAYA PROYEK",                kategori: B, scope: "KAS" },
    { code: "611",  name: "Gaji",                        kategori: B, scope: "KAS" },
    { code: "612",  name: "Gaji Tenaga Ahli",            kategori: B, scope: "KAS" },
    { code: "613",  name: "By Pra Kontrak",              kategori: B, scope: "KAS" },
    { code: "614",  name: "By Survey",                   kategori: B, scope: "KAS" },
    { code: "615",  name: "By Perjalanan Dinas",         kategori: B, scope: "KAS" },
    { code: "616",  name: "PPH",                         kategori: B, scope: "KAS" },
    { code: "617",  name: "PPN",                         kategori: B, scope: "KAS" },
    { code: "618",  name: "By BPJS dan Jaminan",         kategori: B, scope: "KAS" },
    { code: "619",  name: "By Dokumentasi",              kategori: B, scope: "KAS" },
    { code: "620",  name: "By Transportasi",             kategori: B, scope: "KAS" },
    { code: "622",  name: "Perlengkapan",                kategori: B, scope: "KAS" },
    { code: "623",  name: "By Presentasi",               kategori: B, scope: "KAS" },
    { code: "624",  name: "By Komunikasi",               kategori: B, scope: "KAS" },
    { code: "625",  name: "By Taktis",                   kategori: B, scope: "KAS" },
    { code: "626",  name: "By SKA",                      kategori: B, scope: "KAS" },
    { code: "627",  name: "By Kontrak",                  kategori: B, scope: "KAS" },
    { code: "630",  name: "Biaya Lainnya",               kategori: B, scope: "KAS" },
    { code: "631",  name: "Prive",                       kategori: M, scope: "KAS" },
    { code: "632",  name: "By Akomodasi",                kategori: B, scope: "KAS" },
    { code: "633",  name: "By Ijin Usaha",               kategori: B, scope: "KAS" },
    { code: "635",  name: "By yang masih harus dibayar", kategori: K, scope: "KAS" },
    { code: "700",  name: "KAS BAPAK",                   kategori: M, scope: "KAS" },
    { code: "800",  name: "Aktiva",                      kategori: A, scope: "KAS" },
    { code: "1100", name: "Kas Kecil KAK",               kategori: A, scope: "KAS" },
    { code: "1200", name: "Kas Kecil GS",                kategori: A, scope: "KAS" },
    { code: "1300", name: "Kas Kecil TB",                kategori: A, scope: "KAS" },
    { code: "1400", name: "Kas Kecil CAD",               kategori: A, scope: "KAS" },
    { code: "1500", name: "Kas Kecil KP",                kategori: A, scope: "KAS" },
    { code: "2100", name: "Pengembalian PS",             kategori: K, scope: "KAS" },
  ];

  const coaBank: CoaDef[] = [
    { code: "11",   name: "BRI KAK",                     kategori: A, scope: "BANK" },
    { code: "12",   name: "BPD KAK",                     kategori: A, scope: "BANK" },
    { code: "13",   name: "BNI KAK",                     kategori: A, scope: "BANK" },
    { code: "14",   name: "MDR KAK",                     kategori: A, scope: "BANK" },
    { code: "21",   name: "BRI GS",                      kategori: A, scope: "BANK" },
    { code: "22",   name: "BPD GS",                      kategori: A, scope: "BANK" },
    { code: "23",   name: "BNI GS",                      kategori: A, scope: "BANK" },
    { code: "24",   name: "MDR GS",                      kategori: A, scope: "BANK" },
    { code: "31",   name: "BPD TB",                      kategori: A, scope: "BANK" },
    { code: "32",   name: "BNI TB",                      kategori: A, scope: "BANK" },
    { code: "41",   name: "BPD CAD",                     kategori: A, scope: "BANK" },
    { code: "51",   name: "BPD KP",                      kategori: A, scope: "BANK" },
    { code: "100",  name: "AKTIVA",                      kategori: A, scope: "BANK" },
    { code: "110",  name: "Kas KAK",                     kategori: A, scope: "BANK" },
    { code: "111",  name: "PIUTANG KAK",                 kategori: A, scope: "BANK" },
    { code: "112",  name: "PIUTANG GS",                  kategori: A, scope: "BANK" },
    { code: "113",  name: "PIUTANG TB",                  kategori: A, scope: "BANK" },
    { code: "114",  name: "PIUTANG CAD",                 kategori: A, scope: "BANK" },
    { code: "115",  name: "PIUTANG KP",                  kategori: A, scope: "BANK" },
    { code: "116",  name: "PIUTANG LAINNYA",             kategori: A, scope: "BANK" },
    { code: "117",  name: "Piutang Usaha",               kategori: A, scope: "BANK" },
    { code: "118",  name: "Piutang PS",                  kategori: A, scope: "BANK" },
    { code: "120",  name: "Kas GS",                      kategori: A, scope: "BANK" },
    { code: "130",  name: "Kas TB",                      kategori: A, scope: "BANK" },
    { code: "140",  name: "Kas CAD",                     kategori: A, scope: "BANK" },
    { code: "200",  name: "Titipan Lain-lain",           kategori: K, scope: "BANK" },
    { code: "300",  name: "Hutang Pada Grup",            kategori: K, scope: "BANK" },
    { code: "400",  name: "PENDAPATAN",                  kategori: P, scope: "BANK" },
    { code: "410",  name: "Pendapatan Jasa Giro",        kategori: P, scope: "BANK" },
    { code: "411",  name: "Pendapatan Bunga Piutang",    kategori: P, scope: "BANK" },
    { code: "511",  name: "Gaji",                        kategori: B, scope: "BANK" },
    { code: "512",  name: "Gaji Freelance",              kategori: B, scope: "BANK" },
    { code: "513",  name: "Beban Listrik",               kategori: B, scope: "BANK" },
    { code: "514",  name: "Beban Telepon",               kategori: B, scope: "BANK" },
    { code: "515",  name: "Beban PDAM",                  kategori: B, scope: "BANK" },
    { code: "516",  name: "BPJS Kesehatan",              kategori: B, scope: "BANK" },
    { code: "517",  name: "BPJS Ketenagakerjaan",        kategori: B, scope: "BANK" },
    { code: "518",  name: "By Meterai",                  kategori: B, scope: "BANK" },
    { code: "519",  name: "Pemeliharaan Aktiva",         kategori: B, scope: "BANK" },
    { code: "520",  name: "By Samsat",                   kategori: B, scope: "BANK" },
    { code: "522",  name: "Perlengkapan",                kategori: B, scope: "BANK" },
    { code: "523",  name: "By Transport",                kategori: B, scope: "BANK" },
    { code: "524",  name: "By Konsumsi",                 kategori: B, scope: "BANK" },
    { code: "527",  name: "By Iuran",                    kategori: B, scope: "BANK" },
    { code: "528",  name: "By Umum",                     kategori: B, scope: "BANK" },
    { code: "529",  name: "By Upacara",                  kategori: B, scope: "BANK" },
    { code: "530",  name: 'By Lain"',                    kategori: B, scope: "BANK" },
    { code: "531",  name: "Prive",                       kategori: M, scope: "BANK" },
    { code: "532",  name: "By. Adm & Pjk bank",         kategori: B, scope: "BANK" },
    { code: "533",  name: "By. PPH 21",                  kategori: B, scope: "BANK" },
    { code: "534",  name: "PPH Final Pasal 4 Ayat 2",   kategori: B, scope: "BANK" },
    { code: "535",  name: "PPN",                         kategori: B, scope: "BANK" },
    { code: "536",  name: "PPN Masukan",                 kategori: A, scope: "BANK" },
    { code: "600",  name: "BIAYA PROYEK",                kategori: B, scope: "BANK" },
    { code: "611",  name: "Gaji Direktur",               kategori: B, scope: "BANK" },
    { code: "612",  name: "Gaji Tenaga Ahli",            kategori: B, scope: "BANK" },
    { code: "613",  name: "By Pra Kontrak",              kategori: B, scope: "BANK" },
    { code: "614",  name: "By Survey",                   kategori: B, scope: "BANK" },
    { code: "615",  name: "By Perjalanan Dinas",         kategori: B, scope: "BANK" },
    { code: "618",  name: "By BPJS dan Jaminan",         kategori: B, scope: "BANK" },
    { code: "619",  name: "By Dokumentasi",              kategori: B, scope: "BANK" },
    { code: "623",  name: "By Presentasi",               kategori: B, scope: "BANK" },
    { code: "624",  name: "By Komunikasi",               kategori: B, scope: "BANK" },
    { code: "625",  name: "By Taktis",                   kategori: B, scope: "BANK" },
    { code: "626",  name: "By SKA",                      kategori: B, scope: "BANK" },
    { code: "627",  name: "By Kontrak",                  kategori: B, scope: "BANK" },
    { code: "630",  name: "Biaya Lainnya",               kategori: B, scope: "BANK" },
    { code: "631",  name: "Prive",                       kategori: M, scope: "BANK" },
    { code: "632",  name: "By Akomodasi",                kategori: B, scope: "BANK" },
    { code: "633",  name: "By Ijin Usaha",               kategori: B, scope: "BANK" },
    { code: "635",  name: "By yang masih harus dibayar", kategori: K, scope: "BANK" },
    { code: "1000", name: "Aktiva (TBH)",                kategori: A, scope: "BANK" },
    { code: "1100", name: "Kas Kecil KAK",               kategori: A, scope: "BANK" },
    { code: "1200", name: "Kas Kecil GS",                kategori: A, scope: "BANK" },
    { code: "1300", name: "Kas Kecil TB",                kategori: A, scope: "BANK" },
    { code: "1400", name: "Kas Kecil CAD",               kategori: A, scope: "BANK" },
    { code: "1500", name: "Kas Kecil KP",                kategori: A, scope: "BANK" },
  ];

  for (const c of [...coaKas, ...coaBank]) {
    await prisma.coaAccount.upsert({
      where: { code_scope: { code: c.code, scope: c.scope } },
      update: { name: c.name, kategori: c.kategori },
      create: c,
    });
  }

  console.log("✅ Seed selesai. Entitas, user, jenis input, dan COA sudah siap.");
  console.log("   KAS: " + coaKas.length + " akun | BANK: " + coaBank.length + " akun");
  console.log("");
  console.log("Akun (password: password123):");
  console.log("  superadmin@gaharusempana.com  →  Super Admin");
  console.log("  manajer@gaharusempana.com     →  Manajer Keuangan");
  console.log("  staf@gaharusempana.com        →  Staf Keuangan");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
