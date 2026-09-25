# ALUR_DAN_RUMUS_LAPORAN_KEUANGAN.md

**Catatan**: seluruh nama, entitas, dan angka di dokumen ini FIKTIF (dummy), aman untuk disimpan di repository/git. Dokumen ini menjelaskan pola dan mekanisme yang berlaku umum, bukan data klien mana pun.

## Tujuan Dokumen
Referensi lengkap alur dan rumus laporan keuangan: dari Jurnal Umum sampai ke Laba Rugi, Neraca, dan Arus Kas, termasuk mekanisme Komersial vs Fiskal, mode Internal vs Final, dan presentasi Arus Kas yang di-netting. Dipakai sebagai acuan bareng file `DUMMY_Sistem_Keuangan_Contoh.xlsx` dan file-file `CLAUDE_*.md` lain di project ini.

---

## 0. Tiga Sumber Data yang Perannya Beda

| Sumber | Isinya | Analogi |
|---|---|---|
| **Jurnal Umum** | Transaksi sungguhan (tiap kejadian Debet/Kredit) | Mutasi rekening hari ini |
| **Daftar Akun** (Bagan Akun/COA) | (a) Saldo Awal tiap akun, (b) Kelompok akun yang menentukan arah Debet/Kredit | Saldo tabungan sebelum hari ini + aturan bank |
| **Buku Besar** | Hasil hitungan, tidak ada input manual sama sekali | Angka di layar ATM |

```
Saldo Akhir (Buku Besar) = Saldo Awal (Daftar Akun)
                            + SUM(Debet dari Jurnal Umum, akun ini)
                            − SUM(Kredit dari Jurnal Umum, akun ini)
                            [dibalik arahnya kalau Kelompok = Kewajiban/Modal/Pendapatan]
```

Implikasi: tabel Daftar Akun di database wajib punya kolom `saldo_awal` dan `kelompok_akun` sendiri, Buku Besar tidak bisa dihitung benar tanpa dua informasi itu.

---

## 1. Alur Dasar: Jurnal Umum → Buku Besar → Laba Rugi/Neraca → Arus Kas

Contoh dummy "CV Contoh Makmur", satu transaksi: bayar gaji Rp5.000.000 tunai.

1. **Jurnal Umum**: Debet "Beban Gaji" Rp5.000.000, Kredit "Kas" Rp5.000.000
2. **Buku Besar**: saldo akun "Beban Gaji" dan "Kas" ter-update otomatis (SUMIF dari semua transaksi periode berjalan + Saldo Awal dari Daftar Akun)
3. **Laba Rugi**: akun "Beban Gaji" (kelompok Beban) ikut mengurangi Laba Bersih
4. **Neraca**: akun "Kas" (kelompok Aset) langsung tampil di sisi Aktiva; Laba Bersih dari langkah 3 masuk ke Neraca sebagai "Laba Tahun Berjalan" di sisi Modal
5. **Arus Kas**: transaksi ini (kas keluar untuk beban operasional) ikut membentuk angka "Kas dari Aktivitas Operasi"

Logika Debet/Kredit otomatis (staf cukup pilih "Uang Masuk"/"Uang Keluar", sistem yang tentukan sisi):
- Kelompok **Aset** atau **Beban** naik → Debet
- Kelompok **Kewajiban**, **Modal**, atau **Pendapatan** naik → Kredit

---

## 2. Penyusutan (Contoh Dummy)

Jadwal penyusutan tersimpan terpisah (tabel `aset_tetap`), BUKAN diketik manual tiap bulan:

| Nama Aset | Harga Perolehan | Umur Ekonomis | Metode | Penyusutan/Bulan |
|---|---|---|---|---|
| Kendaraan Operasional | Rp40.000.000 | 48 bulan | Garis Lurus | `=Harga Perolehan / Umur Ekonomis` = Rp833.333 |

