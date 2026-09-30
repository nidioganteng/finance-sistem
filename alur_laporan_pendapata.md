# CLAUDE_LAPORANPENDAPATAN.md

## Konteks Halaman
Halaman **Laporan Pendapatan** (di data asli klien disebut "REKAP E-FAKTUR"), bagian dari Sistem Data Keuangan Gaharu Sempana Group. Ini **beda alur** dari Neraca/Laba Rugi/Arus Kas yang semuanya bersumber dari Buku Besar. Laporan Pendapatan adalah **sumber data sendiri, terpisah**, dicatat per **faktur pajak** (bukan per transaksi kas seperti Kas Kecil/Kas Besar/Bank Buku), baru di ujung nyambung ke Laba Rugi sebagai angka Pendapatan.

Dokumen ini disusun dari hasil membaca langsung sheet `PENDAPATAN` di file Excel asli klien (`LAPORAN_KEUANGAN_TB_2026.xlsx`), bukan asumsi.

---

## 1. Input: Data per Faktur Pajak (diisi Staf Keuangan/Admin Pajak)

Satu baris = satu transaksi penjualan/proyek yang sudah terbit faktur pajaknya.

| Field | Tipe | Wajib | Catatan |
|---|---|---|---|
| NPWP | text | ya | NPWP klien/rekanan |
| No. Faktur | text | ya | Nomor e-faktur pajak resmi |
| Masa Pajak | select (bulan) | ya | Bulan pajak terkait transaksi ini |
| Nama Rekanan | text | ya | Nama klien (sering instansi pemerintah di data asli, misal RSUD) |
| Nama JKP | text | ya | Deskripsi jasa/pekerjaan yang difakturkan |
| DPP | number | ya | Dasar Pengenaan Pajak, nilai sebelum pajak |
| DPP Nilai Lain | number | ya | Varian DPP, dipakai basis hitung PPN (beda dari DPP biasa) |
| Kode Jenis Proyek | select | ya | 1 = Perencanaan, 2 = Pengawasan |
| Pekerjaan Perusahaan | number, opsional | tidak | Porsi nilai pekerjaan milik entitas sendiri |
| Pekerjaan yang Dipinjam | number, opsional | tidak | Porsi nilai pekerjaan pakai bendera/lisensi entitas lain dalam grup |
| Tanggal Terima | date | ya | Tanggal uang benar-benar diterima di bank |
| Bank | select | ya | Rekening tujuan pembayaran (BRI/BPD/MDR/BNI dst, tergantung entitas) |
| Nominal Diterima | number | ya | Nominal yang benar-benar cair ke rekening |
| Kode Proyek | select, opsional | tidak | Dari daftar proyek Kontrol Piutang & Termin, kalau terkait proyek berkontrak |

⚠️ **Perhatikan**: kolom Tanggal Terima/Bank/Nominal Diterima berarti laporan ini juga melacak kapan dan ke rekening mana uang benar-benar cair, terpisah dari nilai tagihan (DPP). Ini pola yang sama dengan aturan di `CLAUDE_KONTROLPIUTANGTERMIN.md` (termin baru dicatat setelah dana benar-benar masuk kas/bank). **Rekomendasi**: field ini idealnya terhubung ke transaksi Bank Buku yang sudah ada (pilih transaksi penerimaan yang sudah tercatat), bukan diketik ulang manual terpisah, supaya tidak dobel pencatatan dan tidak ada risiko selisih antara Bank Buku dan Laporan Pendapatan.

---

## 2. Proses Otomatis: Perhitungan Pajak per Faktur

Staf tidak perlu hitung manual, sistem otomatis menghitung begitu DPP dan DPP Nilai Lain diisi:

| Field Hasil | Formula | Arti |
|---|---|---|
| PPN | `= DPP Nilai Lain × tarif PPN` | Pajak Pertambahan Nilai |
| PPh | `= DPP × 3.5%` | Pajak penghasilan final jasa konstruksi |
| Nilai Proyek | `= DPP × 111/100` | Nilai kontrak digenapkan termasuk pajak |
| Laba Setelah Pajak | `= Nilai Proyek − PPN − PPh` | Laba bersih per faktur setelah potongan pajak |

⚠️ **Temuan dari data asli**: tarif PPN yang dipakai **tidak konsisten** antar baris (ada yang 12%, ada yang 11%). Kemungkinan ini mengikuti perubahan tarif PPN resmi pemerintah di periode berbeda. **Jangan hardcode satu tarif tetap di sistem baru.** Tarif PPN harus jadi parameter yang bisa diatur per periode (misal tabel `tarif_pajak` dengan kolom tanggal_mulai_berlaku dan besaran_tarif), supaya kalau tarif berubah lagi di masa depan, tidak perlu ubah kode, cukup tambah baris data. **Perlu dikonfirmasi ke klien/akuntan**: kapan pastinya masing-masing tarif berlaku, supaya data historis tetap benar.

---

## 3. Output: Tiga Lapis Rekap

### 3.1 Total Periode
Jumlah semua faktur dalam satu periode (DPP, DPP Nilai Lain, PPN, PPh, Nilai Proyek, Laba Setelah Pajak), ditotal di baris akhir tabel.

### 3.2 Rekap Bulanan
Agregasi otomatis (jumlah DPP dan PPN) per bulan (Januari-Desember), untuk pemantauan tren pendapatan bulanan.

### 3.3 Rekonsiliasi vs Dilaporkan ke Pajak
Ini **fitur audit kepatuhan pajak**, bukan sekadar rekap keuangan:
- Ada input terpisah "DPP Terlapor" dan "Pajak Terlapor" per bulan (nilai yang benar-benar dilaporkan resmi ke kantor pajak, bisa beda dari hasil rekap otomatis kalau ada faktur yang telat/belum dilaporkan)
- Sistem hitung **Selisih** = (DPP hasil rekap faktur) − (DPP Terlapor)
- Kalau Selisih ≠ 0 di bulan manapun → indikasi ada faktur yang belum/salah dilaporkan ke pajak, perlu ditindaklanjuti oleh Manajer Keuangan

**Rekomendasi UI**: tampilkan tabel rekonsiliasi ini dengan indikator visual (warna merah/kuning) di bulan yang Selisih-nya bukan nol, supaya langsung kelihatan tanpa harus baca angka satu-satu.

---

## 4. Ke Mana Alirannya Setelah Ini

**Total Nilai Proyek** (dari bagian 3.1) adalah angka yang seharusnya menjadi **Pendapatan** di Laba Rugi.

⚠️ **Bug yang sudah ditemukan sebelumnya (lihat `DOKUMENTASI_LR_NERACA_ARUSKAS_ASLI.md` bagian 4)**: di Excel asli klien, Laba Rugi **tidak** menarik total dari sheet Pendapatan ini. Baris Pendapatan di Laba Rugi malah menarik dari Daftar Akun lewat link yang putus, hasilnya Rp0, padahal nilai asli dari sheet Pendapatan adalah Rp160.938.123. Ini menyebabkan Rugi Bersih yang tercatat jadi lebih besar (rugi) dari yang seharusnya.

**Wajib untuk sistem baru**: pastikan baris Pendapatan di Laba Rugi menarik langsung dari total Laporan Pendapatan ini (atau dari akumulasi Buku Besar kalau tiap faktur juga otomatis digenerate jadi baris Jurnal Umum), **jangan replikasi jalur Daftar Akun yang putus** seperti di Excel lama.

---

## 5. Konsep Bisnis yang Perlu Dipertahankan: Pekerjaan Perusahaan vs Pekerjaan yang Dipinjam

