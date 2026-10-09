"use server";

import { phpFetch, getPhpToken, PHP_API_URL, ApiError } from "@/lib/api-client";

export async function uploadDokumen(formData: FormData) {
  try {
    const token = await getPhpToken();
    const res = await fetch(`${PHP_API_URL}/api/dokumen`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      return { error: err.message ?? "Gagal mengupload dokumen." };
    }
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}

export async function deleteDokumen(id: string) {
  const token = await getPhpToken();
  try {
    await phpFetch(`/api/dokumen/${id}`, token, {
      method: "DELETE",
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}
