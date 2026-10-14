# Checklist Deploy ke Hostinger

> Ikuti urutan ini secara berurutan. Centang setiap item sebelum lanjut ke berikutnya.
> Jika ada langkah yang gagal, **berhenti dan lakukan rollback** — jangan lanjut.

---

## Bagian 0 — Persiapan (lakukan di mesin lokal / staging)

### 0.1 Tentukan commit target

```bash
git log --oneline -10
# Catat commit hash yang akan di-deploy, misalnya: abc1234
```

- [ ] Commit target dicatat: `____________`
- [ ] Branch: `feat/php-conversion` (atau main setelah merge)

### 0.2 Jalankan seluruh tes otomatis di dev

```bash
bash tests/manual/piutang-pelunasan.sh
bash tests/manual/jurnal-transaksi-syncspend.sh
bash tests/manual/pendapatan-faktur.sh
bash tests/manual/pendapatan-a3-tarif.sh
bash tests/manual/sync-assignment.sh
```

- [ ] piutang: 29/29 lulus
- [ ] jurnal-transaksi: 13/13 lulus
- [ ] pendapatan: 14/14 lulus
- [ ] pendapatan A3: 11/11 lulus
- [ ] sync: 7/7 lulus

---

## Bagian 1 — Backup database produksi

> Lakukan ini PERTAMA, sebelum menyentuh file apapun di Hostinger.

### 1.1 Dump database produksi

Dari panel Hostinger → phpMyAdmin, atau via SSH:

```bash
# Via SSH di Hostinger (sesuaikan kredensial):
mysqldump -h HOST_PROD -u USER_PROD -p DB_PROD_NAME \
  --single-transaction --routines --triggers \
  > backup_$(date +%Y%m%d_%H%M%S).sql

# Verifikasi ukuran file backup (harus > 0):
ls -lh backup_*.sql
```

- [ ] Backup berhasil dibuat
- [ ] Ukuran file backup > 0 (bukan file kosong)
- [ ] Backup disimpan di tempat aman (lokal atau cloud, bukan hanya di server Hostinger)
- [ ] Nama file backup dicatat: `____________`

### 1.2 Catat jumlah baris tabel kritis

Jalankan query ini di DB produksi via phpMyAdmin dan catat hasilnya:

```sql
SELECT 'Transaction'       AS tabel, COUNT(*) AS jumlah FROM `Transaction`
UNION ALL SELECT 'FakturPendapatan', COUNT(*) FROM FakturPendapatan
UNION ALL SELECT 'Project',          COUNT(*) FROM Project
UNION ALL SELECT 'User',             COUNT(*) FROM User
UNION ALL SELECT 'CoaAccount',       COUNT(*) FROM CoaAccount
UNION ALL SELECT 'ActivityLog',      COUNT(*) FROM ActivityLog;
```

| Tabel | Jumlah sebelum deploy |
|-------|----------------------|
| Transaction | |
| FakturPendapatan | |
| Project | |
| User | |
| CoaAccount | |
| ActivityLog | |

---

## Bagian 2 — Cek lingkungan Hostinger

> Lakukan via SSH atau phpMyAdmin sebelum upload file.

### 2.1 Verifikasi versi PHP

```bash
php -v
# Harus: PHP 8.0 atau lebih baru
```

- [ ] PHP versi: `____________` (minimal 8.0)

### 2.2 Verifikasi ekstensi PHP wajib

```bash
php -m | grep -E "pdo_mysql|curl|mbstring|json|openssl"
```

Atau buat file `phpinfo_check.php` sementara di root:

```php
<?php
$required = ['pdo_mysql', 'curl', 'mbstring', 'json', 'openssl'];
foreach ($required as $ext) {
    echo $ext . ': ' . (extension_loaded($ext) ? 'OK' : 'MISSING') . "\n";
}
```

- [ ] `pdo_mysql` — aktif (koneksi ke MySQL)
- [ ] `curl` — aktif (sync ke Sidamon)
- [ ] `mbstring` — aktif (string multibyte)
- [ ] `json` — aktif (response JSON)
- [ ] `openssl` — aktif (JWT signing)
- [ ] **Hapus file `phpinfo_check.php` setelah cek** (jangan tinggalkan di server)

### 2.3 Verifikasi batas memori PHP

```bash
php -r "echo ini_get('memory_limit');"
# Minimal 128MB. Rekomendasi: 256MB.
```

- [ ] `memory_limit`: `____________` (minimal 128M)

### 2.4 Verifikasi batas upload (untuk modul Dokumen)

```bash
php -r "echo ini_get('upload_max_filesize') . ' / ' . ini_get('post_max_size');"
```

- [ ] `upload_max_filesize`: `____________`
- [ ] `post_max_size`: `____________`

---

## Bagian 3 — Konfigurasi .env produksi

> File `.env` TIDAK boleh dicommit ke git. Buat manual di server.

