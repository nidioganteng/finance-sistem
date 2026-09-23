import ExcelJS from "exceljs";
import type { LaporanPajakData } from "./pajak";

export async function generateLaporanPajakExcel(data: LaporanPajakData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Finance Sistem - SDK Gaharu Sempana";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(`Laba Rugi ${data.year}`);

  // Page setup
  worksheet.views = [{ showGridLines: true }];

  // Column definitions: 3 columns (Code, Keterangan, Jumlah)
  worksheet.columns = [
    { key: "code", width: 16 },
    { key: "name", width: 55 },
    { key: "jumlah", width: 28 },
  ];

  const accountingFormat = '#,##0;(#,##0);"-"';

  // 1. Title Rows
  const titleRow1 = worksheet.addRow(["", "LAPORAN LABA RUGI"]);
  titleRow1.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };

  const titleRow2 = worksheet.addRow(["", `${data.entityName.toUpperCase()} — TAHUN ${data.year}`]);
  titleRow2.font = { bold: true, size: 11, color: { argb: "FF475569" } };

  worksheet.addRow([]); // Blank spacer

  // 2. Table Header
  const headerRow = worksheet.addRow(["NO AKUN", "KETERANGAN", "JUMLAH"]);
  headerRow.height = 26;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // dark slate navy
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: colNumber === 1 ? "center" : colNumber === 2 ? "left" : "right",
    };
    cell.border = {
      top: { style: "medium" },
      bottom: { style: "medium" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Helpers for formatting rows
  const addCategoryHeader = (title: string) => {
    const row = worksheet.addRow(["", title.toUpperCase()]);
    row.height = 22;
    row.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
    row.getCell(2).alignment = { vertical: "middle", horizontal: "left" };
    return row;
  };

  const addDataRow = (code: string, name: string, amount: number) => {
    const row = worksheet.addRow([code, name, amount]);
    row.height = 20;

    // Code
    const cellCode = row.getCell(1);
    cellCode.alignment = { vertical: "middle", horizontal: "center" };
    cellCode.font = { size: 9.5, color: { argb: "FF64748B" } };

    // Name
    const cellName = row.getCell(2);
    cellName.alignment = { vertical: "middle", horizontal: "left" };
    cellName.font = { size: 10 };

    // Amount
    const cellAmount = row.getCell(3);
    cellAmount.numFmt = accountingFormat;
    cellAmount.alignment = { vertical: "middle", horizontal: "right" };
    cellAmount.font = { size: 10 };

    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });

    return row;
  };

  const addTotalRow = (
    label: string,
    amount: number,
    isMajor = false
  ) => {
    const row = worksheet.addRow(["", label.toUpperCase(), amount]);
    row.height = isMajor ? 24 : 22;

    const bgColor = isMajor ? "FFF1F5F9" : "FFF8FAFC";
    row.eachCell((cell, colIdx) => {
      cell.font = { bold: true, size: isMajor ? 10.5 : 10, color: { argb: "FF0F172A" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: bgColor },
      };
      if (colIdx === 3) {
        cell.numFmt = accountingFormat;
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else if (colIdx === 2) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
      cell.border = {
        top: { style: isMajor ? "medium" : "thin" },
        bottom: { style: isMajor ? "double" : "medium" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    return row;
  };

  // Section 1: PENDAPATAN
  addCategoryHeader("PENDAPATAN :");
  for (const item of data.pendapatan.items) {
    addDataRow(item.code, item.name, item.komersial);
  }
  addTotalRow(
    "TOTAL PENDAPATAN USAHA BERSIH",
    data.pendapatan.totalKomersial,
    true
  );

  worksheet.addRow([]); // Spacer

  // Section 2: BIAYA LANGSUNG
  addCategoryHeader("BIAYA LANGSUNG :");
  for (const item of data.biayaLangsung.items) {
    addDataRow(item.code, item.name, item.komersial);
  }
  addTotalRow(
    "TOTAL BIAYA LANGSUNG",
    data.biayaLangsung.totalKomersial,
    true
  );

  worksheet.addRow([]); // Spacer

  // Section 3: LABA KOTOR
  addTotalRow(
    "LABA KOTOR",
    data.labaKotor.komersial,
    true
  );

  worksheet.addRow([]); // Spacer

  // Section 4: BIAYA OPERASIONAL
  addCategoryHeader("BIAYA OPERASIONAL :");
  for (const item of data.biayaOperasional.items) {
    addDataRow(item.code, item.name, item.komersial);
  }
  addTotalRow(
    "TOTAL BIAYA OPERASIONAL",
    data.biayaOperasional.totalKomersial,
    true
  );

  worksheet.addRow([]); // Spacer

  // Section 5: LABA OPERASIONAL
  addTotalRow(
    "LABA OPERASIONAL",
    data.labaOperasional.komersial,
    true
  );

  worksheet.addRow([]); // Spacer

  // Section 6: PPH FINAL
  addCategoryHeader("PPH FINAL PASAL 4 AYAT 2 :");
  for (const item of data.pphFinal.items) {
    addDataRow(item.code, item.name, item.komersial);
  }
  addTotalRow(
    "TOTAL PPH FINAL",
    data.pphFinal.totalKomersial,
    false
  );

  worksheet.addRow([]); // Spacer

  // Section 7: LABA SETELAH PAJAK
  addTotalRow(
    "LABA SETELAH PAJAK",
    data.labaSetelahPajak.komersial,
    true
  );

  worksheet.addRow([]); // Spacer

  // Section 8: PENDAPATAN DAN BIAYA LAIN-LAIN
  addCategoryHeader("PENDAPATAN DAN BIAYA LAIN-LAIN :");
  for (const item of data.pendapatanBiayaLain.items) {
    addDataRow(item.code, item.name, item.komersial);
  }
  addTotalRow(
    "TOTAL PENDAPATAN DAN BIAYA LAIN-LAIN",
    data.pendapatanBiayaLain.totalKomersial,
    false
  );

  worksheet.addRow([]); // Spacer

  // Section 9: RUGI / LABA BERSIH
  addTotalRow(
    data.labaBersih.komersial >= 0 ? "LABA BERSIH" : "RUGI BERSIH",
    data.labaBersih.komersial,
    true
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
