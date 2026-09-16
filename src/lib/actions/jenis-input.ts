"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SYSTEM_KEYS = ["kasKecil", "kasBesar", "bankBuku"];

const LAPORAN_LABEL: Record<string, string> = {
  JURNAL_UMUM: "Jurnal Umum",
  BUKU_BESAR: "Buku Besar",
  LAPORAN_KEUANGAN: "Laporan Keuangan",
  PIUTANG: "Piutang",
  PAJAK: "Laporan Pajak",
};

const VALID_LAPORAN = Object.keys(LAPORAN_LABEL);

function slugify(nama: string) {
  return nama
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

export async function createJenisInput(data: { nama: string; arahLaporan: string[] }) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Belum login.");
  if (session.user.role !== "STAF_KEUANGAN") throw new Error("Hanya Staf Keuangan yang bisa menambahkan jenis input.");

  const nama = data.nama?.trim();
  if (!nama) throw new Error("Nama wajib diisi.");

  const arahLaporan = data.arahLaporan.filter((a) => VALID_LAPORAN.includes(a));
  if (arahLaporan.length === 0) throw new Error("Pilih minimal satu tujuan pencatatan.");

  const baseKey = slugify(nama);
  let key = baseKey;
  let suffix = 1;
  while (await prisma.jenisInputTransaksi.findUnique({ where: { key } })) {
    key = `${baseKey}_${suffix++}`;
  }

  await prisma.jenisInputTransaksi.create({
    data: { key, nama, createdById: session.user.id, extraFieldsJson: { arahLaporan } },
  });

  const now = new Date();
  const tanggal = now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  const jam = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const lapoText = arahLaporan.map((k) => LAPORAN_LABEL[k] ?? k).join(", ");
  const notifText = `${session.user.name} menambahkan jenis input baru "${nama}" (dicatat ke: ${lapoText}) pada ${tanggal} pukul ${jam}.`;

  await prisma.notifikasi.createMany({
    data: [
      { type: "JENIS_INPUT_BARU", targetRole: Role.SUPER_ADMIN, text: notifText },
      { type: "JENIS_INPUT_BARU", targetRole: Role.MANAJER_KEUANGAN, text: notifText },
    ],
  });

  revalidatePath("/jenis-input");
}

export async function toggleJenisInput(id: string, currentActive: boolean) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "STAF_KEUANGAN") throw new Error("Akses ditolak.");
  await prisma.jenisInputTransaksi.update({
    where: { id },
    data: { active: !currentActive },
  });
  revalidatePath("/jenis-input");
}

export async function deleteJenisInput(id: string) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "STAF_KEUANGAN") throw new Error("Akses ditolak.");
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
