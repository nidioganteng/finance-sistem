CREATE TABLE IF NOT EXISTS `TenagaAhliGajiKontrak` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `rekananId` VARCHAR(36) NOT NULL,
  `projectId` VARCHAR(36) NOT NULL,
  `sumber` VARCHAR(10) NOT NULL DEFAULT 'MANUAL',
  `namaPekerjaan` VARCHAR(255) NULL,
  `manMonth` DECIMAL(10,2) NULL,
  `gajiRab` DECIMAL(18,2) NULL,
  `spmkMulai` DATE NULL,
  `spmkSelesai` DATE NULL,
  `gajiNegosiasi` DECIMAL(18,2) NULL,
  `basisNegosiasi` VARCHAR(10) NOT NULL DEFAULT 'BULAN',
  `jadwalJson` LONGTEXT NULL,
  `revision` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_tagk_person_project` (`rekananId`, `projectId`),
  INDEX `idx_tagk_project` (`projectId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
