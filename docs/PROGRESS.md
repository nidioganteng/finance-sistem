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

## pendapatan — `api/routes/pendapatan.php`

**Commit 1:** `5310d09` — fix rumus nilaiProyek dan tambah path kuitansi bruto  
**Commit 2:** `b34090f` — DELETE faktur unlink Transaction.fakturId dulu  
**Commit 3:** `71acd78` — fix nominalDiterima null → crash (NOT NULL column)

### Skenario uji (dijalankan otomatis via `tests/manual/pendapatan-faktur.sh`)

| # | Skenario | Hasil diharapkan | Hasil aktual | Status |
|---|----------|-----------------|--------------|--------|
| 1 | POST faktur standar → nilaiProyek = round(dpp×111/100) | HTTP 201, nilaiProyek=111000 (bukan 110083), ppn=10083, laba=96500 | HTTP 201, semua angka benar | ✓ Lulus (4 assertion) |
| 2 | POST faktur dengan nilaiKuitansi → path kuitansi bruto | HTTP 201, nilaiProyek=nilaiKuitansi=111000, ppn=11000 | HTTP 201, nilaiProyek=111000, ppn=11000 | ✓ Lulus (4 assertion) |
| 3 | DELETE faktur → Transaction.fakturId dilepas ke NULL | HTTP 200, FakturPendapatan hilang, Transaction.fakturId=NULL | HTTP 200, faktur hilang, fakturId=NULL | ✓ Lulus (6 assertion) |

**14 assertion lulus, 0 gagal.**

### Bug yang diperbaiki

| Bug | Deskripsi | Status |
|-----|-----------|--------|
| `nilaiProyek = dpp + ppn` | Dua pembulatan berantai: ppn dari dppNilaiLain yang dibulatkan → tambah ke dpp. Selisih hingga 917 dari spec (Nilai Proyek = DPP × 111/100) | Diperbaiki (Commit 1) |
| Path kuitansi bruto tidak ada | `nilaiKuitansi` diabaikan; nilaiProyek dan ppn selalu dihitung dari dppNilaiLain | Diperbaiki (Commit 1) |
| Tarif PPN hardcode 11.0 | Default tarif PPN ditulis langsung di kode, bukan dari tabel TarifPajak | Diperbaiki (Commit 1: `get_tarif_ppn_aktif()`) |
| DELETE faktur tidak unlink Transaction | Baris Transaction dengan `fakturId` → UUID faktur yang dihapus menjadi orphaned reference | Diperbaiki (Commit 2) |
| `nominalDiterima` null → crash | Kolom NOT NULL, tapi PHP kirim null saat field tidak ada di request | Diperbaiki (Commit 3) |

### Catatan terbuka (belum diubah)

- **`kuitansiJenis`**: tidak ada sebagai field DB — hanya konsep UI di `LaporanPendapatanClient.tsx`. Tidak perlu diubah di PHP.
- **Multi-termin (amrahan)**: logic UI saja di client component. PHP backend sudah mendukung multiple FakturPendapatan per proyek tanpa perubahan.
- **Auto-register rekanan**: Node.js memanggil `autoRegisterRekananIfNew()` saat create/update faktur. PHP tidak melakukan ini. Bisa dikerjakan nanti jika diperlukan.

---

## Tahap B — Perbaikan Teknis Sisa Modul

### T8 sync — `api/routes/sync.php`

**Commit:** `1ee355c` — cek errno dan HTTP status curl ke Sidamon, log gagal, syncBack di response

| Temuan | Fix |
|--------|-----|
| `curl_exec()` ke Sidamon tidak dicek hasilnya — error diabaikan, response selalu sukses | Tangkap return value, cek `curl_errno()` dan HTTP status; jika gagal log ke `log_activity()` dan sertakan `syncBack.success/error` di response |

**Test:** `tests/manual/sync-assignment.sh` — 7/7 assertion lulus (Sidamon sengaja offline saat uji).

