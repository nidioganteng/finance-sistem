import ExcelJS from "exceljs";
import type { RekonsiliasiPajakGajiData } from "./rekonsiliasi-pajak-gaji";

export async function generateRekonsiliasiPajakGajiExcel(
  data: RekonsiliasiPajakGajiData
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Finance Sistem - SDK Gaharu Sempana";
  workbook.created = new Date();

  const ws = workbook.addWorksheet(`Rekonsiliasi PPh 21 ${data.year}`);
  ws.views = [{ showGridLines: true }];

  ws.columns = [
    { key: "no", width: 6 },
    { key: "bulan", width: 16 },
    { key: "gajiJurnal", width: 22 },
    { key: "gajiSpt", width: 22 },
    { key: "selisihGaji", width: 20 },
    { key: "pph21Jurnal", width: 20 },
    { key: "pph21Spt", width: 20 },
    { key: "selisihPph21", width: 20 },
    { key: "status", width: 20 },
    { key: "ntpn", width: 18 },
    { key: "keterangan", width: 35 },
  ];

  const accountingFmt = '"Rp "#,##0;"Rp "(#,##0);"Rp -"';
  const headerBgColor = "FF1E293B"; // Dark Slate Navy

  // 1. Title Rows
  const t1 = ws.addRow(["", "REKONSILIASI PAJAK GAJI & PPH PASAL 21 (JURNAL UMUM VS SPT MASA)"]);
  t1.font = { bold: true, size: 13, color: { argb: "FF0F172A" } };

  const t2 = ws.addRow(["", `${data.entityName.toUpperCase()} — TAHUN ${data.year}`]);
  t2.font = { bold: true, size: 10, color: { argb: "FF475569" } };

  ws.addRow([]); // Blank spacer

  // 2. Header
  const header = ws.addRow([
    "NO",
    "BULAN",
    "BIAYA GAJI JURNAL",
    "GAJI TERLAPOR (SPT)",
    "SELISIH GAJI",
    "PPH 21 JURNAL/PAYROLL",
    "PPH 21 TERLAPOR (SPT)",
    "SELISIH PPH 21",
    "STATUS AUDIT",
    "NTPN / BUKTI",
    "CATATAN / TINDAK LANJUT",
  ]);
  header.height = 26;
  header.eachCell((cell) => {
    cell.font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerBgColor } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "medium" },
      bottom: { style: "medium" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // 3. Data Rows
  data.items.forEach((item) => {
    const isMatch = item.status === "MATCH";
    const isSelisih = item.status === "SELISIH";
    const isBelum = item.status === "BELUM_DILAPORKAN";

    const row = ws.addRow([
      item.month,
      item.namaBulan,
      item.gajiTotalJurnal,
      item.gajiTerlapor,
      item.selisihGaji,
      item.pph21Basis,
      item.pph21Terlapor,
      item.selisihPph21,
      isMatch
        ? "SESUAI / MATCH"
        : isSelisih
        ? "SELISIH (ALERT)"
        : isBelum
        ? "BELUM LAPOR SPT"
        : "NIHIL",
      item.ntpn || "-",
      item.keterangan || "-",
    ]);

    row.height = 20;

    // Alignment and formats
    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(2).alignment = { vertical: "middle", horizontal: "left" };
    row.getCell(9).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(10).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(11).alignment = { vertical: "middle", horizontal: "left" };

    // Format currency columns
    [3, 4, 5, 6, 7, 8].forEach((colIdx) => {
      const c = row.getCell(colIdx);
      c.numFmt = accountingFmt;
      c.alignment = { vertical: "middle", horizontal: "right" };
    });

    // Color indicators
    if (isSelisih) {
      row.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF1F2" } }; // Light rose
      });
      row.getCell(5).font = { color: { argb: "FFE11D48" }, bold: true };
      row.getCell(8).font = { color: { argb: "FFE11D48" }, bold: true };
      row.getCell(9).font = { color: { argb: "FFE11D48" }, bold: true };
    } else if (isBelum) {
      row.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } }; // Light amber
      });
      row.getCell(9).font = { color: { argb: "FFD97706" }, bold: true };
    } else if (isMatch) {
      row.getCell(9).font = { color: { argb: "FF059669" }, bold: true };
    }

    row.eachCell((c) => {
      c.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // 4. Summary Row (Footer)
  const sumRow = ws.addRow([
    "",
    "TOTAL TAHUNAN",
    data.summary.totalGajiJurnal,
    data.summary.totalGajiTerlapor,
    data.summary.totalSelisihGaji,
    data.summary.totalPph21Basis,
    data.summary.totalPph21Terlapor,
    data.summary.totalSelisihPph21,
    data.summary.overallStatus === "ALL_BALANCED" ? "SEMUA BALANCE" : "PERLU AUDIT",
    "",
    "",
  ]);

  sumRow.height = 24;
  sumRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cell.border = {
      top: { style: "medium" },
      bottom: { style: "double" },
      left: { style: "thin" },
      right: { style: "thin" },
    };

    if ([3, 4, 5, 6, 7, 8].includes(colNumber)) {
      cell.numFmt = accountingFmt;
      cell.alignment = { vertical: "middle", horizontal: "right" };
    } else {
      cell.alignment = { vertical: "middle", horizontal: colNumber === 2 ? "left" : "center" };
    }
  });

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}
