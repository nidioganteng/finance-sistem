import ExcelJS from "exceljs";
import type { RekonsiliasiPajakGajiData } from "./rekonsiliasi-pajak-gaji";

export async function generateRekonsiliasiPajakGajiExcel(
  data: RekonsiliasiPajakGajiData
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Finance Sistem - SDK Gaharu Sempana";
  workbook.created = new Date();

  const accountingFmt = '"Rp "#,##0;"Rp "(#,##0);"Rp -"';
  const headerBgColor = "FF1E293B"; // Dark Slate Navy

  function buildSheet(
    title: string,
    sheetName: string,
    isPegawai: boolean | null,
    items: typeof data.items,
    summaryObj: {
      totalGajiJurnal: number;
      totalGajiTerlapor: number;
      totalSelisihGaji: number;
      totalPphBasis: number;
      totalPphTerlapor: number;
      totalSelisihPph: number;
      status: string;
    }
  ) {
    const ws = workbook.addWorksheet(sheetName);
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

    // 1. Title Rows
    const t1 = ws.addRow(["", title]);
    t1.font = { bold: true, size: 13, color: { argb: "FF0F172A" } };

    const t2 = ws.addRow(["", `${data.entityName.toUpperCase()} — TAHUN ${data.year}`]);
    t2.font = { bold: true, size: 10, color: { argb: "FF475569" } };

    ws.addRow([]); // Blank spacer

    // 2. Header
    const gajiColLabel =
      isPegawai === true
        ? "GAJI PEGAWAI JURNAL (511)"
        : isPegawai === false
        ? "HONOR TENAGA AHLI JURNAL (612)"
        : "TOTAL BIAYA GAJI JURNAL";

    const header = ws.addRow([
      "NO",
      "BULAN",
      gajiColLabel,
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
    items.forEach((item) => {
      const gajiJurnal =
        isPegawai === true
          ? item.gajiPegawaiJurnal
          : isPegawai === false
          ? item.gajiTaJurnal
          : item.gajiTotalJurnal;

      const gajiSpt =
        isPegawai === true
          ? item.gajiPegawaiTerlapor
          : isPegawai === false
          ? item.gajiTaTerlapor
          : item.gajiTerlapor;

      const selisihGaji =
        isPegawai === true
          ? item.selisihGajiPegawai
          : isPegawai === false
          ? item.selisihGajiTa
          : item.selisihGaji;

      const pphJurnal =
        isPegawai === true
          ? item.pph21PegawaiBasis
          : isPegawai === false
          ? item.pph21TaBasis
          : item.pph21Basis;

      const pphSpt =
        isPegawai === true
          ? item.pph21PegawaiTerlapor
          : isPegawai === false
          ? item.pph21TaTerlapor
          : item.pph21Terlapor;

      const selisihPph =
        isPegawai === true
          ? item.selisihPph21Pegawai
          : isPegawai === false
          ? item.selisihPph21Ta
          : item.selisihPph21;

      const status =
        isPegawai === true
          ? item.statusPegawai
          : isPegawai === false
          ? item.statusTa
          : item.status;

      const isMatch = status === "MATCH";
      const isSelisih = status === "SELISIH";
      const isBelum = status === "BELUM_DILAPORKAN";

      const row = ws.addRow([
        item.month,
        item.namaBulan,
        gajiJurnal,
        gajiSpt,
        selisihGaji,
        pphJurnal,
        pphSpt,
        selisihPph,
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

      row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(2).alignment = { vertical: "middle", horizontal: "left" };
      row.getCell(9).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(10).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(11).alignment = { vertical: "middle", horizontal: "left" };

      [3, 4, 5, 6, 7, 8].forEach((colIdx) => {
        const c = row.getCell(colIdx);
        c.numFmt = accountingFmt;
        c.alignment = { vertical: "middle", horizontal: "right" };
      });

      if (isSelisih) {
        row.eachCell((c) => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF1F2" } };
        });
        row.getCell(5).font = { color: { argb: "FFE11D48" }, bold: true };
        row.getCell(8).font = { color: { argb: "FFE11D48" }, bold: true };
        row.getCell(9).font = { color: { argb: "FFE11D48" }, bold: true };
      } else if (isBelum) {
        row.eachCell((c) => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
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
      summaryObj.totalGajiJurnal,
      summaryObj.totalGajiTerlapor,
      summaryObj.totalSelisihGaji,
      summaryObj.totalPphBasis,
      summaryObj.totalPphTerlapor,
      summaryObj.totalSelisihPph,
      summaryObj.status === "ALL_BALANCED" ? "SEMUA BALANCE" : "PERLU AUDIT",
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
  }

  // Sheet 1: Total Gabungan
  buildSheet(
    "REKONSILIASI PAJAK GAJI & PPH 21 (TOTAL KONSOLIDASI)",
    `Total PPh 21 ${data.year}`,
    null,
    data.items,
    {
      totalGajiJurnal: data.summary.totalGajiJurnal,
      totalGajiTerlapor: data.summary.totalGajiTerlapor,
      totalSelisihGaji: data.summary.totalSelisihGaji,
      totalPphBasis: data.summary.totalPph21Basis,
      totalPphTerlapor: data.summary.totalPph21Terlapor,
      totalSelisihPph: data.summary.totalSelisihPph21,
      status: data.summary.overallStatus,
    }
  );

  // Sheet 2: Pegawai Tetap
  buildSheet(
    "REKONSILIASI PAJAK GAJI PEGAWAI TETAP (AKUN 511 VS SPT)",
    `Pegawai Tetap ${data.year}`,
    true,
    data.items,
    {
      totalGajiJurnal: data.summary.pegawai.totalGajiJurnal,
      totalGajiTerlapor: data.summary.pegawai.totalGajiTerlapor,
      totalSelisihGaji: data.summary.pegawai.totalSelisihGaji,
      totalPphBasis: data.summary.pegawai.totalPphBasis,
      totalPphTerlapor: data.summary.pegawai.totalPphTerlapor,
      totalSelisihPph: data.summary.pegawai.totalSelisihPph,
      status: data.summary.pegawai.status,
    }
  );

  // Sheet 3: Tenaga Ahli
  buildSheet(
    "REKONSILIASI HONORARIUM TENAGA AHLI (AKUN 612 VS SPT)",
    `Tenaga Ahli ${data.year}`,
    false,
    data.items,
    {
      totalGajiJurnal: data.summary.tenagaAhli.totalGajiJurnal,
      totalGajiTerlapor: data.summary.tenagaAhli.totalGajiTerlapor,
      totalSelisihGaji: data.summary.tenagaAhli.totalSelisihGaji,
      totalPphBasis: data.summary.tenagaAhli.totalPphBasis,
      totalPphTerlapor: data.summary.tenagaAhli.totalPphTerlapor,
      totalSelisihPph: data.summary.tenagaAhli.totalSelisihPph,
      status: data.summary.tenagaAhli.status,
    }
  );

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}