**Catatan:** `log_activity('system', ...)` silently gagal karena FK constraint `ActivityLog.actorId` references `User.id` — tidak ada baris User dengan id='system'. Ini isu pre-existing di `sync.php:120` juga. T8 tidak memperbaikinya karena di luar scope.

---

### T5 kas — `api/routes/kas.php`

**Commit:** `0c329cf` — hapus LIMIT 2000 dari SQL ledger

| Temuan | Fix |
|--------|-----|
| `LIMIT 2000` di level SQL (`kas.php:61`) memotong data diam-diam jika transaksi dalam periode > 2000 baris | Hapus `LIMIT 2000` dari SQL string; pagination tetap di level PHP (page_size=25 grup) |

**Kenapa saldo berjalan tetap benar di semua halaman:** Running saldo dihitung di PHP (`kas.php:140–145`) atas **semua** grup dalam periode sebelum `array_slice()` memotong per halaman — sehingga grup di halaman 2/3/dst selalu mendapat nilai saldo yang akurat dari akumulasi seluruh periode.

---

### T4 jurnal — `api/routes/jurnal.php`

**Commit:** `6bbc82d` — tambah parameter `?limit=` (default 25, max 100)

| Temuan | Fix |
|--------|-----|
| `$page_size = 25` hardcode (`jurnal.php:83`) — client tidak bisa mengontrol jumlah baris per halaman | Ganti dengan `min(100, max(10, (int)($_GET['limit'] ?? 25)))` |

---

### T3 dokumen — `api/routes/dokumen.php`

**Commit:** `cab54e8` — cek return value unlink, error 500 jika gagal

| Temuan | Fix |
|--------|-----|
| `@unlink($filePath)` dengan error-suppress tidak memberitahu client jika file gagal dihapus | `if (file_exists($filePath) && !unlink($filePath)) error_response('Gagal menghapus file fisik.', 500)` — error 500 dilempar sebelum baris DB dihapus |

---

### T2 log — `api/routes/log.php`

**Commit:** `9742960` — validasi panjang (3–200) dan karakter kontrol pada field `action`

| Temuan | Fix |
|--------|-----|
| Field `action` dari client tidak divalidasi — string bebas termasuk karakter kontrol bisa dimasukkan | Cek `strlen($action) < 3 \|\| > 200` + reject ASCII control chars via `preg_match('/[\x00-\x08...]/')` |

---

### T1 pengguna — `api/routes/pengguna.php`

**Status: ✅ Temuan awal salah — tidak ada perubahan kode**

Setelah membaca ulang kode: `set_entity_access()` (`pengguna.php:23–35`) sudah pakai pola **DELETE-first** — semua akses lama dihapus sebelum INSERT baru, sehingga duplikat baru sudah mustahil sejak awal.

**Query diagnostik untuk duplikat lama** (jalankan di prod, read-only):

```sql
SELECT userId, entityId, COUNT(*) AS cnt
FROM UserEntityAccess
GROUP BY userId, entityId
HAVING cnt > 1
ORDER BY cnt DESC;
```

---

### T6 buku-besar — tidak ada perubahan kode

**Status: ⏸ Tidak ada bukti drift — ditunda**

Verifikasi di dev DB: akun `1100` (15 transaksi, semua nilai integer), running balance PHP vs rekalkukasi manual — selisih = 0. Ubah hanya jika ada bukti drift di data produksi dengan nilai desimal dan volume tinggi.

---

### T7, T9, T10, T11, T12 — Ditunda

| # | Alasan tunda |
|---|-------------|
| T7 sync entity mapping | Risiko rendah; ubah hanya jika entitas baru ditambahkan di Sidamon |
| T9 dashboard float | Aman untuk nilai < 1 miliar; bcmath hanya jika dipermasalahkan klien |
| T10 neraca 4 kategori | Bergantung keputusan aset-tetap A–D |
| T11 laporan-keuangan | Bergantung konfirmasi A2 (sumber data laba-rugi) |
| T12 payroll PPh21 | Tidak ada bug aktif; feature future |

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
