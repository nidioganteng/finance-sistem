"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function markAllNotifikasiRead() {
  const session = await getServerSession(authOptions);
  if (!session) return;

  await prisma.notifikasi.updateMany({
    where: { targetRole: session.user.role, read: false },
    data: { read: true },
  });

  revalidatePath("/notifikasi");
  revalidatePath("/dashboard");
}

export async function markNotifikasiRead(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) return;

  // Notifikasi ditarget ke role (bukan per-user), jadi scoped ke targetRole
  // biar user nggak bisa nandain notifikasi role lain sebagai dibaca.
  await prisma.notifikasi.updateMany({
    where: { id, targetRole: session.user.role },
    data: { read: true },
  });

  revalidatePath("/notifikasi");
  revalidatePath("/dashboard");
}
