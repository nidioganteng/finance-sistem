import { prisma } from "./prisma";
import { CoaKategori, type ReportCategory } from "@prisma/client";

// Debet-normal: saldo bertambah saat debet, berkurang saat kredit.
const DEBET_NORMAL: CoaKategori[] = [CoaKategori.ASET, CoaKategori.BEBAN];

// Akun kontra-aset: kategorinya tetep ASET (buat pengelompokan di Neraca),
// tapi saldo normalnya KREDIT — karena isinya nilai pengurang aset, bukan
// aset itu sendiri. Kode 210 (Cadangan CKPN) dan 1001 (Akm Penyusutan).
const KREDIT_NORMAL_OVERRIDE_CODES = new Set<string>(["210", "1001"]);

/**
 * Mengembalikan daftar noBukti yang menyentuh akun terlarang untuk versi laporan tertentu.
 * Jika versi = UMUM, transaksi yang menyentuh akun INTERNAL dikecualikan.
 * Jika versi = INTERNAL, transaksi yang menyentuh akun UMUM dikecualikan.
 */
export async function getExcludedNoBuktiForVersion(
  entityIds: string[] | string,
  year: number,
  version: "INTERNAL" | "UMUM"
): Promise<string[]> {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  const targetCategory: ReportCategory = version === "UMUM" ? "INTERNAL" : "UMUM";

  const rows = await prisma.transaction.findMany({
    where: {
      entityId: { in: ids },
      tanggal: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31T23:59:59`),
      },
      coaAccount: {
        reportCategory: targetCategory,
      },
      noBukti: { not: "" },
    },
    select: { noBukti: true },
    distinct: ["noBukti"],
  });

  return rows.map((r) => r.noBukti).filter(Boolean);
}

export function isDebetNormal(kategori: CoaKategori, code: string): boolean {
  if (KREDIT_NORMAL_OVERRIDE_CODES.has(code)) return false;
  return DEBET_NORMAL.includes(kategori);
}

export function isContraAset(code: string): boolean {
  return KREDIT_NORMAL_OVERRIDE_CODES.has(code);
}

// Aktiva Tetap mencakup akun aset tetap perolehan (100) dan akumulasi penyusutan (1001)
export function isAktivaTetap(code: string, name?: string): boolean {
  if (code === "100" || code === "1001" || code.startsWith("100")) return true;
  if (name && /aktiva tetap|aset tetap|penyusutan|inventaris|peralatan|kendaraan|gedung|tanah/i.test(name)) {
    return true;
  }
  return false;
}

// Akun Laba Ditahan di kelompok Modal (kode 310)
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

// Alokasi laporan tempat akun ini masuk berdasarkan kategori akuntansinya:
// ASET/KEWAJIBAN/MODAL -> Neraca, PENDAPATAN/BEBAN -> Laba Rugi. Ini bukan
// hal yang sama dengan `reportType` ("Rumah Akun", issue #28) yang bisa
// override manual per akun (mis. akun kas/bank ditandai ARUS_KAS) — Alokasi
// di sini murni cerminan kategori, dipakai buat kolom referensi Daftar Akun.
export type Alokasi = "NERACA" | "LABA_RUGI";

export function hitungAlokasi(kategori: CoaKategori): Alokasi {
  return kategori === CoaKategori.PENDAPATAN || kategori === CoaKategori.BEBAN ? "LABA_RUGI" : "NERACA";
}

