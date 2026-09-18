"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { CoaKategori } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/actions/log";

export async function createCOA(formData: FormData) {
  const session = await getServerSession(authOptions);
  const code = (formData.get("code") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const kategori = formData.get("kategori") as CoaKategori;

  const scope = (formData.get("scope") as string) || "KAS";

  if (!code || !name || !kategori) throw new Error("Semua field wajib diisi.");

  await prisma.coaAccount.create({ data: { code, name, kategori, scope } });
  if (session?.user.id) {
    logActivity(session.user.id, `Tambah COA ${code} – ${name}`, "FINANCIAL_CHANGE", { code, name, kategori, scope });
  }
  revalidatePath("/coa");
}

export async function updateCOA(id: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  const code = (formData.get("code") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const kategori = formData.get("kategori") as CoaKategori;

  if (!code || !name || !kategori) throw new Error("Semua field wajib diisi.");

  await prisma.coaAccount.update({ where: { id }, data: { code, name, kategori } });
  if (session?.user.id) {
    logActivity(session.user.id, `Update COA ${code} – ${name}`, "FINANCIAL_CHANGE", { id, code, name, kategori });
  }
  revalidatePath("/coa");
}

export async function deleteCOA(id: string) {
  const session = await getServerSession(authOptions);
  const count = await prisma.transaction.count({ where: { coaAccountId: id } });
  if (count > 0) throw new Error("COA ini masih digunakan oleh " + count + " transaksi dan tidak bisa dihapus.");
  const coa = await prisma.coaAccount.findUnique({ where: { id }, select: { code: true, name: true } });
  await prisma.coaAccount.delete({ where: { id } });
  if (session?.user.id) {
    logActivity(session.user.id, `Hapus COA ${coa?.code} – ${coa?.name}`, "FINANCIAL_CHANGE", { id });
  }
  revalidatePath("/coa");
}
