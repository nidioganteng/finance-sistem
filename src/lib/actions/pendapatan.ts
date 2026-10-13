"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "@/lib/actions/log";
import { hitungPajakFaktur } from "@/lib/pendapatan";
import { autoRegisterRekananIfNew } from "@/lib/actions/rekanan";

export type FakturPendapatanInput = {
  entityId: string;
  npwp: string;
  noFaktur: string;
  masaPajak: number; // 1 - 12
  tahunPajak: number;
  namaRekanan: string;
  namaJkp: string;
  nilaiKuitansi?: number; // Nilai Kuitansi Bruto (Input Utama)
  dpp: number;
  dppNilaiLain: number;
  tarifPpnPersen?: number;
  tarifPphPersen?: number;
  kodeJenisProyek?: number; // 1 = Perencanaan, 2 = Pengawasan
  pekerjaanPerusahaan?: number;
  pekerjaanYangDipinjam?: number;
  tanggalTerima?: string | null; // YYYY-MM-DD or null (opsional jika belum cair)
  bank?: string | null; // Rekening tujuan (opsional jika belum cair)
  nominalDiterima?: number;
  ceklisPpn?: boolean;
  ceklisPph?: boolean;
  ceklisBuktiPotong?: boolean;
  projectId?: string | null;
  bankTransactionId?: string | null;
};

export type RekonsiliasiPajakInput = {
  entityId: string;
  year: number;
  month: number;
  dppTerlapor: number;
  pajakTerlapor: number; // PPN Terlapor
  pphTerlapor?: number; // PPh Terlapor
  keterangan?: string;
};

function revalidatePendapatanPaths() {
  revalidatePath("/pendapatan");
  revalidatePath("/rekanan");
  revalidatePath("/jurnal");
  revalidatePath("/jurnal-transaksi");
  revalidatePath("/laporan");
  revalidatePath("/laporan-keuangan");
  revalidatePath("/dashboard");
}

