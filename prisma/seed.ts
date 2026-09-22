import { PrismaClient, Role, UserStatus, CoaKategori, ReportType } from "@prisma/client";
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

  type CoaMasterDef = { code: string; name: string; kategori: CoaKategori };
  const A = CoaKategori.ASET;
  const P = CoaKategori.PENDAPATAN;
  const B = CoaKategori.BEBAN;
  const K = CoaKategori.KEWAJIBAN;
  const M = CoaKategori.MODAL;

  // Satu sumber data dipakai untuk scope KAS & BANK sekaligus (issue #28) —
  // sebelumnya coaKas/coaBank dua array terpisah yang bisa drift (kode sama
  // berujung nama beda antar scope, itu yang bikin bingung "duplikat").
  const coaMaster: CoaMasterDef[] = [
    { code: "100",  name: "AKTIVA",                      kategori: A },
    { code: "1001", name: "Akm Penyusutan",              kategori: A },
    { code: "110",  name: "Kas KAK",                     kategori: A },
    { code: "120",  name: "Kas GS",                      kategori: A },
    { code: "130",  name: "Kas TB",                      kategori: A },
    { code: "140",  name: "Kas CAD",                     kategori: A },
    { code: "1100", name: "Kas Kecil KAK",               kategori: A },
    { code: "1200", name: "Kas Kecil GS",                kategori: A },
    { code: "1300", name: "Kas Kecil TB",                kategori: A },
    { code: "1400", name: "Kas Kecil CAD",               kategori: A },
    { code: "1500", name: "Kas Kecil KP",                kategori: A },
    { code: "11",   name: "BRI KAK",                     kategori: A },
    { code: "12",   name: "BPD KAK",                     kategori: A },
    { code: "13",   name: "BNI KAK",                     kategori: A },
    { code: "14",   name: "MDR KAK",                     kategori: A },
    { code: "21",   name: "BRI GS",                      kategori: A },
    { code: "22",   name: "BPD GS",                      kategori: A },
    { code: "23",   name: "BNI GS",                      kategori: A },
    { code: "24",   name: "MDR GS",                      kategori: A },
    { code: "31",   name: "BPD TB",                      kategori: A },
    { code: "32",   name: "BNI TB",                      kategori: A },
    { code: "41",   name: "BPD CAD",                     kategori: A },
    { code: "51",   name: "BPD KP",                      kategori: A },
    { code: "111",  name: "PIUTANG KAK",                 kategori: A },
    { code: "112",  name: "PIUTANG GS",                  kategori: A },
    { code: "113",  name: "PIUTANG TB",                  kategori: A },
    { code: "114",  name: "PIUTANG CAD",                 kategori: A },
    { code: "115",  name: "PIUTANG KP",                  kategori: A },
    { code: "116",  name: "PIUTANG USAHA",               kategori: A },
    { code: "117",  name: "Piutang PS",                  kategori: A },
    { code: "118",  name: "PIUTANG LAINNYA",             kategori: A },
    { code: "200",  name: "Titipan Lain-lain",           kategori: K },
    { code: "210",  name: "Cadangan CKPN",                kategori: A },
    { code: "220",  name: "Utang Imbalan Pasca Kerja",   kategori: K },
    { code: "301",  name: "Hutang Pajak",                kategori: K },
    { code: "311",  name: "Hutang KAK",                  kategori: K },
    { code: "312",  name: "Hutang GS",                   kategori: K },
    { code: "313",  name: "Hutang TB",                   kategori: K },
    { code: "314",  name: "Hutang CAD",                  kategori: K },
    { code: "315",  name: "Hutang KP",                   kategori: K },
    { code: "310",  name: "Laba Ditahan",                kategori: M },
    { code: "320",  name: "Modal",                       kategori: M },
    { code: "400",  name: "PENDAPATAN",                  kategori: P },
    { code: "410",  name: "Pendapatan Jasa Giro",        kategori: P },
    { code: "511",  name: "Gaji",                        kategori: B },
    { code: "512",  name: "By Penyusutan",               kategori: B },
    { code: "513",  name: "Beban Listrik",               kategori: B },
    { code: "514",  name: "Beban Telepon",               kategori: B },
    { code: "515",  name: "Beban PDAM",                  kategori: B },
    { code: "516",  name: "BPJS Kesehatan",              kategori: B },
    { code: "517",  name: "BPJS Ketenagakerjaan",        kategori: B },
    { code: "518",  name: "By Meterai",                  kategori: B },
    { code: "519",  name: "Pemeliharaan Aktiva",         kategori: B },
    { code: "520",  name: "By Samsat",                   kategori: B },
    { code: "522",  name: "Perlengkapan",                kategori: B },
    { code: "523",  name: "By Transport",                kategori: B },
    { code: "524",  name: "By Konsumsi",                 kategori: B },
    { code: "527",  name: "By Iuran",                    kategori: B },
    { code: "528",  name: "By Umum",                     kategori: B },
    { code: "529",  name: "By Upacara",                  kategori: B },
    { code: "530",  name: "By Lain",                     kategori: B },
    { code: "531",  name: "Prive",                       kategori: M },
    { code: "532",  name: "By. Adm & Pjk bank",          kategori: B },
    { code: "533",  name: "By. PPH 21",                  kategori: B },
    { code: "534",  name: "PPH Final Pasal 4 Ayat 2",    kategori: B },
    { code: "535",  name: "PPN",                         kategori: B },
    { code: "536",  name: "PPN Masukan",                 kategori: A },
    { code: "612",  name: "Gaji Tenaga Ahli",            kategori: B },
    { code: "613",  name: "By Pra Kontrak",              kategori: B },
    { code: "614",  name: "By Survey",                   kategori: B },
    { code: "615",  name: "By Perjalanan Dinas",         kategori: B },
    { code: "618",  name: "By BPJS dan Jaminan",         kategori: B },
    { code: "619",  name: "By Dokumentasi",              kategori: B },
    { code: "623",  name: "By Presentasi",               kategori: B },
    { code: "624",  name: "By Komunikasi",               kategori: B },
    { code: "625",  name: "By Taktis",                   kategori: B },
    { code: "626",  name: "By SKA",                      kategori: B },
    { code: "627",  name: "By Kontrak",                  kategori: B },
    { code: "628",  name: "By Marketing",                kategori: B },
    { code: "630",  name: "Biaya Lainnya",               kategori: B },
    { code: "632",  name: "By Akomodasi",                kategori: B },
    { code: "633",  name: "By Ijin Usaha",               kategori: B },
    { code: "634",  name: "By Imbalan Pasca Kerja",      kategori: B },
    { code: "635",  name: "By yang masih harus dibayar", kategori: K },
  ];

  // "Rumah Akun" (issue #28): ASET yang namanya kas/bank masuk Arus Kas,
  // ASET lainnya (piutang, proyek, aktiva tetap) cuma masuk Neraca.
  function deriveReportType(kategori: CoaKategori, name: string): ReportType {
    if (kategori === CoaKategori.PENDAPATAN || kategori === CoaKategori.BEBAN) return ReportType.LABA_RUGI;
    if (kategori === CoaKategori.ASET && /kas|bank|bri|bpd|bni|mdr/i.test(name)) return ReportType.ARUS_KAS;
    return ReportType.NERACA;
  }

  for (const scope of ["KAS", "BANK"]) {
    for (const c of coaMaster) {
      const reportType = deriveReportType(c.kategori, c.name);
      await prisma.coaAccount.upsert({
        where: { code_scope: { code: c.code, scope } },
        update: { name: c.name, kategori: c.kategori, reportType },
        create: { code: c.code, name: c.name, kategori: c.kategori, scope, reportType },
      });
    }
  }

  console.log("✅ Seed selesai. Entitas, user, jenis input, dan COA sudah siap.");
  console.log("   " + coaMaster.length + " akun × 2 scope (KAS & BANK) = " + coaMaster.length * 2 + " baris COA");
  console.log("");
  console.log("Akun (password: password123):");
  console.log("  superadmin@gaharusempana.com  →  Super Admin");
  console.log("  manajer@gaharusempana.com     →  Manajer Keuangan");
  console.log("  staf@gaharusempana.com        →  Staf Keuangan");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
