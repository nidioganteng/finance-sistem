"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

export async function upsertSaldoAwal(entityId: string, coaAccountId: string, year: number, nominal: number) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/saldo-awal", token, {
      method: "POST",
      body: JSON.stringify({ entityId, coaAccountId, year, nominal }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}
