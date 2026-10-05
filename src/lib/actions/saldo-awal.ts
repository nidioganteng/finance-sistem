"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "@/lib/actions/log";
import { getCoaOwnerEntityKey, ENTITY_NAMES } from "@/lib/bank-accounts";

export async function upsertSaldoAwal(entityId: string, coaAccountId: string, year: number, nominal: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user.id || !canManageTransaksi(session.user.role)) {
    throw new Error("Kamu tidak punya akses untuk mengubah saldo awal.");
  }
  if (!session.user.entityKeys.length) throw new Error("Kamu tidak punya akses ke entitas manapun.");

  const entity = await prisma.entity.findFirst({
    where: { id: entityId, key: { in: session.user.entityKeys } },
  });
  if (!entity) throw new Error("Kamu tidak punya akses ke entitas ini.");

  if (!Number.isFinite(nominal)) throw new Error("Nominal saldo awal tidak valid.");

  const coa = await prisma.coaAccount.findUnique({ where: { id: coaAccountId }, select: { code: true, name: true } });
  if (!coa) throw new Error("Akun COA tidak ditemukan.");

  const ownerKey = getCoaOwnerEntityKey(coa.code);
  if (ownerKey && ownerKey !== entity.key) {
    const ownerName = ENTITY_NAMES[ownerKey] ?? ownerKey;
    throw new Error(
      `Akun ${coa.code} – ${coa.name} adalah Kas/Bank khusus entitas ${ownerName}. Silakan beralih ke entitas ${ownerName} untuk mengisi saldo awal.`
    );
  }

  await prisma.saldoAwal.upsert({
    where: { entityId_coaAccountId_year: { entityId, coaAccountId, year } },
    update: { nominal },
    create: { entityId, coaAccountId, year, nominal },
  });

  logActivity(session.user.id, `Update saldo awal ${coa?.code} – ${coa?.name} (${entity.name}, ${year})`, "FINANCIAL_CHANGE", {
    entityId,
    coaAccountId,
    year,
    nominal,
  });

  revalidatePath("/daftar-akun");
  revalidatePath("/buku-besar");
  revalidatePath("/bank-buku");
  revalidatePath("/kas-kecil");
  revalidatePath("/kas-besar");
  revalidatePath("/dashboard");
  revalidatePath("/neraca");
  revalidatePath("/laporan-keuangan");
}
