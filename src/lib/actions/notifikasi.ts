"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

export async function markAllNotifikasiRead() {
  try {
    const token = await getPhpToken();
    await phpFetch("/api/notifikasi/read-all", token, {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch (e) {
    if (e instanceof ApiError) return;
    // silent fail — same behavior as original
  }
}

export async function markNotifikasiRead(id: string) {
  try {
    const token = await getPhpToken();
    await phpFetch("/api/notifikasi/read", token, {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  } catch (e) {
    if (e instanceof ApiError) return;
    // silent fail — same behavior as original
  }
}
