import { phpFetch, getPhpToken } from "./api-client";
import { CoaKategori } from "@prisma/client";

// Debet-normal: saldo bertambah saat debet, berkurang saat kredit.
const DEBET_NORMAL: CoaKategori[] = [CoaKategori.ASET, CoaKategori.BEBAN];

// Akun kontra-aset
const KREDIT_NORMAL_OVERRIDE_CODES = new Set<string>(["210", "1001"]);

/**
 * Mengembalikan daftar noBukti yang menyentuh akun terlarang untuk versi laporan tertentu.
 * Jika endpoint PHP belum ada, return [] sebagai fallback — operasi sudah ditangani di PHP side.
 */
export async function getExcludedNoBuktiForVersion(
  entityIds: string[] | string,
  year: number,
  version: "INTERNAL" | "UMUM"
): Promise<string[]> {
  try {
    const token = await getPhpToken();
    const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
    const params = new URLSearchParams();
    ids.forEach((id) => params.append("entityIds[]", id));
    params.set("year", String(year));
    params.set("version", version);

    const result = await phpFetch<{ noBuktis: string[] }>(
      `/api/jurnal/excluded-nobukti?${params.toString()}`,
      token
    );
    return result.noBuktis ?? [];
  } catch {
    return [];
  }
}

export function isDebetNormal(kategori: CoaKategori, code: string): boolean {
  if (KREDIT_NORMAL_OVERRIDE_CODES.has(code)) return false;
  return DEBET_NORMAL.includes(kategori);
}

export function isContraAset(code: string): boolean {
  return KREDIT_NORMAL_OVERRIDE_CODES.has(code);
}

export function isAktivaTetap(code: string, name?: string): boolean {
  if (code === "100" || code === "1001" || code.startsWith("100")) return true;
  if (name && /aktiva tetap|aset tetap|penyusutan|inventaris|peralatan|kendaraan|gedung|tanah/i.test(name)) {
    return true;
  }
  return false;
}

export function isLabaDitahan(code: string, name?: string): boolean {
  if (code === "310") return true;
  if (name && /laba ditahan/i.test(name)) return true;
  return false;
}

export function hitungSaldoAkhir(
  kategori: CoaKategori,
  code: string,
  saldoAwal: number,
  totalDebet: number,
  totalKredit: number
) {
  return isDebetNormal(kategori, code)
    ? saldoAwal + totalDebet - totalKredit
    : saldoAwal + totalKredit - totalDebet;
}

export type Alokasi = "NERACA" | "LABA_RUGI";

export function hitungAlokasi(kategori: CoaKategori): Alokasi {
  return kategori === CoaKategori.PENDAPATAN || kategori === CoaKategori.BEBAN ? "LABA_RUGI" : "NERACA";
}
