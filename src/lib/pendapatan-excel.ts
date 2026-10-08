import ExcelJS from "exceljs";
import type { LaporanPendapatanData } from "./pendapatan";

export async function generateLaporanPendapatanExcel(
  data: LaporanPendapatanData
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Finance Sistem - SDK Gaharu Sempana";
  workbook.created = new Date();

  const accountingFmt = '"Rp "#,##0;"Rp "(#,##0);"Rp -"';
  const headerBgColor = "FF1E293B"; // slate navy

  // ==========================================
  // SHEET 1: REKAP E-FAKTUR (LAPIS 1)
  // ==========================================
  const wsFaktur = workbook.addWorksheet(`E-Faktur ${data.year}`);
  wsFaktur.views = [{ showGridLines: true }];

  wsFaktur.columns = [
    { key: "no", width: 6 },
    { key: "kodeProyek", width: 16 },
    { key: "noFaktur", width: 22 },
    { key: "npwp", width: 22 },
    { key: "namaRekanan", width: 30 },
    { key: "namaJkp", width: 35 },
    { key: "masa", width: 14 },
    { key: "tglTerima", width: 14 },
    { key: "bank", width: 12 },
    { key: "dpp", width: 20 },
    { key: "dppNilaiLain", width: 20 },
    { key: "tarifPpn", width: 12 },
    { key: "ppn", width: 18 },
    { key: "tarifPph", width: 12 },
    { key: "pph", width: 18 },
    { key: "nilaiProyek", width: 22 },
    { key: "labaSetelahPajak", width: 22 },
    { key: "nominalDiterima", width: 20 },
    { key: "jenisProyek", width: 16 },
    { key: "pekerjaanPerusahaan", width: 20 },
    { key: "pekerjaanYangDipinjam", width: 20 },
  ];

  // Title
  const title1 = wsFaktur.addRow(["", `LAPORAN PENDAPATAN & REKAP E-FAKTUR`]);
  title1.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
  const title2 = wsFaktur.addRow([
    "",
    `${data.entity.legalName.toUpperCase()} — TAHUN ${data.year}${
      data.masaPajak ? ` (BULAN ${data.masaPajak})` : ""
    }`,
  ]);
  title2.font = { bold: true, size: 11, color: { argb: "FF475569" } };
  wsFaktur.addRow([]); // Spacer

  // Header
  const headerFaktur = wsFaktur.addRow([
    "NO",
    "KODE PROYEK",
    "NO. FAKTUR",
    "NPWP",
    "NAMA REKANAN",
    "URAIAN JKP",
    "MASA PAJAK",
    "TGL TERIMA",
    "BANK",
    "DPP",
    "DPP NILAI LAIN",
    "TARIF PPN",
    "PPN",
    "TARIF PPH",
    "PPH (3.5%)",
    "NILAI PROYEK (111%)",
    "LABA STLH PAJAK",
    "NOMINAL DITERIMA",
    "JENIS PROYEK",
    "PEKERJAAN SENDIRI",
    "PEKERJAAN DIPINJAM",
  ]);
  headerFaktur.height = 28;
  headerFaktur.eachCell((cell) => {
    cell.font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerBgColor } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: { style: "medium" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  // Data rows
  data.fakturList.forEach((f, idx) => {
    const row = wsFaktur.addRow([
      idx + 1,
      f.projectCode || "-",
      f.noFaktur,
      f.npwp,
      f.namaRekanan,
      f.namaJkp,
      f.namaBulan,
      f.tanggalTerima || "-",
      f.bank || "-",
      f.dpp,
      f.dppNilaiLain,
      `${f.tarifPpnPersen}%`,
      f.ppn,
      `${f.tarifPphPersen}%`,
      f.pph,
      f.nilaiProyek,
      f.labaSetelahPajak,
      f.nominalDiterima,
      f.jenisProyekLabel,
      f.pekerjaanPerusahaan,
      f.pekerjaanYangDipinjam,
    ]);

    row.height = 20;
    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(7).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(8).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(9).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(12).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(14).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(19).alignment = { vertical: "middle", horizontal: "center" };

    // Currency columns: 10, 11, 13, 15, 16, 17, 18, 20, 21
    [10, 11, 13, 15, 16, 17, 18, 20, 21].forEach((colIdx) => {
      const c = row.getCell(colIdx);
      c.numFmt = accountingFmt;
      c.alignment = { vertical: "middle", horizontal: "right" };
    });

    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  // Footer Totals
  const totRow = wsFaktur.addRow([
    "",
    "TOTAL PERIODE",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    data.totalPeriod.dpp,
    data.totalPeriod.dppNilaiLain,
    "",
    data.totalPeriod.ppn,
    "",
    data.totalPeriod.pph,
    data.totalPeriod.nilaiProyek,
    data.totalPeriod.labaSetelahPajak,
    data.totalPeriod.nominalDiterima,
    "",
    data.totalPeriod.pekerjaanPerusahaan,
    data.totalPeriod.pekerjaanYangDipinjam,
  ]);
  totRow.height = 24;
  totRow.eachCell((cell, colIdx) => {
    cell.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    if ([10, 11, 13, 15, 16, 17, 18, 20, 21].includes(colIdx)) {
      cell.numFmt = accountingFmt;
      cell.alignment = { vertical: "middle", horizontal: "right" };
    } else {
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }
    cell.border = { top: { style: "medium" }, bottom: { style: "double" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  // ==========================================
  // SHEET 2: REKAP BULANAN (LAPIS 2)
  // ==========================================
  const wsRekap = workbook.addWorksheet(`Rekap Bulanan ${data.year}`);
  wsRekap.views = [{ showGridLines: true }];

  wsRekap.columns = [
    { key: "no", width: 6 },
    { key: "bulan", width: 18 },
    { key: "fakturCount", width: 14 },
    { key: "dpp", width: 22 },
    { key: "dppNilaiLain", width: 22 },
    { key: "ppn", width: 20 },
    { key: "pph", width: 20 },
    { key: "nilaiProyek", width: 24 },
    { key: "labaSetelahPajak", width: 24 },
    { key: "nominalDiterima", width: 22 },
  ];

  const rTitle1 = wsRekap.addRow(["", `REKAPITULASI PENDAPATAN & PAJAK BULANAN`]);
  rTitle1.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
  const rTitle2 = wsRekap.addRow(["", `${data.entity.legalName.toUpperCase()} — TAHUN ${data.year}`]);
  rTitle2.font = { bold: true, size: 11, color: { argb: "FF475569" } };
  wsRekap.addRow([]);

  const rHeader = wsRekap.addRow([
    "NO",
    "BULAN",
    "JML FAKTUR",
    "TOTAL DPP",
    "TOTAL DPP NILAI LAIN",
    "TOTAL PPN",
    "TOTAL PPH",
    "TOTAL NILAI PROYEK",
    "LABA STLH PAJAK",
    "TOTAL DITERIMA",
  ]);
  rHeader.height = 26;
  rHeader.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerBgColor } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { top: { style: "medium" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  data.rekapBulanan.forEach((b) => {
    const row = wsRekap.addRow([
      b.month,
      b.namaBulan,
      b.jumlahFaktur,
      b.dpp,
      b.dppNilaiLain,
      b.ppn,
      b.pph,
      b.nilaiProyek,
      b.labaSetelahPajak,
      b.nominalDiterima,
    ]);
    row.height = 20;
    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(3).alignment = { vertical: "middle", horizontal: "center" };

    [4, 5, 6, 7, 8, 9, 10].forEach((colIdx) => {
      const c = row.getCell(colIdx);
      c.numFmt = accountingFmt;
      c.alignment = { vertical: "middle", horizontal: "right" };
    });

    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  const totRekapRow = wsRekap.addRow([
    "",
    "TOTAL SETAHUN",
    data.totalTahunanRekap.jumlahFaktur,
    data.totalTahunanRekap.dpp,
    data.totalTahunanRekap.dppNilaiLain,
    data.totalTahunanRekap.ppn,
    data.totalTahunanRekap.pph,
    data.totalTahunanRekap.nilaiProyek,
    data.totalTahunanRekap.labaSetelahPajak,
    data.totalTahunanRekap.nominalDiterima,
  ]);
  totRekapRow.height = 24;
  totRekapRow.eachCell((cell, colIdx) => {
    cell.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    if (colIdx >= 4) {
      cell.numFmt = accountingFmt;
      cell.alignment = { vertical: "middle", horizontal: "right" };
    } else {
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }
    cell.border = { top: { style: "medium" }, bottom: { style: "double" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  // ==========================================
  // SHEET 3: REKONSILIASI AUDIT PAJAK (LAPIS 3)
  // ==========================================
  const wsAudit = workbook.addWorksheet(`Rekonsiliasi Pajak ${data.year}`);
  wsAudit.views = [{ showGridLines: true }];

  wsAudit.columns = [
    { key: "no", width: 6 },
    { key: "bulan", width: 16 },
    { key: "dppRekap", width: 20 },
    { key: "dppTerlapor", width: 20 },
    { key: "selisihDpp", width: 20 },
    { key: "ppnRekap", width: 20 },
    { key: "pajakTerlapor", width: 20 },
    { key: "selisihPajak", width: 20 },
    { key: "pphRekap", width: 20 },
    { key: "pphTerlapor", width: 20 },
    { key: "selisihPph", width: 20 },
    { key: "totalPajakRekap", width: 22 },
    { key: "totalPajakTerlapor", width: 22 },
    { key: "selisihTotalPajak", width: 22 },
    { key: "status", width: 18 },
    { key: "keterangan", width: 35 },
  ];

  const aTitle1 = wsAudit.addRow(["", `AUDIT REKONSILIASI KEPATUHAN PAJAK (FAKTUR VS SPT)`]);
  aTitle1.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
  const aTitle2 = wsAudit.addRow(["", `${data.entity.legalName.toUpperCase()} — TAHUN ${data.year}`]);
  aTitle2.font = { bold: true, size: 11, color: { argb: "FF475569" } };
  wsAudit.addRow([]);

  const aHeader = wsAudit.addRow([
    "NO",
    "BULAN",
    "DPP REKAP FAKTUR",
    "DPP TERLAPOR (SPT)",
    "SELISIH DPP",
    "PPN REKAP FAKTUR",
    "PPN TERLAPOR (SPT)",
    "SELISIH PPN",
    "PPH REKAP FAKTUR",
    "PPH TERLAPOR (SPT)",
    "SELISIH PPH",
    "TOTAL PAJAK REKAP",
    "TOTAL PAJAK SPT",
    "SELISIH TOTAL PAJAK",
    "STATUS AUDIT",
    "CATATAN / TINDAK LANJUT",
  ]);
  aHeader.height = 26;
  aHeader.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerBgColor } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { top: { style: "medium" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  data.rekonsiliasiList.forEach((rec) => {
    const row = wsAudit.addRow([
      rec.month,
      rec.namaBulan,
      rec.dppRekap,
      rec.dppTerlapor,
      rec.selisihDpp,
      rec.ppnRekap,
      rec.pajakTerlapor,
      rec.selisihPajak,
      rec.pphRekap,
      rec.pphTerlapor,
      rec.selisihPph,
      rec.totalPajakRekap,
      rec.totalPajakTerlapor,
      rec.selisihTotalPajak,
      rec.status === "MATCH" ? "SESUAI" : rec.status === "BELUM_DILAPORKAN" ? "BELUM LAPOR" : "SELISIH",
      rec.keterangan,
    ]);
    row.height = 20;
    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };

    [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].forEach((colIdx) => {
      const c = row.getCell(colIdx);
      c.numFmt = accountingFmt;
      c.alignment = { vertical: "middle", horizontal: "right" };
    });

    const statusCell = row.getCell(15);
    statusCell.alignment = { vertical: "middle", horizontal: "center" };
    if (rec.status === "MATCH") {
      statusCell.font = { bold: true, color: { argb: "FF16A34A" } }; // Green
    } else {
      statusCell.font = { bold: true, color: { argb: "FFDC2626" } }; // Red
    }

    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  // Footer Total Lapis 3
  const totDppRekap = data.rekonsiliasiList.reduce((s, r) => s + r.dppRekap, 0);
  const totDppTerlapor = data.rekonsiliasiList.reduce((s, r) => s + r.dppTerlapor, 0);
  const totSelisihDpp = totDppRekap - totDppTerlapor;
  const totPpnRekap = data.rekonsiliasiList.reduce((s, r) => s + r.ppnRekap, 0);
  const totPpnTerlapor = data.rekonsiliasiList.reduce((s, r) => s + r.pajakTerlapor, 0);
  const totSelisihPpn = totPpnRekap - totPpnTerlapor;
  const totPphRekap = data.rekonsiliasiList.reduce((s, r) => s + r.pphRekap, 0);
  const totPphTerlapor = data.rekonsiliasiList.reduce((s, r) => s + r.pphTerlapor, 0);
  const totSelisihPph = totPphRekap - totPphTerlapor;
  const totPajakRekapAll = totPpnRekap + totPphRekap;
  const totPajakTerlaporAll = totPpnTerlapor + totPphTerlapor;
  const totSelisihPajakAll = totPajakRekapAll - totPajakTerlaporAll;

  const aFooter = wsAudit.addRow([
    "",
    "TOTAL",
    totDppRekap,
    totDppTerlapor,
    totSelisihDpp,
    totPpnRekap,
    totPpnTerlapor,
    totSelisihPpn,
    totPphRekap,
    totPphTerlapor,
    totSelisihPph,
    totPajakRekapAll,
    totPajakTerlaporAll,
    totSelisihPajakAll,
    "",
    "",
  ]);
  aFooter.height = 24;
  aFooter.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    if (colNumber >= 3 && colNumber <= 14) {
      cell.numFmt = accountingFmt;
      cell.alignment = { vertical: "middle", horizontal: "right" };
    }
    cell.border = { top: { style: "medium" }, bottom: { style: "double" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
