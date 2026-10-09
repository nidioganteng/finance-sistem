"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

export type CreatePelunasanInput = {
  currentEntityKey: string;
  balanceType: "piutang" | "hutang";
  counterpartyEntityKey: string;
  tanggal: string;
  noBukti: string;
  keterangan: string;
  nominal: number;
  jenisKasSumber: "kasKecil" | "kasBesar";
  jenisKasTujuan?: "kasKecil" | "kasBesar";
};

export async function createPelunasan(input: CreatePelunasanInput): Promise<{ error?: string; success?: boolean }> {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/piutang/pelunasan", token, {
      method: "POST",
      body: JSON.stringify({ input }),
    });
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: "Terjadi kesalahan." };
  }
}

export async function auditTermin(terminId: string) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/piutang/termin/audit", token, {
      method: "POST",
      body: JSON.stringify({ terminId }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function updateTerminStatus(terminId: string, status: string) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/piutang/termin/status", token, {
      method: "PATCH",
      body: JSON.stringify({ terminId, status }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function completeProject(projectId: string) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/piutang/proyek/complete", token, {
      method: "POST",
      body: JSON.stringify({ projectId }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function cancelProject(projectId: string) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/piutang/proyek/cancel", token, {
      method: "POST",
      body: JSON.stringify({ projectId }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function reopenProject(projectId: string) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/piutang/proyek/reopen", token, {
      method: "POST",
      body: JSON.stringify({ projectId }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}
