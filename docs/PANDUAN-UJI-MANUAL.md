# Panduan Uji Manual — Sistem Keuangan Gaharu Sempana (PHP Backend)

> Panduan ini untuk **manusia**, bukan skrip otomatis.  
> Tujuannya: konfirmasi bahwa modul-modul yang diperbaiki di branch
> `feat/php-conversion` bekerja benar di browser — termasuk angka yang
> berubah dibanding sebelum perbaikan.  
>
> **Cara membaca kolom "Angka yang diharapkan":** angka dari DB dev
> (entitas Gaharu Sempana, tahun berjalan). Angka produksi akan berbeda —
> yang penting pola dan relasi antar-angka harus konsisten.

---

## Pra-syarat

- Server PHP berjalan (`php -S localhost:8000 api/router.php` atau Apache)
- Next.js berjalan (`npm run dev`)
- Login sebagai `manajer@gaharusempana.com` (Manajer Keuangan)
- Pilih entitas **Gaharu Sempana** di Entity Switcher

---

## Modul 1 — Jurnal Transaksi (`/jurnal-transaksi`)

### 1.1 Daftar tampil
- [ ] Halaman terbuka, ada tabel transaksi
- [ ] Kolom: Tanggal, No. Bukti, Keterangan, Debit, Kredit, Saldo
- [ ] Pagination bekerja (klik halaman 2 dst)
- [ ] Parameter `?limit=` dihormati: buka `/jurnal-transaksi?limit=10`, harusnya 10 baris per halaman (bukan 25 default)

### 1.2 POST transaksi BEBAN → Project.spend terupdate
1. Catat `spend` project tertentu di halaman Profitabilitas (nilai sebelum)
2. POST transaksi baru: jenis = Kas Kecil, akun BEBAN, pilih proyek yang sama, nominal Rp 100.000
3. Buka kembali halaman Profitabilitas → `spend` proyek harus naik Rp 100.000

**Angka yang berubah:** `spend` proyek naik tepat sebesar nominal yang diinput.  
**Bug yang diperbaiki:** sebelumnya `spend` tidak terupdate karena `syncProjectSpend()` hilang.

---

## Modul 2 — Kas Kecil / Besar / Bank Buku (`/kas`)

### 2.1 Saldo berjalan benar di semua halaman
1. Buka halaman Kas Kecil, scroll ke bawah → lihat saldo akhir baris terakhir
2. Klik halaman 2 (jika ada) → saldo baris pertama halaman 2 harus sambung dari saldo akhir halaman 1
3. Ulangi untuk Kas Besar dan Bank Buku

**Angka yang diharapkan:** saldo berjalan tidak loncat/reset antara halaman.  
**Bug yang diperbaiki:** sebelumnya `LIMIT 2000` di SQL → saldo salah jika data > 2000 baris; kini tidak ada limit SQL.

### 2.2 Filter tanggal bekerja
- [ ] Filter `dari` dan `sampai` → hanya transaksi dalam rentang yang tampil
- [ ] Saldo di akhir periode filter sesuai rentang tersebut

---

## Modul 3 — Kontrol Piutang & Termin (`/piutang`)

### 3.1 Pelunasan piutang
1. Pilih proyek yang punya piutang (status termin < 100%)
2. POST pelunasan termin baru
3. Buka Jurnal Umum → cek 4 baris baru dengan noBukti yang sama:
   - Debit: akun Kas (entitas penerima)
   - Kredit: akun Piutang (entitas penerima)
   - Debit: akun Hutang (entitas pembayar)
   - Kredit: akun Kas (entitas pembayar)
4. Verifikasi kode COA per entitas:

| Entitas | Piutang | Hutang |
|---------|---------|--------|
| Gaharu | 111 | 311 |
| Kencana | 112 | 312 |
| Tataring | 113 | 313 |
| Cipta Asri | 114 | 314 |
| KP/Umum | 115 | 315 |

**Bug yang diperbaiki:** sebelumnya kode COA gaharu↔kencana tertukar (Bug A) dan ciptaAsri tidak cocok (Bug B).

### 3.2 Duplikat noBukti ditolak
- POST pelunasan dengan noBukti yang sama dua kali → respons pertama 201, respons kedua 409

---

## Modul 4 — Laporan Pendapatan / Rekap E-Faktur (`/pajak`)