async function syncFakturToJurnalUmum(
  fakturId: string,
  entityId: string,
  staffId: string,
  fakturData: {
    noFaktur: string;
    namaRekanan: string;
    namaJkp: string;
    dpp: number;
    ppn: number;
    pph: number;
    nilaiProyek: number;
    tanggalTerima: Date | null;
    tahunPajak: number;
    masaPajak: number;
    bank: string | null;
    nominalDiterima: number;
    projectId: string | null;
  }
) {
  try {
    let jenisInput = await prisma.jenisInputTransaksi.findUnique({
      where: { key: "jurnalTransaksi" },
    });
    if (!jenisInput) {
      jenisInput = await prisma.jenisInputTransaksi.create({
        data: { key: "jurnalTransaksi", nama: "Jurnal Transaksi", active: true },
      });
    }

    // Bersihkan transaksi jurnal lama untuk faktur ini
    await prisma.transaction.deleteMany({
      where: {
        fakturId,
      },
    });

    // Nomor Bukti untuk Jurnal Umum: gunakan Nomor Faktur atau suffix amrahan jika sudah ada
    let jNoBukti = fakturData.noFaktur.trim();
    const existingTxCount = await prisma.transaction.count({
      where: {
        entityId,
        jenisInputId: jenisInput.id,
        noBukti: jNoBukti,
      },
    });
    if (existingTxCount > 0) {
      const allSimilar = await prisma.transaction.count({
        where: {
          entityId,
          jenisInputId: jenisInput.id,
          noBukti: { startsWith: jNoBukti },
        },
      });
      jNoBukti = `${jNoBukti}-A${allSimilar + 1}`;
    }

    // Resolve COA Kas / Bank
    let bankCoa = null;
    if (fakturData.bank?.trim()) {
      bankCoa = await prisma.coaAccount.findFirst({
        where: {
          OR: [
            { name: { contains: fakturData.bank.trim() } },
            { code: fakturData.bank.trim() },
          ],
          kategori: "ASET",
        },
      });
    }
    if (!bankCoa) {
      bankCoa = await prisma.coaAccount.findFirst({
        where: {
          kategori: "ASET",
          OR: [
            { name: { contains: "BPD" } },
            { name: { contains: "Kas" } },
            { code: { in: ["110", "120", "130", "140", "150", "11", "12", "21", "22", "31", "41", "51"] } },
          ],
        },
        orderBy: { code: "asc" },
      });
    }

    // Resolve COA Pendapatan (Akun 400)
    const pendCoa = await prisma.coaAccount.findFirst({
      where: {
        OR: [{ code: "400" }, { kategori: "PENDAPATAN" }],
      },
      orderBy: { code: "asc" },
    });

    // Resolve COA PPN (Akun 535)
    const ppnCoa = await prisma.coaAccount.findFirst({
      where: {
        OR: [{ code: "535" }, { code: "536" }, { name: { contains: "PPN" } }],
      },
      orderBy: { code: "asc" },
    });

    // Resolve COA PPh (Akun 533 / 534)
    const pphCoa = await prisma.coaAccount.findFirst({
      where: {
        OR: [{ code: "533" }, { code: "534" }, { name: { contains: "PPh" } }],
      },
      orderBy: { code: "asc" },
    });

    if (bankCoa && pendCoa) {
      const txDate = fakturData.tanggalTerima
        ? fakturData.tanggalTerima
        : (fakturData.tahunPajak && fakturData.masaPajak
            ? new Date(fakturData.tahunPajak, fakturData.masaPajak - 1, 1)
            : new Date());

      const kuitansiBruto = fakturData.nilaiProyek || (fakturData.dpp + fakturData.ppn);
      const dppNominal = fakturData.dpp;
      const ppnNominal = fakturData.ppn;
      const pphNominal = fakturData.pph;
      const ketBase = `${fakturData.namaJkp.trim()} [${fakturData.noFaktur.trim()}]`;

      const txOps = [];

      if (fakturData.tanggalTerima || fakturData.nominalDiterima > 0) {
        // Kasus Realisasi Pencairan
        const netDiterima = fakturData.nominalDiterima > 0
          ? fakturData.nominalDiterima
          : Math.max(0, kuitansiBruto - ppnNominal - pphNominal);

        // 1. Kas/Bank (Debit)
        txOps.push(
          prisma.transaction.create({
            data: {
              entityId,
              jenisInputId: jenisInput.id,
              tanggal: txDate,
              noBukti: jNoBukti,
              keterangan: `${ketBase} (Kas/Bank Masuk)`,
              coaAccountId: bankCoa.id,
              debit: netDiterima,
              kredit: 0,
              saldoSetelah: 0,
              staffId,
              projectId: fakturData.projectId,
              fakturId,
              extraFieldsJson: { autoPostedFromFaktur: true, noFaktur: fakturData.noFaktur },
            },
          })
        );

        // 2. Potongan PPN (Debit jika ada PPN)
        if (ppnCoa && ppnNominal > 0) {
          txOps.push(
            prisma.transaction.create({
              data: {
                entityId,
                jenisInputId: jenisInput.id,
                tanggal: txDate,
                noBukti: jNoBukti,
                keterangan: `PPN Dipungut - ${ketBase}`,
                coaAccountId: ppnCoa.id,
                debit: ppnNominal,
                kredit: 0,
                saldoSetelah: 0,
                staffId,
                projectId: fakturData.projectId,
                fakturId,
                extraFieldsJson: { autoPostedFromFaktur: true, noFaktur: fakturData.noFaktur },
              },
            })
          );
        }

        // 3. Potongan PPh (Debit jika ada PPh)
        if (pphCoa && pphNominal > 0) {
          txOps.push(
            prisma.transaction.create({
              data: {
                entityId,
                jenisInputId: jenisInput.id,
                tanggal: txDate,
                noBukti: jNoBukti,
                keterangan: `Potongan PPh Final - ${ketBase}`,
                coaAccountId: pphCoa.id,
                debit: pphNominal,
                kredit: 0,
                saldoSetelah: 0,
                staffId,
                projectId: fakturData.projectId,
                fakturId,
                extraFieldsJson: { autoPostedFromFaktur: true, noFaktur: fakturData.noFaktur },
              },
            })
          );
        }

        // 4. Pendapatan (Kredit)
        txOps.push(
          prisma.transaction.create({
            data: {
              entityId,
              jenisInputId: jenisInput.id,
              tanggal: txDate,
              noBukti: jNoBukti,
              keterangan: `${ketBase} (Pendapatan Usaha)`,
              coaAccountId: pendCoa.id,
              debit: 0,
              kredit: kuitansiBruto,
              saldoSetelah: 0,
              staffId,
              projectId: fakturData.projectId,
              fakturId,
              extraFieldsJson: { autoPostedFromFaktur: true, noFaktur: fakturData.noFaktur },
            },
          })
        );
      } else {
        // Kasus Tagihan / Kuitansi Bruto Belum Cair
        txOps.push(
          prisma.transaction.create({
            data: {
              entityId,
              jenisInputId: jenisInput.id,
              tanggal: txDate,
              noBukti: jNoBukti,
              keterangan: `${ketBase} (Kuitansi Bruto Tagihan)`,
              coaAccountId: bankCoa.id,
              debit: kuitansiBruto,
              kredit: 0,
              saldoSetelah: 0,
              staffId,
              projectId: fakturData.projectId,
              fakturId,
              extraFieldsJson: { autoPostedFromFaktur: true, noFaktur: fakturData.noFaktur },
            },
          })
        );

        txOps.push(
          prisma.transaction.create({
            data: {
              entityId,
              jenisInputId: jenisInput.id,
              tanggal: txDate,
              noBukti: jNoBukti,
              keterangan: `${ketBase} (DPP Pendapatan)`,
              coaAccountId: pendCoa.id,
              debit: 0,
              kredit: dppNominal,
              saldoSetelah: 0,
              staffId,
              projectId: fakturData.projectId,
              fakturId,
              extraFieldsJson: { autoPostedFromFaktur: true, noFaktur: fakturData.noFaktur },
            },
          })
        );

        if (ppnCoa && ppnNominal > 0) {
          txOps.push(
            prisma.transaction.create({
              data: {
                entityId,
                jenisInputId: jenisInput.id,
                tanggal: txDate,
                noBukti: jNoBukti,
                keterangan: `${ketBase} (PPN)`,
                coaAccountId: ppnCoa.id,
                debit: 0,
                kredit: ppnNominal,
                saldoSetelah: 0,
                staffId,
                projectId: fakturData.projectId,
                fakturId,
                extraFieldsJson: { autoPostedFromFaktur: true, noFaktur: fakturData.noFaktur },
              },
            })
          );
        }
      }

      await prisma.$transaction(txOps);
    }
  } catch (err) {
    console.error("Gagal sinkronisasi auto-entry Jurnal Umum:", err);
  }
}

