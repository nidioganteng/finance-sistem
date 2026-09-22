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
