"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { CoaKategori, ReportType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/actions/log";

export async function createCOA(formData: FormData) {
  const session = await getServerSession(authOptions);
  const code = (formData.get("code") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const kategori = formData.get("kategori") as CoaKategori;
  const reportType = formData.get("reportType") as ReportType;

  if (!code || !name || !kategori || !reportType) throw new Error("Semua field wajib diisi.");

  const last = await prisma.coaAccount.findFirst({ orderBy: { urutan: "desc" }, select: { urutan: true } });
  const urutan = (last?.urutan ?? -1) + 1;

  await prisma.coaAccount.create({ data: { code, name, kategori, reportType, urutan } });
  if (session?.user.id) {
    logActivity(session.user.id, `Tambah COA ${code} – ${name}`, "FINANCIAL_CHANGE", { code, name, kategori, reportType });
  }
  revalidatePath("/coa");
}

export async function updateCOA(id: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  const code = (formData.get("code") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const kategori = formData.get("kategori") as CoaKategori;
  const reportType = formData.get("reportType") as ReportType;

  if (!code || !name || !kategori || !reportType) throw new Error("Semua field wajib diisi.");

  await prisma.coaAccount.update({ where: { id }, data: { code, name, kategori, reportType } });
  if (session?.user.id) {
    logActivity(session.user.id, `Update COA ${code} – ${name}`, "FINANCIAL_CHANGE", { id, code, name, kategori, reportType });
  }
  revalidatePath("/coa");
}

export async function deleteCOA(id: string) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "MANAJER_KEUANGAN" && session?.user.role !== "SUPER_ADMIN") {
    throw new Error("Hanya Manajer Keuangan atau Super Admin yang bisa menghapus akun COA.");
  }
  const count = await prisma.transaction.count({ where: { coaAccountId: id } });
  if (count > 0) throw new Error("COA ini masih digunakan oleh " + count + " transaksi dan tidak bisa dihapus.");
  const coa = await prisma.coaAccount.findUnique({ where: { id }, select: { code: true, name: true } });
  await prisma.coaAccount.delete({ where: { id } });
  if (session?.user.id) {
    logActivity(session.user.id, `Hapus COA ${coa?.code} – ${coa?.name}`, "FINANCIAL_CHANGE", { id });
  }
  revalidatePath("/coa");
}
