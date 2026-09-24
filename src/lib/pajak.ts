import { prisma } from "./prisma";
import { getPenyusutanSummary } from "./aset-tetap";
import { getExcludedNoBuktiForVersion } from "./akuntansi";
import type { ReportVersion } from "./laba-rugi";

export interface TaxReportRow {
  code: string;
  name: string;
  komersial: number;
  koreksi: number;
  fiskal: number;
  isCustom?: boolean;
}

export interface TaxReportSection {
  title: string;
  items: TaxReportRow[];
  totalKomersial: number;
  totalKoreksi: number;
  totalFiskal: number;
}

export interface LaporanPajakData {
  entityId: string;
  entityName: string;
  year: number;
  pendapatan: {
    items: TaxReportRow[];
    totalKomersial: number;
    totalKoreksi: number;
    totalFiskal: number;
  };
  biayaLangsung: {
    items: TaxReportRow[];
    totalKomersial: number;
    totalKoreksi: number;
    totalFiskal: number;
  };
  labaKotor: {
    komersial: number;
    koreksi: number;
    fiskal: number;
  };
  biayaOperasional: {
    items: TaxReportRow[];
    totalKomersial: number;
    totalKoreksi: number;
    totalFiskal: number;
  };
  labaOperasional: {
    komersial: number;
    koreksi: number;
    fiskal: number;
  };
  pphFinal: {
    items: TaxReportRow[];
    totalKomersial: number;
    totalKoreksi: number;
    totalFiskal: number;
  };
  labaSetelahPajak: {
    komersial: number;
    koreksi: number;
    fiskal: number;
  };
  pendapatanBiayaLain: {
    items: TaxReportRow[];
    totalKomersial: number;
    totalKoreksi: number;
    totalFiskal: number;
  };
  labaBersih: {
    komersial: number;
    koreksi: number;
    fiskal: number;
  };
}

export function formatAccounting(val: number): string {
  if (!val || Math.round(val) === 0) return "Rp\u00A0-";
  const rounded = Math.round(val);
  const formatted = Math.abs(rounded).toLocaleString("id-ID");
  return rounded < 0 ? `Rp\u00A0(${formatted})` : `Rp\u00A0${formatted}`;
}

// Template standar akun sesuai format spreadsheet Excel acuan
const TEMPLATE_BIAYA_LANGSUNG = [
  { code: "612", name: "Gaji Tenaga Ahli" },
  { code: "613", name: "By Pra Kontrak" },
  { code: "614", name: "By Survey" },
  { code: "615", name: "By Perjalanan Dinas" },
  { code: "618", name: "By BPJS dan Jaminan" },
  { code: "619", name: "By Dokumentasi" },
  { code: "623", name: "By Presentasi" },
  { code: "624", name: "By Komunikasi" },
  { code: "625", name: "By Taktis" },
  { code: "626", name: "By SKA" },
  { code: "627", name: "By Kontrak" },
  { code: "628", name: "By Marketing" },
  { code: "630", name: "Biaya Lainnya" },
  { code: "632", name: "By Akomodasi" },
];

const TEMPLATE_BIAYA_OPERASIONAL = [
  { code: "511", name: "Gaji Pegawai Tetap" },
  { code: "512", name: "Biaya Penyusutan" },
  { code: "513", name: "Beban Listrik" },
  { code: "514", name: "Beban Telepon" },
  { code: "515", name: "Beban PDAM" },
  { code: "516", name: "BPJS Kesehatan" },
  { code: "517", name: "BPJS Ketenagakerjaan" },
  { code: "518", name: "By Meterai" },
  { code: "519", name: "Pemeliharaan Aktiva" },
  { code: "520", name: "By Samsat" },
  { code: "522", name: "Perlengkapan" },
  { code: "523", name: "By Transport" },
  { code: "524", name: "By Konsumsi" },
  { code: "527", name: "By Iuran" },
  { code: "528", name: "By Umum" },
  { code: "529", name: "By Upacara" },
  { code: "530", name: 'By Lain"' },
  { code: "533", name: "By. PPH 21" },
  { code: "611", name: "Gaji Direktur" },
  { code: "633", name: "By Ijin Usaha" },
  { code: "634", name: "By Imbalan Pasca Kerja" },
];

