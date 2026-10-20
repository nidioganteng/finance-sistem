-- Migration: Tambah kolom masa tugas, proyek, dan status turun lapangan pada tabel Rekanan (tipe TENAGA_AHLI)
-- Digunakan untuk pengaturan masa tugas (kontrak kerja freelance/tenaga ahli),
-- penanda status turun lapangan vs administrasi SKA,
-- serta otomatisasi kemunculan nama tenaga ahli di daftar penggajian bulanan.

ALTER TABLE `Rekanan`
  ADD COLUMN `tanggalMulaiTugas` DATE NULL AFTER `ptkp`,
  ADD COLUMN `tanggalSelesaiTugas` DATE NULL AFTER `tanggalMulaiTugas`,
  ADD COLUMN `projectId` VARCHAR(191) NULL AFTER `tanggalSelesaiTugas`,
  ADD COLUMN `isTurunLapangan` TINYINT(1) NOT NULL DEFAULT 1 AFTER `projectId`,
  ADD COLUMN `nominalHonorBulanan` DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER `isTurunLapangan`;
