import { PrismaClient, Role, UserStatus, TerminStatus, CoaKategori, NotifikasiType, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function buatTransaksi(params: {
  entityId: string;
  jenisInputId: string;
  tanggal: string;
  noBukti: string;
  keterangan: string;
  arah: "masuk" | "keluar";
  rows: { coaId: string; nominal: number }[];
  saldoBefore: number;
  staffId: string;
  rekeningNama?: string;
  kasCoaId: string;
}): Promise<number> {
  const total = params.rows.reduce((s, r) => s + r.nominal, 0);
  const isKeluar = params.arah === "keluar";
  const newSaldo = params.saldoBefore + (isKeluar ? -total : total);

  const common = {
    entityId: params.entityId,
    jenisInputId: params.jenisInputId,
    tanggal: new Date(params.tanggal),
    noBukti: params.noBukti,
    keterangan: params.keterangan,
    saldoSetelah: newSaldo,
    staffId: params.staffId,
  };

  for (const row of params.rows) {
    await prisma.transaction.create({
      data: {
        ...common,
        coaAccountId: row.coaId,
        debit: isKeluar ? row.nominal : 0,
        kredit: isKeluar ? 0 : row.nominal,
      },
    });
  }

  await prisma.transaction.create({
    data: {
      ...common,
      coaAccountId: params.kasCoaId,
      debit: isKeluar ? 0 : total,
      kredit: isKeluar ? total : 0,
      extraFieldsJson: {
        isKasEntry: true,
        ...(params.rekeningNama ? { rekeningNama: params.rekeningNama } : {}),
      } as Prisma.InputJsonValue,
    },
  });

  return newSaldo;
}

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
  const jenisInputDefs = [
    { key: "kasKecil", nama: "Kas Kecil" },
    { key: "kasBesar", nama: "Kas Besar" },
    { key: "bankBuku", nama: "Bank Buku" },
  ];
  const ji: Record<string, { id: string }> = {};
  for (const j of jenisInputDefs) {
    ji[j.key] = await prisma.jenisInputTransaksi.upsert({
      where: { key: j.key }, update: {}, create: { key: j.key, nama: j.nama, active: true },
    });
  }

  // ── COA ──────────────────────────────────────────────────────────
  const coaDefs = [
    { code: "1-001", name: "Kas Kecil",               kategori: CoaKategori.ASET },
    { code: "1-002", name: "Kas Besar",               kategori: CoaKategori.ASET },
    { code: "1-101", name: "Bank BRI GS",             kategori: CoaKategori.ASET },
    { code: "1-102", name: "Bank BPD GS",             kategori: CoaKategori.ASET },
    { code: "1-201", name: "Bank BRI KAK",            kategori: CoaKategori.ASET },
    { code: "1-202", name: "Bank BPD KAK",            kategori: CoaKategori.ASET },
    { code: "1-301", name: "Bank BPD TB",             kategori: CoaKategori.ASET },
    { code: "1-401", name: "Bank BPD CAD",            kategori: CoaKategori.ASET },
    { code: "1-501", name: "Bank BPD KP",             kategori: CoaKategori.ASET },
    { code: "4-001", name: "Penerimaan Termin",       kategori: CoaKategori.PENDAPATAN },
    { code: "4-002", name: "Pendapatan Jasa Giro",    kategori: CoaKategori.PENDAPATAN },
    { code: "5-001", name: "Pembayaran Material",     kategori: CoaKategori.BEBAN },
    { code: "5-002", name: "Biaya Operasional",       kategori: CoaKategori.BEBAN },
    { code: "5-003", name: "Biaya Makan & Konsumsi",  kategori: CoaKategori.BEBAN },
    { code: "5-004", name: "Biaya ATK & Fotokopi",    kategori: CoaKategori.BEBAN },
    { code: "5-005", name: "Biaya Upah Harian",       kategori: CoaKategori.BEBAN },
    { code: "5-006", name: "Biaya Admin Bank",        kategori: CoaKategori.BEBAN },
  ];
  const coa: Record<string, { id: string }> = {};
  for (const c of coaDefs) {
    coa[c.code] = await prisma.coaAccount.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  // ── Projects & Termin ────────────────────────────────────────────
  // contractValue & spend sengaja dikalibrasi agar konsisten dengan transaksi:
  // - Dashboard (Manajer/Admin) pakai contractValue & spend langsung dari sini
  // - Laporan Keuangan (Staf) pakai transaksi aktual yang totalnya menyesuaikan
  // deadline sengaja dicampur: GHR-091/GHR-088/KCN-041 progres sudah >=80% (aman
  // apa pun deadline-nya). TTR-018 progres 45% & deadline SUDAH lewat → memicu
  // warning piutang. CAS-009 progres 30% tapi deadline BELUM lewat → tidak
  // memicu warning (progres rendah saja tidak cukup, harus juga sudah jatuh tempo).
  const projectSeed = [
    { entityKey: "gaharu",    code: "GHR-091", name: "Gudang Distribusi Cikarang",   contractValue: 12.4e12,  spend: 8.2e12,  terminPct: 90, deadline: "2026-12-15" },
    { entityKey: "gaharu",    code: "GHR-088", name: "Pabrik Komponen Bekasi",        contractValue: 18.8e12,  spend: 12e12,  terminPct: 84, deadline: "2026-11-30" },
    { entityKey: "kencana",   code: "KCN-041", name: "Ruko Kencana Blok C",           contractValue: 6.2e12,  spend: 3.8e12,  terminPct: 84, deadline: "2026-10-20" },
    { entityKey: "tataring",  code: "TTR-018", name: "Renovasi Kantor Tataring",      contractValue: 7.2e12,  spend: 4.4e12,  terminPct: 45, deadline: "2026-08-01" },
    { entityKey: "ciptaAsri", code: "CAS-009", name: "Taman Cipta Asri Residence",   contractValue: 4.8e12,  spend: 2.6e12,  terminPct: 30, deadline: "2026-12-31" },
  ];
  const projects: Record<string, { id: string }> = {};
  for (const p of projectSeed) {
    projects[p.code] = await prisma.project.upsert({
      where: { code: p.code },
      update: { name: p.name, contractValue: p.contractValue, spend: p.spend, deadline: new Date(p.deadline), status: "ACTIVE" },
      create: {
        entityId: entities[p.entityKey].id,
        code: p.code,
        name: p.name,
        contractValue: p.contractValue,
        spend: p.spend,
        deadline: new Date(p.deadline),
      },
    });
    await prisma.termin.create({
      data: {
        projectId: projects[p.code].id,
        name: "Termin 1",
        percentage: p.terminPct,
        status: p.terminPct >= 80 ? TerminStatus.ON_TRACK : TerminStatus.AT_RISK,
      },
    });
  }

  const gId  = entities["gaharu"].id;
  const kId  = entities["kencana"].id;
  const tId  = entities["tataring"].id;
  const caId = entities["ciptaAsri"].id;
  const uId  = entities["umum"].id;
  const sId  = staf.id;

  const kasKecilCoaId = coa["1-001"].id;
  const kasBesarCoaId = coa["1-002"].id;
  const briGsCoaId    = coa["1-101"].id;
  const bpdGsCoaId    = coa["1-102"].id;
  const briKakCoaId   = coa["1-201"].id;
  const bpdKakCoaId   = coa["1-202"].id;
  const bpdTbCoaId    = coa["1-301"].id;
  const bpdCadCoaId   = coa["1-401"].id;
  const bpdKpCoaId    = coa["1-501"].id;

  // ════════════════════════════════════════════════════════════════
  // GAHARU — Target Pendapatan ~27 T, Beban ~20,2 T
  // (Dashboard: contractValue 31,2 T, spend 20,2 T)
  // ════════════════════════════════════════════════════════════════

  // ── Kas Kecil — Gaharu ──────────────────────────────────────────
  let skkGaharu = 0;

  skkGaharu = await buatTransaksi({
    entityId: gId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-01", noBukti: "GS/010901", arah: "masuk",
    keterangan: "Pengisian kas kecil dari kas besar",
    rows: [{ coaId: coa["4-001"].id, nominal: 10_000_000_000 }],
    saldoBefore: skkGaharu, kasCoaId: kasKecilCoaId,
  });
  skkGaharu = await buatTransaksi({
    entityId: gId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-05", noBukti: "GS/050901", arah: "keluar",
    keterangan: "Pembelian ATK untuk proyek GHR-091",
    rows: [{ coaId: coa["5-004"].id, nominal: 700_000_000 }],
    saldoBefore: skkGaharu, kasCoaId: kasKecilCoaId,
  });
  skkGaharu = await buatTransaksi({
    entityId: gId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-08", noBukti: "GS/080901", arah: "keluar",
    keterangan: "Makan siang tim lapangan GHR-091",
    rows: [
      { coaId: coa["5-003"].id, nominal: 500_000_000 },
      { coaId: coa["5-003"].id, nominal: 400_000_000 },
    ],
    saldoBefore: skkGaharu, kasCoaId: kasKecilCoaId,
  });
  skkGaharu = await buatTransaksi({
    entityId: gId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-10", noBukti: "GS/100901", arah: "keluar",
    keterangan: "Fotokopi gambar kerja & RAB",
    rows: [{ coaId: coa["5-004"].id, nominal: 240_000_000 }],
    saldoBefore: skkGaharu, kasCoaId: kasKecilCoaId,
  });
  skkGaharu = await buatTransaksi({
    entityId: gId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-14", noBukti: "GS/140901", arah: "keluar",
    keterangan: "Konsumsi rapat koordinasi proyek",
    rows: [{ coaId: coa["5-003"].id, nominal: 960_000_000 }],
    saldoBefore: skkGaharu, kasCoaId: kasKecilCoaId,
  });

  // ── Kas Besar — Gaharu ──────────────────────────────────────────
  let skbGaharu = 0;

  skbGaharu = await buatTransaksi({
    entityId: gId, jenisInputId: ji["kasBesar"].id, staffId: sId,
    tanggal: "2026-09-01", noBukti: "GS/010902", arah: "masuk",
    keterangan: "Modal kas besar periode September 2026",
    rows: [{ coaId: coa["4-001"].id, nominal: 200_000_000_000 }],
    saldoBefore: skbGaharu, kasCoaId: kasBesarCoaId,
  });
  skbGaharu = await buatTransaksi({
    entityId: gId, jenisInputId: ji["kasBesar"].id, staffId: sId,
    tanggal: "2026-09-05", noBukti: "GS/050902", arah: "keluar",
    keterangan: "Pembayaran upah mandor minggu ke-1",
    rows: [{ coaId: coa["5-005"].id, nominal: 25_000_000_000 }],
    saldoBefore: skbGaharu, kasCoaId: kasBesarCoaId,
  });
  skbGaharu = await buatTransaksi({
    entityId: gId, jenisInputId: ji["kasBesar"].id, staffId: sId,
    tanggal: "2026-09-08", noBukti: "GS/080902", arah: "keluar",
    keterangan: "Pembelian material bata merah & semen",
    rows: [
      { coaId: coa["5-001"].id, nominal: 10_400_000_000 },
      { coaId: coa["5-001"].id, nominal: 6_000_000_000 },
    ],
    saldoBefore: skbGaharu, kasCoaId: kasBesarCoaId,
  });
  skbGaharu = await buatTransaksi({
    entityId: gId, jenisInputId: ji["kasBesar"].id, staffId: sId,
    tanggal: "2026-09-12", noBukti: "GS/120901", arah: "keluar",
    keterangan: "Pembayaran upah mandor minggu ke-2",
    rows: [{ coaId: coa["5-005"].id, nominal: 25_000_000_000 }],
    saldoBefore: skbGaharu, kasCoaId: kasBesarCoaId,
  });

  // ── Bank Buku — BRI GS (Gaharu) ─────────────────────────────────
  // Penerimaan termin proyek (bulk via bank)
  let sbbBriGs = 0;

  sbbBriGs = await buatTransaksi({
    entityId: gId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-03", noBukti: "GS/030901", arah: "masuk",
    keterangan: "Penerimaan termin — GHR-091 (90% dari kontrak Rp 12,4 T)",
    rows: [{ coaId: coa["4-001"].id, nominal: 11_160_000_000_000 }],
    saldoBefore: sbbBriGs, rekeningNama: "BRI GS", kasCoaId: briGsCoaId,
  });
  sbbBriGs = await buatTransaksi({
    entityId: gId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-10", noBukti: "GS/100902", arah: "masuk",
    keterangan: "Penerimaan termin pertama — GHR-088 (50% dari kontrak Rp 18,8 T)",
    rows: [{ coaId: coa["4-001"].id, nominal: 9_400_000_000_000 }],
    saldoBefore: sbbBriGs, rekeningNama: "BRI GS", kasCoaId: briGsCoaId,
  });
  sbbBriGs = await buatTransaksi({
    entityId: gId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-30", noBukti: "GS/300901", arah: "keluar",
    keterangan: "Biaya administrasi bank September",
    rows: [{ coaId: coa["5-006"].id, nominal: 3_000_000_000 }],
    saldoBefore: sbbBriGs, rekeningNama: "BRI GS", kasCoaId: briGsCoaId,
  });
  sbbBriGs = await buatTransaksi({
    entityId: gId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-30", noBukti: "GS/300902", arah: "masuk",
    keterangan: "Jasa giro September BRI GS",
    rows: [{ coaId: coa["4-002"].id, nominal: 25_000_000_000 }],
    saldoBefore: sbbBriGs, rekeningNama: "BRI GS", kasCoaId: briGsCoaId,
  });

  // ── Bank Buku — BPD GS (Gaharu) ─────────────────────────────────
  let sbbBpdGs = 0;

  sbbBpdGs = await buatTransaksi({
    entityId: gId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-15", noBukti: "GS/150901", arah: "masuk",
    keterangan: "Penerimaan termin kedua — GHR-088 (34% dari kontrak Rp 18,8 T)",
    rows: [{ coaId: coa["4-001"].id, nominal: 6_200_000_000_000 }],
    saldoBefore: sbbBpdGs, rekeningNama: "BPD GS", kasCoaId: bpdGsCoaId,
  });
  sbbBpdGs = await buatTransaksi({
    entityId: gId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-20", noBukti: "GS/200901", arah: "keluar",
    keterangan: "Pembayaran material, subkontraktor & supplier GHR-091 + GHR-088",
    rows: [{ coaId: coa["5-001"].id, nominal: 14_100_000_000_000 }],
    saldoBefore: sbbBpdGs, rekeningNama: "BPD GS", kasCoaId: bpdGsCoaId,
  });
  sbbBpdGs = await buatTransaksi({
    entityId: gId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-25", noBukti: "GS/250901", arah: "keluar",
    keterangan: "Pembayaran upah mandor & tukang GHR-091 + GHR-088 September",
    rows: [{ coaId: coa["5-005"].id, nominal: 6_000_000_000_000 }],
    saldoBefore: sbbBpdGs, rekeningNama: "BPD GS", kasCoaId: bpdGsCoaId,
  });
  sbbBpdGs = await buatTransaksi({
    entityId: gId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-30", noBukti: "GS/300903", arah: "keluar",
    keterangan: "Biaya administrasi bank September BPD GS",
    rows: [{ coaId: coa["5-006"].id, nominal: 500_000_000 }],
    saldoBefore: sbbBpdGs, rekeningNama: "BPD GS", kasCoaId: bpdGsCoaId,
  });

  // ════════════════════════════════════════════════════════════════
  // KENCANA — Target Pendapatan ~5,2 T, Beban ~3,8 T
  // (Dashboard: contractValue 6,2 T, spend 3,8 T)
  // ════════════════════════════════════════════════════════════════

  // ── Kas Kecil — Kencana ─────────────────────────────────────────
  let skkKencana = 0;

  skkKencana = await buatTransaksi({
    entityId: kId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-02", noBukti: "KAK/020901", arah: "masuk",
    keterangan: "Pengisian kas kecil operasional proyek KCN-041",
    rows: [{ coaId: coa["4-001"].id, nominal: 4_000_000_000 }],
    saldoBefore: skkKencana, kasCoaId: kasKecilCoaId,
  });
  skkKencana = await buatTransaksi({
    entityId: kId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-05", noBukti: "KAK/050901", arah: "keluar",
    keterangan: "Pembelian ATK & alat tulis kantor",
    rows: [{ coaId: coa["5-004"].id, nominal: 300_000_000 }],
    saldoBefore: skkKencana, kasCoaId: kasKecilCoaId,
  });
  skkKencana = await buatTransaksi({
    entityId: kId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-10", noBukti: "KAK/100901", arah: "keluar",
    keterangan: "Konsumsi rapat mingguan proyek KCN-041",
    rows: [{ coaId: coa["5-003"].id, nominal: 600_000_000 }],
    saldoBefore: skkKencana, kasCoaId: kasKecilCoaId,
  });
  skkKencana = await buatTransaksi({
    entityId: kId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-15", noBukti: "KAK/150901", arah: "keluar",
    keterangan: "Fotokopi & cetak gambar kerja ruko",
    rows: [{ coaId: coa["5-004"].id, nominal: 160_000_000 }],
    saldoBefore: skkKencana, kasCoaId: kasKecilCoaId,
  });

  // ── Kas Besar — Kencana ─────────────────────────────────────────
  let skbKencana = 0;

  skbKencana = await buatTransaksi({
    entityId: kId, jenisInputId: ji["kasBesar"].id, staffId: sId,
    tanggal: "2026-09-01", noBukti: "KAK/010902", arah: "masuk",
    keterangan: "Modal kas besar proyek KCN-041 September",
    rows: [{ coaId: coa["4-001"].id, nominal: 100_000_000_000 }],
    saldoBefore: skbKencana, kasCoaId: kasBesarCoaId,
  });
  skbKencana = await buatTransaksi({
    entityId: kId, jenisInputId: ji["kasBesar"].id, staffId: sId,
    tanggal: "2026-09-08", noBukti: "KAK/080901", arah: "keluar",
    keterangan: "Pembayaran upah tukang & mandor minggu ke-1",
    rows: [{ coaId: coa["5-005"].id, nominal: 16_000_000_000 }],
    saldoBefore: skbKencana, kasCoaId: kasBesarCoaId,
  });
  skbKencana = await buatTransaksi({
    entityId: kId, jenisInputId: ji["kasBesar"].id, staffId: sId,
    tanggal: "2026-09-14", noBukti: "KAK/140901", arah: "keluar",
    keterangan: "Pembelian material keramik & granit lantai",
    rows: [{ coaId: coa["5-001"].id, nominal: 7_000_000_000 }],
    saldoBefore: skbKencana, kasCoaId: kasBesarCoaId,
  });

  // ── Bank Buku — BRI KAK (Kencana) ───────────────────────────────
  let sbbBriKak = 0;

  sbbBriKak = await buatTransaksi({
    entityId: kId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-05", noBukti: "KAK/050902", arah: "masuk",
    keterangan: "Penerimaan termin pertama KCN-041 (50% dari kontrak Rp 6,2 T)",
    rows: [{ coaId: coa["4-001"].id, nominal: 3_100_000_000_000 }],
    saldoBefore: sbbBriKak, rekeningNama: "BRI KAK", kasCoaId: briKakCoaId,
  });
  sbbBriKak = await buatTransaksi({
    entityId: kId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-30", noBukti: "KAK/300901", arah: "keluar",
    keterangan: "Biaya administrasi bank September",
    rows: [{ coaId: coa["5-006"].id, nominal: 310_000_000 }],
    saldoBefore: sbbBriKak, rekeningNama: "BRI KAK", kasCoaId: briKakCoaId,
  });
  sbbBriKak = await buatTransaksi({
    entityId: kId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-30", noBukti: "KAK/300902", arah: "masuk",
    keterangan: "Jasa giro September BRI KAK",
    rows: [{ coaId: coa["4-002"].id, nominal: 1_240_000_000 }],
    saldoBefore: sbbBriKak, rekeningNama: "BRI KAK", kasCoaId: briKakCoaId,
  });

  // ── Bank Buku — BPD KAK (Kencana) ───────────────────────────────
  let sbbBpdKak = 0;

  sbbBpdKak = await buatTransaksi({
    entityId: kId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-12", noBukti: "KAK/120901", arah: "masuk",
    keterangan: "Penerimaan termin kedua KCN-041 (34% dari kontrak Rp 6,2 T)",
    rows: [{ coaId: coa["4-001"].id, nominal: 2_108_000_000_000 }],
    saldoBefore: sbbBpdKak, rekeningNama: "BPD KAK", kasCoaId: bpdKakCoaId,
  });
  sbbBpdKak = await buatTransaksi({
    entityId: kId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-20", noBukti: "KAK/200901", arah: "keluar",
    keterangan: "Pembayaran material & supplier KCN-041",
    rows: [{ coaId: coa["5-001"].id, nominal: 3_000_000_000_000 }],
    saldoBefore: sbbBpdKak, rekeningNama: "BPD KAK", kasCoaId: bpdKakCoaId,
  });
  sbbBpdKak = await buatTransaksi({
    entityId: kId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-25", noBukti: "KAK/250901", arah: "keluar",
    keterangan: "Pembayaran upah tukang & subkontraktor KCN-041",
    rows: [{ coaId: coa["5-005"].id, nominal: 776_000_000_000 }],
    saldoBefore: sbbBpdKak, rekeningNama: "BPD KAK", kasCoaId: bpdKakCoaId,
  });
  sbbBpdKak = await buatTransaksi({
    entityId: kId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-30", noBukti: "KAK/300903", arah: "keluar",
    keterangan: "Biaya administrasi bank September BPD KAK",
    rows: [{ coaId: coa["5-006"].id, nominal: 220_000_000 }],
    saldoBefore: sbbBpdKak, rekeningNama: "BPD KAK", kasCoaId: bpdKakCoaId,
  });

  // ════════════════════════════════════════════════════════════════
  // TATARING — Target Pendapatan ~3,24 T, Beban ~4,4 T (rugi)
  // (Dashboard: contractValue 7,2 T, spend 4,4 T — proyek masih awal)
  // ════════════════════════════════════════════════════════════════

  // ── Kas Kecil — Tataring ─────────────────────────────────────────
  let skkTataring = 0;

  skkTataring = await buatTransaksi({
    entityId: tId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-03", noBukti: "TTR/030901", arah: "masuk",
    keterangan: "Pengisian kas kecil renovasi kantor TTR-018",
    rows: [{ coaId: coa["4-001"].id, nominal: 6_000_000_000 }],
    saldoBefore: skkTataring, kasCoaId: kasKecilCoaId,
  });
  skkTataring = await buatTransaksi({
    entityId: tId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-08", noBukti: "TTR/080901", arah: "keluar",
    keterangan: "Konsumsi tim renovasi minggu ke-1",
    rows: [{ coaId: coa["5-003"].id, nominal: 800_000_000 }],
    saldoBefore: skkTataring, kasCoaId: kasKecilCoaId,
  });
  skkTataring = await buatTransaksi({
    entityId: tId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-14", noBukti: "TTR/140901", arah: "keluar",
    keterangan: "Pembelian ATK proyek TTR-018",
    rows: [{ coaId: coa["5-004"].id, nominal: 360_000_000 }],
    saldoBefore: skkTataring, kasCoaId: kasKecilCoaId,
  });

  // ── Kas Besar — Tataring ─────────────────────────────────────────
  let skbTataring = 0;

  skbTataring = await buatTransaksi({
    entityId: tId, jenisInputId: ji["kasBesar"].id, staffId: sId,
    tanggal: "2026-09-01", noBukti: "TTR/010902", arah: "masuk",
    keterangan: "Modal kas besar proyek TTR-018 September",
    rows: [{ coaId: coa["4-001"].id, nominal: 120_000_000_000 }],
    saldoBefore: skbTataring, kasCoaId: kasBesarCoaId,
  });
  skbTataring = await buatTransaksi({
    entityId: tId, jenisInputId: ji["kasBesar"].id, staffId: sId,
    tanggal: "2026-09-08", noBukti: "TTR/080902", arah: "keluar",
    keterangan: "Pembayaran upah tukang renovasi minggu ke-1",
    rows: [{ coaId: coa["5-005"].id, nominal: 24_000_000_000 }],
    saldoBefore: skbTataring, kasCoaId: kasBesarCoaId,
  });
  skbTataring = await buatTransaksi({
    entityId: tId, jenisInputId: ji["kasBesar"].id, staffId: sId,
    tanggal: "2026-09-12", noBukti: "TTR/120901", arah: "keluar",
    keterangan: "Pembelian cat, wallpaper & material finishing",
    rows: [{ coaId: coa["5-001"].id, nominal: 16_800_000_000 }],
    saldoBefore: skbTataring, kasCoaId: kasBesarCoaId,
  });

  // ── Bank Buku — BPD TB (Tataring) ───────────────────────────────
  let sbbBpdTb = 0;

  sbbBpdTb = await buatTransaksi({
    entityId: tId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-04", noBukti: "TTR/040901", arah: "masuk",
    keterangan: "Penerimaan termin TTR-018 (45% dari kontrak Rp 7,2 T)",
    rows: [{ coaId: coa["4-001"].id, nominal: 3_115_560_000_000 }],
    saldoBefore: sbbBpdTb, rekeningNama: "BPD TB", kasCoaId: bpdTbCoaId,
  });
  sbbBpdTb = await buatTransaksi({
    entityId: tId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-18", noBukti: "TTR/180901", arah: "keluar",
    keterangan: "Pembayaran material plafon, partisi & mekanikal",
    rows: [{ coaId: coa["5-001"].id, nominal: 3_000_000_000_000 }],
    saldoBefore: sbbBpdTb, rekeningNama: "BPD TB", kasCoaId: bpdTbCoaId,
  });
  sbbBpdTb = await buatTransaksi({
    entityId: tId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-22", noBukti: "TTR/220901", arah: "keluar",
    keterangan: "Pembayaran upah tukang renovasi & finishing",
    rows: [{ coaId: coa["5-005"].id, nominal: 1_357_860_000_000 }],
    saldoBefore: sbbBpdTb, rekeningNama: "BPD TB", kasCoaId: bpdTbCoaId,
  });
  sbbBpdTb = await buatTransaksi({
    entityId: tId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-30", noBukti: "TTR/300901", arah: "keluar",
    keterangan: "Biaya administrasi bank September",
    rows: [{ coaId: coa["5-006"].id, nominal: 380_000_000 }],
    saldoBefore: sbbBpdTb, rekeningNama: "BPD TB", kasCoaId: bpdTbCoaId,
  });
  sbbBpdTb = await buatTransaksi({
    entityId: tId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-30", noBukti: "TTR/300902", arah: "masuk",
    keterangan: "Jasa giro September BPD TB",
    rows: [{ coaId: coa["4-002"].id, nominal: 1_560_000_000 }],
    saldoBefore: sbbBpdTb, rekeningNama: "BPD TB", kasCoaId: bpdTbCoaId,
  });

  // ════════════════════════════════════════════════════════════════
  // CIPTA ASRI — Target Pendapatan ~1,44 T, Beban ~2,6 T (rugi)
  // (Dashboard: contractValue 4,8 T, spend 2,6 T — proyek masih awal)
  // ════════════════════════════════════════════════════════════════

  // ── Kas Kecil — Cipta Asri ───────────────────────────────────────
  let skkCa = 0;

  skkCa = await buatTransaksi({
    entityId: caId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-02", noBukti: "CAS/020901", arah: "masuk",
    keterangan: "Pengisian kas kecil proyek CAS-009",
    rows: [{ coaId: coa["4-001"].id, nominal: 2_000_000_000 }],
    saldoBefore: skkCa, kasCoaId: kasKecilCoaId,
  });
  skkCa = await buatTransaksi({
    entityId: caId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-09", noBukti: "CAS/090901", arah: "keluar",
    keterangan: "Konsumsi tim lapangan landscape",
    rows: [{ coaId: coa["5-003"].id, nominal: 300_000_000 }],
    saldoBefore: skkCa, kasCoaId: kasKecilCoaId,
  });
  skkCa = await buatTransaksi({
    entityId: caId, jenisInputId: ji["kasKecil"].id, staffId: sId,
    tanggal: "2026-09-15", noBukti: "CAS/150901", arah: "keluar",
    keterangan: "ATK & keperluan kantor lapangan",
    rows: [{ coaId: coa["5-004"].id, nominal: 140_000_000 }],
    saldoBefore: skkCa, kasCoaId: kasKecilCoaId,
  });

  // ── Kas Besar — Cipta Asri ───────────────────────────────────────
  let skbCa = 0;

  skbCa = await buatTransaksi({
    entityId: caId, jenisInputId: ji["kasBesar"].id, staffId: sId,
    tanggal: "2026-09-01", noBukti: "CAS/010902", arah: "masuk",
    keterangan: "Modal kas besar proyek CAS-009 September",
    rows: [{ coaId: coa["4-001"].id, nominal: 80_000_000_000 }],
    saldoBefore: skbCa, kasCoaId: kasBesarCoaId,
  });
  skbCa = await buatTransaksi({
    entityId: caId, jenisInputId: ji["kasBesar"].id, staffId: sId,
    tanggal: "2026-09-06", noBukti: "CAS/060901", arah: "keluar",
    keterangan: "Pembayaran upah tim tukang taman",
    rows: [{ coaId: coa["5-005"].id, nominal: 14_000_000_000 }],
    saldoBefore: skbCa, kasCoaId: kasBesarCoaId,
  });
  skbCa = await buatTransaksi({
    entityId: caId, jenisInputId: ji["kasBesar"].id, staffId: sId,
    tanggal: "2026-09-11", noBukti: "CAS/110901", arah: "keluar",
    keterangan: "Pembelian tanaman, batu alam & material taman",
    rows: [{ coaId: coa["5-001"].id, nominal: 12_000_000_000 }],
    saldoBefore: skbCa, kasCoaId: kasBesarCoaId,
  });

  // ── Bank Buku — BPD CAD (Cipta Asri) ────────────────────────────
  let sbbBpdCad = 0;

  sbbBpdCad = await buatTransaksi({
    entityId: caId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-05", noBukti: "CAS/050901", arah: "masuk",
    keterangan: "Penerimaan termin CAS-009 (30% dari kontrak Rp 4,8 T)",
    rows: [{ coaId: coa["4-001"].id, nominal: 1_358_000_000_000 }],
    saldoBefore: sbbBpdCad, rekeningNama: "BPD CAD", kasCoaId: bpdCadCoaId,
  });
  sbbBpdCad = await buatTransaksi({
    entityId: caId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-20", noBukti: "CAS/200901", arah: "keluar",
    keterangan: "Pembayaran supplier irigasi, drainase & material taman",
    rows: [{ coaId: coa["5-001"].id, nominal: 1_840_000_000_000 }],
    saldoBefore: sbbBpdCad, rekeningNama: "BPD CAD", kasCoaId: bpdCadCoaId,
  });
  sbbBpdCad = await buatTransaksi({
    entityId: caId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-25", noBukti: "CAS/250901", arah: "keluar",
    keterangan: "Pembayaran upah tukang taman & landscaper",
    rows: [{ coaId: coa["5-005"].id, nominal: 733_300_000_000 }],
    saldoBefore: sbbBpdCad, rekeningNama: "BPD CAD", kasCoaId: bpdCadCoaId,
  });
  sbbBpdCad = await buatTransaksi({
    entityId: caId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-30", noBukti: "CAS/300901", arah: "keluar",
    keterangan: "Biaya administrasi bank September",
    rows: [{ coaId: coa["5-006"].id, nominal: 260_000_000 }],
    saldoBefore: sbbBpdCad, rekeningNama: "BPD CAD", kasCoaId: bpdCadCoaId,
  });

  // ════════════════════════════════════════════════════════════════
  // UMUM — Ruang Transit Antar Entitas (hanya Bank Buku)
  // ════════════════════════════════════════════════════════════════
  let sbbBpdKp = 0;

  sbbBpdKp = await buatTransaksi({
    entityId: uId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-03", noBukti: "KP/030901", arah: "masuk",
    keterangan: "Transfer masuk dari Gaharu — pinjam bendera KSO",
    rows: [{ coaId: coa["4-001"].id, nominal: 11_000_000_000_000 }],
    saldoBefore: sbbBpdKp, rekeningNama: "BPD KP", kasCoaId: bpdKpCoaId,
  });
  sbbBpdKp = await buatTransaksi({
    entityId: uId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-15", noBukti: "KP/150901", arah: "keluar",
    keterangan: "Reklasifikasi ke Kencana — proyek KSO selesai verifikasi",
    rows: [{ coaId: coa["5-002"].id, nominal: 9_900_000_000_000 }],
    saldoBefore: sbbBpdKp, rekeningNama: "BPD KP", kasCoaId: bpdKpCoaId,
  });
  sbbBpdKp = await buatTransaksi({
    entityId: uId, jenisInputId: ji["bankBuku"].id, staffId: sId,
    tanggal: "2026-09-30", noBukti: "KP/300901", arah: "keluar",
    keterangan: "Biaya administrasi bank September",
    rows: [{ coaId: coa["5-006"].id, nominal: 1_870_000_000 }],
    saldoBefore: sbbBpdKp, rekeningNama: "BPD KP", kasCoaId: bpdKpCoaId,
  });

  // ── Notifikasi ───────────────────────────────────────────────────
  await prisma.notifikasi.createMany({
    data: [
      { type: NotifikasiType.TERMIN_BARU,  targetRole: Role.SUPER_ADMIN,       text: "Staf Rina Kartika menginput termin baru — Proyek Gudang Cikarang",       read: false },
      { type: NotifikasiType.PROGRES_80,   targetRole: Role.SUPER_ADMIN,       text: "Progres termin Proyek Ruko Kencana Blok C telah melewati 80%",           read: false },
      { type: NotifikasiType.PENDAFTARAN,  targetRole: Role.MANAJER_KEUANGAN,  text: "Pendaftaran akun baru dari Budi Santoso menunggu persetujuan",           read: false },
      { type: NotifikasiType.TERMIN_AUDIT, targetRole: Role.MANAJER_KEUANGAN,  text: "Termin Proyek Gudang Distribusi Cikarang perlu diaudit",                 read: false },
    ],
  });

  console.log("✅ Seed selesai — semua transaksi balanced (Debet = Kredit).");
  console.log("");
  console.log("Ringkasan data per entitas (Laporan Keuangan Staf ≈ Dashboard Manager):");
  console.log("  Gaharu     | Pendapatan ~27 T    | Beban ~20,2 T | Laba ~6,8 T");
  console.log("  Kencana    | Pendapatan ~5,32 T  | Beban ~3,8 T  | Laba ~1,52 T");
  console.log("  Tataring   | Pendapatan ~3,24 T  | Beban ~4,4 T  | Rugi ~1,16 T");
  console.log("  Cipta Asri | Pendapatan ~1,44 T  | Beban ~2,6 T  | Rugi ~1,16 T");
  console.log("  Umum       | Pendapatan ~11,0 T  | Beban ~9,9 T  | Laba ~1,1 T");
  console.log("");
  console.log("Akun contoh (password: password123):");
  console.log("  superadmin@gaharusempana.com  →  Super Admin");
  console.log("  manajer@gaharusempana.com     →  Manajer Keuangan");
  console.log("  staf@gaharusempana.com        →  Staf Keuangan");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
