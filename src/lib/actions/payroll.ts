"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "@/lib/actions/log";
import { syncProjectSpend } from "@/lib/piutang";

// Helper check auth
async function checkAuth() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Akses ditolak. Silakan login terlebih dahulu.");
  if (!canManageTransaksi(session.user.role)) {
    throw new Error("Akses ditolak. Anda tidak memiliki izin mengelola modul Payroll.");
  }
  return session;
}

// ----------------------------------------------------
// PEGAWAI TETAP (MASTER DATA)
// ----------------------------------------------------

export async function createPegawaiAction(formData: FormData) {
  const session = await checkAuth();

  const entityId = formData.get("entityId") as string;
  const nik = (formData.get("nik") as string)?.trim();
  const nama = (formData.get("nama") as string)?.trim();
  const jabatan = (formData.get("jabatan") as string)?.trim() || "Karyawan";
  const statusKeluarga = (formData.get("statusKeluarga") as string)?.trim() || "TK/0";
  const ptkp = Number(formData.get("ptkp")) || 54000000;
  const gajiPokok = Number(formData.get("gajiPokok")) || 0;
  const tunjanganJabatan = Number(formData.get("tunjanganJabatan")) || 0;
  const tanggalMasukRaw = (formData.get("tanggalMasuk") as string)?.trim();
  const tanggalMasuk = tanggalMasukRaw ? new Date(tanggalMasukRaw) : null;
  const isActive = formData.get("isActive") === "true" || formData.get("isActive") === "on";

  if (!entityId || !nik || !nama) {
    throw new Error("Entitas, NIK/Kode, dan Nama Pegawai wajib diisi.");
  }

  // Check unique NIK within entity
  const existing = await prisma.pegawai.findFirst({
    where: { entityId, nik },
  });
  if (existing) {
    throw new Error(`Pegawai dengan NIK/Kode ${nik} sudah terdaftar pada entitas ini.`);
  }

  const pegawai = await prisma.pegawai.create({
    data: {
      entityId,
      nik,
      nama,
      jabatan,
      statusKeluarga,
      ptkp,
      gajiPokok,
      tunjanganJabatan,
      tanggalMasuk,
      isActive,
    },
  });

  await logActivity(
    session.user.id,
    `Tambah Pegawai Tetap: ${nama} (${nik}) - ${jabatan}`,
    "FINANCIAL_CHANGE",
    { pegawaiId: pegawai.id, entityId }
  );

  revalidatePath("/payroll");
  return { success: true, data: pegawai };
}

export async function updatePegawaiAction(formData: FormData) {
  const session = await checkAuth();

  const id = formData.get("id") as string;
  const nik = (formData.get("nik") as string)?.trim();
  const nama = (formData.get("nama") as string)?.trim();
  const jabatan = (formData.get("jabatan") as string)?.trim() || "Karyawan";
  const statusKeluarga = (formData.get("statusKeluarga") as string)?.trim() || "TK/0";
  const ptkp = Number(formData.get("ptkp")) || 54000000;
  const gajiPokok = Number(formData.get("gajiPokok")) || 0;
  const tunjanganJabatan = Number(formData.get("tunjanganJabatan")) || 0;
  const tanggalMasukRaw = (formData.get("tanggalMasuk") as string)?.trim();
  const tanggalMasuk = tanggalMasukRaw ? new Date(tanggalMasukRaw) : null;
  const isActive = formData.get("isActive") === "true" || formData.get("isActive") === "on";

  if (!id || !nik || !nama) {
    throw new Error("ID, NIK/Kode, dan Nama Pegawai wajib diisi.");
  }

  const existing = await prisma.pegawai.findUnique({ where: { id } });
  if (!existing) throw new Error("Data pegawai tidak ditemukan.");

  // Check unique NIK within entity if NIK changed
  if (existing.nik !== nik) {
    const duplicate = await prisma.pegawai.findFirst({
      where: { entityId: existing.entityId, nik, id: { not: id } },
    });
    if (duplicate) {
      throw new Error(`Pegawai dengan NIK/Kode ${nik} sudah terdaftar pada entitas ini.`);
    }
  }

  const updated = await prisma.pegawai.update({
    where: { id },
    data: {
      nik,
      nama,
      jabatan,
      statusKeluarga,
      ptkp,
      gajiPokok,
      tunjanganJabatan,
      tanggalMasuk,
      isActive,
    },
  });

  await logActivity(
    session.user.id,
    `Update Pegawai Tetap: ${nama} (${nik})`,
    "FINANCIAL_CHANGE",
    { pegawaiId: id }
  );

  revalidatePath("/payroll");
  return { success: true, data: updated };
}