export async function createFakturPendapatanAction(data: FakturPendapatanInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Belum login." };
  }
  if (!canManageTransaksi(session.user.role) && session.user.role !== "SUPER_ADMIN") {
    return { error: "Kamu tidak punya akses untuk menambah faktur pendapatan." };
  }

  const entity = await prisma.entity.findFirst({
    where: {
      id: data.entityId,
      ...(session.user.role !== "SUPER_ADMIN" ? { key: { in: session.user.entityKeys } } : {}),
    },
  });
  if (!entity) return { error: "Kamu tidak punya akses ke entitas ini." };

  if (!data.noFaktur.trim()) return { error: "Nomor faktur wajib diisi." };
  if (!data.npwp.trim()) return { error: "NPWP klien/rekanan wajib diisi." };
  if (!data.namaRekanan.trim()) return { error: "Nama rekanan wajib diisi." };
  if (!data.namaJkp.trim()) return { error: "Uraian JKP wajib diisi." };
  if (data.masaPajak < 1 || data.masaPajak > 12) return { error: "Masa pajak harus antara bulan 1-12." };

  const tarifPpn = data.tarifPpnPersen ?? 11;
  const tarifPph = data.tarifPphPersen ?? 3.5;
  const calculated = hitungPajakFaktur(data.dpp, data.dppNilaiLain, tarifPpn, tarifPph, data.nilaiKuitansi);

  const created = await prisma.fakturPendapatan.create({
    data: {
      entityId: data.entityId,
      npwp: data.npwp.trim(),
      noFaktur: data.noFaktur.trim(),
      masaPajak: data.masaPajak,
      tahunPajak: data.tahunPajak || (data.tanggalTerima ? new Date(data.tanggalTerima).getFullYear() : new Date().getFullYear()),
      namaRekanan: data.namaRekanan.trim(),
      namaJkp: data.namaJkp.trim(),
      dpp: data.dpp,
      dppNilaiLain: data.dppNilaiLain,
      tarifPpnPersen: tarifPpn,
      tarifPphPersen: tarifPph,
      ppn: calculated.ppn,
      pph: calculated.pph,
      nilaiProyek: calculated.nilaiProyek,
      labaSetelahPajak: calculated.labaSetelahPajak,
      kodeJenisProyek: data.kodeJenisProyek ?? 1,
      pekerjaanPerusahaan: data.pekerjaanPerusahaan ?? data.dpp,
      pekerjaanYangDipinjam: data.pekerjaanYangDipinjam ?? 0,
      tanggalTerima: data.tanggalTerima ? new Date(data.tanggalTerima) : null,
      bank: data.bank?.trim() ? data.bank.trim() : null,
      nominalDiterima: data.nominalDiterima ?? 0,
      ceklisPpn: Boolean(data.ceklisPpn),
      ceklisPph: Boolean(data.ceklisPph),
      ceklisBuktiPotong: Boolean(data.ceklisBuktiPotong),
      projectId: data.projectId || null,
      bankTransactionId: data.bankTransactionId || null,
      createdById: session.user.id,
    },
  });

  // Auto-register atau sync ke Master Data Rekanan Terpusat jika rekanan baru
  if (data.namaRekanan?.trim()) {
    await autoRegisterRekananIfNew(data.npwp || "", data.namaRekanan);
  }

  // Auto-entry ke Jurnal Umum (Kas/Bank, Pendapatan, DPP, PPN, Keterangan)
  await syncFakturToJurnalUmum(created.id, data.entityId, session.user.id, {
    noFaktur: created.noFaktur,
    namaRekanan: created.namaRekanan,
    namaJkp: created.namaJkp,
    dpp: Number(created.dpp),
    ppn: Number(created.ppn),
    pph: Number(created.pph),
    nilaiProyek: Number(created.nilaiProyek),
    tanggalTerima: created.tanggalTerima,
    tahunPajak: created.tahunPajak,
    masaPajak: created.masaPajak,
    bank: created.bank,
    nominalDiterima: Number(created.nominalDiterima),
    projectId: created.projectId,
  });

  logActivity(
    session.user.id,
    `Tambah faktur pendapatan: ${created.noFaktur} - ${created.namaRekanan} (${entity.name})`,
    "FINANCIAL_CHANGE",
    {
      fakturId: created.id,
      noFaktur: created.noFaktur,
      entityId: data.entityId,
      nilaiProyek: calculated.nilaiProyek,
      dpp: data.dpp,
      ppn: calculated.ppn,
    }
  );

  revalidatePendapatanPaths();
  return { success: true, id: created.id };
}

