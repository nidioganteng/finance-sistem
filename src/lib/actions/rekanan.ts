"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";
import { RekananTipe } from "@/types/app-enums";

export type { RekananTipe };

export type RekananInput = {
  nama: string;
  npwp?: string | null;
  nik?: string | null;
  tipe?: RekananTipe;
  kategori?: string | null;
  alamat?: string | null;
  telepon?: string | null;
  email?: string | null;
  namaBank?: string | null;
  noRekening?: string | null;
  atasNamaBank?: string | null;
  entityId?: string | null;
};

export type RekananItem = {
  id: string;
  nama: string;
  npwp: string | null;
  nik: string | null;
  tipe: RekananTipe;
  kategori: string | null;
  alamat: string | null;
  telepon: string | null;
  email: string | null;
  namaBank: string | null;
  noRekening: string | null;
  atasNamaBank: string | null;
  entityId: string | null;
  entityName?: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Pencarian Rekanan Terpusat untuk fitur Auto-Fill
 */
export async function searchRekananAction(
  query: string,
  tipe?: string
): Promise<{ data: RekananItem[] }> {
  const token = await getPhpToken();
  const params = new URLSearchParams({ q: query });
  if (tipe) params.set("tipe", tipe);
  return phpFetch<{ data: RekananItem[] }>(
    `/api/rekanan/search?${params}`,
    token
  );
}

/**
 * Mengambil daftar rekanan lengkap untuk Halaman Master Data Rekanan
 */
export async function getRekananListAction(params?: {
  search?: string;
  tipe?: string;
  entityId?: string;
}): Promise<{ data: RekananItem[] }> {
  const token = await getPhpToken();
  const sp = new URLSearchParams();
  if (params?.search) sp.set("search", params.search);
  if (params?.tipe) sp.set("tipe", params.tipe);
  if (params?.entityId) sp.set("entityId", params.entityId);
  return phpFetch<{ data: RekananItem[] }>(`/api/rekanan?${sp}`, token);
}

/**
 * Tambah Rekanan Baru
 */
export async function createRekananAction(data: RekananInput) {
  const token = await getPhpToken();
  try {
    const result = await phpFetch<{ success: boolean; id: string }>(
      "/api/rekanan",
      token,
      { method: "POST", body: JSON.stringify(data) }
    );
    return { success: true, id: result.id };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}

/**
 * Edit Rekanan
 */
export async function updateRekananAction(
  id: string,
  data: Partial<RekananInput>
) {
  const token = await getPhpToken();
  try {
    await phpFetch<{ success: boolean; id: string }>(
      `/api/rekanan/${id}`,
      token,
      { method: "PUT", body: JSON.stringify(data) }
    );
    return { success: true, id };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}

/**
 * Hapus Rekanan
 */
export async function deleteRekananAction(id: string) {
  const token = await getPhpToken();
  try {
    await phpFetch<{ success: boolean }>(`/api/rekanan/${id}`, token, {
      method: "DELETE",
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}

/**
 * Utility otomatis: simpan NPWP/Nama ke Master Data jika belum terdaftar.
 */
export async function autoRegisterRekananIfNew(
  npwp: string,
  nama: string,
  tipe: RekananTipe = "KLIEN"
) {
  const token = await getPhpToken();
  try {
    await phpFetch<{ success: boolean }>("/api/rekanan/auto-register", token, {
      method: "POST",
      body: JSON.stringify({ npwp, nama, tipe }),
    });
  } catch {
    // Abaikan error (concurrency race condition)
  }
}
