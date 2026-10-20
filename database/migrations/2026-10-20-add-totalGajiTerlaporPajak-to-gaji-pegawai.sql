-- Migration: Tambah kolom totalGajiTerlaporPajak pada tabel GajiPegawaiBulanan
-- Memisahkan total gaji kotor (termasuk tunjangan non-pajak) dengan
-- total gaji yang menjadi dasar penghitungan PPh 21 (basis terlapor ke SPT).

ALTER TABLE `GajiPegawaiBulanan`
  ADD COLUMN `totalGajiTerlaporPajak` DECIMAL(18,2) NOT NULL DEFAULT 0.00
  AFTER `totalGajiKotor`;

-- Isi nilai awal: samakan dengan totalGajiKotor untuk data yang sudah ada
UPDATE `GajiPegawaiBulanan`
SET `totalGajiTerlaporPajak` = `totalGajiKotor`
WHERE `totalGajiTerlaporPajak` = 0.00;
