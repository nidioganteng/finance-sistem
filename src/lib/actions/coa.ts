"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

export async function createCOA(formData: FormData) {
  const token = await getPhpToken();
  const code = (formData.get("code") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const kategori = formData.get("kategori") as string;
  const reportType = formData.get("reportType") as string;
  const reportCategory = (formData.get("reportCategory") as string) || "SEMUA";

  if (!code || !name || !kategori || !reportType) throw new Error("Semua field wajib diisi.");

  try {
    await phpFetch("/api/coa", token, {
      method: "POST",
      body: JSON.stringify({ code, name, kategori, reportType, reportCategory }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function updateCOA(id: string, formData: FormData) {
  const token = await getPhpToken();
  const code = (formData.get("code") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const kategori = formData.get("kategori") as string;
  const reportType = formData.get("reportType") as string;
  const reportCategory = (formData.get("reportCategory") as string) || "SEMUA";

  if (!code || !name || !kategori || !reportType) throw new Error("Semua field wajib diisi.");

  try {
    await phpFetch(`/api/coa/${id}`, token, {
      method: "PUT",
      body: JSON.stringify({ code, name, kategori, reportType, reportCategory }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function deleteCOA(id: string) {
  const token = await getPhpToken();
  try {
    await phpFetch(`/api/coa/${id}`, token, {
      method: "DELETE",
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}
