import { ApiError, getPhpToken, phpFetch } from "@/lib/api-client";

export async function saveKasTransitory(action: "hold" | "release" | "reversal", id: string, body: Record<string, unknown>) {
  const token = await getPhpToken();
  try {
    const result = await phpFetch<{ success: boolean; id: string }>(action === "hold" ? "/api/kas-transitory" : `/api/kas-transitory/${encodeURIComponent(id)}/${action}`, token, { method: "POST", body: JSON.stringify(body) });
    return result;
  } catch (error) { throw new Error(error instanceof ApiError ? error.message : "Gagal menyimpan Kas Transitory."); }
}
