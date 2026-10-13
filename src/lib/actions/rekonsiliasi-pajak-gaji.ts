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
  pph21PegawaiTerlapor?: number;
  pph21TaTerlapor?: number;
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

  const gajiPeg = Math.max(0, Number(input.gajiPegawaiTerlapor) || 0);
  const gajiTa = Math.max(0, Number(input.gajiTaTerlapor) || 0);
  const pphPeg = Math.max(0, Number(input.pph21PegawaiTerlapor) || 0);
  const pphTa = Math.max(0, Number(input.pph21TaTerlapor) || 0);

  // Jika input total kosong tapi rincian diisi, auto-sum ke total
  const gajiTot = Math.max(0, Number(input.gajiTerlapor) || (gajiPeg + gajiTa));
  const pphTot = Math.max(0, Number(input.pph21Terlapor) || (pphPeg + pphTa));

  const saved = await prisma.rekonsiliasiGajiPph21.upsert({
    where: {
      entityId_year_month: {
        entityId: input.entityId,
        year: input.year,
        month: input.month,
      },
    },
    update: {
      gajiTerlapor: gajiTot,
      pph21Terlapor: pphTot,
      gajiPegawaiTerlapor: gajiPeg,
      gajiTaTerlapor: gajiTa,
      pph21PegawaiTerlapor: pphPeg,
      pph21TaTerlapor: pphTa,
      ntpn: input.ntpn?.trim() || null,
      keterangan: input.keterangan?.trim() || null,
    },
    create: {
      entityId: input.entityId,
      year: input.year,
      month: input.month,
      gajiTerlapor: gajiTot,
      pph21Terlapor: pphTot,
      gajiPegawaiTerlapor: gajiPeg,
      gajiTaTerlapor: gajiTa,
      pph21PegawaiTerlapor: pphPeg,
      pph21TaTerlapor: pphTa,
      ntpn: input.ntpn?.trim() || null,
      keterangan: input.keterangan?.trim() || null,
    },
  });

  logActivity(
    session.user.id,
    `Update Rekonsiliasi Pajak Gaji & PPh 21 Bulan ${input.month}/${input.year} (${entity.name})`,
    "FINANCIAL_CHANGE",
    {
      entityId: input.entityId,
      year: input.year,
      month: input.month,
      gajiTerlapor: gajiTot,
      pph21Terlapor: pphTot,
      gajiPegawaiTerlapor: gajiPeg,
      gajiTaTerlapor: gajiTa,
    }
  );

  revalidatePath("/pajak");
  revalidatePath("/payroll");
  return { success: true, data: saved };
}
