-- Migration: Tambah komponen gaji tetap di tabel Pegawai (Master Data)
-- Memfasilitasi pemisahan input komponen gaji tetap (auto-fill) vs variabel bulanan.

ALTER TABLE `Pegawai`
  ADD COLUMN `tunjanganBpjsKes` DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER `tunjanganJabatan`,
  ADD COLUMN `tunjanganBpjsTk` DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER `tunjanganBpjsKes`,
  ADD COLUMN `bpjsKesehatan` DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER `tunjanganBpjsTk`,
  ADD COLUMN `bpjsKetenagakerjaan` DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER `bpjsKesehatan`,
  ADD COLUMN `potonganBpjs` DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER `bpjsKetenagakerjaan`;
