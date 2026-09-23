import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { CoaKategori } from "@prisma/client";
import {
  isDebetNormal,
  isContraAset,
  isAktivaTetap,
  isLabaDitahan,
  hitungSaldoAkhir,
} from "./akuntansi";
import { getPenyusutanSummary } from "./aset-tetap";

export type CoaLine = {
  code: string;
  name: string;
  saldo: number;
  saldoFmt: string;
  isContra?: boolean;
};

export async function getNeracaData(entityId: string, year: number) {
  const [allCoa, saldoAwalRows, transactions, penyusutanSummary] = await Promise.all([
    prisma.coaAccount.findMany({ orderBy: { urutan: "asc" } }),
    prisma.saldoAwal.findMany({ where: { entityId, year } }),
    prisma.transaction.findMany({
      where: {
        entityId,
        coaAccountId: { not: null },
        tanggal: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31T23:59:59`),
        },
      },
      select: { coaAccountId: true, debit: true, kredit: true },
    }),
    getPenyusutanSummary(entityId, year),
  ]);

  const totalsByAccount = new Map<string, { debit: number; kredit: number }>();
  for (const t of transactions) {
    if (!t.coaAccountId) continue;
    const cur = totalsByAccount.get(t.coaAccountId) ?? { debit: 0, kredit: 0 };
    cur.debit += Number(t.debit);
    cur.kredit += Number(t.kredit);
    totalsByAccount.set(t.coaAccountId, cur);
  }

  const saldoAwalByAccount = new Map(saldoAwalRows.map((s) => [s.coaAccountId, Number(s.nominal)]));

  // 1. Laba Tahun Berjalan dari akun nominal (PENDAPATAN & BEBAN)
  let totalPendapatan = 0;
  let totalBeban = 0;

  for (const coa of allCoa) {
    const { debit, kredit } = totalsByAccount.get(coa.id) ?? { debit: 0, kredit: 0 };
    if (coa.kategori === CoaKategori.PENDAPATAN) {
      totalPendapatan += kredit - debit;
    } else if (coa.kategori === CoaKategori.BEBAN) {
      // Jika akun beban penyusutan dan ada hitungan otomatis dari Modul Aset Tetap,
      // kita tangani sinkronisasinya agar tidak dobel hitung.
      const isDeprCoa = coa.code === "512" || coa.code === "540" || /penyusutan/i.test(coa.name);
      if (isDeprCoa && penyusutanSummary.totalBebanPenyusutan > 0) {
        // Akan ditambahkan otomatis di bawah
      } else {
        totalBeban += debit - kredit;
      }
    }
  }

  // Issue 39: Tarik otomatis beban penyusutan dari Modul Aktiva Tetap
  if (penyusutanSummary.totalBebanPenyusutan > 0) {
    totalBeban += penyusutanSummary.totalBebanPenyusutan;
  }

  const labaBersih = totalPendapatan - totalBeban;

  // 2. Akun-akun Neraca (ASET, KEWAJIBAN, MODAL)
  const aktivaLancar: CoaLine[] = [];
  const aktivaTetap: CoaLine[] = [];
  const kewajiban: CoaLine[] = [];
  const modal: CoaLine[] = [];
  let labaDitahanSaldo = 0;
  let labaDitahanItem: CoaLine | null = null;

  const formatSaldo = (val: number, isContra: boolean) => {
    const abs = formatRupiah(Math.abs(val));
    if (isContra) return `(${abs})`;
    return val < 0 ? `-${abs}` : abs;
  };

  for (const coa of allCoa) {
    const saldoAwal = saldoAwalByAccount.get(coa.id) ?? 0;
    const { debit, kredit } = totalsByAccount.get(coa.id) ?? { debit: 0, kredit: 0 };
    const saldo = hitungSaldoAkhir(coa.kategori, coa.code, saldoAwal, debit, kredit);
    const hasActivity = saldoAwal !== 0 || debit !== 0 || kredit !== 0;
    const contra = isContraAset(coa.code);

    const line: CoaLine = {
      code: coa.code,
      name: coa.name,
      saldo,
      saldoFmt: formatSaldo(saldo, contra),
      isContra: contra,
    };

    if (coa.kategori === CoaKategori.ASET) {
      if (isAktivaTetap(coa.code, coa.name)) {
        // Tampilkan akun aktiva tetap jika ada saldo/transaksi atau akun standar (100 / 1001)
        if (hasActivity || coa.code === "100" || coa.code === "1001") {
          aktivaTetap.push(line);
        }
      } else {
        if (hasActivity) {
          aktivaLancar.push(line);
        }
      }
    } else if (coa.kategori === CoaKategori.KEWAJIBAN) {
      if (hasActivity) {
        kewajiban.push(line);
      }
    } else if (coa.kategori === CoaKategori.MODAL) {
      if (isLabaDitahan(coa.code, coa.name)) {
        labaDitahanSaldo = saldo;
        labaDitahanItem = line;
      } else {
        if (hasActivity || coa.code === "320") {
          modal.push(line);
        }
      }
    }
  }

  // Issue 39: Sinkronkan saldo Aktiva Tetap & Akumulasi Penyusutan dari Modul Aset Tetap
  if (penyusutanSummary.assets.length > 0) {
    // 1. Akun Akumulasi Penyusutan (kontra aset)
    let akmLine = aktivaTetap.find((a) => a.isContra || a.code === "1001" || /penyusutan/i.test(a.name));
    if (akmLine) {
      akmLine.saldo = penyusutanSummary.totalAkumulasiPenyusutan;
      akmLine.saldoFmt = formatSaldo(akmLine.saldo, true);
      akmLine.isContra = true;
    } else if (penyusutanSummary.totalAkumulasiPenyusutan > 0) {
      aktivaTetap.push({
        code: "1001",
        name: "Akumulasi Penyusutan Aset",
        saldo: penyusutanSummary.totalAkumulasiPenyusutan,
        saldoFmt: formatSaldo(penyusutanSummary.totalAkumulasiPenyusutan, true),
        isContra: true,
      });
    }

    // 2. Akun Perolehan Aktiva Tetap
    let perolehanLine = aktivaTetap.find((a) => !a.isContra && (a.code === "100" || /aktiva tetap|aset tetap/i.test(a.name)));
    if (perolehanLine) {
      if (perolehanLine.saldo === 0 || perolehanLine.saldo < penyusutanSummary.totalHargaPerolehan) {
        perolehanLine.saldo = penyusutanSummary.totalHargaPerolehan;
        perolehanLine.saldoFmt = formatSaldo(perolehanLine.saldo, false);
      }
    } else if (penyusutanSummary.totalHargaPerolehan > 0) {
      aktivaTetap.unshift({
        code: "100",
        name: "Aktiva Tetap (Perolehan)",
        saldo: penyusutanSummary.totalHargaPerolehan,
        saldoFmt: formatSaldo(penyusutanSummary.totalHargaPerolehan, false),
        isContra: false,
      });
    }
  }

  // 3. Formula Neraca Sesuai Standar & Templat Excel (Issue 38 & 39)
  // • Total Aktiva Lancar: akun debet dijumlahkan, akun kontra dikurangkan
  const totalAktivaLancar = aktivaLancar.reduce(
    (sum, item) => sum + (item.isContra ? -item.saldo : item.saldo),
    0
  );

  // • Total Aktiva Tetap: Nilai Perolehan Aktiva Tetap dikurangi Akumulasi Penyusutan (kontra)
  const totalAktivaTetap = aktivaTetap.reduce(
    (sum, item) => sum + (item.isContra ? -item.saldo : item.saldo),
    0
  );

  // • Total Aktiva = Total Aktiva Lancar + Total Aktiva Tetap
  const totalAktiva = totalAktivaLancar + totalAktivaTetap;

  // • Kewajiban
  const totalKewajiban = kewajiban.reduce((sum, item) => sum + item.saldo, 0);

  // • Modal (tanpa Laba Ditahan)
  const totalModal = modal.reduce((sum, item) => sum + item.saldo, 0);

  // • Total Pasiva = Kewajiban + Modal + Laba Ditahan
  // di mana Laba Ditahan = Saldo Akun 310 + Laba Tahun Berjalan (Laba Bersih Laba Rugi)
  const totalLabaDitahan = labaDitahanSaldo + labaBersih;
  const totalEkuitas = totalModal + totalLabaDitahan;
  const totalPassiva = totalKewajiban + totalEkuitas;

  const balanced = Math.abs(totalAktiva - totalPassiva) < 1;

  // Gabungan seluruh akun aset (untuk backwards compatibility)
  const aset = [...aktivaLancar, ...aktivaTetap];

  return {
    // Breakdown Aktiva
    aktivaLancar,
    aktivaTetap,
    totalAktivaLancar,
    totalAktivaTetap,
    totalAktiva,
    totalAktivaLancarFmt: formatRupiah(Math.abs(totalAktivaLancar)),
    totalAktivaTetapFmt: formatRupiah(Math.abs(totalAktivaTetap)),
    totalAktivaFmt: totalAktiva < 0 ? `-${formatRupiah(Math.abs(totalAktiva))}` : formatRupiah(totalAktiva),

    // Backwards-compatible Aset aliases
    aset,
    totalAset: totalAktiva,
    totalAsetFmt: totalAktiva < 0 ? `-${formatRupiah(Math.abs(totalAktiva))}` : formatRupiah(totalAktiva),

    // Kewajiban
    kewajiban,
    totalKewajiban,
    totalKewajibanFmt: formatRupiah(Math.abs(totalKewajiban)),

    // Modal & Laba Ditahan
    modal,
    totalModal,
    totalModalFmt: formatRupiah(Math.abs(totalModal)),
    labaDitahan: labaDitahanSaldo,
    labaDitahanFmt: formatRupiah(Math.abs(labaDitahanSaldo)),
    labaBersih,
    labaBersihFmt: formatRupiah(Math.abs(labaBersih)),
    labaBersihPositive: labaBersih >= 0,
    totalLabaDitahan,
    totalLabaDitahanFmt: formatRupiah(Math.abs(totalLabaDitahan)),
    totalEkuitas,
    totalEkuitasFmt: totalEkuitas < 0 ? `-${formatRupiah(Math.abs(totalEkuitas))}` : formatRupiah(totalEkuitas),
    totalModalDanLabaFmt: totalEkuitas < 0 ? `-${formatRupiah(Math.abs(totalEkuitas))}` : formatRupiah(totalEkuitas),

    // Pasiva
    totalPassiva,
    totalPassivaFmt: totalPassiva < 0 ? `-${formatRupiah(Math.abs(totalPassiva))}` : formatRupiah(totalPassiva),
    neracaBalanced: balanced,
    balanced,

    // Modul Aset Tetap summary
    penyusutanOtomatis: penyusutanSummary.totalBebanPenyusutan,
    akumulasiPenyusutanOtomatis: penyusutanSummary.totalAkumulasiPenyusutan,
  };
}
