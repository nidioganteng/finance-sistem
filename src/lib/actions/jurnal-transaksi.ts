"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

export async function saveJurnalTransaksi(formData: FormData) {
  const token = await getPhpToken();
  const body = {
    tanggal: formData.get("tanggal"),
    entityKey: formData.get("entityKey"),
    noBukti: formData.get("noBukti"),
    editNoBukti: formData.get("editNoBukti") || null,
    projectId: formData.get("projectId") || null,
    rows: JSON.parse((formData.get("rows") as string) ?? "[]"),
  };

  try {
    await phpFetch("/api/jurnal-transaksi", token, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}

export async function deleteJurnalTransaksi(txIds: string[]) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/jurnal-transaksi", token, {
      method: "DELETE",
      body: JSON.stringify({ txIds }),
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}