### 4.1 POST faktur baru
1. Buat faktur baru dengan DPP = 1.000.000, DPP Nilai Lain = 900.900, Tarif PPN = 11%
2. Nilai yang harus terisi otomatis:
   - PPN = round(900.900 × 11%) = **99.099**
   - PPh = round(1.000.000 × 3,5%) = **35.000**
   - Nilai Proyek = round(1.000.000 × 111/100) = **1.110.000**

### 4.2 Edit faktur lama bertarif 11% — tarif harus tidak berubah
1. Buka faktur yang tarifPpn = 11%
2. Edit hanya `namaRekanan` (jangan ubah tarif)
3. Simpan → buka faktur → PPN harus **sama** dengan sebelumnya (tidak berubah ke 12%)

**Bug yang diperbaiki (A3):** sebelumnya PUT tanpa `tarifPpnPersen` menghitung ulang PPN pakai tarif terbaru (12%), merusak faktur lama.

### 4.3 Total periode dan rekap bulanan
- [ ] Total DPP/PPN/PPh/Nilai Proyek/Laba tampil di bawah tabel
- [ ] Rekap bulanan: setiap baris bulan punya angka yang wajar

---

## Modul 5 — Aktiva Tetap (`/aktiva-tetap`)

### 5.1 Kategori hanya 4 PSAK
- [ ] Dropdown kategori hanya menampilkan: **Tanah**, **Bangunan & Gedung**, **Kendaraan**, **Peralatan & Inventaris**
- [ ] Kategori lama (GEDUNG, MESIN, INVENTARIS, LAINNYA) **tidak boleh ada** di dropdown

### 5.2 TANAH tidak disusutkan
1. Buat aset baru kategori **Tanah**, Harga Perolehan = 500.000.000, Umur Ekonomis = 120 bulan
2. Simpan → lihat baris aset di tabel:
   - Beban Penyusutan = **Rp 0**
   - Akumulasi Penyusutan = **Rp 0**
   - Nilai Buku = **500.000.000** (= harga perolehan, tidak berkurang)
3. Kolom `Umur Ekonomis` di DB harus tersimpan sebagai **0** (bukan 120)

### 5.3 Field tahun awal
- [ ] Tabel aset menampilkan kolom `Akumulasi Penyusutan Awal Tahun` dan `Nilai Buku Awal Tahun`
- [ ] Untuk aset yang dibeli di tahun berjalan: `akumulasiAwalTahun = 0`, `nilaiBukuAwalTahun = hargaPerolehan`
- [ ] Untuk aset yang dibeli tahun sebelumnya: `akumulasiAwalTahun > 0`

### 5.4 Rekap per kategori
- [ ] Di bawah tabel aset, ada ringkasan per kategori (Tanah/Bangunan/Kendaraan/Peralatan)
- [ ] Total kolom `Nilai Buku` per kategori = jumlah nilai buku per aset dalam kategori itu

---

## Modul 6 — Laba Rugi (`/laporan` → Laba Rugi)

### 6.1 Angka Pendapatan dual-source
1. Catat angka **Total Pendapatan** saat ini
2. Buat faktur baru (DPP = 2.000.000, nilaiProyek = 2.220.000) tanpa mempostingnya ke Jurnal Transaksi
3. Refresh halaman Laba Rugi → **Total Pendapatan harus naik sebesar 2.220.000**
4. Ada baris tambahan "Pendapatan dari E-Faktur (belum dijurnal)" dengan angka tersebut

**Angka yang berubah:** Pendapatan naik = total nilaiProyek dari semua faktur yang belum punya jurnal terkait.

### 6.2 Tidak ada hitung ganda
1. Jurnal manual: POST transaksi ke akun COA PENDAPATAN, kredit = 2.220.000 (nominal sama persis), TANPA memilih faktur
2. Refresh Laba Rugi → Total Pendapatan harus **tetap sama** (tidak naik 2.220.000 lagi)
3. Baris "Pendapatan dari E-Faktur (belum dijurnal)" harus **hilang** (faktur terdeteksi sudah dijurnal)

**Bug yang diperbaiki:** sebelumnya kasus ini menyebabkan double-count — Total Pendapatan naik 2× nilaiProyek.

### 6.3 Beban Penyusutan (jika ada aset)
- [ ] Ada baris "Beban Penyusutan Aset Tetap (otomatis)" di bagian Beban
- [ ] Nilainya sesuai dengan perhitungan manual: (harga - residu) / umurBulan × bulan aktif tahun ini

---

## Modul 7 — Neraca (`/laporan` → Neraca)