Tiap akhir bulan, sistem (bukan staf) generate otomatis baris Jurnal Umum: Debet "Beban Penyusutan" Rp833.333, Kredit "Akumulasi Penyusutan" Rp833.333. Akun "Akumulasi Penyusutan" ini kelompoknya **Kontra Aset** — walau di bawah Aset, arah hitungnya kebalik (naik lewat Kredit, seperti Kewajiban), karena fungsinya mengurangi nilai aset di Neraca (`Aset Tetap Bersih = Harga Perolehan − Akumulasi Penyusutan`).

---

## 3. Laba Rugi — Dua Kolom: Komersial vs Fiskal

Selain kolom hasil akhir biasa, Laba Rugi idealnya punya dua versi berdampingan:
- **Komersial**: sesuai standar akuntansi biasa, dipakai internal
- **Fiskal**: Komersial dikurangi Koreksi Fiskal, dipakai untuk pelaporan pajak

**Contoh dummy**: "Beban Konsumsi" tercatat Rp300.000 secara Komersial. Menurut aturan pajak, katakanlah cuma Rp200.000 yang boleh diakui sebagai beban (sisanya dianggap konsumsi pribadi, tidak boleh mengurangi pajak). Maka:

| Akun | Komersial | Koreksi Fiskal | Fiskal |
|---|---|---|---|
| Beban Konsumsi | Rp300.000 | Rp100.000 | Rp200.000 |

Rumus: `Fiskal = Komersial − Koreksi Fiskal`. Kalau tidak ada koreksi di suatu baris, Koreksi = 0 dan Fiskal otomatis sama dengan Komersial (ini kondisi paling umum, koreksi cuma muncul di baris-baris tertentu sesuai aturan pajak yang berlaku).

---

## 4. Neraca & Laba Rugi — Dua Mode: Internal vs Final

Selain isi angkanya, laporan juga perlu dibedakan berdasarkan **status waktu**:

- **Mode Internal** (live): terus ter-update mengikuti transaksi berjalan, dipakai Manajer Keuangan untuk pantau kondisi kapan saja, sebelum periode ditutup.
- **Mode Final** (snapshot): versi resmi yang "dibekukan" begitu Close Book dilakukan di akhir periode. Setelah dibekukan, angka ini tidak berubah lagi walau ada transaksi susulan di periode berikutnya.

**Contoh dummy**: pertengahan Januari, Manajer Keuangan buka Neraca mode Internal, Kas menunjukkan Rp18.000.000 (posisi hari itu, masih akan berubah). Akhir Januari, setelah Close Book, sistem membuat snapshot "Neraca Januari 2026 (Final)" dengan Kas Rp31.500.000 (angka yang sudah final, tidak berubah lagi biarpun ada transaksi baru masuk Februari).

**Penting**: ini BUKAN dua rumus yang beda (bedanya cuma di poin 0-2), ini soal KAPAN datanya dibekukan. Idealnya satu mesin hitung yang sama, dengan snapshot otomatis tersimpan tiap Close Book — bukan disalin manual seperti kebiasaan di Excel.

---

### 4.1 Neraca: Versi Internal (Gross) vs Versi Umum (Netted Antar Entitas)

Selain pembedaan waktu, Neraca juga memiliki perbedaan penyajian untuk **Internal** vs **Umum (Eksternal)**:

- **Versi Internal (Gross)**:
  Seluruh akun piutang dan hutang antar entitas (inter-entity) ditampilkan secara utuh (*gross*). Contoh: Kencana mencatat `[112] PIUTANG GS: Rp 100.000.000` di Aktiva Lancar dan `[312] Hutang GS: Rp 50.010.000.000` di Kewajiban. Keduanya muncul bersamaan agar tim internal memiliki jejak audit lengkap antara pinjaman modal kerja vs talangan operasional.

