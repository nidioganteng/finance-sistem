import ExcelJS from "exceljs";
import type { ArusKasPresisiData } from "./arus-kas-presisi";

export async function generateArusKasExcel(data: ArusKasPresisiData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Finance Sistem - SDK Gaharu Sempana";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(`Arus Kas ${data.year}`);

  // Page setup
  worksheet.views = [{ showGridLines: true }];

  // Column definitions: Column A for URAIAN, Column B for Amount
  worksheet.columns = [
    { key: "uraian", width: 62 },
    { key: "nominal", width: 26 },
  ];

  const accountingFormat = '"Rp "#,##0;"Rp "(#,##0);"Rp -"';

  // 1. Title Rows
  const titleRow1 = worksheet.addRow([data.entityName.toUpperCase()]);
  titleRow1.font = { bold: true, size: 12, color: { argb: "FF0F172A" } };
  titleRow1.alignment = { vertical: "middle", horizontal: "left" };

  const versionSuffix = data.version === "UMUM" ? " (VERSI UMUM)" : " (VERSI INTERNAL)";
  const titleRow2 = worksheet.addRow([`LAPORAN ARUS KAS${versionSuffix}`]);
  titleRow2.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
  titleRow2.alignment = { vertical: "middle", horizontal: "left" };

  const titleRow3 = worksheet.addRow([`Tahun ${data.year}`]);
  titleRow3.font = { size: 10, italic: true, color: { argb: "FF475569" } };
  titleRow3.alignment = { vertical: "middle", horizontal: "left" };

  worksheet.addRow([]); // Blank spacer

  // 2. Table Header
  const headerRow = worksheet.addRow(["URAIAN", `${data.year}`]);
  headerRow.height = 24;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }, // Dark Slate
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: colNumber === 1 ? "left" : "right",
    };
    cell.border = {
      top: { style: "medium" },
      bottom: { style: "medium" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // 3. Rows
  for (const rowData of data.rows) {
    const indentSpaces = "  ".repeat(rowData.level);
    const labelWithIndent = `${indentSpaces}${rowData.label}`;

    const excelRow = worksheet.addRow([
      labelWithIndent,
      rowData.isHeader ? "" : rowData.amount,
    ]);

    excelRow.height = rowData.isTotal ? 22 : 19;

    const cellUraian = excelRow.getCell(1);
    const cellNominal = excelRow.getCell(2);

    // Font styling
    if (rowData.isHeader) {
      cellUraian.font = { bold: true, size: rowData.level === 0 ? 10.5 : 10, color: { argb: "FF0F172A" } };
    } else if (rowData.isTotal) {
      cellUraian.font = { bold: true, size: 10.5, color: { argb: "FF0F172A" } };
      cellNominal.font = { bold: true, size: 10.5, color: { argb: "FF0F172A" } };
    } else if (rowData.isSubtotal) {
      cellUraian.font = { bold: true, size: 10, color: { argb: "FF1E293B" } };
      cellNominal.font = { bold: true, size: 10, color: { argb: "FF1E293B" } };
    } else {
      cellUraian.font = { size: 9.5, color: { argb: "FF334155" } };
      cellNominal.font = { size: 9.5, color: { argb: "FF0F172A" } };
    }

    cellUraian.alignment = { vertical: "middle", horizontal: "left" };
    cellNominal.alignment = { vertical: "middle", horizontal: "right" };

    if (!rowData.isHeader) {
      cellNominal.numFmt = accountingFormat;
    }

    // Border styling
    if (rowData.isTotal) {
      cellUraian.border = {
        top: { style: "thin" },
        bottom: { style: "double" },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      cellNominal.border = {
        top: { style: "thin" },
        bottom: { style: "double" },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      cellUraian.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
      cellNominal.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
    } else if (rowData.isSubtotal) {
      cellUraian.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      cellNominal.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      cellUraian.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      cellNominal.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
    } else {
      cellUraian.border = {
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      cellNominal.border = {
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