### 3.1 Buat file `.env` di root proyek di server

```bash
# Di server Hostinger, buat file .env di folder root Next.js:
nano .env
```

Isi minimal:

```dotenv
# Database (sesuaikan dengan kredensial Hostinger)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=nama_database_produksi
DB_USER=user_database_produksi
DB_PASSWORD=password_kuat_di_sini

# JWT (gunakan string acak panjang, minimal 32 karakter)
JWT_SECRET=GANTI_DENGAN_RANDOM_STRING_PANJANG
JWT_EXPIRES_IN=30d

# URL aplikasi
FRONTEND_URL=https://domain-produksi.com
UPLOAD_DIR=/path/absolut/ke/folder/uploads

# Integrasi Sidamon
INTERNAL_SECRET=SAMA_DENGAN_SECRET_DI_SIDAMON
SIDAMON_URL=https://url-sidamon-produksi.com
```

```dotenv
# File .env.local untuk Next.js (di root folder Next.js)
NEXTAUTH_SECRET=GANTI_DENGAN_RANDOM_STRING_PANJANG
NEXTAUTH_URL=https://domain-produksi.com
PHP_API_URL=https://domain-produksi.com
```

- [ ] `.env` PHP dibuat di server (bukan di git)
- [ ] `.env.local` Next.js dibuat di server
- [ ] `JWT_SECRET` menggunakan string acak yang berbeda dari dev
- [ ] `NEXTAUTH_SECRET` menggunakan string acak yang berbeda dari dev
- [ ] `INTERNAL_SECRET` sesuai dengan nilai di Sidamon

### 3.2 Verifikasi koneksi DB dari PHP

Buat file sementara `db_check.php`:

```php
<?php
$pdo = new PDO(
    'mysql:host=' . getenv('DB_HOST') . ';dbname=' . getenv('DB_NAME') . ';charset=utf8mb4',
    getenv('DB_USER'), getenv('DB_PASSWORD')
);
$row = $pdo->query('SELECT COUNT(*) FROM User')->fetchColumn();
echo "OK — jumlah user: $row\n";
```

- [ ] Koneksi DB berhasil
- [ ] **Hapus `db_check.php` setelah cek**

---

## Bagian 4 — Upload dan deploy file

### 4.1 Upload file PHP backend

Via FTP/SFTP atau git pull:

```bash
# Jika pakai git di server:
git pull origin feat/php-conversion
# Atau upload folder api/ dan src/ via FTP
```

- [ ] Folder `api/` terupload (semua file .php)
- [ ] Folder `src/` terupload (Next.js source)
- [ ] File `package.json`, `next.config.*`, `tailwind.config.*` terupload
- [ ] File `.env` dan `.env.local` **tidak** terupload (sudah dibuat manual di langkah 3.1)

### 4.2 Build Next.js

```bash
npm install
npm run build
```

- [ ] Build selesai tanpa error
- [ ] Tidak ada TypeScript error

### 4.3 Verifikasi permissions

```bash
# Folder uploads harus writable
chmod 755 uploads/
ls -la uploads/
```

- [ ] Folder `uploads/` writable oleh PHP

---

## Bagian 5 — Uji di data produksi (staging clone)

> **Idealnya**: clone DB produksi ke environment staging, jalankan tes di sana.
> Jika tidak ada staging, lanjut ke Bagian 6 dengan hati-hati.

### 5.1 Clone DB produksi ke staging

```bash
# Restore backup ke DB staging:
mysql -h HOST_STAGING -u USER_STAGING -p DB_STAGING < backup_YYYYMMDD_HHMMSS.sql
```

- [ ] DB staging berisi data produksi
- [ ] `.env` staging mengarah ke DB staging (bukan produksi)

### 5.2 Jalankan tes otomatis di staging

```bash
# Pastikan BASE di tes mengarah ke URL staging
bash tests/manual/piutang-pelunasan.sh
bash tests/manual/jurnal-transaksi-syncspend.sh
bash tests/manual/pendapatan-faktur.sh
bash tests/manual/pendapatan-a3-tarif.sh
bash tests/manual/sync-assignment.sh
```

- [ ] Semua tes lulus di atas data produksi

### 5.3 Bersihkan data tes dari staging

```bash
echo "ya" | bash tests/manual/cleanup.sh
```

- [ ] Tidak ada baris TEST- tersisa di staging

---

## Bagian 6 — Verifikasi pasca-deploy per modul

> Lakukan manual di browser setelah deploy ke produksi.

### 6.1 Auth

- [ ] Login berhasil dengan akun produksi
- [ ] Token JWT diterima dan bisa dipakai untuk request berikutnya
- [ ] Logout berfungsi

### 6.2 Dashboard

- [ ] Halaman dashboard terbuka tanpa error
- [ ] Angka revenue/spend tampil (tidak NaN atau 0 semua)

### 6.3 Jurnal Transaksi

