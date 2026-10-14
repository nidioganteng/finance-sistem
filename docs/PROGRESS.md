# Progress Perbaikan PHP Backend

> Dibuat setelah tes uji manual modul. Setiap modul dicatat setelah semua
> skenario lulus. Modul yang belum diuji tidak ada di sini.

---

## piutang — `api/routes/piutang.php`

**Commit 1:** `cadf998` — fix silent skip COA dan cek duplikat noBukti  
**Commit 2:** `7d7ec8f` — koreksi kode COA piutang/hutang (Bug A dan B)

### Skenario uji (dijalankan otomatis via `tests/manual/piutang-pelunasan.sh`)

| # | Skenario | Hasil diharapkan | Hasil aktual | Status |
|---|----------|-----------------|--------------|--------|
| 1 | Pelunasan normal gaharu←tataring (kasKecil) | HTTP 201, 4 baris, COA 113/1200/312/1300 debit/kredit benar | HTTP 201, 4 baris, semua COA dan arah benar | ✓ Lulus |
| 2 | jenisKasSumber=bankBuku (tidak ada di map) | HTTP 422, 0 baris di DB | HTTP 422, 0 baris | ✓ Lulus |
| 3 | noBukti sama dikirim dua kali | Kirim-1 201, kirim-2 409, total 4 baris | Kirim-1 201, kirim-2 409, 4 baris | ✓ Lulus |
| 4 | Pelunasan kencana←gaharu (kasBesar), verifikasi Bug A | HTTP 201, 4 baris, COA 112/110/311/120, COA 111+312 tidak ada | HTTP 201, COA benar, COA salah lama tidak ada | ✓ Lulus |

**29 assertion lulus, 0 gagal.**

### Bug yang diperbaiki

| Bug | Deskripsi | Status |
|-----|-----------|--------|
| Silent skip COA | `coa_by_jenis()` mengembalikan null jika entitas belum punya transaksi kas → INSERT dilewati diam-diam, saldo tidak balance | Diperbaiki (Commit 1) |
| Duplikat noBukti | Tidak ada cek → pelunasan sama bisa dikirim dua kali | Diperbaiki (Commit 1) |
| Validasi nominal | `empty()` meloloskan nilai 0 atau negatif | Diperbaiki (Commit 1) |
| Bug A — gaharu/kencana tertukar | `entity_code_map` menukar kode COA gaharu↔kencana | Diperbaiki (Commit 2) |
| Bug B — ciptaAsri tidak cocok | `strtolower('ciptaAsri')` = `'ciptaasri'` tidak ditemukan di map | Diperbaiki (Commit 2) |

### Catatan terbuka (belum diubah)

- **Race condition `last_saldo()`** (`piutang.php:283`): dua request bersamaan membaca saldo yang sama sebelum commit → `saldoSetelah` tidak akurat. Fix yang benar butuh `SELECT ... FOR UPDATE` di dalam transaction. Dampaknya hanya angka running balance (tidak ada data hilang). Menunggu keputusan apakah ini prioritas.
- **Data historis Bug A dan B**: transaksi sebelum Commit 2 yang melibatkan gaharu↔kencana atau ciptaAsri menggunakan kode COA yang salah. Data tidak disentuh. Query diagnostik tersedia di response sebelumnya.

---

## jurnal-transaksi — `api/routes/jurnal-transaksi.php`

**Commit 1:** `a1f2f95` — tambah `sync_project_spend()` di POST dan DELETE  
**Commit 2:** `71957fd` — tangani parameter `fakturId` (Transaction link + edit-safe)  
**Commit 3:** `c3fb1cd` — fix `$now` null bug di edit mode FakturPendapatan UPDATE

### Skenario uji (dijalankan otomatis via `tests/manual/jurnal-transaksi-syncspend.sh`)

| # | Skenario | Hasil diharapkan | Hasil aktual | Status |
|---|----------|-----------------|--------------|--------|
| 1 | POST jurnal BEBAN 5jt ke proyek → Project.spend bertambah 5jt | HTTP 200, delta spend = 5.000.000 | HTTP 200, delta = 5.000.000 | ✓ Lulus |
| 2 | DELETE jurnal yang sama → Project.spend berkurang 5jt | HTTP 200, delta spend = −5.000.000 | HTTP 200, delta = −5.000.000 | ✓ Lulus |
| 3 | POST 7jt + DELETE → spend kembali ke nilai sebelum POST | HTTP 200 (keduanya), spend kembali tepat | HTTP 200, delta kembali = 0 | ✓ Lulus |
| 4 | Edit jurnal dengan fakturId → FakturPendapatan tidak terhapus | HTTP 200 (edit), COUNT faktur = 1 | HTTP 200, COUNT = 1 | ✓ Lulus |

