-- Migration: Tambah kolom ptkp pada tabel Rekanan
-- Digunakan untuk tenaga ahli yang statusnya pegawai tetap lintas entitas,
-- agar kalkulasi PPh 21 TER bisa membaca status PTKP dari master rekanan.

ALTER TABLE `Rekanan`
  ADD COLUMN `ptkp` VARCHAR(20) NOT NULL DEFAULT 'TK/0' AFTER `entityId`;
