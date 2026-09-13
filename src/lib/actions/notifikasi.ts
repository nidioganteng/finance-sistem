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
