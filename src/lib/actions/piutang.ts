"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { TerminStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/actions/log";

export async function auditTermin(terminId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Belum login.");

  const termin = await prisma.termin.findUnique({ where: { id: terminId }, select: { name: true, project: { select: { code: true } } } });
  await prisma.termin.update({
    where: { id: terminId },
    data: {
      status: TerminStatus.ON_TRACK,
      auditedAt: new Date(),
      auditedById: session.user.id,
    },
  });
  logActivity(session.user.id, `Audit termin ${termin?.name ?? terminId} – Proyek ${termin?.project?.code ?? ""}`, "FINANCIAL_CHANGE", { terminId });
  revalidatePath("/piutang");
}

export async function updateTerminStatus(terminId: string, status: TerminStatus) {
  const session = await getServerSession(authOptions);
  const termin = await prisma.termin.findUnique({ where: { id: terminId }, select: { name: true, project: { select: { code: true } } } });
  await prisma.termin.update({ where: { id: terminId }, data: { status } });
  if (session?.user.id) {
    logActivity(session.user.id, `Update status termin ${termin?.name ?? terminId} → ${status}`, "FINANCIAL_CHANGE", { terminId, status });
  }
  revalidatePath("/piutang");
}

// Menyelesaikan proyek: status jadi COMPLETED, hilang dari Kontrol Piutang.
// Transaksi di jurnal tetap ada — hanya tampilan piutang yang menyembunyikannya.
export async function completeProject(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Belum login.");
  if (session.user.role !== "MANAJER_KEUANGAN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Hanya Manajer Keuangan yang bisa menyelesaikan proyek.");
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true, name: true } });
  await prisma.project.update({ where: { id: projectId }, data: { status: "COMPLETED" } });

  logActivity(session.user.id, `Selesaikan proyek ${project?.code ?? projectId} – ${project?.name ?? ""}`, "FINANCIAL_CHANGE", { projectId });
  revalidatePath("/piutang");
  revalidatePath("/dashboard");
}

// Membatalkan proyek: termin yang belum terbayar (sisa termin berjalan) dihapus
// supaya proyek dianggap selesai dan tidak terus memicu warning piutang.
export async function cancelProject(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Belum login.");
  if (session.user.role !== "MANAJER_KEUANGAN") {
    throw new Error("Hanya Manajer Keuangan yang bisa membatalkan proyek.");
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true, name: true } });
  await prisma.$transaction([
    prisma.termin.deleteMany({ where: { projectId } }),
    prisma.project.update({ where: { id: projectId }, data: { status: "CANCELLED" } }),
  ]);

  logActivity(session.user.id, `Batalkan proyek ${project?.code ?? projectId} – ${project?.name ?? ""}`, "FINANCIAL_CHANGE", { projectId });
  revalidatePath("/piutang");
  revalidatePath("/dashboard");
}
