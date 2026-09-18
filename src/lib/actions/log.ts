"use server";

import { prisma } from "@/lib/prisma";
import { LogCategory } from "@prisma/client";

export async function logActivity(
  actorId: string,
  action: string,
  category: LogCategory,
  detail?: Record<string, unknown>,
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.activityLog.create({ data: { actorId, action, category, detail: detail as any } });
  } catch {
    // log gagal tidak boleh gagalkan operasi utama
  }
}
