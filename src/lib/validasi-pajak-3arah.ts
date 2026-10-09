import { prisma } from "./prisma";
import { formatRupiah } from "./dashboard-data";
import { isAutoPostedMirror } from "./akuntansi";
import { getLabaRugiData } from "./laba-rugi";

export interface ValidasiPajakItem {
  key: "dpp" | "ppn" | "pph";
  label: string;
  sublabel: string;
  nilaiFaktur: number;
  nilaiJurnal: number;
  nilaiLabaRugi: number;
  selisih: number;
  isBalance: boolean;
  nilaiFakturFmt: string;
  nilaiJurnalFmt: string;
  nilaiLabaRugiFmt: string;
  selisihFmt: string;
  keterangan: string;
}

export interface ValidasiPajak3ArahResult {
  year: number;
  allBalanced: boolean;
  jumlahSelisih: number;
  items: ValidasiPajakItem[];
}

export type ValidasiPajak3ArahData = ValidasiPajak3ArahResult;

/**
 * Validasi 3-Arah (Issue 88):
 * Membandingkan nilai Dasar Pengenaan Pajak / Omzet, PPN, dan PPh Final antara:
 * 1. Laporan Pendapatan (Rekap E-Faktur)
 * 2. Jurnal Umum / Transaksi Akuntansi
 * 3. Laporan Laba Rugi & Neraca
 */
export async function getValidasiPajak3Arah(
  entityIds: string[] | string,
  year: number,
  version: string = "INTERNAL"
): Promise<ValidasiPajak3ArahResult> {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];

  // 1. Data dari Laporan Pendapatan (Faktur)
  const fakturs = await prisma.fakturPendapatan.findMany({
    where: {
      entityId: { in: ids },
      tahunPajak: year,
    },
    select: {
      dpp: true,
      ppn: true,
      pph: true,
      nilaiProyek: true,
      nominalDiterima: true,
      tanggalTerima: true,
    },
  });

  const totalFakturDpp = fakturs.reduce(
    (s, f) => s + (Number(f.nilaiProyek) > 0 ? Number(f.nilaiProyek) : Number(f.dpp)),
    0
  );
  const totalFakturPpn = fakturs.reduce((s, f) => s + Number(f.ppn), 0);
  const totalFakturPph = fakturs.reduce((s, f) => s + Number(f.pph), 0);

  // 2. Data dari Jurnal Umum (Transaksi Aktual yang bukan mirror Buku Bank)
  const txRows = await prisma.transaction.findMany({
    where: {
      entityId: { in: ids },
      tanggal: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31T23:59:59`),
      },
    },
    select: {
      debit: true,
      kredit: true,
      extraFieldsJson: true,
      coaAccount: {
        select: {
          code: true,
          name: true,
          kategori: true,
        },
      },
    },
  });

  let totalJurnalDpp = 0;
  let totalJurnalPpn = 0;
  let totalJurnalPph = 0;

  for (const t of txRows) {
    if (isAutoPostedMirror(t)) continue;
    const cat = t.coaAccount?.kategori;
    const code = t.coaAccount?.code;

    // DPP / Pendapatan Usaha (Akun 400 / kategori PENDAPATAN)
    if (cat === "PENDAPATAN") {
      totalJurnalDpp += Number(t.kredit) - Number(t.debit);
    }

    // PPN (Akun 535 / nama PPN)
    if (code === "535" || (code?.startsWith("535") ?? false) || /ppn/i.test(t.coaAccount?.name || "")) {
      totalJurnalPpn += Number(t.debit) - Number(t.kredit);
    }

    // PPh Final (Akun 534 / PPh Final Pasal 4 Ayat 2)
    if (code === "534" || (code?.startsWith("534") ?? false) || /pph.*final/i.test(t.coaAccount?.name || "")) {
      totalJurnalPph += Number(t.debit) - Number(t.kredit);
    }
  }

  // 3. Data dari Laba Rugi
  // Ambil data laba rugi untuk masing-masing entitas lalu agregasikan
  let totalLrDpp = 0;
  let totalLrPpn = 0;
  let totalLrPph = 0;

  for (const eid of ids) {
    const lr = await getLabaRugiData(eid, year, undefined, version);
    totalLrDpp += lr.totalPendapatan;

    for (const b of lr.bebanList) {
      if (b.code === "535" || /ppn/i.test(b.name)) {
        totalLrPpn += b.total;
      }
      if (b.code === "534" || /pph.*final/i.test(b.name)) {
        totalLrPph += b.total;
      }
    }
  }

  // Evaluasi 3-Arah
  const buildItem = (
    key: "dpp" | "ppn" | "pph",
    label: string,
    sublabel: string,
    fakturVal: number,
    jurnalVal: number,
    lrVal: number
  ): ValidasiPajakItem => {
    const diffFJ = Math.abs(fakturVal - jurnalVal);
    const diffJL = Math.abs(jurnalVal - lrVal);
    const diffFL = Math.abs(fakturVal - lrVal);
    const maxDiff = Math.max(diffFJ, diffJL, diffFL);
    const isBalance = maxDiff < 1;

    let keterangan = "Ketiga laporan seimbang (cocok 100%)";
    if (!isBalance) {
      if (diffFJ >= 1 && diffJL < 1) {
        keterangan = "Jurnal & Laba Rugi cocok, namun berbeda dengan Laporan Pendapatan";
      } else if (diffJL >= 1) {
        keterangan = "Terdapat selisih antara Jurnal Umum dan Laba Rugi";
      } else {
        keterangan = "Terdapat selisih pada rekapitulasi data";
      }
    }

    return {
      key,
      label,
      sublabel,
      nilaiFaktur: fakturVal,
      nilaiJurnal: jurnalVal,
      nilaiLabaRugi: lrVal,
      selisih: maxDiff,
      isBalance,
      nilaiFakturFmt: formatRupiah(Math.round(fakturVal)),
      nilaiJurnalFmt: formatRupiah(Math.round(jurnalVal)),
      nilaiLabaRugiFmt: formatRupiah(Math.round(lrVal)),
      selisihFmt: formatRupiah(Math.round(maxDiff)),
      keterangan,
    };
  };

  const items: ValidasiPajakItem[] = [
    buildItem(
      "dpp",
      "DPP / Pendapatan Usaha",
      "Basis Dasar Pengenaan Pajak & Nilai Kontrak Bersih",
      totalFakturDpp,
      totalJurnalDpp,
      totalLrDpp
    ),
    buildItem(
      "ppn",
      "PPN Realisasi",
      "Pajak Pertambahan Nilai (Akun 535)",
      totalFakturPpn,
      totalJurnalPpn,
      totalLrPpn
    ),
    buildItem(
      "pph",
      "PPh Final (Pasal 4 Ayat 2)",
      "Pajak Penghasilan Jasa Konstruksi / Konsultansi (Akun 534)",
      totalFakturPph,
      totalJurnalPph,
      totalLrPph
    ),
  ];

  const allBalanced = items.every((i) => i.isBalance);
  const jumlahSelisih = items.filter((i) => !i.isBalance).length;

  return {
    year,
    allBalanced,
    jumlahSelisih,
    items,
  };
}
