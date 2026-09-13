"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function registerUser(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return { error: "Semua field wajib diisi." };
  }
  if (password.length < 8) {
    return { error: "Password minimal 8 karakter." };
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { name, email, passwordHash, status: "PENDING" },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return { error: "Email sudah terdaftar. Gunakan email lain atau login." };
    }
    return { error: "Terjadi kesalahan. Coba lagi." };
  }

  redirect("/login?registered=1");
}
