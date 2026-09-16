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
