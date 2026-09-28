"use server";

import { prisma } from "@/lib/prisma";
import { LogCategory } from "@prisma/client";

export async function logActivity(
  actorId: string,
  action: string,
  category: LogCategory,
  detail?: Record<string, unknown>,
) {
  // Hanya catat tindakan yang mengubah konten data (tambah, edit, hapus, mutasi)
  // Tindakan navigasi klik halaman atau melihat data biasa diabaikan agar audit trail tetap bersih
  const trimmed = action.trim();
  if (
    trimmed.startsWith("Buka ") ||
    trimmed.startsWith("Lihat ") ||
    trimmed.startsWith("Navigasi ") ||
    trimmed.startsWith("Download ") ||
    trimmed.startsWith("Export ")
  ) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.activityLog.create({ data: { actorId, action, category, detail: detail as any } });
  } catch {
    // log gagal tidak boleh gagalkan operasi utama
  }
}
