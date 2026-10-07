import { PrismaClient, RekananTipe } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const initialRekanan = [
    {
      nama: "Dinas Pekerjaan Umum dan Penataan Ruang Prov. Kalteng",
      npwp: "00.123.456.7-711.000",
      nik: null,
      tipe: RekananTipe.KLIEN,
      kategori: "Dinas Pemerintah",
      alamat: "Jl. S. Parman No. 1, Palangka Raya",
      telepon: "0536-3221234",
      email: "pupr@kalteng.go.id",
      namaBank: "Bank Kalteng",
      noRekening: "100.01.00.012345-6",
      atasNamaBank: "Bendahara Pengeluaran Dinas PUPR",
    },
    {
      nama: "RSUD dr. Doris Sylvanus Palangka Raya",
      npwp: "00.987.654.3-711.000",
      nik: null,
      tipe: RekananTipe.KLIEN,
      kategori: "BLUD / Rumah Sakit",
      alamat: "Jl. Tambun Bungai No. 4, Palangka Raya",
      telepon: "0536-3221777",
      email: "info@rsuddorissylvanus.id",
      namaBank: "Bank Kalteng",
      noRekening: "100.02.00.098765-4",
      atasNamaBank: "Bendahara Penerimaan RSUD Doris Sylvanus",
    },
    {
      nama: "Bappedalitbang Provinsi Kalimantan Tengah",
      npwp: "00.555.444.3-711.000",
      nik: null,
      tipe: RekananTipe.KLIEN,
      kategori: "Badan Perencanaan",
      alamat: "Jl. Diponegoro No. 60, Palangka Raya",
      telepon: "0536-3221444",
      email: "bappeda@kalteng.go.id",
      namaBank: "Bank Kalteng",
      noRekening: "100.01.00.055544-3",
      atasNamaBank: "Bappedalitbang Prov Kalteng",
    },
    {
      nama: "PT Semen Indonesia Distributor Kalteng",
      npwp: "01.324.567.8-054.000",
      nik: null,
      tipe: RekananTipe.VENDOR,
      kategori: "Supplier Material Konstruksi",
      alamat: "Jl. Tjilik Riwut Km. 5, Palangka Raya",
      telepon: "0536-3229988",
      email: "sales@semenindonesia-kalteng.com",
      namaBank: "Bank Mandiri",
      noRekening: "159-00-1234567-8",
      atasNamaBank: "PT Semen Indonesia Distributor",
    },
    {
      nama: "CV Kahayan Mitra Konstruksi",
      npwp: "71.234.567.8-711.000",
      nik: null,
      tipe: RekananTipe.VENDOR,
      kategori: "Subkontraktor Sipil",
      alamat: "Jl. RTA Milono Km. 3, Palangka Raya",
      telepon: "081255443322",
      email: "kahayan.mitra@gmail.com",
      namaBank: "Bank BRI",
      noRekening: "0100-01-002233-50-1",
      atasNamaBank: "CV Kahayan Mitra Konstruksi",
    },
    {
      nama: "Ir. Bambang Wijaya, MT, IAI",
      npwp: "82.111.222.3-711.000",
      nik: "6271011508820001",
      tipe: RekananTipe.TENAGA_AHLI,
      kategori: "Ahli Arsitektur Utama",
      alamat: "Jl. Rajawali VII No. 12, Palangka Raya",
      telepon: "08115201234",
      email: "bambang.wijaya.mt@gmail.com",
      namaBank: "Bank BNI",
      noRekening: "0234567891",
      atasNamaBank: "Bambang Wijaya",
    },
    {
      nama: "Dr. Ir. Hendra Setiawan, IPM",
      npwp: "84.333.444.5-711.000",
      nik: "6271032104790002",
      tipe: RekananTipe.TENAGA_AHLI,
      kategori: "Ahli Struktur & Geoteknik",
      alamat: "Jl. Bukit Hindu No. 45, Palangka Raya",
      telepon: "081349887766",
      email: "hendra.setiawan@eng.ac.id",
      namaBank: "Bank Mandiri",
      noRekening: "159-00-9876543-2",
      atasNamaBank: "Hendra Setiawan",
    },
  ];

  console.log("Seeding master rekanan terpusat...");
  for (const r of initialRekanan) {
    // Cari apakah sudah ada nama atau NPWP yang sama
    const existing = await prisma.rekanan.findFirst({
      where: {
        OR: [
          { nama: r.nama },
          ...(r.npwp ? [{ npwp: r.npwp }] : []),
        ],
      },
    });

    if (existing) {
      await prisma.rekanan.update({
        where: { id: existing.id },
        data: r,
      });
    } else {
      await prisma.rekanan.create({
        data: r,
      });
    }
  }

  const count = await prisma.rekanan.count();
  console.log(`✅ Berhasil menambahkan / memperbarui ${count} master rekanan.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
