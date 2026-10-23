/**
 * PHP API client — semua fetch ke backend PHP melalui helper ini.
 * Token JWT PHP disimpan di localStorage (auth-store.ts).
 */

import { getStoredToken } from "./auth-store";

export const PHP_API_URL =
  process.env.NEXT_PUBLIC_PHP_API_URL ??
  "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function phpFetch<T = unknown>(
  path: string,
  token: string | null | undefined,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${PHP_API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new ApiError(res.status, err.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getPhpToken(): Promise<string> {
  const token = getStoredToken();
  if (!token) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Sesi habis. Silakan login kembali.");
  }
  return token;
}