export async function deletePegawaiAction(id: string) {
  const session = await checkAuth();

  const existing = await prisma.pegawai.findUnique({
    where: { id },
    select: { id: true, nama: true, nik: true, entityId: true },
  });
  if (!existing) throw new Error("Data pegawai tidak ditemukan.");

  await prisma.pegawai.delete({ where: { id } });

  await logActivity(
    session.user.id,
    `Hapus Pegawai Tetap: ${existing.nama} (${existing.nik})`,
    "FINANCIAL_CHANGE",
    { pegawaiId: id, entityId: existing.entityId }
  );

  revalidatePath("/payroll");
  return { success: true };
}

// ----------------------------------------------------
// GAJI BULANAN PEGAWAI TETAP
// ----------------------------------------------------

export async function saveGajiBulananAction(formData: FormData) {
  const session = await checkAuth();

  const pegawaiId = formData.get("pegawaiId") as string;
  const entityId = formData.get("entityId") as string;
  const bulan = Number(formData.get("bulan"));
  const tahun = Number(formData.get("tahun"));
  const gajiPokok = Number(formData.get("gajiPokok")) || 0;
  const tunjanganJabatan = Number(formData.get("tunjanganJabatan")) || 0;
  const hariKerja = Number(formData.get("hariKerja")) || 0;
  const tarifTransportHarian = Number(formData.get("tarifTransportHarian")) || 15000;
  
  // Otomatisasi Tunjangan Transport: jika tunjanganTransport manual kosong/0 tapi hariKerja diisi
  let tunjanganTransport = Number(formData.get("tunjanganTransport"));
  if (isNaN(tunjanganTransport) || tunjanganTransport === 0) {
    if (hariKerja > 0) {
      tunjanganTransport = hariKerja * tarifTransportHarian;
    } else {
      tunjanganTransport = 0;
    }
  }

  const tunjanganLainnya =
    Number(formData.get("tunjanganLainnya")) || Number(formData.get("insentif")) || 0;
  const insentif = tunjanganLainnya;

  const tunjanganBpjsKes = Number(formData.get("tunjanganBpjsKes")) || 0;
  const tunjanganBpjsTk = Number(formData.get("tunjanganBpjsTk")) || 0;
  let tunjanganBpjs = Number(formData.get("tunjanganBpjs")) || 0;
  if (tunjanganBpjs === 0 && (tunjanganBpjsKes > 0 || tunjanganBpjsTk > 0)) {
    tunjanganBpjs = tunjanganBpjsKes + tunjanganBpjsTk;
  }

  const tunjanganPph = Number(formData.get("tunjanganPph")) || 0;
  const thr = Number(formData.get("thr")) || 0;

  const bpjsKesehatan = Number(formData.get("bpjsKesehatan")) || 0;
  const bpjsKetenagakerjaan = Number(formData.get("bpjsKetenagakerjaan")) || 0;
  let potonganBpjs = Number(formData.get("potonganBpjs")) || 0;
  if (potonganBpjs === 0 && (bpjsKesehatan > 0 || bpjsKetenagakerjaan > 0)) {
    potonganBpjs = bpjsKesehatan + bpjsKetenagakerjaan;
  }

  const potonganLain = Number(formData.get("potonganLain")) || 0;
  const pph21 = Number(formData.get("pph21")) || 0;
  const catatan = (formData.get("catatan") as string)?.trim() || null;

  if (!pegawaiId || !entityId || !bulan || !tahun) {
    throw new Error("Pegawai, Entitas, Bulan, dan Tahun wajib diisi.");
  }
  if (bulan < 1 || bulan > 12) {
    throw new Error("Bulan harus antara 1 sampai 12.");
  }

  const pegawai = await prisma.pegawai.findUnique({
    where: { id: pegawaiId },
    select: { id: true, nama: true, nik: true },
  });
  if (!pegawai) throw new Error("Pegawai tidak ditemukan.");

  // Dual Total:
  // 1. Total Gaji Kotor / Terlapor Pajak (Bruto SPT PPh 21)
  const totalGajiKotor =
    gajiPokok +
    tunjanganJabatan +
    tunjanganTransport +
    tunjanganLainnya +
    tunjanganBpjs +
    tunjanganPph +
    thr;
  const totalGajiTerlaporPajak = totalGajiKotor;

  // 2. Total Gaji Bersih (Take Home Pay yang ditransfer riil ke karyawan)
  // CATATAN: Potongan PPh 21 tidak dipotong dari karyawan karena ditanggung sepenuhnya oleh perusahaan
  const totalGajiBersih = Math.max(
    0,
    gajiPokok +
      tunjanganJabatan +
      tunjanganTransport +
      tunjanganLainnya +
      thr -
      potonganBpjs -
      potonganLain
  );

  const gaji = await prisma.gajiPegawaiBulanan.upsert({
    where: {
      pegawaiId_bulan_tahun: {
        pegawaiId,
        bulan,
        tahun,
      },
    },
    update: {
      gajiPokok,
      tunjanganJabatan,
      hariKerja,
      tarifTransportHarian,
      tunjanganTransport,
      insentif,
      tunjanganLainnya,
      tunjanganBpjs,
      tunjanganBpjsKes,
      tunjanganBpjsTk,
      tunjanganPph,
      thr,
      bpjsKesehatan,
      bpjsKetenagakerjaan,
      potonganBpjs,
      potonganLain,
      pph21,
      totalGajiKotor,
      totalGajiTerlaporPajak,
      totalGajiBersih,
      catatan,
    },
    create: {
      pegawaiId,
      entityId,
      bulan,
      tahun,
      gajiPokok,
      tunjanganJabatan,
      hariKerja,
      tarifTransportHarian,
      tunjanganTransport,
      insentif,
      tunjanganLainnya,
      tunjanganBpjs,
      tunjanganBpjsKes,
      tunjanganBpjsTk,
      tunjanganPph,
      thr,
      bpjsKesehatan,
      bpjsKetenagakerjaan,
      potonganBpjs,
      potonganLain,
      pph21,
      totalGajiKotor,
      totalGajiTerlaporPajak,
      totalGajiBersih,
      catatan,
    },
  });

  await logActivity(
    session.user.id,
    `Input Gaji Pegawai ${pegawai.nama} Bulan ${bulan}/${tahun} (Kotor: Rp ${totalGajiKotor.toLocaleString("id-ID")}, Bersih: Rp ${totalGajiBersih.toLocaleString("id-ID")})`,
    "FINANCIAL_CHANGE",
    { gajiId: gaji.id, pegawaiId, bulan, tahun }
  );

  revalidatePath("/payroll");
  revalidatePath("/laporan");
  return { success: true, data: gaji };
}

