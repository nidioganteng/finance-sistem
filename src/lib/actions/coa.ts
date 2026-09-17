"use server";

import { revalidatePath } from "next/cache";
import { CoaKategori } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createCOA(formData: FormData) {
  const code = (formData.get("code") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const kategori = formData.get("kategori") as CoaKategori;

  const scope = (formData.get("scope") as string) || "KAS";

  if (!code || !name || !kategori) throw new Error("Semua field wajib diisi.");

  await prisma.coaAccount.create({ data: { code, name, kategori, scope } });
  revalidatePath("/coa");
}

export async function updateCOA(id: string, formData: FormData) {
  const code = (formData.get("code") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const kategori = formData.get("kategori") as CoaKategori;

  if (!code || !name || !kategori) throw new Error("Semua field wajib diisi.");

  await prisma.coaAccount.update({ where: { id }, data: { code, name, kategori } });
  revalidatePath("/coa");
}

export async function deleteCOA(id: string) {
  const count = await prisma.transaction.count({ where: { coaAccountId: id } });
  if (count > 0) throw new Error("COA ini masih digunakan oleh " + count + " transaksi dan tidak bisa dihapus.");
  await prisma.coaAccount.delete({ where: { id } });
  revalidatePath("/coa");
}
