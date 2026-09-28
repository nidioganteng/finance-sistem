"use server";

import { prisma } from "@/lib/prisma";
import { LogCategory } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function logExportActivity(action: string, detail?: Record<string, unknown>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action,
        category: "USER_ACTIVITY",
        detail: (detail ?? {}) as any,
      },
    });
    return { success: true };
  } catch (err) {
    console.error("Gagal mencatat log ekspor:", err);
    return { success: false };
  }
}

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
    trimmed.startsWith("Navigasi ")
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