export async function updateFakturPendapatanAction(
  id: string,
  data: Partial<FakturPendapatanInput>
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Belum login." };
  }
  if (!canManageTransaksi(session.user.role) && session.user.role !== "SUPER_ADMIN") {
    return { error: "Kamu tidak punya akses untuk mengubah faktur pendapatan." };
  }

  const existing = await prisma.fakturPendapatan.findUnique({
    where: { id },
    include: { entity: true },
  });
  if (!existing) return { error: "Data faktur tidak ditemukan." };

  if (
    session.user.role !== "SUPER_ADMIN" &&
    !session.user.entityKeys.includes(existing.entity.key)
  ) {
    return { error: "Kamu tidak punya akses ke entitas ini." };
  }

  const dpp = data.dpp !== undefined ? data.dpp : Number(existing.dpp);
  const dppNilaiLain =
    data.dppNilaiLain !== undefined ? data.dppNilaiLain : Number(existing.dppNilaiLain);
  const tarifPpn =
    data.tarifPpnPersen !== undefined ? data.tarifPpnPersen : Number(existing.tarifPpnPersen);
  const tarifPph =
    data.tarifPphPersen !== undefined ? data.tarifPphPersen : Number(existing.tarifPphPersen);

  const calculated = hitungPajakFaktur(dpp, dppNilaiLain, tarifPpn, tarifPph);

  const updated = await prisma.fakturPendapatan.update({
    where: { id },
    data: {
      ...(data.npwp ? { npwp: data.npwp.trim() } : {}),
      ...(data.noFaktur ? { noFaktur: data.noFaktur.trim() } : {}),
      ...(data.masaPajak ? { masaPajak: data.masaPajak } : {}),
      ...(data.tahunPajak ? { tahunPajak: data.tahunPajak } : {}),
      ...(data.namaRekanan ? { namaRekanan: data.namaRekanan.trim() } : {}),
      ...(data.namaJkp ? { namaJkp: data.namaJkp.trim() } : {}),
      dpp,
      dppNilaiLain,
      tarifPpnPersen: tarifPpn,
      tarifPphPersen: tarifPph,
      ppn: calculated.ppn,
      pph: calculated.pph,
      nilaiProyek: calculated.nilaiProyek,
      labaSetelahPajak: calculated.labaSetelahPajak,
      ...(data.kodeJenisProyek !== undefined ? { kodeJenisProyek: data.kodeJenisProyek } : {}),
      ...(data.pekerjaanPerusahaan !== undefined ? { pekerjaanPerusahaan: data.pekerjaanPerusahaan } : {}),
      ...(data.pekerjaanYangDipinjam !== undefined ? { pekerjaanYangDipinjam: data.pekerjaanYangDipinjam } : {}),
      ...(data.tanggalTerima !== undefined ? { tanggalTerima: data.tanggalTerima ? new Date(data.tanggalTerima) : null } : {}),
      ...(data.bank !== undefined ? { bank: data.bank?.trim() ? data.bank.trim() : null } : {}),
      ...(data.nominalDiterima !== undefined ? { nominalDiterima: data.nominalDiterima } : {}),
      ...(data.ceklisPpn !== undefined ? { ceklisPpn: Boolean(data.ceklisPpn) } : {}),
      ...(data.ceklisPph !== undefined ? { ceklisPph: Boolean(data.ceklisPph) } : {}),
      ...(data.ceklisBuktiPotong !== undefined ? { ceklisBuktiPotong: Boolean(data.ceklisBuktiPotong) } : {}),
      ...(data.projectId !== undefined ? { projectId: data.projectId || null } : {}),
      ...(data.bankTransactionId !== undefined ? { bankTransactionId: data.bankTransactionId || null } : {}),
    },
  });

  const effectiveNpwp = data.npwp !== undefined ? data.npwp : existing.npwp;
  const effectiveNama = data.namaRekanan !== undefined ? data.namaRekanan : existing.namaRekanan;
  if (effectiveNama?.trim()) {
    await autoRegisterRekananIfNew(effectiveNpwp || "", effectiveNama);
  }

  // Sinkronisasi otomatis ke Jurnal Umum
  await syncFakturToJurnalUmum(updated.id, existing.entityId, session.user.id, {
    noFaktur: updated.noFaktur,
    namaRekanan: updated.namaRekanan,
    namaJkp: updated.namaJkp,
    dpp: Number(updated.dpp),
    ppn: Number(updated.ppn),
    pph: Number(updated.pph),
    nilaiProyek: Number(updated.nilaiProyek),
    tanggalTerima: updated.tanggalTerima,
    tahunPajak: updated.tahunPajak,
    masaPajak: updated.masaPajak,
    bank: updated.bank,
    nominalDiterima: Number(updated.nominalDiterima),
    projectId: updated.projectId,
  });

  logActivity(
    session.user.id,
    `Ubah faktur pendapatan: ${updated.noFaktur} (${existing.entity.name})`,
    "FINANCIAL_CHANGE",
    {
      fakturId: updated.id,
      noFaktur: updated.noFaktur,
      entityId: existing.entityId,
      nilaiProyek: calculated.nilaiProyek,
    }
  );

  revalidatePendapatanPaths();
  return { success: true };
}