export async function deleteGajiBulananAction(id: string) {
  const session = await checkAuth();

  const existing = await prisma.gajiPegawaiBulanan.findUnique({
    where: { id },
    include: { pegawai: { select: { nama: true } } },
  });
  if (!existing) throw new Error("Data gaji bulanan tidak ditemukan.");

  await prisma.gajiPegawaiBulanan.delete({ where: { id } });

  await logActivity(
    session.user.id,
    `Hapus Gaji Pegawai: ${existing.pegawai.nama} Bulan ${existing.bulan}/${existing.tahun}`,
    "FINANCIAL_CHANGE",
    { gajiId: id }
  );

  revalidatePath("/payroll");
  revalidatePath("/laporan");
  return { success: true };
}

// ----------------------------------------------------
// SUB-MODUL TENAGA AHLI / BUKAN PEGAWAI
// ----------------------------------------------------

export async function saveHonorTenagaAhliAction(formData: FormData) {
  const session = await checkAuth();

  const id = (formData.get("id") as string)?.trim() || null;
  const entityId = formData.get("entityId") as string;
  const rekananId = (formData.get("rekananId") as string)?.trim() || null;
  let nik = (formData.get("nik") as string)?.trim();
  let nama = (formData.get("nama") as string)?.trim();
  let npwp = (formData.get("npwp") as string)?.trim() || null;
  let ptkp = (formData.get("ptkp") as string)?.trim() || "";
  const uraian = (formData.get("uraian") as string)?.trim();
  const tanggalStr = formData.get("tanggal") as string;
  const nominalHonor = Number(formData.get("nominalHonor")) || 0;
  const jenisPph = (formData.get("jenisPph") as string)?.trim() || "PPh 21";
  const tarifPph21Persen = Number(formData.get("tarifPph21Persen")) || 0;
  const pph21 = Number(formData.get("pph21")) || 0;
  const projectId = (formData.get("projectId") as string)?.trim() || null;
  let namaProyek = (formData.get("namaProyek") as string)?.trim() || null;
  const noBukti = (formData.get("noBukti") as string)?.trim() || null;

  // Jika rekananId dipilih, ambil NIK, Nama, NPWP, dan PTKP dari database rekanan jika belum terisi
  let finalRekananId = rekananId;
  if (rekananId) {
    const r = await prisma.rekanan.findUnique({ where: { id: rekananId } });
    if (r) {
      nama = nama || r.nama;
      nik = nik || r.nik || "";
      npwp = npwp || r.npwp;
      ptkp = ptkp || r.ptkp || "TK/0";
    }
  }
  ptkp = ptkp || "TK/0";

  if (!entityId || !nik || !nama || !uraian || !tanggalStr || nominalHonor <= 0) {
    throw new Error("Entitas, Tenaga Ahli (NIK & Nama), Uraian Tugas, Tanggal, dan Nominal Honor (> 0) wajib diisi.");
  }

  // Jika projectId dipilih tapi namaProyek belum diisi, ambil nama dari relasi project
  if (!namaProyek && projectId) {
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { code: true, name: true },
    });
    if (proj) {
      namaProyek = `${proj.code} - ${proj.name}`;
    }
  }

  const tanggal = new Date(tanggalStr);
  const bulanForm = Number(formData.get("bulan"));
  const tahunForm = Number(formData.get("tahun"));
  const bulan = bulanForm && bulanForm >= 1 && bulanForm <= 12 ? bulanForm : tanggal.getMonth() + 1;
  const tahun = tahunForm && tahunForm >= 2000 ? tahunForm : tanggal.getFullYear();
  const nominalBersih = Math.max(0, nominalHonor - pph21);

  // Jika rekananId belum ada, cek apakah ada master Rekanan dengan NIK/NPWP cocok
  if (!finalRekananId) {
    const matchedRekanan = await prisma.rekanan.findFirst({
      where: {
        tipe: "TENAGA_AHLI",
        OR: [{ nik }, ...(npwp ? [{ npwp }] : [])],
      },
      select: { id: true },
    });
    if (matchedRekanan) {
      finalRekananId = matchedRekanan.id;
    }
  }

  // Cek projectId lama jika proses edit untuk update realisasi biaya proyek
  let previousProjectId: string | null = null;
  if (id) {
    const prev = await prisma.honorTenagaAhli.findUnique({
      where: { id },
      select: { projectId: true },
    });
    previousProjectId = prev?.projectId ?? null;
  }

  let honor;
  if (id) {
    honor = await prisma.honorTenagaAhli.update({
      where: { id },
      data: {
        entityId,
        rekananId: finalRekananId,
        nik,
        nama,
        npwp,
        ptkp,
        uraian,
        tanggal,
        bulan,
        tahun,
        nominalHonor,
        jenisPph,
        tarifPph21Persen,
        pph21,
        nominalBersih,
        projectId,
        namaProyek,
        noBukti,
      },
    });
    await logActivity(
      session.user.id,
      `Update Honorarium Tenaga Ahli: ${nama} - Rp ${nominalHonor.toLocaleString("id-ID")}`,
      "FINANCIAL_CHANGE",
      { honorId: id, entityId }
    );
  } else {
    honor = await prisma.honorTenagaAhli.create({
      data: {
        entityId,
        rekananId: finalRekananId,
        nik,
        nama,
        npwp,
        ptkp,
        uraian,
        tanggal,
        bulan,
        tahun,
        nominalHonor,
        jenisPph,
        tarifPph21Persen,
        pph21,
        nominalBersih,
        projectId,
        namaProyek,
        noBukti,
      },
    });
    await logActivity(
      session.user.id,
      `Input Honorarium Tenaga Ahli: ${nama} - Rp ${nominalHonor.toLocaleString("id-ID")}`,
      "FINANCIAL_CHANGE",
      { honorId: honor.id, entityId }
    );
  }

  // Hubungkan ke pengeluaran proyek (realisasi biaya proyek - Issue 98)
  if (honor.projectId) {
    await syncProjectSpend(honor.projectId);
  }
  if (previousProjectId && previousProjectId !== honor.projectId) {
    await syncProjectSpend(previousProjectId);
  }

  revalidatePath("/payroll");
  revalidatePath("/laporan");
  revalidatePath("/piutang");
  revalidatePath("/profitabilitas");
  return { success: true, data: honor };
}

