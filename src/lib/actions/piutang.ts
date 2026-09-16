"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { TerminStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManagePiutang } from "@/lib/rbac";

// Admin proyek cuma input nilai kontrak di awal — belum ada termin/piutang
// sama sekali sampai Keuangan mencatat uang masuk pertama (recordTerminPayment).
export async function createProject(input: {
  entityId: string;
  code: string;
  name: string;
  contractValue: number;
}) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Belum login.");
  if (!canManagePiutang(session.user.role)) {
    throw new Error("Kamu tidak punya akses untuk menambah proyek baru.");
  }
  if (!input.code.trim() || !input.name.trim()) {
    throw new Error("Kode dan nama proyek wajib diisi.");
  }
  if (!(input.contractValue > 0)) {
    throw new Error("Nilai kontrak harus lebih dari 0.");
  }

  const code = input.code.trim();
  const existing = await prisma.project.findUnique({ where: { code } });
  if (existing) throw new Error(`Kode proyek "${code}" sudah dipakai.`);

  await prisma.project.create({
    data: {
      entityId: input.entityId,
      code,
      name: input.name.trim(),
      contractValue: input.contractValue,
      spend: 0,
    },
  });
  revalidatePath("/piutang");
}

// Pengisian nominal & persentase termin sepenuhnya di tangan Keuangan — dicatat
// tiap kali ada uang masuk, persentase dihitung otomatis dari akumulasi uang
// masuk dibanding nilai kontrak (bukan diinput manual).
export async function recordTerminPayment(input: { projectId: string; nominalMasuk: number }) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Belum login.");
  if (!canManagePiutang(session.user.role)) {
    throw new Error("Kamu tidak punya akses untuk mencatat termin.");
  }
  if (!(input.nominalMasuk > 0)) {
    throw new Error("Nominal uang masuk harus lebih dari 0.");
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: { termin: { select: { percentage: true } } },
  });
  if (!project) throw new Error("Proyek tidak ditemukan.");

  const contractValue = Number(project.contractValue);
  const maxPctSoFar = project.termin.reduce((max, t) => Math.max(max, t.percentage), 0);
  const cumulativeBefore = (maxPctSoFar / 100) * contractValue;
  const cumulativeAfter = cumulativeBefore + input.nominalMasuk;
  const newPct = Math.min(100, Math.round((cumulativeAfter / contractValue) * 100));

  await prisma.termin.create({
    data: {
      projectId: input.projectId,
      name: `Termin ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}`,
      percentage: newPct,
      status: newPct >= 80 ? TerminStatus.ON_TRACK : TerminStatus.AT_RISK,
    },
  });
  revalidatePath("/piutang");
  revalidatePath("/dashboard");
}

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
