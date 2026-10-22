"use server";
import { ApiError, getPhpToken, phpFetch } from "@/lib/api-client";
import { revalidatePath } from "next/cache";

export async function saveKasTransitory(action: "hold" | "release" | "reversal", id: string, body: Record<string, unknown>) {
  const token = await getPhpToken();
  try {
    const result = await phpFetch<{ success: boolean; id: string }>(action === "hold" ? "/api/kas-transitory" : `/api/kas-transitory/${encodeURIComponent(id)}/${action}`, token, { method: "POST", body: JSON.stringify(body) });
    for (const path of ["/kas-transitory", "/payroll", "/kas-besar", "/kas-kecil", "/bank-buku", "/jurnal", "/jurnal-transaksi", "/laba-rugi", "/profitabilitas", "/arus-kas"]) revalidatePath(path);
    return result;
  } catch (error) { throw new Error(error instanceof ApiError ? error.message : "Gagal menyimpan Kas Transitory."); }
}
