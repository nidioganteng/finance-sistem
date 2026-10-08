import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";

export const PTKP_RATES: Record<string, number> = {
  "TK/0": 54000000,
  "TK/1": 58500000,
  "TK/2": 63000000,
  "TK/3": 67500000,
  "K/0": 58500000,
  "K/1": 63000000,
  "K/2": 67500000,
  "K/3": 72000000,
};

export type PegawaiItem = {
  id: string;
  entityId: string;
  nik: string;
  nama: string;
  jabatan: string;
  statusKeluarga: string;
  ptkp: number;
  ptkpFmt: string;
  gajiPokok: number;
  gajiPokokFmt: string;
  isActive: boolean;
  currentGaji?: GajiBulananItem | null;
  akumulasiTahun?: {
    totalGajiKotor: number;
    totalGajiBersih: number;
    totalPph21: number;
    bulanTerbayar: number;
  };
};

export type GajiBulananItem = {
  id: string;
  pegawaiId: string;
  pegawaiNama: string;
  pegawaiNik: string;
  pegawaiJabatan: string;
  bulan: number;
  tahun: number;
  gajiPokok: number;
  gajiPokokFmt: string;
  tunjanganJabatan: number;
  tunjanganJabatanFmt: string;
  tunjanganTransport: number;
  tunjanganTransportFmt: string;
  insentif: number;
  insentifFmt: string;
  bpjsKesehatan: number;
  bpjsKesehatanFmt: string;
  bpjsKetenagakerjaan: number;
  bpjsKetenagakerjaanFmt: string;
  potonganLain: number;
  potonganLainFmt: string;
  pph21: number;
  pph21Fmt: string;
  totalGajiKotor: number;
  totalGajiKotorFmt: string;
  totalGajiBersih: number;
  totalGajiBersihFmt: string;
  catatan?: string | null;
};

export type HonorTenagaAhliItem = {
  id: string;
  entityId: string;
  entityName: string;
  entityKey: string;
  rekananId?: string | null;
  nik: string;
  nama: string;
  npwp?: string | null;
  uraian: string;
  tanggal: string;
  tanggalFmt: string;
  bulan: number;
  tahun: number;
  nominalHonor: number;
  nominalHonorFmt: string;
  tarifPph21Persen: number;
  pph21: number;
  pph21Fmt: string;
  nominalBersih: number;
  nominalBersihFmt: string;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  namaProyek?: string | null;
  noBukti?: string | null;
};

export const BULAN_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export type RekapBulanPegawaiItem = {
  bulan: number;
  bulanName: string;
  totalPegawai: number;
  totalGajiPokok: number;
  totalGajiPokokFmt: string;
  totalTunjangan: number;
  totalTunjanganFmt: string;
  totalInsentif: number;
  totalInsentifFmt: string;
  totalGajiKotor: number;
  totalGajiKotorFmt: string;
  totalBpjs: number;
  totalBpjsFmt: string;
  totalPph21: number;
  totalPph21Fmt: string;
  totalPotonganLain: number;
  totalPotonganLainFmt: string;
  totalGajiBersih: number;
  totalGajiBersihFmt: string;
};

export type RekapBulanTenagaAhliItem = {
  bulan: number;
  bulanName: string;
  totalTransaksi: number;
  totalHonorBruto: number;
  totalHonorBrutoFmt: string;
  totalPph21: number;
  totalPph21Fmt: string;
  totalHonorBersih: number;
  totalHonorBersihFmt: string;
};

export type RekapTenagaAhliPerNamaItem = {
  nik: string;
  nama: string;
  npwp?: string | null;
  totalTransaksi: number;
  totalHonorBruto: number;
  totalHonorBrutoFmt: string;
  totalPph21: number;
  totalPph21Fmt: string;
  totalHonorBersih: number;
  totalHonorBersihFmt: string;
  daftarEntitas: string[];
  daftarProyek: string[];
  daftarBulan: string[];
  rincian: {
    id: string;
    entityId: string;
    entityName: string;
    tanggal: string;
    tanggalFmt: string;
    bulan: number;
    bulanName: string;
    uraian: string;
    namaProyek: string;
    noBukti?: string | null;
    nominalHonor: number;
    nominalHonorFmt: string;
    pph21: number;
    pph21Fmt: string;
    nominalBersih: number;
    nominalBersihFmt: string;
  }[];
};

export type KonsolidasiTenagaAhliItem = {
  nik: string;
  nama: string;
  npwp?: string | null;
  totalTransaksi: number;
  totalHonorBruto: number;
  totalHonorBrutoFmt: string;
  totalPph21: number;
  totalPph21Fmt: string;
  totalHonorBersih: number;
  totalHonorBersihFmt: string;
  perEntitas: {
    entityId: string;
    entityName: string;
    entityKey: string;
    nominalHonor: number;
    nominalHonorFmt: string;
    pph21: number;
    pph21Fmt: string;
    transaksiCount: number;
  }[];
};

export type JurnalTransaksiGajiItem = {
  id: string;
  entityId: string;
  tanggal: string;
  tanggalFmt: string;
  bulan: number;
  tahun: number;
  noBukti: string;
  keterangan: string;
  coaAccountId: string | null;
  coaCode: string;
  coaName: string;
  jenisInputKey: string;
  jenisInputNama: string;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  namaProyek?: string | null;
  debit: number;
  debitFmt: string;
  kredit: number;
  kreditFmt: string;
  staffName?: string | null;
};

