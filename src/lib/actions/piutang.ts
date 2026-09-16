"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { TerminStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function auditTermin(terminId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Belum login.");

  await prisma.termin.update({
    where: { id: terminId },
    data: {
      status: TerminStatus.ON_TRACK,
      auditedAt: new Date(),
      auditedById: session.user.id,
    },
  });
  revalidatePath("/piutang");
}

export async function updateTerminStatus(terminId: string, status: TerminStatus) {
  await prisma.termin.update({ where: { id: terminId }, data: { status } });
  revalidatePath("/piutang");
}

// Membatalkan proyek: termin yang belum terbayar (sisa termin berjalan) dihapus
// supaya proyek dianggap selesai dan tidak terus memicu warning piutang.
export async function cancelProject(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Belum login.");
  if (session.user.role !== "MANAJER_KEUANGAN") {
    throw new Error("Hanya Manajer Keuangan yang bisa membatalkan proyek.");
  }

  await prisma.$transaction([
    prisma.termin.deleteMany({ where: { projectId } }),
    prisma.project.update({ where: { id: projectId }, data: { status: "CANCELLED" } }),
  ]);

  revalidatePath("/piutang");
  revalidatePath("/dashboard");
}
