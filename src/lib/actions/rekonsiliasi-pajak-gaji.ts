"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "./log";

export interface SaveRekonsiliasiGajiPph21Input {
  entityId: string;
  year: number;
  month: number;
  gajiTerlapor: number;
  pph21Terlapor: number;
  gajiPegawaiTerlapor?: number;
  gajiTaTerlapor?: number;
  ntpn?: string;
  keterangan?: string;
}

export async function saveRekonsiliasiGajiPph21Action(input: SaveRekonsiliasiGajiPph21Input) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Belum login." };
  }

  const role = session.user.role;
  if (!canManageTransaksi(role) && role !== "SUPER_ADMIN" && role !== "MANAJER_KEUANGAN" && role !== "STAF_KEUANGAN") {
    return { error: "Kamu tidak punya hak akses untuk mengubah rekonsiliasi pajak gaji." };
  }

  const entity = await prisma.entity.findFirst({
    where: {
      id: input.entityId,
      ...(role !== "SUPER_ADMIN" ? { key: { in: session.user.entityKeys } } : {}),
    },
  });
  if (!entity) return { error: "Kamu tidak punya akses ke entitas ini." };

  if (input.month < 1 || input.month > 12) {
    return { error: "Bulan harus antara 1 dan 12." };
  }

  const saved = await prisma.rekonsiliasiGajiPph21.upsert({
    where: {
      entityId_year_month: {
        entityId: input.entityId,
        year: input.year,
        month: input.month,
      },
    },
    update: {
      gajiTerlapor: Math.max(0, Number(input.gajiTerlapor) || 0),
      pph21Terlapor: Math.max(0, Number(input.pph21Terlapor) || 0),
      gajiPegawaiTerlapor: Math.max(0, Number(input.gajiPegawaiTerlapor) || 0),
      gajiTaTerlapor: Math.max(0, Number(input.gajiTaTerlapor) || 0),
      ntpn: input.ntpn?.trim() || null,
      keterangan: input.keterangan?.trim() || null,
    },
    create: {
      entityId: input.entityId,
      year: input.year,
      month: input.month,
      gajiTerlapor: Math.max(0, Number(input.gajiTerlapor) || 0),
      pph21Terlapor: Math.max(0, Number(input.pph21Terlapor) || 0),
      gajiPegawaiTerlapor: Math.max(0, Number(input.gajiPegawaiTerlapor) || 0),
      gajiTaTerlapor: Math.max(0, Number(input.gajiTaTerlapor) || 0),
      ntpn: input.ntpn?.trim() || null,
      keterangan: input.keterangan?.trim() || null,
    },
  });

  logActivity(
    session.user.id,
    `Update Rekonsiliasi Pajak Gaji & PPh 21 Bulan ${input.month}/${input.year} (${entity.name})`,
    "TRANSAKSI",
    {
      entityId: input.entityId,
      year: input.year,
      month: input.month,
      gajiTerlapor: input.gajiTerlapor,
      pph21Terlapor: input.pph21Terlapor,
    }
  );

  revalidatePath("/pajak");
  return { success: true, data: saved };
}