- [ ] Daftar transaksi tampil dengan paginasi
- [ ] POST transaksi baru berhasil
- [ ] Project.spend terupdate setelah POST transaksi BEBAN

### 6.4 Kas (kecil/besar/bank)

- [ ] Ledger kas tampil dengan saldo berjalan yang benar
- [ ] Filter tanggal berfungsi
- [ ] Tambah transaksi kas baru berhasil

### 6.5 Piutang & Termin

- [ ] Daftar piutang tampil
- [ ] POST pelunasan berhasil
- [ ] 4 baris jurnal terbentuk setelah pelunasan

### 6.6 Pendapatan / Rekap E-Faktur

- [ ] Daftar faktur tampil
- [ ] POST faktur baru berhasil, nilaiProyek = round(dpp × 111/100)
- [ ] Edit faktur lama (tarifPpn=11%) tanpa ubah tarif → ppn tidak berubah ke 12%

### 6.7 Laporan (Buku Besar, Neraca, Laba Rugi, Arus Kas)

- [ ] Laporan terbuka tanpa error
- [ ] Angka tidak 0 semua (ada data produksi)

### 6.8 Sync Sidamon

- [ ] POST `/api/sync/assignment` berhasil membuat project
- [ ] Response mengandung `syncBack.success` (true atau false)
- [ ] Jika Sidamon tidak bisa dicapai: error tercatat di log, response tetap 200

### 6.9 Notifikasi

- [ ] Badge notifikasi tampil di sidebar
- [ ] Halaman notifikasi terbuka
- [ ] Mark as read berfungsi

### 6.10 Dokumen

- [ ] Upload dokumen berhasil
- [ ] Download berhasil
- [ ] Delete berhasil (file fisik terhapus, bukan hanya record DB)

---

## Bagian 7 — Verifikasi jumlah baris pasca-deploy

Jalankan query yang sama dengan Bagian 1.2 dan bandingkan:

```sql
SELECT 'Transaction'       AS tabel, COUNT(*) AS jumlah FROM `Transaction`
UNION ALL SELECT 'FakturPendapatan', COUNT(*) FROM FakturPendapatan
UNION ALL SELECT 'Project',          COUNT(*) FROM Project
UNION ALL SELECT 'User',             COUNT(*) FROM User
UNION ALL SELECT 'CoaAccount',       COUNT(*) FROM CoaAccount
UNION ALL SELECT 'ActivityLog',      COUNT(*) FROM ActivityLog;
```

| Tabel | Sebelum deploy | Setelah deploy | Selisih |
|-------|---------------|----------------|---------|
| Transaction | | | |
| FakturPendapatan | | | |
| Project | | | |
| User | | | |
| CoaAccount | | | |
| ActivityLog | | | |

- [ ] Semua tabel kritis: selisih = 0 (tidak ada data yang hilang akibat deploy)

---

## Bagian 8 — Rencana rollback

> Jalankan jika ada masalah serius setelah deploy.

### Kapan rollback diperlukan

- Data hilang atau corrupt di tabel kritis
- Login tidak bisa dilakukan sama sekali
- Error 500 di lebih dari satu modul utama
- Angka laporan keuangan berubah drastis tanpa alasan

### Langkah rollback

**Opsi A — Rollback kode saja** (jika DB tidak terpengaruh):

```bash
# Kembali ke commit sebelum deploy
git revert HEAD
# atau
git checkout COMMIT_HASH_SEBELUM_DEPLOY

# Rebuild Next.js
npm run build
```

**Opsi B — Rollback kode + restore DB** (jika DB terpengaruh):

```bash
# 1. Hentikan traffic ke aplikasi (maintenance mode atau ubah DNS)

# 2. Restore DB dari backup yang dibuat di Bagian 1.1
mysql -h HOST_PROD -u USER_PROD -p DB_PROD_NAME < backup_YYYYMMDD_HHMMSS.sql

# 3. Rollback kode ke commit sebelum deploy
git checkout COMMIT_HASH_SEBELUM_DEPLOY

# 4. Rebuild dan restart
npm run build

# 5. Verifikasi jumlah baris sama dengan snapshot di Bagian 1.2
```

- [ ] Lokasi file backup dicatat dan bisa diakses: `____________`
- [ ] Commit hash sebelum deploy dicatat: `____________`
- [ ] Prosedur rollback sudah diuji di staging (opsional tapi direkomendasikan)

---

## Catatan tambahan

- **Jangan deploy saat jam kerja puncak** — pilih malam hari atau akhir pekan.
- **Beritahu pengguna** sebelum maintenance jika diperlukan downtime.
- **INTERNAL_SECRET** harus sama di PHP (`.env`) dan di server Sidamon — jika berbeda, sync akan gagal dengan 401.
- File `phpinfo_check.php` dan `db_check.php` yang dibuat di langkah 2.2 dan 3.2 **wajib dihapus** sebelum aplikasi live.
