# Paket Keputusan Tim — Sistem Keuangan Gaharu Sempana

> Dokumen ini ditujukan untuk rekan tim dan akuntan. Setiap item berisi
> satu pertanyaan yang perlu dijawab sebelum pengembang bisa melanjutkan
> perbaikan. Untuk setiap item tersedia query SQL yang bisa dijalankan
> di database produksi (hanya baca, tidak mengubah data).
>
> **Cara membaca pilihan jawaban:** pilih satu dan beritahu pengembang.
> Tidak perlu memahami teknis — cukup pahami pertanyaan bisnisnya.

---

## Daftar Item

1. [Aset Tetap A — Kategori](#aset-tetap-a--kategori)
2. [Aset Tetap B — Migrasi data lama](#aset-tetap-b--migrasi-data-lama)
3. [Aset Tetap C — Tanah yang sudah disusutkan](#aset-tetap-c--tanah-yang-sudah-disusutkan)
4. [Aset Tetap D — Dampak ke Neraca](#aset-tetap-d--dampak-ke-neraca)
5. [A1 — Kelengkapan biaya proyek](#a1--kelengkapan-biaya-proyek)
6. [A2 — Sumber data Laba Rugi](#a2--sumber-data-laba-rugi)
7. [A3 — Tarif PPN untuk faktur lama](#a3--tarif-ppn-untuk-faktur-lama)
8. [Koreksi data piutang lama (Bug A & B)](#koreksi-data-piutang-lama-bug-a--b)

---

## Aset Tetap A — Kategori

**Pertanyaan:** Apakah sistem keuangan akan mengikuti 4 kategori standar akuntansi (PSAK 16), atau tetap memakai 6 kategori yang sudah ada?

**Konteks:** Saat ini sistem memakai 6 kategori: KENDARAAN, PERALATAN, MESIN, GEDUNG, INVENTARIS, LAINNYA. Standar akuntansi Indonesia (PSAK 16) menyarankan 4 kategori: Tanah, Bangunan, Kendaraan, Peralatan Kantor — yang lebih umum dipakai untuk pelaporan ke kantor pajak dan auditor.

**Query untuk melihat sebaran aset saat ini:**

```sql
SELECT
  kategori,
  COUNT(*)             AS jumlah_aset,
  SUM(hargaPerolehan)  AS total_nilai_perolehan,
  SUM(CASE WHEN umurBulan > 0 THEN 1 ELSE 0 END) AS yang_disusutkan
FROM AsetTetap
GROUP BY kategori
ORDER BY kategori;
```

**Pilihan jawaban:**

- **[ ] Pakai 4 kategori PSAK** — pengembang akan migrasi kategori dan update semua form input.
- **[ ] Tetap 6 kategori** — tidak ada perubahan. Laporan akan terus pakai kategori custom.

---

## Aset Tetap B — Migrasi data lama

**Pertanyaan:** Jika memilih 4 kategori PSAK (item A), aset-aset lama seperti GEDUNG, MESIN, INVENTARIS, dan LAINNYA perlu dipindah ke kategori baru. Siapa yang melakukan pencocokan, dan bagaimana caranya?

**Konteks:** Tidak ada aturan baku untuk memetakan kategori lama ke baru — misalnya MESIN bisa masuk Kendaraan atau Peralatan Kantor tergantung jenis asetnya. Pengembang tidak bisa memutuskan ini sendirian karena butuh pengetahuan tentang aset fisik perusahaan.

**Query untuk melihat aset yang perlu dipindah:**

```sql
SELECT
  id, kode, nama, kategori, entityId,
  hargaPerolehan, tanggalPerolehan
FROM AsetTetap
WHERE kategori IN ('GEDUNG', 'MESIN', 'INVENTARIS', 'LAINNYA')
ORDER BY kategori, entityId;
```

**Pilihan jawaban:**

- **[ ] Manual per aset** — akuntan/admin mencocokkan satu per satu lewat form. Pengembang buat fitur edit kategori batch.
- **[ ] Otomatis dengan aturan baku** — GEDUNG→BANGUNAN, MESIN→PERALATAN_KANTOR, INVENTARIS→PERALATAN_KANTOR, LAINNYA→PERALATAN_KANTOR. Pengembang jalankan migration script.
- **[ ] Tunda** — tidak pindah dulu, sistem tetap pakai kategori lama.

---

## Aset Tetap C — Tanah yang sudah disusutkan

**Pertanyaan:** Ada aset bernama/berkode "Tanah" yang sudah dihitung penyusutannya. Menurut PSAK 16, Tanah tidak boleh disusutkan. Bagaimana menangani data yang sudah terlanjur dihitung?

**Konteks:** Sistem Node.js (versi baru) sudah mencegah Tanah disusutkan. Sistem PHP (versi Hostinger) belum punya penjagaan ini. Jika ada data Tanah dengan umurBulan > 0, nilai buku di neraca bisa lebih rendah dari seharusnya.

**Query untuk melihat aset Tanah yang terdampak:**

```sql
SELECT
  id, kode, nama, kategori, entityId,
  hargaPerolehan, nilaiResidu, umurBulan,
  tanggalPerolehan,
  ROUND(hargaPerolehan * (1 - (DATEDIFF(CURDATE(), tanggalPerolehan)/30) / umurBulan), 0) AS nilaiBuku_salah
FROM AsetTetap
WHERE (LOWER(nama) LIKE '%tanah%' OR LOWER(kode) LIKE '%tanah%')
  AND umurBulan > 0
ORDER BY entityId;
```

**Pilihan jawaban:**

- **[ ] Reset umurBulan ke 0** — penyusutan dihapus, nilai buku kembali ke harga perolehan. Neraca perlu disesuaikan.
- **[ ] Biarkan** — data lama dibiarkan apa adanya, hanya cegah input baru.
- **[ ] Koreksi jurnal** — akuntan buat jurnal koreksi manual untuk membalik akumulasi penyusutan yang salah.

---

## Aset Tetap D — Dampak ke Neraca

**Pertanyaan:** Setelah kategori aset tetap distandarkan (item A–C), apakah laporan Neraca perlu menampilkan rincian per kategori, atau cukup satu baris "Aset Tetap (neto)"?

**Konteks:** Sistem Node.js sudah menampilkan 4 baris terpisah di Neraca (Tanah, Bangunan, Kendaraan, Peralatan). Sistem PHP saat ini hanya menampilkan satu angka agregat. Rincian per kategori lebih informatif untuk audit, tapi butuh waktu pengembangan tambahan.

**Query untuk melihat nilai aset per kategori saat ini:**

```sql
SELECT
  kategori,
  SUM(hargaPerolehan)                                             AS harga_perolehan,
  SUM(hargaPerolehan * DATEDIFF(CURDATE(), tanggalPerolehan) /
      (umurBulan * 30))                                           AS akumulasi_penyusutan_estimasi,
  SUM(hargaPerolehan) -
  SUM(CASE WHEN umurBulan > 0
      THEN hargaPerolehan * LEAST(1, DATEDIFF(CURDATE(), tanggalPerolehan)/(umurBulan*30))
      ELSE 0 END)                                                 AS nilai_buku_estimasi
FROM AsetTetap
WHERE entityId IS NOT NULL
GROUP BY kategori
ORDER BY kategori;
```

**Pilihan jawaban:**

- **[ ] Rincian per kategori** — Neraca menampilkan baris terpisah. Pengembang update endpoint neraca.php setelah A–C selesai.
- **[ ] Satu baris agregat** — tidak ada perubahan pada Neraca.

---

## A1 — Kelengkapan biaya proyek

**Pertanyaan:** Apakah angka "Total Biaya" di halaman Profitabilitas sudah mencerminkan SEMUA pengeluaran untuk setiap proyek, termasuk biaya overhead kantor?

**Konteks:** Sistem menghitung biaya proyek hanya dari transaksi yang secara eksplisit dikaitkan ke proyek tertentu (via field `projectId` di jurnal transaksi). Biaya overhead seperti listrik kantor, sewa, gaji yang tidak dilink ke proyek spesifik tidak masuk hitungan profitabilitas proyek.

**Query untuk mengecek:**

```sql
-- Bandingkan Project.spend dengan total transaksi BEBAN yang ter-link ke proyek
SELECT
  p.code,
  p.name,
  p.spend                             AS spend_tersimpan,
  COALESCE(SUM(t.debit), 0)           AS total_beban_dari_transaksi,
  p.spend - COALESCE(SUM(t.debit), 0) AS selisih
FROM Project p
LEFT JOIN `Transaction` t ON t.projectId = p.id
  AND t.coaAccountId IN (
    SELECT id FROM CoaAccount WHERE kategori = 'BEBAN'
  )
WHERE p.status = 'ACTIVE'
GROUP BY p.id, p.code, p.name, p.spend
ORDER BY ABS(p.spend - COALESCE(SUM(t.debit), 0)) DESC
LIMIT 20;
```

**Pilihan jawaban:**

- **[ ] Ya, biaya proyek sudah lengkap** — setiap pengeluaran proyek selalu di-link ke proyek saat diinput di jurnal. Angka profitabilitas bisa dipercaya.
- **[ ] Tidak, ada biaya overhead yang tidak ter-link** — angka profitabilitas hanya biaya langsung. Perlu keputusan: apakah overhead dialokasikan ke proyek (dan dengan metode apa)?

---

## A2 — Sumber data Laba Rugi

**Pertanyaan:** Apakah setiap faktur pajak yang dibuat di modul Rekap E-Faktur otomatis tercatat sebagai transaksi pendapatan di Buku Besar (COA)?

**Konteks:** Laporan Laba Rugi di sistem PHP mengambil angka Pendapatan dari saldo akun COA PENDAPATAN di Buku Besar. Laporan yang ada di Node.js mengambil dari total Nilai Proyek di tabel faktur pajak. Jika faktur pajak tidak diposting ke Buku Besar, kedua laporan akan menunjukkan angka Pendapatan yang berbeda.

**Query untuk mengecek keselarasan:**

```sql
-- Bandingkan total Nilai Proyek per entitas dari faktur vs dari COA PENDAPATAN
SELECT
  e.name                        AS entitas,
  COALESCE(f.total_faktur, 0)   AS pendapatan_dari_faktur,
  COALESCE(c.total_coa, 0)      AS pendapatan_dari_coa,
  COALESCE(f.total_faktur, 0) - COALESCE(c.total_coa, 0) AS selisih
FROM Entity e
LEFT JOIN (
  SELECT entityId, SUM(nilaiProyek) AS total_faktur
  FROM FakturPendapatan
  GROUP BY entityId
) f ON f.entityId = e.id
LEFT JOIN (
  SELECT t.entityId, SUM(t.kredit) AS total_coa
  FROM `Transaction` t
  JOIN CoaAccount ca ON ca.id = t.coaAccountId
  WHERE ca.kategori = 'PENDAPATAN'
  GROUP BY t.entityId
) c ON c.entityId = e.id
ORDER BY e.name;
```

**Pilihan jawaban:**

- **[ ] Selisih = 0 (atau bisa dijelaskan)** — faktur dan COA sinkron, atau ada penjelasan logis untuk selisihnya. Laporan Laba Rugi PHP bisa dipercaya.
- **[ ] Ada selisih signifikan** — faktur tidak otomatis diposting ke COA, atau ada entri manual yang mengembungkan salah satu sisi. Perlu diselesaikan sebelum Laba Rugi PHP dipakai untuk pelaporan resmi.

---

## A3 — Tarif PPN untuk faktur lama

**Pertanyaan:** Untuk faktur-faktur lama dari tahun 2022–2024 yang dibuat saat tarif PPN masih 11%, apakah angka PPN-nya sudah benar dan perlu dijaga agar tidak berubah jika diedit?

**Konteks:** Sistem saat ini menyimpan tarif PPN per faktur (`tarifPpnPersen`) di database — jadi angka yang sudah tersimpan aman. Namun ada celah: jika faktur lama (tarifPpn=11%) diedit dan pengguna tidak secara eksplisit mengisi ulang tarif, sistem akan menghitung ulang PPN-nya menggunakan tarif terbaru (12%). Ini bisa mengubah angka PPN faktur lama secara diam-diam.

**Analisis teknis** (info untuk pengembang — tidak perlu dibaca akuntan):
- `get_tarif_ppn_aktif()` dipanggil di `pendapatan.php:237` (POST baru) dan `pendapatan.php:295` (PUT edit)
- Fungsi ini selalu mengambil tarif terbaru (`ORDER BY tanggalMulai DESC LIMIT 1`), tidak mempertimbangkan tanggal/masa pajak faktur
- Untuk POST: `tarifPpnPersen` adalah field **wajib** — jadi tarif dari DB tidak pernah dipakai saat membuat faktur baru, user selalu memasukkan tarif
- Untuk PUT: jika request edit tidak menyertakan `tarifPpnPersen`, kalkulasi ulang ppn/nilaiProyek/laba menggunakan tarif dari DB (12%) meski faktur aslinya 11%

**Query untuk melihat faktur dengan tarifPpn < 12%:**

```sql
SELECT
  noFaktur,
  masaPajak,
  tahunPajak,
  namaRekanan,
  dpp,
  tarifPpnPersen,
  ppn,
  ROUND(dpp * tarifPpnPersen / 100, 0) AS ppn_dihitung_ulang,
  ppn - ROUND(dpp * tarifPpnPersen / 100, 0) AS selisih_ppn,
  updatedAt
FROM FakturPendapatan
WHERE tarifPpnPersen < 12
ORDER BY tahunPajak, masaPajak;
```

**Pilihan jawaban:**

- **[ ] Lindungi faktur lama** — saat mengedit, sistem harus membaca `tarifPpnPersen` yang tersimpan di DB sebagai fallback (bukan tarif terbaru). Pengembang akan fix logika PUT.
- **[ ] Biarkan** — pengguna harus selalu memilih tarif secara manual saat edit. Risiko: kalkulasi salah jika lupa mengisi tarif saat mengedit faktur lama.

---

## Koreksi data piutang lama (Bug A & B)

**Pertanyaan:** Ada transaksi pelunasan piutang lama yang kemungkinan menggunakan kode COA yang salah akibat dua bug yang sudah diperbaiki. Apakah perlu dilakukan koreksi jurnal untuk transaksi-transaksi tersebut?

**Konteks:** Dua bug ditemukan dan diperbaiki: (Bug A) kode COA untuk entitas Gaharu dan Kencana tertukar satu sama lain, dan (Bug B) transaksi entitas Cipta Asri tidak bisa ditemukan karena salah penulisan nama. Transaksi lama yang dibuat sebelum perbaikan tidak diubah — perlu diperiksa apakah ada yang terdampak dan apakah perlu jurnal koreksi.

**Query untuk melihat transaksi yang mungkin terdampak:**

```sql
-- Transaksi pelunasan piutang yang melibatkan Gaharu atau Kencana
-- (Bug A: kode COA bisa tertukar di transaksi sebelum commit 7d7ec8f)
SELECT
  t.id,
  t.tanggal,
  t.noBukti,
  t.keterangan,
  e.name          AS entitas,
  ca.code         AS kode_coa,
  ca.name         AS nama_coa,
  t.debit,
  t.kredit,
  t.createdAt
FROM `Transaction` t
JOIN Entity e ON e.id = t.entityId
JOIN CoaAccount ca ON ca.id = t.coaAccountId
WHERE e.`key` IN ('gaharu', 'kencana', 'ciptaAsri')
  AND t.keterangan LIKE '%piutang%'
  AND t.createdAt < '2025-01-01'   -- sebelum perbaikan; sesuaikan tanggal jika perlu
ORDER BY t.createdAt DESC
LIMIT 50;
```

```sql
-- Cek apakah COA piutang/hutang antar-entitas masih balance
-- (saldo Gaharu = saldo Kencana dalam tanda berlawanan)
SELECT
  e.name AS entitas,
  ca.code,
  ca.name,
  SUM(t.debit) - SUM(t.kredit) AS saldo_neto
FROM `Transaction` t
JOIN Entity e ON e.id = t.entityId
JOIN CoaAccount ca ON ca.id = t.coaAccountId
WHERE ca.code IN ('111', '112', '113', '310', '311', '312', '1200', '1300')
GROUP BY e.name, ca.code, ca.name
ORDER BY ca.code, e.name;
```

**Pilihan jawaban:**

- **[ ] Perlu koreksi** — akuntan buat jurnal koreksi manual untuk transaksi yang salah COA. Pengembang tidak perlu mengubah kode, hanya perlu akses input jurnal untuk koreksi.
- **[ ] Tidak perlu** — transaksi lama dibiarkan apa adanya karena sudah dilaporkan atau nilainya tidak material.
- **[ ] Cek dulu** — jalankan query di atas, review hasilnya, baru putuskan.

---

*Dokumen ini dibuat otomatis dari hasil verifikasi kode. Pertanyaan teknis: tanyakan ke pengembang.*
