-- Tambah nilai PENUGASAN_BARU ke enum NotifikasiType
-- Dijalankan via phpMyAdmin atau mysql CLI di server
ALTER TABLE `Notifikasi`
  MODIFY COLUMN `type` ENUM(
    'PENDAFTARAN',
    'LOADING_DOCK',
    'TERMIN_AUDIT',
    'TERMIN_BARU',
    'PROGRES_80',
    'PERUBAHAN_CLOSED',
    'BACKDATE',
    'JENIS_INPUT_BARU',
    'PENUGASAN_BARU'
  ) NOT NULL;
