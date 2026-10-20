-- Migration: Tambah tarifTransportHarian di tabel Pegawai (Master Data)
-- Digunakan untuk kalkulasi otomatis tunjangan transport (Hari Kerja * Tarif Harian) saat input gaji bulanan.

ALTER TABLE `Pegawai`
  ADD COLUMN `tarifTransportHarian` DECIMAL(18,2) NOT NULL DEFAULT 15000.00 AFTER `tunjanganJabatan`;
