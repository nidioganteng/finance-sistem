import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding payroll dummy data...");

  const gaharu = await prisma.entity.findFirst({ where: { key: "gaharu" } });
  const kencana = await prisma.entity.findFirst({ where: { key: "kencana" } });
  const tataring = await prisma.entity.findFirst({ where: { key: "tataring" } });

  if (!gaharu) {
    console.error("Entitas Gaharu tidak ditemukan!");
    return;
  }

  // Fetch some projects for linking
  const dorisProject = await prisma.project.findFirst({
    where: { entityId: gaharu.id, code: "GHR-001" },
  });
  const kahayanProject = await prisma.project.findFirst({
    where: { entityId: gaharu.id, code: "GHR-002" },
  });
  const drainaseProject = await prisma.project.findFirst({
    where: { entityId: gaharu.id, code: "GHR-003" },
  });

  // Fetch rekanan tenaga ahli if any
  const bambangRekanan = await prisma.rekanan.findFirst({
    where: { nama: { contains: "Bambang Wijaya" } },
  });
  const hendraRekanan = await prisma.rekanan.findFirst({
    where: { nama: { contains: "Hendra Setiawan" } },
  });

  // ==========================================
  // 1. SEED MASTER PEGAWAI GAHARU
  // ==========================================
  const pegawaiGaharuData = [
    {
      nik: "GHR-EMP-001",
      nama: "Ahmad Fauzi, S.T.",
      jabatan: "Project Manager",
      statusKeluarga: "K/1",
      ptkp: 63000000,
      gajiPokok: 8500000,
      entityId: gaharu.id,
      monthly: {
        tunjanganJabatan: 1500000,
        tunjanganTransport: 800000,
        insentif: 700000,
        bpjsKesehatan: 150000,
        bpjsKetenagakerjaan: 250000,
        pph21: 220000,
      },
    },
    {
      nik: "GHR-EMP-002",
      nama: "Siti Rahmawati, S.E.",
      jabatan: "Finance & Accounting Supervisor",
      statusKeluarga: "TK/0",
      ptkp: 54000000,
      gajiPokok: 6500000,
      entityId: gaharu.id,
      monthly: {
        tunjanganJabatan: 1000000,
        tunjanganTransport: 500000,
        insentif: 500000,
        bpjsKesehatan: 100000,
        bpjsKetenagakerjaan: 180000,
        pph21: 150000,
      },
    },
    {
      nik: "GHR-EMP-003",
      nama: "Budi Santoso, S.T.",
      jabatan: "Site Engineer",
      statusKeluarga: "K/2",
      ptkp: 67500000,
      gajiPokok: 7000000,
      entityId: gaharu.id,
      monthly: {
        tunjanganJabatan: 1000000,
        tunjanganTransport: 600000,
        insentif: 600000,
        bpjsKesehatan: 120000,
        bpjsKetenagakerjaan: 200000,
        pph21: 160000,
      },
    },
    {
      nik: "GHR-EMP-004",
      nama: "Dewi Lestari, A.Md.",
      jabatan: "Draftsperson / CAD Operator",
      statusKeluarga: "TK/0",
      ptkp: 54000000,
      gajiPokok: 5000000,
      entityId: gaharu.id,
      monthly: {
        tunjanganJabatan: 500000,
        tunjanganTransport: 400000,
        insentif: 300000,
        bpjsKesehatan: 80000,
        bpjsKetenagakerjaan: 140000,
        pph21: 60000,
      },
    },
    {
      nik: "GHR-EMP-005",
      nama: "Rian Hidayat",
      jabatan: "Admin Proyek & Logistik",
      statusKeluarga: "TK/1",
      ptkp: 58500000,
      gajiPokok: 4500000,
      entityId: gaharu.id,
      monthly: {
        tunjanganJabatan: 300000,
        tunjanganTransport: 400000,
        insentif: 200000,
        bpjsKesehatan: 70000,
        bpjsKetenagakerjaan: 120000,
        pph21: 40000,
      },
    },
  ];

  for (const emp of pegawaiGaharuData) {
    const existing = await prisma.pegawai.findFirst({
      where: { entityId: emp.entityId, nik: emp.nik },
    });

    const pegawai = existing
      ? await prisma.pegawai.update({
          where: { id: existing.id },
          data: {
            nama: emp.nama,
            jabatan: emp.jabatan,
            statusKeluarga: emp.statusKeluarga,
            ptkp: emp.ptkp,
            gajiPokok: emp.gajiPokok,
            isActive: true,
          },
        })
      : await prisma.pegawai.create({
          data: {
            nik: emp.nik,
            nama: emp.nama,
            jabatan: emp.jabatan,
            statusKeluarga: emp.statusKeluarga,
            ptkp: emp.ptkp,
            gajiPokok: emp.gajiPokok,
            entityId: emp.entityId,
            isActive: true,
          },
        });

    // Seed Gaji Bulanan for Agustus, September, and Oktober 2026
    const months = [8, 9, 10];
    for (const bulan of months) {
      const gajiPokok = emp.gajiPokok;
      const tunjJab = emp.monthly.tunjanganJabatan;
      const tunjTrans = emp.monthly.tunjanganTransport;
      const insentif = emp.monthly.insentif;
      const bpjsKes = emp.monthly.bpjsKesehatan;
      const bpjsTK = emp.monthly.bpjsKetenagakerjaan;
      const pph = emp.monthly.pph21;
      const kotor = gajiPokok + tunjJab + tunjTrans + insentif;
      const bersih = kotor - (bpjsKes + bpjsTK + pph);

      const existingGaji = await prisma.gajiPegawaiBulanan.findUnique({
        where: {
          pegawaiId_bulan_tahun: {
            pegawaiId: pegawai.id,
            bulan,
            tahun: 2026,
          },
        },
      });

      if (!existingGaji) {
        await prisma.gajiPegawaiBulanan.create({
          data: {
            entityId: emp.entityId,
            pegawaiId: pegawai.id,
            bulan,
            tahun: 2026,
            gajiPokok,
            tunjanganJabatan: tunjJab,
            tunjanganTransport: tunjTrans,
            insentif,
            bpjsKesehatan: bpjsKes,
            bpjsKetenagakerjaan: bpjsTK,
            potonganLain: 0,
            pph21: pph,
            totalGajiKotor: kotor,
            totalGajiBersih: bersih,
            catatan: `Payroll Bulan ${bulan}/2026`,
          },
        });
      }
    }
  }

  // ==========================================
  // 2. SEED MASTER PEGAWAI KENCANA (OPTIONAL JIKA ENTITAS ADA)
  // ==========================================
  if (kencana) {
    const pegawaiKencanaData = [
      {
        nik: "KCN-EMP-001",
        nama: "Hendro Prasetyo, S.T.",
        jabatan: "Site Coordinator",
        statusKeluarga: "K/1",
        ptkp: 63000000,
        gajiPokok: 7500000,
        entityId: kencana.id,
        monthly: {
          tunjanganJabatan: 1000000,
          tunjanganTransport: 600000,
          insentif: 400000,
          bpjsKesehatan: 120000,
          bpjsKetenagakerjaan: 200000,
          pph21: 170000,
        },
      },
      {
        nik: "KCN-EMP-002",
        nama: "Maya Indah, S.Ak.",
        jabatan: "Staff Keuangan & Kasir",
        statusKeluarga: "TK/0",
        ptkp: 54000000,
        gajiPokok: 5500000,
        entityId: kencana.id,
        monthly: {
          tunjanganJabatan: 500000,
          tunjanganTransport: 400000,
          insentif: 300000,
          bpjsKesehatan: 90000,
          bpjsKetenagakerjaan: 150000,
          pph21: 80000,
        },
      },
    ];

    for (const emp of pegawaiKencanaData) {
      const existing = await prisma.pegawai.findFirst({
        where: { entityId: emp.entityId, nik: emp.nik },
      });

      const pegawai = existing
        ? await prisma.pegawai.update({
            where: { id: existing.id },
            data: {
              nama: emp.nama,
              jabatan: emp.jabatan,
              statusKeluarga: emp.statusKeluarga,
              ptkp: emp.ptkp,
              gajiPokok: emp.gajiPokok,
              isActive: true,
            },
          })
        : await prisma.pegawai.create({
            data: {
              nik: emp.nik,
              nama: emp.nama,
              jabatan: emp.jabatan,
              statusKeluarga: emp.statusKeluarga,
              ptkp: emp.ptkp,
              gajiPokok: emp.gajiPokok,
              entityId: emp.entityId,
              isActive: true,
            },
          });

      for (const bulan of [9, 10]) {
        const kotor =
          emp.gajiPokok +
          emp.monthly.tunjanganJabatan +
          emp.monthly.tunjanganTransport +
          emp.monthly.insentif;
        const bersih =
          kotor -
          (emp.monthly.bpjsKesehatan +
            emp.monthly.bpjsKetenagakerjaan +
            emp.monthly.pph21);

        const existingGaji = await prisma.gajiPegawaiBulanan.findUnique({
          where: {
            pegawaiId_bulan_tahun: {
              pegawaiId: pegawai.id,
              bulan,
              tahun: 2026,
            },
          },
        });

        if (!existingGaji) {
          await prisma.gajiPegawaiBulanan.create({
            data: {
              entityId: emp.entityId,
              pegawaiId: pegawai.id,
              bulan,
              tahun: 2026,
              gajiPokok: emp.gajiPokok,
              tunjanganJabatan: emp.monthly.tunjanganJabatan,
              tunjanganTransport: emp.monthly.tunjanganTransport,
              insentif: emp.monthly.insentif,
              bpjsKesehatan: emp.monthly.bpjsKesehatan,
              bpjsKetenagakerjaan: emp.monthly.bpjsKetenagakerjaan,
              potonganLain: 0,
              pph21: emp.monthly.pph21,
              totalGajiKotor: kotor,
              totalGajiBersih: bersih,
              catatan: `Payroll Bulan ${bulan}/2026`,
            },
          });
        }
      }
    }
  }

  // ==========================================
  // 3. SEED HONOR TENAGA AHLI (LINTAS ENTITAS)
  // ==========================================
  const honorTenagaAhliData = [
    {
      entityId: gaharu.id,
      rekananId: bambangRekanan?.id ?? null,
      nik: "6271011508820001",
      nama: "Ir. Bambang Wijaya, MT, IAI",
      npwp: "82.111.222.3-711.000",
      uraian: "Honorarium Tenaga Ahli Arsitektur Utama Periode Oktober 2026",
      tanggal: new Date("2026-10-05"),
      bulan: 10,
      tahun: 2026,
      nominalHonor: 25000000,
      tarifPph21Persen: 5,
      pph21: 1250000,
      nominalBersih: 23750000,
      projectId: dorisProject?.id ?? null,
      noBukti: "HON-GHR-2610-001",
    },
    {
      entityId: gaharu.id,
      rekananId: hendraRekanan?.id ?? null,
      nik: "6271032104790002",
      nama: "Dr. Ir. Hendra Setiawan, IPM",
      npwp: "84.333.444.5-711.000",
      uraian: "Review Desain dan Analisis Struktur Jembatan Sei Kahayan",
      tanggal: new Date("2026-10-06"),
      bulan: 10,
      tahun: 2026,
      nominalHonor: 30000000,
      tarifPph21Persen: 5,
      pph21: 1500000,
      nominalBersih: 28500000,
      projectId: kahayanProject?.id ?? null,
      noBukti: "HON-GHR-2610-002",
    },
    {
      entityId: gaharu.id,
      rekananId: null,
      nik: "6271025510860003",
      nama: "Ratna Kusuma, S.T., M.Sc.",
      npwp: "75.888.999.1-711.000",
      uraian: "Penyusunan Kajian Lingkungan & Hidrologi Drainase Perkotaan",
      tanggal: new Date("2026-10-07"),
      bulan: 10,
      tahun: 2026,
      nominalHonor: 18000000,
      tarifPph21Persen: 5,
      pph21: 900000,
      nominalBersih: 17100000,
      projectId: drainaseProject?.id ?? null,
      noBukti: "HON-GHR-2610-003",
    },
  ];

  // Tambahkan pembayaran tenaga ahli di entitas lain (Kencana & Tataring) agar konsolidasi lintas entitas terlihat
  if (kencana) {
    honorTenagaAhliData.push({
      entityId: kencana.id,
      rekananId: bambangRekanan?.id ?? null,
      nik: "6271011508820001",
      nama: "Ir. Bambang Wijaya, MT, IAI",
      npwp: "82.111.222.3-711.000",
      uraian: "Konsultasi Masterplan Kawasan Terpadu Kencana",
      tanggal: new Date("2026-09-15"),
      bulan: 9,
      tahun: 2026,
      nominalHonor: 15000000,
      tarifPph21Persen: 5,
      pph21: 750000,
      nominalBersih: 14250000,
      projectId: null,
      noBukti: "HON-KCN-2609-001",
    });
  }

  if (tataring) {
    honorTenagaAhliData.push({
      entityId: tataring.id,
      rekananId: null,
      nik: "6271025510860003",
      nama: "Ratna Kusuma, S.T., M.Sc.",
      npwp: "75.888.999.1-711.000",
      uraian: "Kajian Amdal Proyek Pembangunan Tataring",
      tanggal: new Date("2026-09-20"),
      bulan: 9,
      tahun: 2026,
      nominalHonor: 12000000,
      tarifPph21Persen: 5,
      pph21: 600000,
      nominalBersih: 11400000,
      projectId: null,
      noBukti: "HON-TTR-2609-001",
    });
  }

  for (const h of honorTenagaAhliData) {
    const existing = await prisma.honorTenagaAhli.findFirst({
      where: {
        entityId: h.entityId,
        nik: h.nik,
        bulan: h.bulan,
        tahun: h.tahun,
        uraian: h.uraian,
      },
    });

    if (!existing) {
      await prisma.honorTenagaAhli.create({
        data: h,
      });
    }
  }

  console.log("Seeding payroll dummy data completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