export async function toggleCeklisDokumenFakturAction(
  id: string,
  field: "ppn" | "pph" | "buktiPotong",
  value: boolean
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Belum login." };
  }
  if (!canManageTransaksi(session.user.role) && session.user.role !== "SUPER_ADMIN") {
    return { error: "Kamu tidak punya akses untuk mengubah status dokumen fisik." };
  }

  const existing = await prisma.fakturPendapatan.findUnique({
    where: { id },
    include: { entity: true },
  });
  if (!existing) return { error: "Data faktur tidak ditemukan." };

  if (
    session.user.role !== "SUPER_ADMIN" &&
    !session.user.entityKeys.includes(existing.entity.key)
  ) {
    return { error: "Kamu tidak punya akses ke entitas ini." };
  }

  const fieldKey =
    field === "ppn"
      ? "ceklisPpn"
      : field === "pph"
      ? "ceklisPph"
      : "ceklisBuktiPotong";

  await prisma.fakturPendapatan.update({
    where: { id },
    data: { [fieldKey]: value },
  });

  logActivity(
    session.user.id,
    `Ceklis fisik ${field.toUpperCase()} faktur ${existing.noFaktur}: ${value ? "Sudah Diterima" : "Belum Diterima"}`,
    "FINANCIAL_CHANGE",
    { fakturId: id, field, value }
  );

  revalidatePendapatanPaths();
  return { success: true };
}