Split "Pekerjaan Perusahaan" vs "Pekerjaan yang Dipinjam" tidak ada di laporan lain manapun yang sudah dibahas sebelumnya. Ini kemungkinan terkait praktik "pinjam bendera" (satu entitas mengerjakan proyek pakai lisensi/nama entitas lain dalam grup), yang berpotensi menghasilkan aliran uang antar entitas yang harus tercatat juga di Laporan Hutang Piutang (`CLAUDE_HUTANGPIUTANG.md`).

**Perlu dikonfirmasi ke klien**: kalau satu faktur punya porsi "Pekerjaan yang Dipinjam", apakah itu otomatis harus menghasilkan entri Hutang/Piutang antar entitas juga (misal Entitas A "berhutang" bagi hasil ke Entitas B yang bendera lisensinya dipakai)? Kalau ya, ini perlu jadi proses otomatis lanjutan, bukan cuma field informasi pasif di form.

---

## 6. Bug/Risiko Tambahan Ditemukan Khusus di Sheet Ini (jangan direplikasi)

| Temuan | Masalah | Rekomendasi |
|---|---|---|
| Formula `#REF!` di baris rekap tahunan | Sisa referensi ke baris/sheet yang sudah dihapus, tidak dibersihkan | Jangan biarkan error formula tersimpan; validasi tiap kali struktur data berubah |
| Dua nilai hardcode manual tanpa formula (di baris dekat rekap tahunan) | Tidak bisa ditelusuri asalnya, mirip pola Modal Saham/Laba Ditahan di Neraca | Kalau memang perlu angka pembuka/carry-over, buat field input resmi dengan jejak (siapa isi, kapan), bukan sel bebas ketik |
| Rentang SUMIF rekap bulanan tidak konsisten antar bulan | Berpotensi salah hitung begitu data bertambah banyak (rentang yang lebih pendek tidak mencakup baris baru) | Di sistem baru, agregasi bulanan harus query dinamis berdasarkan field Masa Pajak, bukan rentang sel tetap |
| Total rekap bulanan PPN melewatkan bulan Januari | Kemungkinan salah ketik rentang SUM | Uji query agregasi dengan data 12 bulan penuh, pastikan semua bulan ikut terhitung |

---

## 7. Tugas untuk Claude Code

1. Bangun form input Laporan Pendapatan sesuai field di bagian 1, dengan kalkulasi otomatis PPN/PPh/Nilai Proyek/Laba Setelah Pajak sesuai bagian 2.
2. Buat tarif PPN dan PPh sebagai data terkonfigurasi per periode (bukan hardcode), sesuai catatan di bagian 2.
3. Field Tanggal Terima/Bank/Nominal Diterima idealnya memilih dari transaksi Bank Buku yang sudah ada (bukan input manual terpisah), untuk mencegah dobel pencatatan. Kalau belum memungkinkan di fase ini, minimal beri validasi silang: total Nominal Diterima di Laporan Pendapatan harus bisa direkonsiliasi dengan mutasi masuk di Bank Buku entitas terkait.
4. Bangun 3 lapis output sesuai bagian 3: Total Periode, Rekap Bulanan, dan Rekonsiliasi vs Dilaporkan ke Pajak (dengan indikator visual untuk Selisih ≠ 0).
5. **Perbaiki bug penghubung ke Laba Rugi** (bagian 4): pastikan angka Pendapatan di Laba Rugi menarik dari total Laporan Pendapatan ini, jangan dari jalur Daftar Akun yang di Excel asli ternyata putus.
6. Query agregasi bulanan harus dinamis berdasarkan field Masa Pajak per baris, bukan rentang sel tetap seperti di Excel asli (lihat bagian 6), supaya tidak berulang bug yang sama saat data bertambah.
7. **Konfirmasi ke klien** soal Pekerjaan yang Dipinjam (bagian 5): apakah perlu otomatis menghasilkan entri di Hutang Piutang antar entitas. Jangan bangun otomatisasi ini sebelum dikonfirmasi, cukup sediakan field-nya dulu sebagai informasi pasif.