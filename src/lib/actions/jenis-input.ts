"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

export async function createJenisInput(data: { nama: string; arahLaporan: string[]; entityKeys: string[] }) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/jenis-input", token, {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function toggleJenisInput(id: string, currentActive: boolean) {
  const token = await getPhpToken();
  try {
    await phpFetch(`/api/jenis-input/${id}/toggle`, token, {
      method: "POST",
      body: JSON.stringify({ currentActive }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function deleteJenisInput(id: string) {
  const token = await getPhpToken();
  try {
    await phpFetch(`/api/jenis-input/${id}`, token, {
      method: "DELETE",
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}
