"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

export async function updateKodeAkunJurnal(transactionId: string, entityId: string, newCode: string) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/jurnal/kode-akun", token, {
      method: "PATCH",
      body: JSON.stringify({ transactionId, entityId, newCode }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function updateProyekJurnal(transactionId: string, entityId: string, newProjectId: string | null) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/jurnal/proyek", token, {
      method: "PATCH",
      body: JSON.stringify({ transactionId, entityId, newProjectId }),
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function updateAkrualJurnal(
  transactionId: string,
  entityId: string,
  bulan: number | null,
  tahun: number | null
) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/jurnal/akrual", token, {
      method: "PATCH",
      body: JSON.stringify({ transactionId, entityId, bulan, tahun }),
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}