export async function deleteHonorTenagaAhliAction(id: string) {
  const session = await checkAuth();

  const existing = await prisma.honorTenagaAhli.findUnique({
    where: { id },
    select: { id: true, nama: true, nominalHonor: true, entityId: true, projectId: true },
  });
  if (!existing) throw new Error("Data honorarium tidak ditemukan.");

  await prisma.honorTenagaAhli.delete({ where: { id } });

  if (existing.projectId) {
    await syncProjectSpend(existing.projectId);
  }

  await logActivity(
    session.user.id,
    `Hapus Honorarium Tenaga Ahli: ${existing.nama} - Rp ${Number(existing.nominalHonor).toLocaleString("id-ID")}`,
    "FINANCIAL_CHANGE",
    { honorId: id, entityId: existing.entityId }
  );

  revalidatePath("/payroll");
  revalidatePath("/laporan");
  revalidatePath("/piutang");
  revalidatePath("/profitabilitas");
  return { success: true };
}

// ----------------------------------------------------
// AUTO-GENERATE / SALIN GAJI DARI BULAN SEBELUMNYA
// ----------------------------------------------------

export async function copyGajiBulanSebelumnyaAction(
  entityId: string,
  targetYear: number,
  targetMonth: number
) {
  const session = await checkAuth();

  const sourceMonth = targetMonth === 1 ? 12 : targetMonth - 1;
  const sourceYear = targetMonth === 1 ? targetYear - 1 : targetYear;

  const prevGajiList = await prisma.gajiPegawaiBulanan.findMany({
    where: { entityId, tahun: sourceYear, bulan: sourceMonth },
  });

  if (prevGajiList.length === 0) {
    // Jika bulan lalu belum ada data, buat otomatis dari master Pegawai yang aktif
    const activePegawai = await prisma.pegawai.findMany({
      where: { entityId, isActive: true },
    });
    if (activePegawai.length === 0) {
      throw new Error("Belum ada pegawai aktif di master database entitas ini.");
    }

    let count = 0;
    for (const p of activePegawai) {
      const existing = await prisma.gajiPegawaiBulanan.findUnique({
        where: {
          pegawaiId_bulan_tahun: {
            pegawaiId: p.id,
            bulan: targetMonth,
            tahun: targetYear,
          },
        },
      });

      if (!existing) {
        const gp = Number(p.gajiPokok);
        await prisma.gajiPegawaiBulanan.create({
          data: {
            entityId,
            pegawaiId: p.id,
            bulan: targetMonth,
            tahun: targetYear,
            gajiPokok: gp,
            totalGajiKotor: gp,
            totalGajiBersih: gp,
            catatan: "Dibuat otomatis dari Gaji Pokok Master",
          },
        });
        count++;
      }
    }

    await logActivity(
      session.user.id,
      `Generate otomatis gaji ${count} pegawai dari master untuk bulan ${targetMonth}/${targetYear}`,
      "FINANCIAL_CHANGE",
      { entityId, targetYear, targetMonth }
    );

    revalidatePath("/payroll");
    return { success: true, count, message: `${count} pegawai berhasil dibuat dari master data.` };
  }

  let count = 0;
  for (const prev of prevGajiList) {
    const existing = await prisma.gajiPegawaiBulanan.findUnique({
      where: {
        pegawaiId_bulan_tahun: {
          pegawaiId: prev.pegawaiId,
          bulan: targetMonth,
          tahun: targetYear,
        },
      },
    });

    if (!existing) {
      await prisma.gajiPegawaiBulanan.create({
        data: {
          entityId,
          pegawaiId: prev.pegawaiId,
          bulan: targetMonth,
          tahun: targetYear,
          gajiPokok: prev.gajiPokok,
          tunjanganJabatan: prev.tunjanganJabatan,
          hariKerja: prev.hariKerja,
          tarifTransportHarian: prev.tarifTransportHarian,
          tunjanganTransport: prev.tunjanganTransport,
          insentif: prev.insentif,
          tunjanganLainnya: (prev as any).tunjanganLainnya ?? prev.insentif,
          tunjanganBpjs: prev.tunjanganBpjs,
          tunjanganBpjsKes: (prev as any).tunjanganBpjsKes ?? 0,
          tunjanganBpjsTk: (prev as any).tunjanganBpjsTk ?? 0,
          tunjanganPph: prev.tunjanganPph,
          thr: 0,
          bpjsKesehatan: prev.bpjsKesehatan,
          bpjsKetenagakerjaan: prev.bpjsKetenagakerjaan,
          potonganBpjs: prev.potonganBpjs,
          potonganLain: prev.potonganLain,
          pph21: prev.pph21,
          totalGajiKotor: prev.totalGajiKotor,
          totalGajiTerlaporPajak: prev.totalGajiTerlaporPajak,
          totalGajiBersih: prev.totalGajiBersih,
          catatan: `Disalin dari bulan ${sourceMonth}/${sourceYear}`,
        },
      });
      count++;
    }
  }

  await logActivity(
    session.user.id,
    `Salin gaji ${count} pegawai dari bulan ${sourceMonth}/${sourceYear} ke bulan ${targetMonth}/${targetYear}`,
    "FINANCIAL_CHANGE",
    { entityId, targetYear, targetMonth }
  );

  revalidatePath("/payroll");
  return {
    success: true,
    count,
    message: `${count} gaji pegawai berhasil disalin dari bulan ${sourceMonth}/${sourceYear}.`,
  };
}