**13 assertion lulus, 0 gagal.**

### Bug yang diperbaiki

| Bug | Deskripsi | Status |
|-----|-----------|--------|
| `syncProjectSpend` tidak ada | POST/DELETE jurnal tidak pernah memperbarui `Project.spend` — nilai selalu 0 (stale) | Diperbaiki (Commit 1) |
| `fakturId` diabaikan di INSERT | Kolom `fakturId` di Transaction tidak diisi — transaksi tidak terhubung ke faktur | Diperbaiki (Commit 2) |
| Edit mode hapus faktur | `DELETE FakturPendapatan WHERE noFaktur=?` menghapus faktur yang mungkin dibuat manual di modul pendapatan | Diperbaiki (Commit 2) |
| Faktur sync salah sasaran | Saat `fakturId` ada, upsert by noFaktur bisa menimpa faktur yang salah | Diperbaiki (Commit 2) |
| `$now` null di edit mode | `$now` didefinisikan setelah blok edit selesai → `updatedAt cannot be null` di UPDATE FakturPendapatan | Diperbaiki (Commit 3) |

### Catatan terbuka (belum diubah)

- **Duplikat noBukti behavior**: Node.js auto-suffix (`-A2`, `-A3`) untuk multi-termin; PHP return 409. Ini perbedaan desain yang disengaja di PHP — lebih eksplisit. Tidak perlu diubah kecuali ada keluhan pengguna.

---

## aset-tetap — `api/routes/aset-tetap.php`

**Status: ⏸ Menunggu keputusan tim — kode tidak diubah**

### Gap yang teridentifikasi (belum diperbaiki)

| Gap | Deskripsi | Kode PHP | Kode Node.js |
|-----|-----------|----------|--------------|
| 6 kategori vs 4 PSAK | PHP: `KENDARAAN/PERALATAN/MESIN/GEDUNG/INVENTARIS/LAINNYA` | `aset-tetap.php:9` | `aset-tetap.ts:5` |
| PHP menyusutkan Tanah | Tidak ada guard `kategori = TANAH` → umurBulan > 0 diterima dan disusutkan | `akuntansi-helpers.php:49` | `aset-tetap.ts:119` |
| Tidak ada `akumulasiPenyusutanAwalTahun` | PHP hanya return `akumulasiPenyusutan` dan `nilaiBuku` untuk tahun target; tidak ada angka pembuka tahun | `aset-tetap.php:44–48` | `aset-tetap.ts:62–206` |

### Keputusan tim yang diperlukan sebelum kode disentuh

- **A** — Adopsi 4 kategori PSAK (Tanah/Bangunan/Kendaraan/Peralatan Kantor) atau tetap 6?
- **B** — Migrasi data lama: GEDUNG→BANGUNAN, MESIN/INVENTARIS/LAINNYA→PERALATAN_KANTOR — otomatis atau manual per aset?
- **C** — Aset Tanah dengan `umurBulan > 0` yang sudah dihitung penyusutannya: reset atau biarkan?
- **D** — Laporan neraca perlu menyesuaikan setelah kategori distandarkan?

### Query preview (baca saja, jangan dijalankan ke produksi)

```sql
-- Sebaran aset per kategori dengan umurBulan > 0
SELECT kategori,
       COUNT(*)                         AS jumlah_aset,
       SUM(hargaPerolehan)              AS total_harga,
       SUM(CASE WHEN umurBulan > 0 THEN 1 ELSE 0 END) AS aset_disusutkan,
       SUM(CASE WHEN umurBulan = 0 THEN 1 ELSE 0 END) AS aset_tidak_disusutkan
FROM AsetTetap
GROUP BY kategori
ORDER BY kategori;

-- Aset yang terdampak migrasi kategori
SELECT id, kode, nama, kategori, entityId,
       hargaPerolehan, nilaiResidu, umurBulan,
       tanggalPerolehan
FROM AsetTetap
WHERE kategori IN ('GEDUNG', 'MESIN', 'INVENTARIS', 'LAINNYA')
ORDER BY kategori, entityId;

-- Aset yang bernama/berkategori Tanah dengan umurBulan > 0 (harus 0 per PSAK 16)
SELECT id, kode, nama, kategori, entityId,
       hargaPerolehan, nilaiResidu, umurBulan,
       tanggalPerolehan
FROM AsetTetap
WHERE (
    LOWER(nama) LIKE '%tanah%'
    OR LOWER(kode) LIKE '%tanah%'
)
AND umurBulan > 0
ORDER BY entityId;
```

---