export type PenyesuaianAkunGajiDetail = {
  coaCode: string;
  coaName: string;
  totalPayrollBulan: number;
  totalPayrollBulanFmt: string;
  totalJurnalBulan: number;
  totalJurnalBulanFmt: string;
  selisihBulan: number;
  selisihBulanFmt: string;
  isSinkronBulan: boolean;

  totalPayrollTahun: number;
  totalPayrollTahunFmt: string;
  totalJurnalTahun: number;
  totalJurnalTahunFmt: string;
  selisihTahun: number;
  selisihTahunFmt: string;
  isSinkronTahun: boolean;

  transaksiBulan: JurnalTransaksiGajiItem[];
  transaksiTahun: JurnalTransaksiGajiItem[];
};

export type PenyesuaianAkunGaji = {
  pegawai: PenyesuaianAkunGajiDetail;
  tenagaAhli: PenyesuaianAkunGajiDetail;
};

export type PayrollSyncLabaRugi = {
  tahun: number;
  bulan?: number;
  // Pegawai Tetap
  payrollGajiPegawai: number;
  payrollGajiPegawaiFmt: string;
  glBebanGaji511: number;
  glBebanGaji511Fmt: string;
  selisihGajiPegawai: number;
  selisihGajiPegawaiFmt: string;
  isGajiPegawaiSinkron: boolean;

  // Tenaga Ahli
  payrollHonorTenagaAhli: number;
  payrollHonorTenagaAhliFmt: string;
  glBebanTenagaAhli612: number;
  glBebanTenagaAhli612Fmt: string;
  selisihTenagaAhli: number;
  selisihTenagaAhliFmt: string;
  isTenagaAhliSinkron: boolean;

  // Total
  totalPayroll: number;
  totalPayrollFmt: string;
  totalGLBeban: number;
  totalGLBebanFmt: string;
  totalSelisih: number;
  totalSelisihFmt: string;
  isOverallSinkron: boolean;

  // Transaksi Jurnal Umum
  jurnalPegawaiRows: JurnalTransaksiGajiItem[];
  jurnalTenagaAhliRows: JurnalTransaksiGajiItem[];
};

