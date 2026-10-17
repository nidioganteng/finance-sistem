-- Migration: Tambah kolom status dan tanggalResign pada tabel Pegawai
-- Digunakan untuk pengelolaan status karyawan (Aktif / Resign / Pensiun)
-- serta otomatisasi kemunculan karyawan di daftar penggajian bulanan.

ALTER TABLE `Pegawai`
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'AKTIF' AFTER `isActive`,
  ADD COLUMN `tanggalResign` DATE NULL AFTER `status`;

UPDATE `Pegawai`
SET `status` = IF(`isActive` = 1, 'AKTIF', 'RESIGN')
WHERE `status` IS NULL OR `status` = '';
