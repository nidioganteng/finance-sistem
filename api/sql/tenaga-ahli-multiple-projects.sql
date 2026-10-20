-- Migration: Tabel TenagaAhliProject untuk mendukung penugasan multi-proyek per freelance
-- 1 Tenaga Ahli dapat ditugaskan pada lebih dari 1 proyek, masing-masing dengan masa tugas, status lapangan, dan honor bulanan sendiri.

CREATE TABLE IF NOT EXISTS `TenagaAhliProject` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `rekananId` VARCHAR(36) NOT NULL,
  `projectId` VARCHAR(36) NOT NULL,
  `tanggalMulaiTugas` DATE NULL,
  `tanggalSelesaiTugas` DATE NULL,
  `isTurunLapangan` TINYINT(1) NOT NULL DEFAULT 1,
  `nominalHonorBulanan` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tap_rekanan` (`rekananId`),
  INDEX `idx_tap_project` (`projectId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
