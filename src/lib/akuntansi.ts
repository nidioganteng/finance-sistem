import { CoaKategori } from "@prisma/client";

// Debet-normal: saldo bertambah saat debet, berkurang saat kredit.
const DEBET_NORMAL: CoaKategori[] = [CoaKategori.ASET, CoaKategori.BEBAN];

// Akun kontra-aset: kategorinya tetep ASET (buat pengelompokan di Neraca),
// tapi saldo normalnya KREDIT — karena isinya nilai pengurang aset, bukan
// aset itu sendiri. Kode 210 (Cadangan CKPN) dikonfirmasi atasan.
const KREDIT_NORMAL_OVERRIDE_CODES = new Set<string>(["210"]);

export function isDebetNormal(kategori: CoaKategori, code: string): boolean {
  if (KREDIT_NORMAL_OVERRIDE_CODES.has(code)) return false;
  return DEBET_NORMAL.includes(kategori);
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