export async function getPayrollData(
  entityId: string,
  year: number,
  month: number
) {
  // 1. Fetch Entity info
  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    select: { id: true, key: true, name: true, legalName: true },
  });

  const allEntities = await prisma.entity.findMany({
    select: { id: true, key: true, name: true, legalName: true },
    orderBy: { name: "asc" },
  });

  // 2. Fetch Projects for dropdown
  const projects = await prisma.project.findMany({
    where: { entityId },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  // 3. Fetch Master Database Tenaga Ahli (Lintas Entitas Holding)
  const rekananTenagaAhli = await prisma.rekanan.findMany({
    where: {
      tipe: "TENAGA_AHLI",
    },
    select: {
      id: true,
      nama: true,
      nik: true,
      npwp: true,
      kategori: true,
    },
    orderBy: { nama: "asc" },
  });

  // 4. Fetch Pegawai Tetap for this entity
  const pegawaiRaw = await prisma.pegawai.findMany({
    where: { entityId },
    include: {
      gajiBulanan: {
        where: { tahun: year },
      },
    },
    orderBy: [{ isActive: "desc" }, { nama: "asc" }],
  });

  const pegawaiList: PegawaiItem[] = pegawaiRaw.map((p) => {
    const currentGajiRaw = p.gajiBulanan.find((g) => g.bulan === month);
    const ptkpNum = Number(p.ptkp);
    const gajiPokokNum = Number(p.gajiPokok);

    let currentGaji: GajiBulananItem | null = null;
    if (currentGajiRaw) {
      const gp = Number(currentGajiRaw.gajiPokok);
      const tj = Number(currentGajiRaw.tunjanganJabatan);
      const tt = Number(currentGajiRaw.tunjanganTransport);
      const ins = Number(currentGajiRaw.insentif);
      const bpjsKes = Number(currentGajiRaw.bpjsKesehatan);
      const bpjsTk = Number(currentGajiRaw.bpjsKetenagakerjaan);
      const pot = Number(currentGajiRaw.potonganLain);
      const pph = Number(currentGajiRaw.pph21);
      const kotor = Number(currentGajiRaw.totalGajiKotor);
      const bersih = Number(currentGajiRaw.totalGajiBersih);

      currentGaji = {
        id: currentGajiRaw.id,
        pegawaiId: p.id,
        pegawaiNama: p.nama,
        pegawaiNik: p.nik,
        pegawaiJabatan: p.jabatan,
        bulan: currentGajiRaw.bulan,
        tahun: currentGajiRaw.tahun,
        gajiPokok: gp,
        gajiPokokFmt: formatRupiah(gp),
        tunjanganJabatan: tj,
        tunjanganJabatanFmt: formatRupiah(tj),
        tunjanganTransport: tt,
        tunjanganTransportFmt: formatRupiah(tt),
        insentif: ins,
        insentifFmt: formatRupiah(ins),
        bpjsKesehatan: bpjsKes,
        bpjsKesehatanFmt: formatRupiah(bpjsKes),
        bpjsKetenagakerjaan: bpjsTk,
        bpjsKetenagakerjaanFmt: formatRupiah(bpjsTk),
        potonganLain: pot,
        potonganLainFmt: formatRupiah(pot),
        pph21: pph,
        pph21Fmt: formatRupiah(pph),
        totalGajiKotor: kotor,
        totalGajiKotorFmt: formatRupiah(kotor),
        totalGajiBersih: bersih,
        totalGajiBersihFmt: formatRupiah(bersih),
        catatan: currentGajiRaw.catatan,
      };
    }

    // Akumulasi tahunan
    const totalGajiKotorThn = p.gajiBulanan.reduce(
      (sum, g) => sum + Number(g.totalGajiKotor),
      0
    );
    const totalGajiBersihThn = p.gajiBulanan.reduce(
      (sum, g) => sum + Number(g.totalGajiBersih),
      0
    );
    const totalPph21Thn = p.gajiBulanan.reduce(
      (sum, g) => sum + Number(g.pph21),
      0
    );

    return {
      id: p.id,
      entityId: p.entityId,
      nik: p.nik,
      nama: p.nama,
      jabatan: p.jabatan,
      statusKeluarga: p.statusKeluarga,
      ptkp: ptkpNum,
      ptkpFmt: formatRupiah(ptkpNum),
      gajiPokok: gajiPokokNum,
      gajiPokokFmt: formatRupiah(gajiPokokNum),
      isActive: p.isActive,
      currentGaji,
      akumulasiTahun: {
        totalGajiKotor: totalGajiKotorThn,
        totalGajiBersih: totalGajiBersihThn,
        totalPph21: totalPph21Thn,
        bulanTerbayar: p.gajiBulanan.length,
      },
    };
  });

  // Summary bulanan Pegawai Tetap
  const gajiBulanIni = pegawaiList
    .map((p) => p.currentGaji)
    .filter((g): g is GajiBulananItem => g !== null && g !== undefined);

  const summaryBulanIni = {
    totalPegawaiAktif: pegawaiList.filter((p) => p.isActive).length,
    totalPegawaiInput: gajiBulanIni.length,
    totalGajiPokok: gajiBulanIni.reduce((s, g) => s + g.gajiPokok, 0),
    totalTunjanganJabatan: gajiBulanIni.reduce((s, g) => s + g.tunjanganJabatan, 0),
    totalTunjanganTransport: gajiBulanIni.reduce((s, g) => s + g.tunjanganTransport, 0),
    totalInsentif: gajiBulanIni.reduce((s, g) => s + g.insentif, 0),
    totalBpjsKesehatan: gajiBulanIni.reduce((s, g) => s + g.bpjsKesehatan, 0),
    totalBpjsKetenagakerjaan: gajiBulanIni.reduce((s, g) => s + g.bpjsKetenagakerjaan, 0),
    totalPotonganLain: gajiBulanIni.reduce((s, g) => s + g.potonganLain, 0),
    totalPph21: gajiBulanIni.reduce((s, g) => s + g.pph21, 0),
    totalGajiKotor: gajiBulanIni.reduce((s, g) => s + g.totalGajiKotor, 0),
    totalGajiBersih: gajiBulanIni.reduce((s, g) => s + g.totalGajiBersih, 0),
  };

  // 5. Fetch Honor Tenaga Ahli (Entitas saat ini pada bulan & tahun terpilih)
  const honorRaw = await prisma.honorTenagaAhli.findMany({
    where: {
      entityId,
      tahun: year,
      bulan: month,
    },
    include: {
      entity: { select: { id: true, key: true, name: true } },
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: { tanggal: "desc" },
  });

  const honorList: HonorTenagaAhliItem[] = honorRaw.map((h) => {
    const bruto = Number(h.nominalHonor);
    const pph = Number(h.pph21);
    const bersih = Number(h.nominalBersih);
    const resolvedProjName =
      h.namaProyek || (h.project ? `${h.project.code} - ${h.project.name}` : null);
    return {
      id: h.id,
      entityId: h.entityId,
      entityName: h.entity.name,
      entityKey: h.entity.key,
      rekananId: h.rekananId,
      nik: h.nik,
      nama: h.nama,
      npwp: h.npwp,
      uraian: h.uraian,
      tanggal: h.tanggal.toISOString(),
      tanggalFmt: h.tanggal.toLocaleDateString("id-ID"),
      bulan: h.bulan,
      tahun: h.tahun,
      nominalHonor: bruto,
      nominalHonorFmt: formatRupiah(bruto),
      tarifPph21Persen: Number(h.tarifPph21Persen),
      pph21: pph,
      pph21Fmt: formatRupiah(pph),
      nominalBersih: bersih,
      nominalBersihFmt: formatRupiah(bersih),
      projectId: h.projectId,
      projectCode: h.project?.code ?? null,
      projectName: h.project?.name ?? null,
      namaProyek: resolvedProjName,
      noBukti: h.noBukti,
    };
  });

  const summaryHonorBulanIni = {
    totalTransaksi: honorList.length,
    totalHonorBruto: honorList.reduce((s, h) => s + h.nominalHonor, 0),
    totalPph21: honorList.reduce((s, h) => s + h.pph21, 0),
    totalHonorBersih: honorList.reduce((s, h) => s + h.nominalBersih, 0),
  };

  // 6. Rekapitulasi Per Bulan (Januari - Desember) untuk Pegawai Tetap
  const allGajiTahunRaw = await prisma.gajiPegawaiBulanan.findMany({
    where: { entityId, tahun: year },
    orderBy: [{ bulan: "asc" }],
  });

  const rekapBulananPegawai: RekapBulanPegawaiItem[] = BULAN_NAMES.map((name, idx) => {
    const m = idx + 1;
    const gListM = allGajiTahunRaw.filter((g) => g.bulan === m);
    const totGajiPokok = gListM.reduce((s, g) => s + Number(g.gajiPokok), 0);
    const totTunjangan = gListM.reduce(
      (s, g) => s + Number(g.tunjanganJabatan) + Number(g.tunjanganTransport),
      0
    );
    const totInsentif = gListM.reduce((s, g) => s + Number(g.insentif), 0);
    const totGajiKotor = gListM.reduce((s, g) => s + Number(g.totalGajiKotor), 0);
    const totBpjs = gListM.reduce(
      (s, g) => s + Number(g.bpjsKesehatan) + Number(g.bpjsKetenagakerjaan),
      0
    );
    const totPph21 = gListM.reduce((s, g) => s + Number(g.pph21), 0);
    const totPotonganLain = gListM.reduce((s, g) => s + Number(g.potonganLain), 0);
    const totGajiBersih = gListM.reduce((s, g) => s + Number(g.totalGajiBersih), 0);

    return {
      bulan: m,
      bulanName: name,
      totalPegawai: gListM.length,
      totalGajiPokok: totGajiPokok,
      totalGajiPokokFmt: formatRupiah(totGajiPokok),
      totalTunjangan: totTunjangan,
      totalTunjanganFmt: formatRupiah(totTunjangan),
      totalInsentif: totInsentif,
      totalInsentifFmt: formatRupiah(totInsentif),
      totalGajiKotor: totGajiKotor,
      totalGajiKotorFmt: formatRupiah(totGajiKotor),
      totalBpjs: totBpjs,
      totalBpjsFmt: formatRupiah(totBpjs),
      totalPph21: totPph21,
      totalPph21Fmt: formatRupiah(totPph21),
      totalPotonganLain: totPotonganLain,
      totalPotonganLainFmt: formatRupiah(totPotonganLain),
      totalGajiBersih: totGajiBersih,
      totalGajiBersihFmt: formatRupiah(totGajiBersih),
    };
  });

  // 7. Rekapitulasi Per Bulan & Per Nama (Patokan NIK) untuk Tenaga Ahli (Entitas Ini)
  const allHonorEntitasTahun = await prisma.honorTenagaAhli.findMany({
    where: { entityId, tahun: year },
    include: {
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ tanggal: "desc" }],
  });

  const rekapBulananTenagaAhli: RekapBulanTenagaAhliItem[] = BULAN_NAMES.map((name, idx) => {
    const m = idx + 1;
    const hListM = allHonorEntitasTahun.filter((h) => h.bulan === m);
    const bruto = hListM.reduce((s, h) => s + Number(h.nominalHonor), 0);
    const pph = hListM.reduce((s, h) => s + Number(h.pph21), 0);
    const bersih = hListM.reduce((s, h) => s + Number(h.nominalBersih), 0);

    return {
      bulan: m,
      bulanName: name,
      totalTransaksi: hListM.length,
      totalHonorBruto: bruto,
      totalHonorBrutoFmt: formatRupiah(bruto),
      totalPph21: pph,
      totalPph21Fmt: formatRupiah(pph),
      totalHonorBersih: bersih,
      totalHonorBersihFmt: formatRupiah(bersih),
    };
  });

  // 8. Rekapitulasi Tenaga Ahli Lintas Seluruh Entitas (Cek Per Nama & Konsolidasi Holding)
  const allHonorTahunRaw = await prisma.honorTenagaAhli.findMany({
    where: {
      tahun: year,
    },
    include: {
      entity: { select: { id: true, key: true, name: true } },
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ tanggal: "desc" }],
  });

  // Pengelompokan Rekap Tenaga Ahli Per Nama (Patokan NIK) - Lintas Entitas Holding
  const perNamaMap = new Map<string, RekapTenagaAhliPerNamaItem>();
  for (const h of allHonorTahunRaw) {
    const key = h.nik?.trim() || h.nama.trim();
    const resolvedProjName =
      h.namaProyek || (h.project ? `${h.project.code} - ${h.project.name}` : "Umum / Non-Proyek");
    const entityName = h.entity.name;
    const bulanName = BULAN_NAMES[h.bulan - 1] || `Bulan ${h.bulan}`;
    const bruto = Number(h.nominalHonor);
    const pph = Number(h.pph21);
    const bersih = Number(h.nominalBersih);

    if (!perNamaMap.has(key)) {
      perNamaMap.set(key, {
        nik: h.nik,
        nama: h.nama,
        npwp: h.npwp,
        totalTransaksi: 0,
        totalHonorBruto: 0,
        totalHonorBrutoFmt: "Rp 0",
        totalPph21: 0,
        totalPph21Fmt: "Rp 0",
        totalHonorBersih: 0,
        totalHonorBersihFmt: "Rp 0",
        daftarEntitas: [],
        daftarProyek: [],
        daftarBulan: [],
        rincian: [],
      });
    }

    const rec = perNamaMap.get(key)!;
    rec.totalTransaksi += 1;
    rec.totalHonorBruto += bruto;
    rec.totalPph21 += pph;
    rec.totalHonorBersih += bersih;
    if (entityName && !rec.daftarEntitas.includes(entityName)) {
      rec.daftarEntitas.push(entityName);
    }
    if (resolvedProjName && !rec.daftarProyek.includes(resolvedProjName)) {
      rec.daftarProyek.push(resolvedProjName);
    }
    if (bulanName && !rec.daftarBulan.includes(bulanName)) {
      rec.daftarBulan.push(bulanName);
    }
    rec.rincian.push({
      id: h.id,
      entityId: h.entityId,
      entityName: h.entity.name,
      tanggal: h.tanggal.toISOString(),
      tanggalFmt: h.tanggal.toLocaleDateString("id-ID"),
      bulan: h.bulan,
      bulanName,
      uraian: h.uraian,
      namaProyek: resolvedProjName,
      noBukti: h.noBukti,
      nominalHonor: bruto,
      nominalHonorFmt: formatRupiah(bruto),
      pph21: pph,
      pph21Fmt: formatRupiah(pph),
      nominalBersih: bersih,
      nominalBersihFmt: formatRupiah(bersih),
    });
  }

  const rekapTenagaAhliPerNama: RekapTenagaAhliPerNamaItem[] = Array.from(perNamaMap.values())
    .map((r) => ({
      ...r,
      totalHonorBrutoFmt: formatRupiah(r.totalHonorBruto),
      totalPph21Fmt: formatRupiah(r.totalPph21),
      totalHonorBersihFmt: formatRupiah(r.totalHonorBersih),
    }))
    .sort((a, b) => b.totalHonorBruto - a.totalHonorBruto);

  const konsolidasiMap = new Map<string, KonsolidasiTenagaAhliItem>();

  for (const h of allHonorTahunRaw) {
    const key = h.nik || h.nama;
    if (!konsolidasiMap.has(key)) {
      konsolidasiMap.set(key, {
        nik: h.nik,
        nama: h.nama,
        npwp: h.npwp,
        totalTransaksi: 0,
        totalHonorBruto: 0,
        totalHonorBrutoFmt: "Rp 0",
        totalPph21: 0,
        totalPph21Fmt: "Rp 0",
        totalHonorBersih: 0,
        totalHonorBersihFmt: "Rp 0",
        perEntitas: [],
      });
    }

    const item = konsolidasiMap.get(key)!;
    const bruto = Number(h.nominalHonor);
    const pph = Number(h.pph21);
    const bersih = Number(h.nominalBersih);

    item.totalTransaksi += 1;
    item.totalHonorBruto += bruto;
    item.totalPph21 += pph;
    item.totalHonorBersih += bersih;

    let entRow = item.perEntitas.find((e) => e.entityId === h.entityId);
    if (!entRow) {
      entRow = {
        entityId: h.entityId,
        entityName: h.entity.name,
        entityKey: h.entity.key,
        nominalHonor: 0,
        nominalHonorFmt: "Rp 0",
        pph21: 0,
        pph21Fmt: "Rp 0",
        transaksiCount: 0,
      };
      item.perEntitas.push(entRow);
    }
    entRow.nominalHonor += bruto;
    entRow.pph21 += pph;
    entRow.transaksiCount += 1;
  }

  const konsolidasiTenagaAhli: KonsolidasiTenagaAhliItem[] = Array.from(
    konsolidasiMap.values()
  ).map((k) => ({
    ...k,
    totalHonorBrutoFmt: formatRupiah(k.totalHonorBruto),
    totalPph21Fmt: formatRupiah(k.totalPph21),
    totalHonorBersihFmt: formatRupiah(k.totalHonorBersih),
    perEntitas: k.perEntitas.map((e) => ({
      ...e,
      nominalHonorFmt: formatRupiah(e.nominalHonor),
      pph21Fmt: formatRupiah(e.pph21),
    })),
  }));

  // 9. Penarikan Transaksi Jurnal Umum Riil untuk Kode Akun Gaji Pegawai (511) & Tenaga Ahli (612)
  const startYear = new Date(year, 0, 1, 0, 0, 0, 0);
  const endYear = new Date(year, 11, 31, 23, 59, 59, 999);

  const txGajiTahunRaw = await prisma.transaction.findMany({
    where: {
      entityId,
      tanggal: { gte: startYear, lte: endYear },
      coaAccountId: { not: null },
      coaAccount: {
        kategori: "BEBAN",
        OR: [
          { code: "511" },
          { code: "612" },
          { name: { contains: "Gaji" } },
          { name: { contains: "Honor" } },
          { name: { contains: "Tenaga Ahli" } },
        ],
      },
    },
    include: {
      coaAccount: { select: { code: true, name: true } },
      jenisInput: { select: { key: true, nama: true } },
      project: { select: { code: true, name: true } },
      staff: { select: { name: true } },
    },
    orderBy: [{ tanggal: "desc" }, { noBukti: "desc" }],
  });

  const txPegawaiTahun: JurnalTransaksiGajiItem[] = [];
  const txTenagaAhliTahun: JurnalTransaksiGajiItem[] = [];

  for (const t of txGajiTahunRaw) {
    if (!t.coaAccount) continue;
    const code = t.coaAccount.code;
    const name = t.coaAccount.name.toLowerCase();
    const item = mapTransactionToGajiItem(t);

    // Pemisahan transaksi akun jurnal:
    // 1. Kode akun 612 atau Tenaga Ahli/Honor masuk ke Tenaga Ahli
    if (code === "612" || /tenaga ahli|honor/i.test(name)) {
      txTenagaAhliTahun.push(item);
    } else if (code === "511" || /gaji/i.test(name)) {
      // 2. Kode akun 511 atau Gaji Pegawai masuk ke Pegawai Tetap
      txPegawaiTahun.push(item);
    }
  }

  const txPegawaiBulan = txPegawaiTahun.filter((t) => t.bulan === month);
  const txTenagaAhliBulan = txTenagaAhliTahun.filter((t) => t.bulan === month);

  const totalJurnalPegawaiBulan = txPegawaiBulan.reduce((s, t) => s + t.debit, 0);
  const totalJurnalPegawaiTahun = txPegawaiTahun.reduce((s, t) => s + t.debit, 0);
  const totalPayrollPegawaiBulan = summaryBulanIni.totalGajiKotor;
  const totalPayrollPegawaiTahun = rekapBulananPegawai.reduce((s, r) => s + r.totalGajiKotor, 0);
  const selisihPegawaiBulan = Math.abs(totalPayrollPegawaiBulan - totalJurnalPegawaiBulan);
  const selisihPegawaiTahun = Math.abs(totalPayrollPegawaiTahun - totalJurnalPegawaiTahun);

  const totalJurnalTenagaAhliBulan = txTenagaAhliBulan.reduce((s, t) => s + t.debit, 0);
  const totalJurnalTenagaAhliTahun = txTenagaAhliTahun.reduce((s, t) => s + t.debit, 0);
  const totalPayrollTenagaAhliBulan = summaryHonorBulanIni.totalHonorBruto;
  const totalPayrollTenagaAhliTahun = rekapBulananTenagaAhli.reduce((s, r) => s + r.totalHonorBruto, 0);
  const selisihTenagaAhliBulan = Math.abs(totalPayrollTenagaAhliBulan - totalJurnalTenagaAhliBulan);
  const selisihTenagaAhliTahun = Math.abs(totalPayrollTenagaAhliTahun - totalJurnalTenagaAhliTahun);

  const penyesuaianJurnal: PenyesuaianAkunGaji = {
    pegawai: {
      coaCode: "511",
      coaName: "Gaji",
      totalPayrollBulan: totalPayrollPegawaiBulan,
      totalPayrollBulanFmt: formatRupiah(totalPayrollPegawaiBulan),
      totalJurnalBulan: totalJurnalPegawaiBulan,
      totalJurnalBulanFmt: formatRupiah(totalJurnalPegawaiBulan),
      selisihBulan: selisihPegawaiBulan,
      selisihBulanFmt: formatRupiah(selisihPegawaiBulan),
      isSinkronBulan: selisihPegawaiBulan === 0,

      totalPayrollTahun: totalPayrollPegawaiTahun,
      totalPayrollTahunFmt: formatRupiah(totalPayrollPegawaiTahun),
      totalJurnalTahun: totalJurnalPegawaiTahun,
      totalJurnalTahunFmt: formatRupiah(totalJurnalPegawaiTahun),
      selisihTahun: selisihPegawaiTahun,
      selisihTahunFmt: formatRupiah(selisihPegawaiTahun),
      isSinkronTahun: selisihPegawaiTahun === 0,

      transaksiBulan: txPegawaiBulan,
      transaksiTahun: txPegawaiTahun,
    },
    tenagaAhli: {
      coaCode: "612",
      coaName: "Gaji Tenaga Ahli",
      totalPayrollBulan: totalPayrollTenagaAhliBulan,
      totalPayrollBulanFmt: formatRupiah(totalPayrollTenagaAhliBulan),
      totalJurnalBulan: totalJurnalTenagaAhliBulan,
      totalJurnalBulanFmt: formatRupiah(totalJurnalTenagaAhliBulan),
      selisihBulan: selisihTenagaAhliBulan,
      selisihBulanFmt: formatRupiah(selisihTenagaAhliBulan),
      isSinkronBulan: selisihTenagaAhliBulan === 0,

      totalPayrollTahun: totalPayrollTenagaAhliTahun,
      totalPayrollTahunFmt: formatRupiah(totalPayrollTenagaAhliTahun),
      totalJurnalTahun: totalJurnalTenagaAhliTahun,
      totalJurnalTahunFmt: formatRupiah(totalJurnalTenagaAhliTahun),
      selisihTahun: selisihTenagaAhliTahun,
      selisihTahunFmt: formatRupiah(selisihTenagaAhliTahun),
      isSinkronTahun: selisihTenagaAhliTahun === 0,

      transaksiBulan: txTenagaAhliBulan,
      transaksiTahun: txTenagaAhliTahun,
    },
  };

  const syncData: PayrollSyncLabaRugi = {
    tahun: year,
    bulan: month,
    payrollGajiPegawai: totalPayrollPegawaiBulan,
    payrollGajiPegawaiFmt: formatRupiah(totalPayrollPegawaiBulan),
    glBebanGaji511: totalJurnalPegawaiBulan,
    glBebanGaji511Fmt: formatRupiah(totalJurnalPegawaiBulan),
    selisihGajiPegawai: selisihPegawaiBulan,
    selisihGajiPegawaiFmt: formatRupiah(selisihPegawaiBulan),
    isGajiPegawaiSinkron: selisihPegawaiBulan === 0,

    payrollHonorTenagaAhli: totalPayrollTenagaAhliBulan,
    payrollHonorTenagaAhliFmt: formatRupiah(totalPayrollTenagaAhliBulan),
    glBebanTenagaAhli612: totalJurnalTenagaAhliBulan,
    glBebanTenagaAhli612Fmt: formatRupiah(totalJurnalTenagaAhliBulan),
    selisihTenagaAhli: selisihTenagaAhliBulan,
    selisihTenagaAhliFmt: formatRupiah(selisihTenagaAhliBulan),
    isTenagaAhliSinkron: selisihTenagaAhliBulan === 0,

    totalPayroll: totalPayrollPegawaiBulan + totalPayrollTenagaAhliBulan,
    totalPayrollFmt: formatRupiah(totalPayrollPegawaiBulan + totalPayrollTenagaAhliBulan),
    totalGLBeban: totalJurnalPegawaiBulan + totalJurnalTenagaAhliBulan,
    totalGLBebanFmt: formatRupiah(totalJurnalPegawaiBulan + totalJurnalTenagaAhliBulan),
    totalSelisih: Math.abs(
      totalPayrollPegawaiBulan + totalPayrollTenagaAhliBulan - (totalJurnalPegawaiBulan + totalJurnalTenagaAhliBulan)
    ),
    totalSelisihFmt: formatRupiah(
      Math.abs(
        totalPayrollPegawaiBulan + totalPayrollTenagaAhliBulan - (totalJurnalPegawaiBulan + totalJurnalTenagaAhliBulan)
      )
    ),
    isOverallSinkron:
      selisihPegawaiBulan === 0 && selisihTenagaAhliBulan === 0,

    jurnalPegawaiRows: txPegawaiBulan,
    jurnalTenagaAhliRows: txTenagaAhliBulan,
  };

  return {
    entity,
    allEntities,
    projects,
    rekananTenagaAhli,
    year,
    month,
    pegawaiList,
    gajiBulanIni,
    rekapBulananPegawai,
    summaryBulanIni: {
      ...summaryBulanIni,
      totalGajiPokokFmt: formatRupiah(summaryBulanIni.totalGajiPokok),
      totalTunjanganJabatanFmt: formatRupiah(summaryBulanIni.totalTunjanganJabatan),
      totalTunjanganTransportFmt: formatRupiah(summaryBulanIni.totalTunjanganTransport),
      totalInsentifFmt: formatRupiah(summaryBulanIni.totalInsentif),
      totalBpjsKesehatanFmt: formatRupiah(summaryBulanIni.totalBpjsKesehatan),
      totalBpjsKetenagakerjaanFmt: formatRupiah(summaryBulanIni.totalBpjsKetenagakerjaan),
      totalPotonganLainFmt: formatRupiah(summaryBulanIni.totalPotonganLain),
      totalPph21Fmt: formatRupiah(summaryBulanIni.totalPph21),
      totalGajiKotorFmt: formatRupiah(summaryBulanIni.totalGajiKotor),
      totalGajiBersihFmt: formatRupiah(summaryBulanIni.totalGajiBersih),
    },
    honorList,
    rekapBulananTenagaAhli,
    rekapTenagaAhliPerNama,
    summaryHonorBulanIni: {
      ...summaryHonorBulanIni,
      totalHonorBrutoFmt: formatRupiah(summaryHonorBulanIni.totalHonorBruto),
      totalPph21Fmt: formatRupiah(summaryHonorBulanIni.totalPph21),
      totalHonorBersihFmt: formatRupiah(summaryHonorBulanIni.totalHonorBersih),
    },
    konsolidasiTenagaAhli,
    penyesuaianJurnal,
    syncData,
  };
}