/**
 * Tambah / Edit Tenaga Ahli ke Master Database
 */
export async function saveTenagaAhliMasterAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!canManageTransaksi(session.user.role) && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Hanya staf/manajer keuangan yang dapat mengelola database tenaga ahli.");
  }

  const id = (formData.get("id") as string)?.trim() || null;
  const nama = (formData.get("nama") as string)?.trim();
  const nik = (formData.get("nik") as string)?.trim();
  const npwp = (formData.get("npwp") as string)?.trim() || null;
  const ptkp = (formData.get("ptkp") as string)?.trim() || "TK/0";
  const kategori = (formData.get("kategori") as string)?.trim() || null;
  const entityId = (formData.get("entityId") as string)?.trim() || null;

  if (!nama || !nik) {
    throw new Error("Nama Lengkap dan NIK Tenaga Ahli wajib diisi.");
  }

  const cleanNik = nik.replace(/\D/g, "");
  if (cleanNik.length !== 16) {
    throw new Error("NIK Tenaga Ahli harus berupa 16 digit angka KTP.");
  }

  let record;
  if (id) {
    record = await prisma.rekanan.update({
      where: { id },
      data: {
        nama,
        nik: cleanNik,
        npwp,
        ptkp,
        kategori,
        entityId: entityId || null,
      },
    });
    await logActivity(
      session.user.id,
      `Update Database Tenaga Ahli: ${nama} (${cleanNik})`,
      "FINANCIAL_CHANGE",
      { rekananId: id }
    );
  } else {
    // Cek apakah NIK sudah pernah terdaftar di Rekanan
    const existing = await prisma.rekanan.findFirst({
      where: { tipe: "TENAGA_AHLI", nik: cleanNik },
    });
    if (existing) {
      throw new Error(`Tenaga Ahli dengan NIK ${cleanNik} sudah terdaftar (${existing.nama}).`);
    }

    record = await prisma.rekanan.create({
      data: {
        nama,
        nik: cleanNik,
        npwp,
        ptkp,
        tipe: "TENAGA_AHLI",
        kategori,
        entityId: entityId || null,
      },
    });
    await logActivity(
      session.user.id,
      `Tambah Database Tenaga Ahli: ${nama} (${cleanNik})`,
      "FINANCIAL_CHANGE",
      { rekananId: record.id }
    );
  }

  revalidatePath("/payroll");
  return {
    success: true,
    data: {
      id: record.id,
      nama: record.nama,
      nik: record.nik,
      npwp: record.npwp,
      kategori: record.kategori,
    },
    message: `Tenaga Ahli ${nama} berhasil disimpan ke database.`,
  };
}

/**
 * Hapus Tenaga Ahli dari Master Database
 */
export async function deleteTenagaAhliMasterAction(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!canManageTransaksi(session.user.role) && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Hanya staf/manajer keuangan yang dapat menghapus data tenaga ahli.");
  }

  // Cek apakah ada riwayat honor
  const honorCount = await prisma.honorTenagaAhli.count({
    where: { rekananId: id },
  });
  if (honorCount > 0) {
    throw new Error(`Tenaga Ahli tidak dapat dihapus karena memiliki ${honorCount} riwayat pembayaran honor.`);
  }

  await prisma.rekanan.delete({ where: { id } });
  revalidatePath("/payroll");
  return { success: true, message: "Tenaga Ahli berhasil dihapus dari database." };
}

