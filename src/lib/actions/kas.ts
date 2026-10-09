"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

export type CreateKasTransactionInput = {
  entityKey: string;
  jenisInputKey: string;
  tanggal: string;
  noBukti: string;
  keterangan: string;
  arah: "masuk" | "keluar";
  rows: { coaAccountId: string; nominal: number; keterangan?: string }[];
  pagePath: string;
  rekeningId?: string;
  crossingEntityKeys?: string[];
  projectId?: string;
  arahLaporan?: string[];
  syncBukuBankRekeningId?: string;
};

export async function generateNoBukti(entityKey: string, tanggal: string): Promise<string> {
  const token = await getPhpToken();
  const result = await phpFetch<{ noBukti: string }>("/api/kas/no-bukti", token, {
    method: "POST",
    body: JSON.stringify({ entityKey, tanggal }),
  });
  return result.noBukti;
}

export async function createKasTransaction(input: CreateKasTransactionInput) {
  const token = await getPhpToken();
  try {
    const result = await phpFetch<{ noBukti: string }>("/api/kas/transaksi", token, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { success: true, noBukti: result.noBukti };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}

export async function deleteKasTransactionGroup(txIds: string[], pagePath: string) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/kas/transaksi", token, {
      method: "DELETE",
      body: JSON.stringify({ txIds, pagePath }),
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}

export async function replaceKasTransaction(input: CreateKasTransactionInput & { existingTxIds: string[] }) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/kas/transaksi", token, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}

export async function updateKasTransactionGroup(input: {
  txIds: string[];
  newNoBukti: string;
  newKeterangan: string;
  coaUpdates: { txId: string; newCoaAccountId: string }[];
  pagePath: string;
}) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/kas/transaksi", token, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}