function mapTransactionToGajiItem(t: {
  id: string;
  entityId: string;
  tanggal: Date;
  noBukti: string;
  keterangan: string;
  coaAccountId: string | null;
  coaAccount?: { code: string; name: string } | null;
  jenisInput?: { key: string; nama: string } | null;
  projectId?: string | null;
  project?: { code: string; name: string } | null;
  debit: unknown;
  kredit: unknown;
  staff?: { name: string } | null;
}): JurnalTransaksiGajiItem {
  const d = Number(t.debit ?? 0);
  const k = Number(t.kredit ?? 0);
  const tgl = new Date(t.tanggal);
  const bln = tgl.getMonth() + 1;
  const thn = tgl.getFullYear();

  let jenisNama = t.jenisInput?.nama || "Jurnal Umum";
  if (t.jenisInput?.key === "kasKecil") jenisNama = "Kas Kecil";
  else if (t.jenisInput?.key === "kasBesar") jenisNama = "Kas Besar";
  else if (t.jenisInput?.key === "bankBuku") jenisNama = "Buku Bank";
  else if (t.jenisInput?.key === "jurnalTransaksi") jenisNama = "Jurnal Umum";

  const resolvedProjName = t.project ? `${t.project.code} - ${t.project.name}` : null;

  return {
    id: t.id,
    entityId: t.entityId,
    tanggal: t.tanggal.toISOString(),
    tanggalFmt: tgl.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    bulan: bln,
    tahun: thn,
    noBukti: t.noBukti,
    keterangan: t.keterangan,
    coaAccountId: t.coaAccountId,
    coaCode: t.coaAccount?.code || "-",
    coaName: t.coaAccount?.name || "Beban Gaji",
    jenisInputKey: t.jenisInput?.key || "jurnalTransaksi",
    jenisInputNama: jenisNama,
    projectId: t.projectId ?? null,
    projectCode: t.project?.code ?? null,
    projectName: t.project?.name ?? null,
    namaProyek: resolvedProjName,
    debit: d,
    debitFmt: formatRupiah(d),
    kredit: k,
    kreditFmt: formatRupiah(k),
    staffName: t.staff?.name ?? null,
  };
}

