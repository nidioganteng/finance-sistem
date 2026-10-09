"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

export type LogCategory = "USER_ACTIVITY" | "FINANCIAL_CHANGE";

export async function logExportActivity(action: string, detail?: Record<string, unknown>) {
  try {
    const token = await getPhpToken();
    await phpFetch("/api/log/activity", token, {
      method: "POST",
      body: JSON.stringify({ action, category: "USER_ACTIVITY", detail: detail ?? {} }),
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function logActivity(
  actorId: string,
  action: string,
  category: LogCategory,
  detail?: Record<string, unknown>,
) {
  // Hanya catat tindakan yang mengubah konten data
  const trimmed = action.trim();
  if (
    trimmed.startsWith("Buka ") ||
    trimmed.startsWith("Lihat ") ||
    trimmed.startsWith("Navigasi ")
  ) {
    return;
  }

  try {
    const token = await getPhpToken();
    await phpFetch("/api/log/activity", token, {
      method: "POST",
      body: JSON.stringify({ actorId, action, category, detail: detail ?? {} }),
    });
  } catch (e) {
    if (e instanceof ApiError) return;
    // log gagal tidak boleh gagalkan operasi utama
  }
}