### 7.1 Rekap aktiva tetap per kategori PSAK
- [ ] Di bagian Aktiva Tetap, ada 4 baris rekap: Tanah / Bangunan / Kendaraan / Peralatan Kantor
- [ ] Setiap baris: jumlah aset, harga perolehan, akumulasi, nilai buku neto
- [ ] TANAH: akumulasi = 0, nilai buku = harga perolehan

### 7.2 Neraca balance
- [ ] Total Aktiva = Total Kewajiban + Modal (selisih = 0 atau < Rp 1)
- [ ] Laba bersih sudah masuk ke kolom Modal (laba ditahan)

---

## Modul 8 — Profitabilitas Proyek (`/laporan` → Profitabilitas)

### 8.1 Spend dari COA BEBAN
- [ ] Kolom `Spend` per proyek mencerminkan total transaksi BEBAN yang dilink ke proyek tersebut di Jurnal Transaksi
- [ ] Jika tidak ada transaksi BEBAN terkait: kolom `Spend` pakai nilai dari tabel Proyek (fallback)

**Angka yang berubah:** jika ada selisih antara `Project.spend` (cache) dan total COA BEBAN aktual, angka di kolom `Spend` sekarang pakai COA (lebih akurat). Margin dan Profit ikut berubah.

### 8.2 Tes konsistensi
1. Catat `Spend` dan `Margin` untuk satu proyek
2. POST transaksi BEBAN baru untuk proyek itu, nominal Rp 500.000
3. Refresh Profitabilitas → `Spend` naik Rp 500.000, `Margin` turun

---

## Modul 9 — Laporan Keuangan Konsolidasi (`/laporan` → Laporan Keuangan)

### 9.1 Pendapatan konsolidasi
- [ ] Total Pendapatan = gabungan COA PENDAPATAN + faktur belum dijurnal semua entitas
- [ ] Tidak ada double-count (sama seperti Laba Rugi per entitas)

### 9.2 Rekap aktiva tetap di neraca konsolidasi
- [ ] Neraca konsolidasi punya breakdown aktiva tetap per kategori PSAK
- [ ] Total = jumlah semua entitas per kategori

---

## Modul 10 — Sinkronisasi Sidamon (`POST /api/sync/assignment`)

### 10.1 Respons syncBack
1. Kirim POST ke `/api/sync/assignment` (dari panel Sidamon atau via curl)
2. Respons JSON harus mengandung `"syncBack": {"success": true/false}`
3. Jika Sidamon tidak dapat dicapai: `"success": false`, sistem tetap return 200, proyek sudah dibuat
4. Error tercatat di ActivityLog (cek `/log`)

---

## Modul 11 — Auth & Notifikasi

### 11.1 Auth
- [ ] Login email+password berhasil, redirect ke dashboard
- [ ] Logout berfungsi, token terhapus
- [ ] Akses `/jurnal-transaksi` tanpa login → redirect ke `/login`

### 11.2 Badge notifikasi
- [ ] Badge merah muncul di sidebar jika ada notifikasi belum dibaca
- [ ] Klik notifikasi → status berubah jadi "dibaca", badge hilang atau berkurang

---

## Tabel Angka Referensi (DB Dev, Entitas Gaharu Sempana, 2026)

> Untuk verifikasi silang saat uji di lingkungan dev. Angka produksi berbeda.

| Metrik | Nilai di Dev |
|--------|-------------|
| Jumlah Transaction (total) | 56 baris |
| Jumlah FakturPendapatan | 2 faktur |
| Total Pendapatan COA (2026) | Rp 200.000.000 |
| Total Beban COA (2026) | Rp 29.696.126 |
| Laba Bersih COA saja (2026) | Rp 170.303.874 |
| Laba Bersih + faktur unlinked | lebih tinggi (tergantung faktur yang ada) |

---

## Checklist Regresi Cepat (5 menit)

Jika hanya punya waktu singkat, uji urutan ini:

1. **Login** → dashboard terbuka → angka tidak NaN ✓
2. **Jurnal Transaksi** → tambah 1 transaksi BEBAN → saldo berjalan naik ✓
3. **Rekap E-Faktur** → edit faktur bertarif 11% → PPN tidak berubah ke 12% ✓
4. **Aktiva Tetap** → tambah TANAH → beban penyusutan = 0 ✓
5. **Laba Rugi** → ada baris "E-Faktur belum dijurnal" jika ada faktur unlinked ✓
6. **Neraca** → Aktiva = Kewajiban + Modal (selisih ≈ 0) ✓
