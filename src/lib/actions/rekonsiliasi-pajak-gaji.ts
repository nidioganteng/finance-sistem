import { phpFetch, getPhpToken } from "@/lib/api-client";
import { canManageTransaksi } from "@/lib/rbac";
import { logActivity } from "./log";

export interface SaveRekonsiliasiGajiPph21Input {
  entityId: string;
  year: number;
  month: number;
  gajiTerlapor: number;
  pph21Terlapor: number;
  gajiPegawaiTerlapor?: number;
  gajiTaTerlapor?: number;
  pph21PegawaiTerlapor?: number;
  pph21TaTerlapor?: number;
  ntpn?: string;
  keterangan?: string;
}

export async function saveRekonsiliasiGajiPph21Action(
  input: SaveRekonsiliasiGajiPph21Input,
  userId: string,
  role: string
) {
  if (!userId) {
    return { error: "Belum login." };
  }

  if (!canManageTransaksi(role) && role !== "SUPER_ADMIN" && role !== "MANAJER_KEUANGAN" && role !== "STAF_KEUANGAN") {
    return { error: "Kamu tidak punya hak akses untuk mengubah rekonsiliasi pajak gaji." };
  }

  if (input.month < 1 || input.month > 12) {
    return { error: "Bulan harus antara 1 dan 12." };
  }

  const gajiPeg = Math.max(0, Number(input.gajiPegawaiTerlapor) || 0);
  const gajiTa = Math.max(0, Number(input.gajiTaTerlapor) || 0);
  const pphPeg = Math.max(0, Number(input.pph21PegawaiTerlapor) || 0);
  const pphTa = Math.max(0, Number(input.pph21TaTerlapor) || 0);

  const gajiTot = Math.max(0, Number(input.gajiTerlapor) || (gajiPeg + gajiTa));
  const pphTot = Math.max(0, Number(input.pph21Terlapor) || (pphPeg + pphTa));

  try {
    const token = await getPhpToken();
    const saved = await phpFetch<{ success: boolean; id: string }>(
      "/api/rekonsiliasi-pajak-gaji",
      token,
      {
        method: "POST",
        body: JSON.stringify({
          entityId: input.entityId,
          year: input.year,
          month: input.month,
          gajiTerlapor: gajiTot,
          pph21Terlapor: pphTot,
          gajiPegawaiTerlapor: gajiPeg,
          gajiTaTerlapor: gajiTa,
          pph21PegawaiTerlapor: pphPeg,
          pph21TaTerlapor: pphTa,
          ntpn: input.ntpn?.trim() || null,
          keterangan: input.keterangan?.trim() || null,
        }),
      }
    );

    await logActivity(
      userId,
      `Update Rekonsiliasi Pajak Gaji & PPh 21 Bulan ${input.month}/${input.year} Entitas ${input.entityId}`,
      "FINANCIAL_CHANGE",
      {
        rekonsiliasiId: saved.id,
        entityId: input.entityId,
        year: input.year,
        month: input.month,
        gajiTerlapor: gajiTot,
        pph21Terlapor: pphTot,
        gajiPegawaiTerlapor: gajiPeg,
        gajiTaTerlapor: gajiTa,
      }
    );

    return { success: true, id: saved.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menyimpan rekonsiliasi.";
    return { error: msg };
  }
}
