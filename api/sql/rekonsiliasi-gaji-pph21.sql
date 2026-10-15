-- Table: RekonsiliasiGajiPph21
-- Catatan: Nilai yang DILAPORKAN ke SPT Masa 1721 per entitas, per bulan, per tahun.
-- Dipakai untuk audit paralel Jurnal (Akun 511 & 612) vs SPT Terlapor.
-- Dibuat untuk endpoint GET/POST/PUT/DELETE /api/rekonsiliasi-pajak-gaji
-- dan dibaca oleh src/lib/rekonsiliasi-pajak-gaji.ts
--
-- Kolom camelCase mengikuti konvensi tabel lain (hasil migrasi dari Prisma).
-- DECIMAL(18, 2) agar bisa menampung nilai besar.
-- `updatedAt` auto-update, `createdAt` auto-set saat INSERT.
-- Composite unique key (entityId, year, month) agar satu baris per entitas-bulan-tahun.

CREATE TABLE IF NOT EXISTS `RekonsiliasiGajiPph21` (
  `id`                   VARCHAR(191)   NOT NULL,
  `entityId`             VARCHAR(191)   NOT NULL,
  `year`                 INT            NOT NULL,
  `month`                INT            NOT NULL,
  `gajiTerlapor`         DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `pph21Terlapor`        DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `gajiPegawaiTerlapor`  DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `gajiTaTerlapor`       DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `pph21PegawaiTerlapor` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `pph21TaTerlapor`      DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `ntpn`                 VARCHAR(191)   NULL,
  `keterangan`           TEXT           NULL,
  `createdAt`            DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`            DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `RekonsiliasiGajiPph21_entityId_year_month_key` (`entityId`, `year`, `month`),
  KEY `RekonsiliasiGajiPph21_entityId_year_idx` (`entityId`, `year`),
  CONSTRAINT `RekonsiliasiGajiPph21_entityId_fkey`
    FOREIGN KEY (`entityId`) REFERENCES `Entity` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
