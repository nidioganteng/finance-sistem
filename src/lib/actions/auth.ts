"use server";

import { redirect } from "next/navigation";
import { phpFetch, ApiError } from "@/lib/api-client";

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
    await phpFetch("/api/auth/register", null, {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 409) {
        return { error: "Email sudah terdaftar. Gunakan email lain atau login." };
      }
      return { error: e.message };
    }
    return { error: "Terjadi kesalahan. Coba lagi." };
  }

  redirect("/login?registered=1");
}
