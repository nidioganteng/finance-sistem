"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "@/lib/actions/log";
import { hitungPajakFaktur } from "@/lib/pendapatan";

export type FakturPendapatanInput = {
  entityId: string;
  npwp: string;
  noFaktur: string;
  masaPajak: number; // 1 - 12
  tahunPajak: number;
  namaRekanan: string;
  namaJkp: string;
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
  pajakTerlapor: number;
  keterangan?: string;
};

function revalidatePendapatanPaths() {
  revalidatePath("/pendapatan");
  revalidatePath("/laporan");
  revalidatePath("/laporan-keuangan");
  revalidatePath("/dashboard");
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
  const calculated = hitungPajakFaktur(data.dpp, data.dppNilaiLain, tarifPpn, tarifPph);

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
      pekerjaanPerusahaan: data.pekerjaanPerusahaan ?? 0,
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
      keterangan: data.keterangan?.trim() || null,
    },
    create: {
      entityId: data.entityId,
      year: data.year,
      month: data.month,
      dppTerlapor: data.dppTerlapor,
      pajakTerlapor: data.pajakTerlapor,
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
    }
  );

  revalidatePendapatanPaths();
  return { success: true, id: saved.id };
}