- **Versi Umum (Netted — "Yang Paling Besar yang Dimasukkan")**:
  Untuk kebutuhan pelaporan eksternal (bank, auditor, pajak), transaksi bolak-balik antar entitas berelasi disajikan secara bersih (*netted*) per pasangan entitas rekanan:
  1. **Jika Hutang > Piutang**: Akun Hutang dimasukkan di sisi Kewajiban sebesar nilai selisihnya (`Hutang - Piutang`), sedangkan akun Piutang menjadi Rp 0 (tidak ditampilkan).
     *Contoh*: Kencana memiliki Hutang GS Rp 50,01 Miliar dan Piutang GS Rp 100 Juta $\rightarrow$ Yang muncul di Neraca Umum hanyalah **Hutang GS: Rp 49.910.000.000** di Kewajiban.
  2. **Jika Piutang > Hutang**: Akun Piutang dimasukkan di sisi Aktiva Lancar sebesar nilai selisihnya (`Piutang - Hutang`), sedangkan akun Hutang menjadi Rp 0 (tidak ditampilkan).
     *Contoh*: Gaharu memiliki Piutang KAK Rp 50,01 Miliar dan Hutang KAK Rp 100 Juta $\rightarrow$ Yang muncul di Neraca Umum hanyalah **PIUTANG KAK: Rp 49.910.000.000** di Aktiva Lancar.
  3. **Keseimbangan Neraca**: Karena kedua sisi (Aktiva & Pasiva) berkurang dengan angka yang sama persis (`min(Piutang, Hutang)`), formula Neraca tetap **100% seimbang (Total Aktiva = Total Pasiva)**.


---

## 5. Arus Kas — Presentasi Netted per Pihak Terkait

Kalau ada piutang DAN hutang ke pihak yang sama, sebaiknya digabung jadi satu baris bersih di Arus Kas, bukan ditampilkan dua baris terpisah.

**Contoh dummy**: CV Contoh Makmur punya hubungan dagang dengan "Mitra Bisnis A". Selama periode berjalan:
- Piutang ke Mitra A naik Rp500.000 (mengurangi kas, karena itu pendapatan yang belum jadi uang tunai)
- Hutang ke Mitra A juga naik Rp800.000 (menambah kas, karena itu pembelian yang belum dibayar tunai)

**Cara gross (dua baris terpisah):**
| Baris | Nilai |
|---|---|
| Piutang - Mitra A | -Rp500.000 |
| Hutang - Mitra A | +Rp800.000 |

**Cara netted (satu baris gabungan, direkomendasikan):**
| Baris | Nilai |
|---|---|
| Piutang & Utang Bersih - Mitra A | +Rp300.000 |

Totalnya sama (-500.000+800.000 = 300.000), cuma beda cara tampil. **Pakai label yang jujur** ("Piutang & Utang Bersih - [Nama Pihak]"), jangan pakai label yang cuma menyebut salah satu sisi padahal isinya gabungan keduanya, itu bisa membingungkan pembaca laporan.

---

## 6. Validasi Silang yang Wajib Ada

1. **Neraca seimbang**: Total Aktiva = Total Kewajiban + Modal
2. **Laba Rugi ↔ Neraca**: Laba/Rugi Bersih (Laba Rugi) = Laba Tahun Berjalan (Neraca, sisi Modal) — harus angka yang PERSIS sama
3. **Neraca ↔ Arus Kas**: Kas Akhir Periode (Arus Kas) = Kas + Bank di Neraca — harus angka yang PERSIS sama

Kalau salah satu dari tiga ini pecah setelah sistem jalan, itu tanda ada bug di rumus, bukan sekadar beda pembulatan. Tambahkan indikator visual otomatis (warna merah/ikon peringatan) di UI kalau validasi ini gagal.

---

## 7. Catatan Implementasi Next.js + MySQL

- Pola `SUMIF` per akun → jadi `SUM(...) WHERE kode_akun = ? AND entitas_id = ? AND tanggal BETWEEN ? AND ?` di query SQL.
- Jadwal Penyusutan → tabel `aset_tetap` tersendiri, dengan job terjadwal yang generate baris Jurnal Umum otomatis tiap akhir bulan.
- Mode Internal vs Final → satu service/fungsi hitung yang sama, dipanggil live untuk mode Internal, dan dipanggil sekali lagi lalu disimpan sebagai snapshot read-only saat Close Book untuk mode Final. Simpan juga kapan dan siapa yang men-Close Book (untuk audit trail).
- Presentasi netted di Arus Kas → dihitung di layer service (gabungkan piutang+hutang per entitas terkait sebelum ditampilkan), bukan disimpan sebagai baris terpisah di database.