export async function deleteFakturPendapatanAction(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Belum login." };
  }
  if (!canManageTransaksi(session.user.role) && session.user.role !== "SUPER_ADMIN") {
    return { error: "Kamu tidak punya akses untuk menghapus faktur pendapatan." };
  }

  const existing = await prisma.fakturPendapatan.findUnique({
    where: { id },
    include: { entity: true },
  });
  if (!existing) return { error: "Data faktur tidak ditemukan." };

  if (
    session.user.role !== "SUPER_ADMIN" &&
    !session.user.entityKeys.includes(existing.entity.key)
  ) {
    return { error: "Kamu tidak punya akses ke entitas ini." };
  }

  // Bersihkan transaksi Jurnal Umum terkait faktur ini
  await prisma.transaction.deleteMany({
    where: { fakturId: id },
  });

  await prisma.fakturPendapatan.delete({ where: { id } });

  logActivity(
    session.user.id,
    `Hapus faktur pendapatan: ${existing.noFaktur} - ${existing.namaRekanan} (${existing.entity.name})`,
    "FINANCIAL_CHANGE",
    { fakturId: id, noFaktur: existing.noFaktur, entityId: existing.entityId }
  );

  revalidatePendapatanPaths();
  return { success: true };
}

export async function upsertRekonsiliasiPajakAction(data: RekonsiliasiPajakInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Belum login." };
  }
  if (!canManageTransaksi(session.user.role) && session.user.role !== "SUPER_ADMIN") {
    return { error: "Kamu tidak punya akses untuk mengubah rekonsiliasi pajak." };
  }

  const entity = await prisma.entity.findFirst({
    where: {
      id: data.entityId,
      ...(session.user.role !== "SUPER_ADMIN" ? { key: { in: session.user.entityKeys } } : {}),
    },
  });
  if (!entity) return { error: "Kamu tidak punya akses ke entitas ini." };

  const pphTerlapor = Number(data.pphTerlapor) || 0;

  const saved = await prisma.rekonsiliasiPajakBulanan.upsert({
    where: {
      entityId_year_month: {
        entityId: data.entityId,
        year: data.year,
        month: data.month,
      },
    },
    update: {
      dppTerlapor: data.dppTerlapor,
      pajakTerlapor: data.pajakTerlapor,
      pphTerlapor: pphTerlapor,
      keterangan: data.keterangan?.trim() || null,
    },
    create: {
      entityId: data.entityId,
      year: data.year,
      month: data.month,
      dppTerlapor: data.dppTerlapor,
      pajakTerlapor: data.pajakTerlapor,
      pphTerlapor: pphTerlapor,
      keterangan: data.keterangan?.trim() || null,
    },
  });

  logActivity(
    session.user.id,
    `Update rekonsiliasi pajak bulan ${data.month}/${data.year} (${entity.name})`,
    "FINANCIAL_CHANGE",
    {
      rekonsiliasiId: saved.id,
      entityId: data.entityId,
      year: data.year,
      month: data.month,
      dppTerlapor: data.dppTerlapor,
      pajakTerlapor: data.pajakTerlapor,
      pphTerlapor: pphTerlapor,
    }
  );

  revalidatePendapatanPaths();
  return { success: true, id: saved.id };
}