export async function getLaporanPajakData(
  entityId: string | string[],
  year: number,
  version: ReportVersion = "INTERNAL"
): Promise<LaporanPajakData> {
  const ids = Array.isArray(entityId) ? entityId : [entityId];
  let entityName = "Semua Entitas (Grup)";
  let primaryEntityId = ids[0] ?? "";
  if (ids.length === 1) {
    const entity = await prisma.entity.findUnique({
      where: { id: ids[0] },
      select: { id: true, name: true },
    });
    if (entity) {
      entityName = entity.name;
      primaryEntityId = entity.id;
    }
  }

  const start = new Date(`${year}-01-01`);
  const end = new Date(`${year}-12-31T23:59:59`);

  const [excludedNoBuktiUmum, penyusutanSummaries, allAccounts, transactions] = await Promise.all([
    getExcludedNoBuktiForVersion(ids, year, "UMUM"),
    Promise.all(ids.map((id) => getPenyusutanSummary(id, year))),
    prisma.coaAccount.findMany({
      where: {
        OR: [
          { kategori: { in: ["PENDAPATAN", "BEBAN"] } },
          { code: { in: ["400", "410", "534", "535", "532", "616"] } },
        ],
      },
      orderBy: { code: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        entityId: { in: ids },
        tanggal: { gte: start, lte: end },
        coaAccountId: { not: null },
      },
      include: { coaAccount: true },
    }),
  ]);

  const excludedUmumSet = new Set(excludedNoBuktiUmum);

  // Akumulasi nilai per kode akun: Komersial (Internal) dan Fiskal (Umum)
  const komersialMap = new Map<string, number>();
  const fiskalMap = new Map<string, number>();

  for (const tx of transactions) {
    if (!tx.coaAccount) continue;
    const code = tx.coaAccount.code;
    const repCat = tx.coaAccount.reportCategory;

    // Untuk Pendapatan (kredit - debit), untuk Beban (debit - kredit)
    const isPendapatan = tx.coaAccount.kategori === "PENDAPATAN";
    const netAmount = isPendapatan
      ? Number(tx.kredit) - Number(tx.debit)
      : Number(tx.debit) - Number(tx.kredit);

    // Komersial: mencakup transaksi dengan akun INTERNAL dan SEMUA
    if (repCat === "INTERNAL" || repCat === "SEMUA") {
      komersialMap.set(code, (komersialMap.get(code) ?? 0) + netAmount);
    }

    // Fiskal: mencakup akun UMUM dan SEMUA (kecuali nomor bukti yang dikecualikan di versi umum)
    if (repCat === "UMUM" || (repCat === "SEMUA" && !excludedUmumSet.has(tx.noBukti))) {
      fiskalMap.set(code, (fiskalMap.get(code) ?? 0) + netAmount);
    }
  }

  // Set nilai penyusutan otomatis dari modul aktiva tetap
  const totalBebanPenyusutan = penyusutanSummaries.reduce((sum, s) => sum + s.totalBebanPenyusutan, 0);
  if (totalBebanPenyusutan > 0) {
    const penyusutanCode = "512";
    komersialMap.set(penyusutanCode, totalBebanPenyusutan);
    fiskalMap.set(penyusutanCode, totalBebanPenyusutan);
  }

  // Buat map nama akun dari DB untuk fallback nama yang tepat
  const accountNameMap = new Map<string, string>();
  for (const acc of allAccounts) {
    accountNameMap.set(acc.code, acc.name);
  }

  // Pilih sumber nilai komersial berdasarkan versi laporan:
  // Versi INTERNAL memakai komersialMap (transaksi internal + semua)
  // Versi UMUM memakai fiskalMap (transaksi umum + semua tanpa nomor bukti yang dikecualikan)
  const activeAmountMap = version === "UMUM" ? fiskalMap : komersialMap;

  // 1. PENDAPATAN
  // Akun 400 (Pendapatan Usaha) dan akun 616/535 (PPN)
  const pend400Komersial = activeAmountMap.get("400") ?? 0;
  const pend400Fiskal = fiskalMap.get("400") ?? 0;
  const ppnKomersial = (activeAmountMap.get("616") ?? 0) || (activeAmountMap.get("535") ?? 0);
  const ppnFiskal = (fiskalMap.get("616") ?? 0) || (fiskalMap.get("535") ?? 0);

  const pendapatanRows: TaxReportRow[] = [
    {
      code: "400",
      name: accountNameMap.get("400") ?? "PENDAPATAN",
      komersial: pend400Komersial,
      fiskal: pend400Fiskal,
      koreksi: pend400Fiskal - pend400Komersial,
    },
    {
      code: "616",
      name: "PPN",
      komersial: ppnKomersial,
      fiskal: ppnFiskal,
      koreksi: ppnFiskal - ppnKomersial,
    },
  ];

  // Tambahkan akun pendapatan usaha lain (selain 400 dan 410 Giro) jika ada
  for (const acc of allAccounts) {
    if (acc.kategori === "PENDAPATAN" && acc.code !== "400" && acc.code !== "410") {
      const k = activeAmountMap.get(acc.code) ?? 0;
      const f = fiskalMap.get(acc.code) ?? 0;
      if (k !== 0 || f !== 0) {
        pendapatanRows.push({
          code: acc.code,
          name: acc.name,
          komersial: k,
          fiskal: f,
          koreksi: f - k,
          isCustom: true,
        });
      }
    }
  }

  const totalPendapatanKomersial = pend400Komersial - ppnKomersial;
  const totalPendapatanFiskal = pend400Fiskal - ppnFiskal;

  // 2. BIAYA LANGSUNG (Akun 6xx proyek/langsung)
  // Aturan Biaya: Di Versi INTERNAL ada By Marketing (628), di Versi UMUM tidak ada By Marketing (628).
  const templateBiayaLangsung = version === "UMUM"
    ? TEMPLATE_BIAYA_LANGSUNG.filter((t) => t.code !== "628")
    : TEMPLATE_BIAYA_LANGSUNG;

  const biayaLangsungCodes = new Set(templateBiayaLangsung.map((t) => t.code));
  const biayaLangsungRows: TaxReportRow[] = templateBiayaLangsung.map((item) => {
    const k = activeAmountMap.get(item.code) ?? 0;
    const f = fiskalMap.get(item.code) ?? 0;
    return {
      code: item.code,
      name: accountNameMap.get(item.code) ?? item.name,
      komersial: k,
      fiskal: f,
      koreksi: f - k,
    };
  });

  // Tambahkan akun 6xx lain di luar template standar (selain 611 dan 633) jika ada
  for (const acc of allAccounts) {
    if (
      acc.code.startsWith("6") &&
      !biayaLangsungCodes.has(acc.code) &&
      acc.code !== "611" &&
      acc.code !== "633" &&
      acc.code !== "616" &&
      (version !== "UMUM" || acc.code !== "628")
    ) {
      const k = activeAmountMap.get(acc.code) ?? 0;
      const f = fiskalMap.get(acc.code) ?? 0;
      if (k !== 0 || f !== 0) {
        biayaLangsungRows.push({
          code: acc.code,
          name: acc.name,
          komersial: k,
          fiskal: f,
          koreksi: f - k,
          isCustom: true,
        });
      }
    }
  }

  const totalBiayaLangsungKomersial = biayaLangsungRows.reduce((s, r) => s + r.komersial, 0);
  const totalBiayaLangsungFiskal = biayaLangsungRows.reduce((s, r) => s + r.fiskal, 0);

  // 3. LABA KOTOR
  const labaKotorKomersial = totalPendapatanKomersial - totalBiayaLangsungKomersial;
  const labaKotorFiskal = totalPendapatanFiskal - totalBiayaLangsungFiskal;

  // 4. BIAYA OPERASIONAL (Akun 5xx, 611 Gaji Direktur, 633 By Ijin Usaha)
  const biayaOperasionalCodes = new Set(TEMPLATE_BIAYA_OPERASIONAL.map((t) => t.code));
  const biayaOperasionalRows: TaxReportRow[] = TEMPLATE_BIAYA_OPERASIONAL.map((item) => {
    const k = activeAmountMap.get(item.code) ?? 0;
    const f = fiskalMap.get(item.code) ?? 0;
    return {
      code: item.code,
      name: accountNameMap.get(item.code) ?? item.name,
      komersial: k,
      fiskal: f,
      koreksi: f - k,
    };
  });

  // Tambahkan akun 5xx lain yang ada di DB (selain 534 PPh Final dan 532 Adm Bank)
  for (const acc of allAccounts) {
    if (
      acc.code.startsWith("5") &&
      !biayaOperasionalCodes.has(acc.code) &&
      acc.code !== "534" &&
      acc.code !== "532" &&
      acc.code !== "535" &&
      acc.code !== "536"
    ) {
      const k = activeAmountMap.get(acc.code) ?? 0;
      const f = fiskalMap.get(acc.code) ?? 0;
      if (k !== 0 || f !== 0) {
        biayaOperasionalRows.push({
          code: acc.code,
          name: acc.name,
          komersial: k,
          fiskal: f,
          koreksi: f - k,
          isCustom: true,
        });
      }
    }
  }

  const totalBiayaOperasionalKomersial = biayaOperasionalRows.reduce((s, r) => s + r.komersial, 0);
  const totalBiayaOperasionalFiskal = biayaOperasionalRows.reduce((s, r) => s + r.fiskal, 0);

  // 5. LABA OPERASIONAL
  const labaOperasionalKomersial = labaKotorKomersial - totalBiayaOperasionalKomersial;
  const labaOperasionalFiskal = labaKotorFiskal - totalBiayaOperasionalFiskal;

  // 6. PPH FINAL (Akun 534)
  const pphFinalKomersial = activeAmountMap.get("534") ?? 0;
  const pphFinalFiskal = fiskalMap.get("534") ?? 0;
  const pphFinalRows: TaxReportRow[] = [
    {
      code: "534",
      name: accountNameMap.get("534") ?? "PPH Final Pasal 4 Ayat 2",
      komersial: pphFinalKomersial,
      fiskal: pphFinalFiskal,
      koreksi: pphFinalFiskal - pphFinalKomersial,
    },
  ];

  // 7. LABA SETELAH PAJAK
  const labaSetelahPajakKomersial = labaOperasionalKomersial - pphFinalKomersial;
  const labaSetelahPajakFiskal = labaOperasionalFiskal - pphFinalFiskal;

  // 8. PENDAPATAN & BIAYA LAIN - LAIN
  // 410 Pendapatan Jasa Giro & 532 By. Adm & Pjk bank
  const jasaGiroKomersial = activeAmountMap.get("410") ?? 0;
  const jasaGiroFiskal = fiskalMap.get("410") ?? 0;
  const admBankKomersial = activeAmountMap.get("532") ?? 0;
  const admBankFiskal = fiskalMap.get("532") ?? 0;

  const pendapatanBiayaLainRows: TaxReportRow[] = [
    {
      code: "410",
      name: accountNameMap.get("410") ?? "Pendapatan Jasa Giro",
      komersial: jasaGiroKomersial,
      fiskal: jasaGiroFiskal,
      koreksi: jasaGiroFiskal - jasaGiroKomersial,
    },
    {
      code: "532",
      name: accountNameMap.get("532") ?? "By. Adm & Pjk bank",
      komersial: admBankKomersial,
      fiskal: admBankFiskal,
      koreksi: admBankFiskal - admBankKomersial,
    },
  ];

  const totalLainKomersial = jasaGiroKomersial - admBankKomersial;
  const totalLainFiskal = jasaGiroFiskal - admBankFiskal;

  // 9. RUGI / LABA BERSIH
  const labaBersihKomersial = labaSetelahPajakKomersial + totalLainKomersial;
  const labaBersihFiskal = labaSetelahPajakFiskal + totalLainFiskal;

  return {
    entityId: primaryEntityId,
    entityName,
    year,
    pendapatan: {
      items: pendapatanRows,
      totalKomersial: totalPendapatanKomersial,
      totalFiskal: totalPendapatanFiskal,
      totalKoreksi: totalPendapatanFiskal - totalPendapatanKomersial,
    },
    biayaLangsung: {
      items: biayaLangsungRows,
      totalKomersial: totalBiayaLangsungKomersial,
      totalFiskal: totalBiayaLangsungFiskal,
      totalKoreksi: totalBiayaLangsungFiskal - totalBiayaLangsungKomersial,
    },
    labaKotor: {
      komersial: labaKotorKomersial,
      fiskal: labaKotorFiskal,
      koreksi: labaKotorFiskal - labaKotorKomersial,
    },
    biayaOperasional: {
      items: biayaOperasionalRows,
      totalKomersial: totalBiayaOperasionalKomersial,
      totalFiskal: totalBiayaOperasionalFiskal,
      totalKoreksi: totalBiayaOperasionalFiskal - totalBiayaOperasionalKomersial,
    },
    labaOperasional: {
      komersial: labaOperasionalKomersial,
      fiskal: labaOperasionalFiskal,
      koreksi: labaOperasionalFiskal - labaOperasionalKomersial,
    },
    pphFinal: {
      items: pphFinalRows,
      totalKomersial: pphFinalKomersial,
      totalFiskal: pphFinalFiskal,
      totalKoreksi: pphFinalFiskal - pphFinalKomersial,
    },
    labaSetelahPajak: {
      komersial: labaSetelahPajakKomersial,
      fiskal: labaSetelahPajakFiskal,
      koreksi: labaSetelahPajakFiskal - labaSetelahPajakKomersial,
    },
    pendapatanBiayaLain: {
      items: pendapatanBiayaLainRows,
      totalKomersial: totalLainKomersial,
      totalFiskal: totalLainFiskal,
      totalKoreksi: totalLainFiskal - totalLainKomersial,
    },
    labaBersih: {
      komersial: labaBersihKomersial,
      fiskal: labaBersihFiskal,
      koreksi: labaBersihFiskal - labaBersihKomersial,
    },
  };
}
