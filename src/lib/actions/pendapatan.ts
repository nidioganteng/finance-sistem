"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

export type FakturPendapatanInput = {
  entityId: string;
  npwp: string;
  noFaktur: string;
  masaPajak: number;
  tahunPajak: number;
  namaRekanan: string;
  namaJkp: string;
  dpp: number;
  dppNilaiLain: number;
  tarifPpnPersen?: number;
  tarifPphPersen?: number;
  kodeJenisProyek?: number;
  pekerjaanPerusahaan?: number;
  pekerjaanYangDipinjam?: number;
  tanggalTerima: string;
  bank: string;
  nominalDiterima: number;
  projectId?: string | null;
  bankTransactionId?: string | null;
};

export type RekonsiliasiPajakInput = {
  entityId: string;
  year: number;
  month: number;
  dppTerlapor: number;
  pajakTerlapor: number;
  keterangan?: string;
};

export async function createFakturPendapatanAction(data: FakturPendapatanInput) {
  const token = await getPhpToken();
  try {
    const result = await phpFetch<{ id: string }>("/api/pendapatan/faktur", token, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { success: true, id: result.id };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}

export async function updateFakturPendapatanAction(id: string, data: Partial<FakturPendapatanInput>) {
  const token = await getPhpToken();
  try {
    await phpFetch(`/api/pendapatan/faktur/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}

export async function deleteFakturPendapatanAction(id: string) {
  const token = await getPhpToken();
  try {
    await phpFetch(`/api/pendapatan/faktur/${id}`, token, {
      method: "DELETE",
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}

export async function upsertRekonsiliasiPajakAction(data: RekonsiliasiPajakInput) {
  const token = await getPhpToken();
  try {
    const result = await phpFetch<{ id: string }>("/api/pendapatan/rekonsiliasi", token, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { success: true, id: result.id };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}
