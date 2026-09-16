"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SYSTEM_KEYS = ["kasKecil", "kasBesar", "bankBuku"];

function slugify(nama: string) {
  return nama
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

export async function createJenisInput(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Belum login.");

  const nama = (formData.get("nama") as string)?.trim();
  if (!nama) throw new Error("Nama wajib diisi.");

  const arahPencatatan = (formData.get("arahPencatatan") as string) || "JURNAL_UMUM";
  const validArah = ["JURNAL_UMUM", "PIUTANG", "PENDAPATAN"];
  if (!validArah.includes(arahPencatatan)) throw new Error("Arah pencatatan tidak valid.");

  const baseKey = slugify(nama);
  let key = baseKey;
  let suffix = 1;
  while (await prisma.jenisInputTransaksi.findUnique({ where: { key } })) {
    key = `${baseKey}_${suffix++}`;
  }

  await prisma.jenisInputTransaksi.create({
    data: { key, nama, createdById: session.user.id, extraFieldsJson: { arahPencatatan } },
  });

  await prisma.notifikasi.createMany({
    data: [
      {
        type: "JENIS_INPUT_BARU",
        targetRole: Role.SUPER_ADMIN,
        text: `Jenis input transaksi baru "${nama}" ditambahkan oleh ${session.user.name}`,
      },
      {
        type: "JENIS_INPUT_BARU",
        targetRole: Role.MANAJER_KEUANGAN,
        text: `Jenis input transaksi baru "${nama}" ditambahkan oleh ${session.user.name}`,
      },
    ],
  });

  revalidatePath("/jenis-input");
}

export async function toggleJenisInput(id: string, currentActive: boolean) {
  await prisma.jenisInputTransaksi.update({
    where: { id },
    data: { active: !currentActive },
  });
  revalidatePath("/jenis-input");
}

export async function deleteJenisInput(id: string) {
  const item = await prisma.jenisInputTransaksi.findUnique({ where: { id } });
  if (!item) throw new Error("Jenis input tidak ditemukan.");
  if (SYSTEM_KEYS.includes(item.key)) {
    throw new Error("Tidak bisa menghapus jenis input bawaan sistem.");
  }
  const count = await prisma.transaction.count({ where: { jenisInputId: id } });
  if (count > 0) throw new Error("Jenis input ini masih digunakan oleh transaksi.");
  await prisma.jenisInputTransaksi.delete({ where: { id } });
  revalidatePath("/jenis-input");
}
