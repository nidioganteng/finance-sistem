import { CoaKategori } from "@prisma/client";

// Debet-normal: saldo bertambah saat debet, berkurang saat kredit.
export const DEBET_NORMAL: CoaKategori[] = [CoaKategori.ASET, CoaKategori.BEBAN];

export function hitungSaldoAkhir(
  kategori: CoaKategori,
  saldoAwal: number,
  totalDebet: number,
  totalKredit: number
) {
  return DEBET_NORMAL.includes(kategori)
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