export async function getPayrollSyncData(
  entityId: string,
  year: number,
  month?: number
): Promise<PayrollSyncLabaRugi> {
  const { start, end } = month
    ? {
        start: new Date(year, month - 1, 1),
        end: new Date(year, month, 0, 23, 59, 59),
      }
    : {
        start: new Date(`${year}-01-01`),
        end: new Date(`${year}-12-31T23:59:59`),
      };

  // A. Total Gaji Kotor dari Modul Payroll Pegawai Tetap
  const gajiPegawaiAgg = await prisma.gajiPegawaiBulanan.aggregate({
    where: {
      entityId,
      tahun: year,
      ...(month ? { bulan: month } : {}),
    },
    _sum: {
      totalGajiKotor: true,
    },
  });
  const payrollGajiPegawai = Number(gajiPegawaiAgg._sum.totalGajiKotor ?? 0);

  // B. Total Honor Bruto dari Modul Payroll Tenaga Ahli
  const honorTenagaAhliAgg = await prisma.honorTenagaAhli.aggregate({
    where: {
      entityId,
      tahun: year,
      ...(month ? { bulan: month } : {}),
    },
    _sum: {
      nominalHonor: true,
    },
  });
  const payrollHonorTenagaAhli = Number(
    honorTenagaAhliAgg._sum.nominalHonor ?? 0
  );

  // C. Query GL / Transaksi Beban di Buku Besar / Laba Rugi
  // Akun 511: Gaji Pegawai Tetap
  // Akun 612: Gaji Tenaga Ahli
  const txGaji = await prisma.transaction.findMany({
    where: {
      entityId,
      tanggal: { gte: start, lte: end },
      coaAccountId: { not: null },
      coaAccount: {
        kategori: "BEBAN",
        OR: [
          { code: "511" },
          { code: "612" },
          { name: { contains: "Gaji" } },
          { name: { contains: "Honor" } },
          { name: { contains: "Tenaga Ahli" } },
        ],
      },
    },
    include: {
      coaAccount: { select: { code: true, name: true } },
      jenisInput: { select: { key: true, nama: true } },
      project: { select: { code: true, name: true } },
      staff: { select: { name: true } },
    },
    orderBy: [{ tanggal: "desc" }, { noBukti: "desc" }],
  });

  let glBebanGaji511 = 0;
  let glBebanTenagaAhli612 = 0;
  const jurnalPegawaiRows: JurnalTransaksiGajiItem[] = [];
  const jurnalTenagaAhliRows: JurnalTransaksiGajiItem[] = [];

  for (const t of txGaji) {
    if (!t.coaAccount) continue;
    const debit = Number(t.debit ?? 0);
    const code = t.coaAccount.code;
    const name = t.coaAccount.name.toLowerCase();
    const item = mapTransactionToGajiItem(t);

    if (code === "511" || (/gaji/i.test(name) && !/tenaga ahli|honor/i.test(name))) {
      glBebanGaji511 += debit;
      jurnalPegawaiRows.push(item);
    } else if (code === "612" || /tenaga ahli|honor/i.test(name)) {
      glBebanTenagaAhli612 += debit;
      jurnalTenagaAhliRows.push(item);
    }
  }

  const selisihGajiPegawai = Math.abs(payrollGajiPegawai - glBebanGaji511);
  const isGajiPegawaiSinkron = selisihGajiPegawai === 0;

  const selisihTenagaAhli = Math.abs(
    payrollHonorTenagaAhli - glBebanTenagaAhli612
  );
  const isTenagaAhliSinkron = selisihTenagaAhli === 0;

  const totalPayroll = payrollGajiPegawai + payrollHonorTenagaAhli;
  const totalGLBeban = glBebanGaji511 + glBebanTenagaAhli612;
  const totalSelisih = Math.abs(totalPayroll - totalGLBeban);
  const isOverallSinkron = totalSelisih === 0;

  return {
    tahun: year,
    bulan: month,
    payrollGajiPegawai,
    payrollGajiPegawaiFmt: formatRupiah(payrollGajiPegawai),
    glBebanGaji511,
    glBebanGaji511Fmt: formatRupiah(glBebanGaji511),
    selisihGajiPegawai,
    selisihGajiPegawaiFmt: formatRupiah(selisihGajiPegawai),
    isGajiPegawaiSinkron,

    payrollHonorTenagaAhli,
    payrollHonorTenagaAhliFmt: formatRupiah(payrollHonorTenagaAhli),
    glBebanTenagaAhli612,
    glBebanTenagaAhli612Fmt: formatRupiah(glBebanTenagaAhli612),
    selisihTenagaAhli,
    selisihTenagaAhliFmt: formatRupiah(selisihTenagaAhli),
    isTenagaAhliSinkron,

    totalPayroll,
    totalPayrollFmt: formatRupiah(totalPayroll),
    totalGLBeban,
    totalGLBebanFmt: formatRupiah(totalGLBeban),
    totalSelisih,
    totalSelisihFmt: formatRupiah(totalSelisih),
    isOverallSinkron,

    jurnalPegawaiRows,
    jurnalTenagaAhliRows,
  };
}
