"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "@/lib/actions/log";

export type AsetTetapInput = {
  entityId: string;
  kode: string;
  nama: string;
  kategori: string;
  tanggalPerolehan: string; // ISO date string YYYY-MM-DD
  hargaPerolehan: number;
  nilaiResidu?: number;
  umurBulan: number;
  keterangan?: string;
};

export async function createAsetTetapAction(data: AsetTetapInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user.id || !canManageTransaksi(session.user.role)) {
    throw new Error("Kamu tidak punya akses untuk mengelola aset tetap.");
  }

  const entity = await prisma.entity.findFirst({
    where: { id: data.entityId, key: { in: session.user.entityKeys } },
  });
  if (!entity) throw new Error("Kamu tidak punya akses ke entitas ini.");

  if (!data.kode.trim()) throw new Error("Kode/Tagging aset wajib diisi.");
  if (!data.nama.trim()) throw new Error("Nama aset wajib diisi.");
  if (data.hargaPerolehan <= 0) throw new Error("Harga perolehan harus lebih dari 0.");
  if (data.umurBulan <= 0) throw new Error("Umur ekonomis harus lebih dari 0 bulan.");

  const created = await prisma.asetTetap.create({
    data: {
      entityId: data.entityId,
      kode: data.kode.trim(),
      nama: data.nama.trim(),
      kategori: data.kategori || "KENDARAAN",
      tanggalPerolehan: new Date(data.tanggalPerolehan),
      hargaPerolehan: data.hargaPerolehan,
      nilaiResidu: data.nilaiResidu ?? 0,
      umurBulan: data.umurBulan,
      metode: "GARIS_LURUS",
      keterangan: data.keterangan?.trim() || null,
    },
  });

  logActivity(
    session.user.id,
    `Tambah aset tetap: ${created.kode} - ${created.nama} (${entity.name})`,
    "FINANCIAL_CHANGE",
    { asetId: created.id, entityId: data.entityId, hargaPerolehan: data.hargaPerolehan }
  );

  revalidateAllReportPaths();
  return created;
}

export async function updateAsetTetapAction(id: string, data: Partial<AsetTetapInput>) {
  const session = await getServerSession(authOptions);
  if (!session?.user.id || !canManageTransaksi(session.user.role)) {
    throw new Error("Kamu tidak punya akses untuk mengubah aset tetap.");
  }

  const existing = await prisma.asetTetap.findUnique({
    where: { id },
    include: { entity: true },
  });
  if (!existing) throw new Error("Data aset tidak ditemukan.");

  if (!session.user.entityKeys.includes(existing.entity.key)) {
    throw new Error("Kamu tidak punya akses ke entitas ini.");
  }

  const updated = await prisma.asetTetap.update({
    where: { id },
    data: {
      ...(data.kode ? { kode: data.kode.trim() } : {}),
      ...(data.nama ? { nama: data.nama.trim() } : {}),
      ...(data.kategori ? { kategori: data.kategori } : {}),
      ...(data.tanggalPerolehan ? { tanggalPerolehan: new Date(data.tanggalPerolehan) } : {}),
      ...(data.hargaPerolehan !== undefined ? { hargaPerolehan: data.hargaPerolehan } : {}),
      ...(data.nilaiResidu !== undefined ? { nilaiResidu: data.nilaiResidu } : {}),
      ...(data.umurBulan !== undefined ? { umurBulan: data.umurBulan } : {}),
      ...(data.keterangan !== undefined ? { keterangan: data.keterangan.trim() || null } : {}),
    },
  });

  logActivity(
    session.user.id,
    `Update aset tetap: ${updated.kode} - ${updated.nama} (${existing.entity.name})`,
    "FINANCIAL_CHANGE",
    { asetId: id, changes: data }
  );

  revalidateAllReportPaths();
  return updated;
}

export async function deleteAsetTetapAction(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user.id || !canManageTransaksi(session.user.role)) {
    throw new Error("Kamu tidak punya akses untuk menghapus aset tetap.");
  }

  const existing = await prisma.asetTetap.findUnique({
    where: { id },
    include: { entity: true },
  });
  if (!existing) throw new Error("Data aset tidak ditemukan.");

  if (!session.user.entityKeys.includes(existing.entity.key)) {
    throw new Error("Kamu tidak punya akses ke entitas ini.");
  }

  await prisma.asetTetap.delete({ where: { id } });

  logActivity(
    session.user.id,
    `Hapus aset tetap: ${existing.kode} - ${existing.nama} (${existing.entity.name})`,
    "FINANCIAL_CHANGE",
    { asetId: id, kode: existing.kode, nama: existing.nama }
  );

  revalidateAllReportPaths();
}

function revalidateAllReportPaths() {
  revalidatePath("/aktiva-tetap");
  revalidatePath("/laba-rugi");
  revalidatePath("/neraca");
  revalidatePath("/laporan-keuangan");
  revalidatePath("/laporan");
  revalidatePath("/dashboard");
}
