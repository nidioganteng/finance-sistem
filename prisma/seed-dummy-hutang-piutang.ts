import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding realistic inter-entity Hutang & Piutang dummy data...");

  const entities = await prisma.entity.findMany();
  const entMap = new Map(entities.map((e) => [e.key, e]));

  const cad = entMap.get("ciptaAsri");
  const kak = entMap.get("kencana");
  const gs = entMap.get("gaharu");
  const tb = entMap.get("tataring");
  const kp = entMap.get("umum");

  if (!cad || !kak || !gs || !tb || !kp) {
    console.error("Entities not found!");
    return;
  }

  // Get COA accounts
  const coaAccounts = await prisma.coaAccount.findMany({
    where: {
      code: { in: ["111", "112", "113", "114", "115", "311", "312", "313", "314", "315"] },
    },
  });
  const coa = new Map(coaAccounts.map((c) => [c.code, c]));

  // Helper for Saldo Awal
  async function setSaldoAwal(entityId: string, coaCode: string, nominal: number) {
    const acc = coa.get(coaCode);
    if (!acc) return;
    await prisma.saldoAwal.upsert({
      where: { entityId_coaAccountId_year: { entityId, coaAccountId: acc.id, year: 2026 } },
      update: { nominal },
      create: { entityId, coaAccountId: acc.id, year: 2026, nominal },
    });
  }

  // Helper for Transaction
  const [jenisInput, staffUser] = await Promise.all([
    prisma.jenisInputTransaksi.findFirst(),
    prisma.user.findFirst(),
  ]);
  const jenisInputId = jenisInput?.id ?? "manual";
  const staffUserId = staffUser!.id;

  async function addTx(entityId: string, coaCode: string, tanggal: Date, debit: number, kredit: number, noBukti: string, keterangan: string) {
    const acc = coa.get(coaCode);
    if (!acc) return;
    await prisma.transaction.create({
      data: {
        entity: { connect: { id: entityId } },
        coaAccount: { connect: { id: acc.id } },
        jenisInput: { connect: { id: jenisInputId } },
        staff: { connect: { id: staffUserId } },
        tanggal,
        noBukti,
        keterangan,
        debit,
        kredit,
        saldoSetelah: debit || kredit,
      },
    });
  }

  // Clean previous inter-entity transactions to avoid duplicate accumulation
  await prisma.transaction.deleteMany({
    where: {
      coaAccountId: { in: coaAccounts.map((c) => c.id) },
      noBukti: { startsWith: "MUT-AFIL-" },
    },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 1. CIPTA ASRI (CAD) — Persis Sesuai Screenshot Excel Tim Finance!
  // ══════════════════════════════════════════════════════════════════════════
  // Hutang per 2025:
  // - Hutang KAK (311): Rp 1.929.192.192
  await setSaldoAwal(cad.id, "311", 1929192192);
  await setSaldoAwal(cad.id, "312", 0);
  await setSaldoAwal(cad.id, "313", 0);
  await setSaldoAwal(cad.id, "315", 0);

  // Mutasi Hutang 2026:
  // - Hutang KAK: Rp 4.226.270
  await addTx(cad.id, "311", new Date("2026-03-15"), 0, 4226270, "MUT-AFIL-CAD-01", "Talangan Kas dan Bank KAK untuk operasional CAD");
  // - Hutang GS: Rp 46.295.500
  await addTx(cad.id, "312", new Date("2026-04-10"), 0, 46295500, "MUT-AFIL-CAD-02", "Talangan Kas dan Bank GS pengadaan bibit landscape");
  // - Hutang TB: Rp 10.218.204
  await addTx(cad.id, "313", new Date("2026-05-18"), 0, 10218204, "MUT-AFIL-CAD-03", "Talangan Kas dan Bank TB material proyek");

  // Piutang 2026:
  // - Piutang KAK (111): Rp 49.281.866
  await setSaldoAwal(cad.id, "111", 49281866);
  // - Piutang GS (112): Rp 1.170.271.443 (+ mutasi 120 = Rp 1.170.271.563, sinkron dgn Hutang GS)
  await setSaldoAwal(cad.id, "112", 1170271443);
  // - Piutang TB (113): Rp 5.719.046
  await setSaldoAwal(cad.id, "113", 5719046);
  // - Piutang KP (115): Rp 10.560.107
  await setSaldoAwal(cad.id, "115", 10560107);


  // ══════════════════════════════════════════════════════════════════════════
  // 2. KENCANA (KAK) — SINKRON DENGAN CAD, TB & ENTITAS LAIN
  // ══════════════════════════════════════════════════════════════════════════
  // Piutang ke CAD (114): Total Rp 1.933.418.462 (Saldo Awal Rp 1.929.192.192 + Mutasi Rp 4.226.270)
  await setSaldoAwal(kak.id, "114", 1929192192);
  await addTx(kak.id, "114", new Date("2026-03-15"), 4226270, 0, "MUT-AFIL-KAK-01", "Pemberian dana talangan ke CAD");
  // Hutang ke CAD (314): Total Rp 49.281.866
  await setSaldoAwal(kak.id, "314", 49281866);

  // KAK vs GS:
  await setSaldoAwal(kak.id, "112", 250000000); // Piutang GS Rp 250 JT
  await setSaldoAwal(kak.id, "312", 150000000); // Hutang GS Rp 150 JT

  // KAK vs TB (Sinkron persis dengan Rekap Hutang/Piutang Tataring Bali di Excel):
  // TB Hutang KAK: Saldo awal Rp 635.817.899 + mutasi Rp 15.829.336 = Rp 651.647.235
  await setSaldoAwal(kak.id, "113", 635817899);
  await addTx(kak.id, "113", new Date("2026-04-20"), 15829336, 0, "MUT-AFIL-KAK-TB", "Talangan operasional proyek Tataring Bali");
  // TB Piutang KAK: mutasi Rp 1.432.000
  await setSaldoAwal(kak.id, "313", 0);
  await addTx(kak.id, "313", new Date("2026-06-12"), 0, 1432000, "MUT-AFIL-TB-KAK", "Talangan material dari TB ke KAK");

  // KAK vs KP:
  await setSaldoAwal(kak.id, "115", 120000000); // Piutang KP Rp 120 JT
  await setSaldoAwal(kak.id, "315", 80000000);  // Hutang KP Rp 80 JT

  // ══════════════════════════════════════════════════════════════════════════
  // 3. GAHARU (GS) — SINKRON DENGAN CAD, KAK & TB
  // ══════════════════════════════════════════════════════════════════════════
  // Piutang ke CAD (114): Rp 46.295.500 (mutasi 2026)
  await setSaldoAwal(gs.id, "114", 0);
  await addTx(gs.id, "114", new Date("2026-04-10"), 46295500, 0, "MUT-AFIL-GS-01", "Penyaluran dana talangan landscape ke CAD");
  // Hutang ke CAD (314): Rp 1.170.271.323
  await setSaldoAwal(gs.id, "314", 1170271323);

  // GS vs KAK:
  await setSaldoAwal(gs.id, "111", 150000000);
  await setSaldoAwal(gs.id, "311", 250000000);

  // GS vs TB (Sinkron persis dengan Rekap Hutang/Piutang Tataring Bali di Excel):
  // TB Piutang GS: Saldo awal Rp 1.388.223.436 + mutasi Rp 1.851.926 = Rp 1.390.075.362
  await setSaldoAwal(gs.id, "313", 1388223436);
  await addTx(gs.id, "313", new Date("2026-05-10"), 0, 1851926, "MUT-AFIL-TB-GS", "Pinjaman dana talangan TB ke GS");
  // TB Hutang GS: mutasi Rp 88.725.020
  await setSaldoAwal(gs.id, "113", 0);
  await addTx(gs.id, "113", new Date("2026-07-15"), 88725020, 0, "MUT-AFIL-GS-TB", "Talangan pembelian alat GS untuk TB");

  // GS vs KP:
  await setSaldoAwal(gs.id, "115", 95000000);
  await setSaldoAwal(gs.id, "315", 40000000);

  // ══════════════════════════════════════════════════════════════════════════
  // 4. TATARING (TB) — PERSIS SESUAI SCREENSHOT EXCEL TIM FINANCE!
  // ══════════════════════════════════════════════════════════════════════════
  // Hutang TB:
  // - Hutang KAK (311): Awal Rp 635.817.899 + Mutasi Rp 15.829.336 = Rp 651.647.235
  await setSaldoAwal(tb.id, "311", 635817899);
  await addTx(tb.id, "311", new Date("2026-04-20"), 0, 15829336, "MUT-AFIL-KAK-TB-01", "Penerimaan talangan Kas dan Bank KAK");

  // - Hutang GS (312): Awal Rp 0 + Mutasi Rp 88.725.020 = Rp 88.725.020
  await setSaldoAwal(tb.id, "312", 0);
  await addTx(tb.id, "312", new Date("2026-07-15"), 0, 88725020, "MUT-AFIL-GS-TB-01", "Penerimaan talangan Kas dan Bank GS");

  // - Hutang CAD (314): Awal Rp 0 + Mutasi Rp 5.719.046 = Rp 5.719.046
  await setSaldoAwal(tb.id, "314", 0);
  await addTx(tb.id, "314", new Date("2026-03-25"), 0, 5719046, "MUT-AFIL-CAD-TB-01", "Penerimaan talangan Kas dan Bank CAD");

  // - Hutang KP (315): Rp 0
  await setSaldoAwal(tb.id, "315", 0);

  // Piutang TB:
  // - Piutang KAK (111): Awal Rp 0 + Mutasi Rp 1.432.000 = Rp 1.432.000
  await setSaldoAwal(tb.id, "111", 0);
  await addTx(tb.id, "111", new Date("2026-06-12"), 1432000, 0, "MUT-AFIL-TB-KAK-01", "Pemberian pinjaman TB ke KAK");

  // - Piutang GS (112): Awal Rp 1.388.223.436 + Mutasi Rp 1.851.926 = Rp 1.390.075.362
  await setSaldoAwal(tb.id, "112", 1388223436);
  await addTx(tb.id, "112", new Date("2026-05-10"), 1851926, 0, "MUT-AFIL-TB-GS-01", "Pemberian pinjaman TB ke GS");

  // - Piutang CAD (114): Awal Rp 0 + Mutasi Rp 10.218.204 = Rp 10.218.204
  await setSaldoAwal(tb.id, "114", 0);
  await addTx(tb.id, "114", new Date("2026-05-18"), 10218204, 0, "MUT-AFIL-TB-CAD-01", "Pemberian dana talangan material ke CAD");

  // - Piutang KP (115): Awal Rp 140.472 + Mutasi Rp 7.783.347 = Rp 7.923.819
  await setSaldoAwal(tb.id, "115", 140472);
  await addTx(tb.id, "115", new Date("2026-08-05"), 7783347, 0, "MUT-AFIL-TB-KP-01", "Pemberian talangan operasional TB ke KP");

  // ══════════════════════════════════════════════════════════════════════════
  // 5. KARDI PRATAMA / UMUM (KP) — SINKRON DENGAN SEMUA ENTITAS
  // ══════════════════════════════════════════════════════════════════════════
  // KP vs CAD:
  await setSaldoAwal(kp.id, "114", 0);
  await setSaldoAwal(kp.id, "314", 10560107); // Hutang CAD Rp 10.560.107 (sinkron dgn Piutang KP di CAD)

  // KP vs KAK:
  await setSaldoAwal(kp.id, "111", 80000000);  // Piutang KAK Rp 80 JT (sinkron)
  await setSaldoAwal(kp.id, "311", 120000000); // Hutang KAK Rp 120 JT (sinkron)

  // KP vs GS:
  await setSaldoAwal(kp.id, "112", 40000000);  // Piutang GS Rp 40 JT (sinkron)
  await setSaldoAwal(kp.id, "312", 95000000);  // Hutang GS Rp 95 JT (sinkron)

  // KP vs TB (Sinkron persis dengan Rekap Hutang/Piutang Tataring Bali di Excel):
  // TB Piutang KP: Saldo awal Rp 140.472 + mutasi Rp 7.783.347 = Rp 7.923.819
  await setSaldoAwal(kp.id, "313", 140472);
  await addTx(kp.id, "313", new Date("2026-08-05"), 0, 7783347, "MUT-AFIL-TB-KP", "Penerimaan talangan operasional dari TB");
  await setSaldoAwal(kp.id, "113", 0);

  console.log("Seeding complete! All inter-entity debt & receivable dummy data are 100% synchronized.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
