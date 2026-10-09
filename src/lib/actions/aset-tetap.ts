"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

export type AsetTetapInput = {
  entityId: string;
  kode: string;
  nama: string;
  kategori: string;
  tanggalPerolehan: string;
  hargaPerolehan: number;
  nilaiResidu?: number;
  umurBulan: number;
  keterangan?: string;
};

export async function createAsetTetapAction(data: AsetTetapInput) {
  const token = await getPhpToken();
  try {
    const result = await phpFetch("/api/aset-tetap", token, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return result;
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function updateAsetTetapAction(id: string, data: Partial<AsetTetapInput>) {
  const token = await getPhpToken();
  try {
    const result = await phpFetch(`/api/aset-tetap/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return result;
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function deleteAsetTetapAction(id: string) {
  const token = await getPhpToken();
  try {
    await phpFetch(`/api/aset-tetap/${id}`, token, {
      method: "DELETE",
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}
