"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export async function uploadDokumen(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Tidak terautentikasi." };

  const judul = formData.get("judul") as string;
  const kategori = formData.get("kategori") as string;
  const file = formData.get("file") as File;

  if (!judul?.trim()) return { error: "Judul harus diisi." };
  if (!kategori || !["SOP", "DOKUMEN_PENDUKUNG"].includes(kategori))
    return { error: "Kategori tidak valid." };
  if (!file || file.size === 0) return { error: "File harus dipilih." };
  if (file.size > 10 * 1024 * 1024) return { error: "Ukuran file maksimal 10 MB." };

  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
  ];
  if (!allowedTypes.includes(file.type)) return { error: "Format file tidak didukung (PDF, Word, Excel, JPG, PNG)." };

  const ext = path.extname(file.name) || ".bin";
  const filename = `${randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "dokumen");
  const filePath = path.join(uploadDir, filename);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);
  } catch {
    return { error: "Gagal menyimpan file." };
  }

  await prisma.dokumen.create({
    data: {
      judul: judul.trim(),
      kategori: kategori as "SOP" | "DOKUMEN_PENDUKUNG",
      fileUrl: `/uploads/dokumen/${filename}`,
      uploadedById: session.user.id,
    },
  });

  revalidatePath("/dokumen");
  return { success: true };
}

export async function deleteDokumen(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Tidak terautentikasi." };
  if (session.user.role !== "MANAJER_KEUANGAN") return { error: "Tidak diizinkan." };

  const dok = await prisma.dokumen.findUnique({ where: { id } });
  if (!dok) return { error: "Dokumen tidak ditemukan." };

  await prisma.dokumen.delete({ where: { id } });

  // hapus file lokal jika bukan URL eksternal
  if (dok.fileUrl.startsWith("/uploads/")) {
    try {
      const filePath = path.join(process.cwd(), "public", dok.fileUrl);
      await unlink(filePath);
    } catch {}
  }

  revalidatePath("/dokumen");
  return { success: true };
}
