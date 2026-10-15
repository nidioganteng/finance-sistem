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

> ✅ **Diputuskan: ikuti Node (4 kategori PSAK)** — implementasi selesai di commit `ee8b50c`.

Sistem sekarang hanya menerima: TANAH, BANGUNAN, KENDARAAN, PERALATAN_KANTOR.
Skrip migrasi tersedia di `tests/manual/migrate-aset-psak.sh` — jalankan di produksi setelah backup.

---

## Aset Tetap B — Migrasi data lama

> ✅ **Diputuskan: otomatis dengan aturan baku** — skrip migrasi dibuat di commit `ee8b50c`.

Peta: GEDUNG→BANGUNAN, MESIN/INVENTARIS/LAINNYA/PERALATAN→PERALATAN_KANTOR.
Jalankan `tests/manual/migrate-aset-psak.sh` di DB produksi **setelah backup** (Bagian 1 checklist deploy).

---

## Aset Tetap C — Tanah yang sudah disusutkan

> ✅ **Diputuskan: sistem PHP sekarang memaksa umurBulan=0 untuk TANAH** (commit `ee8b50c`).
> Input baru sudah aman. Untuk data lama (jika ada), jalankan query di bawah di produksi
> dan putuskan apakah perlu reset atau jurnal koreksi manual.

```sql
SELECT id, kode, nama, kategori, entityId,
       hargaPerolehan, nilaiResidu, umurBulan, tanggalPerolehan
FROM AsetTetap
WHERE kategori = 'TANAH' AND umurBulan > 0;
-- Jika ada baris: UPDATE AsetTetap SET umurBulan=0 WHERE kategori='TANAH';
```

---

## Aset Tetap D — Dampak ke Neraca

> ✅ **Diputuskan: rincian per kategori** — implementasi selesai di commit `3ae9539`.

`GET /api/neraca` sekarang menyertakan `rekapPerKategoriAset` dengan breakdown beban dan akumulasi per kategori TANAH/BANGUNAN/KENDARAAN/PERALATAN_KANTOR. Frontend bisa menampilkan 4 baris terpisah menggunakan field ini.

---

## A1 — Kelengkapan biaya proyek

> ✅ **Diputuskan: ikuti Node** — profitabilitas.php sekarang menghitung spend dari COA BEBAN
> per proyek (commit `d5107cd`), bukan dari Project.spend yang ter-cache.
> Field `spendSource` di response menunjukkan sumber data tiap proyek.
>
> Pertanyaan yang **masih terbuka untuk akuntan**: Apakah overhead kantor perlu dialokasikan
> ke proyek? Saat ini hanya biaya yang dilink ke projectId yang masuk. Jika ada overhead
> yang tidak dilink, angka profitabilitas hanya mencerminkan biaya langsung.

---

## A2 — Sumber data Laba Rugi

> ✅ **Diputuskan: ikuti Node (dual-source)** — laba-rugi.php dan laporan-keuangan.php
> sekarang menggabungkan COA PENDAPATAN + FakturPendapatan yang belum dijurnal
> (commit `7590f7a`, `511bba4`). Field `fakturUnlinked` di response menunjukkan
> berapa besar kontribusi dari faktur yang belum dijurnal.
>
> **Aksi manual yang perlu dilakukan di produksi:** Jalankan query keselarasan di bawah
> untuk mengetahui seberapa besar selisih antara COA dan faktur — agar bisa
> memperkirakan dampak perubahan ini pada angka Laba Rugi.

```sql
SELECT e.name,
       COALESCE(f.total_faktur, 0) AS pendapatan_dari_faktur,
       COALESCE(c.total_coa, 0)    AS pendapatan_dari_coa,
       COALESCE(f.total_faktur, 0) - COALESCE(c.total_coa, 0) AS selisih
FROM Entity e
LEFT JOIN (SELECT entityId, SUM(nilaiProyek) AS total_faktur FROM FakturPendapatan GROUP BY entityId) f ON f.entityId = e.id
LEFT JOIN (SELECT t.entityId, SUM(t.kredit) AS total_coa FROM `Transaction` t JOIN CoaAccount ca ON ca.id = t.coaAccountId WHERE ca.kategori='PENDAPATAN' GROUP BY t.entityId) c ON c.entityId = e.id
ORDER BY e.name;
```

---

## A3 — Tarif PPN untuk faktur lama

> ✅ **Sudah diperbaiki secara teknis** (commit `4045e38`). Tidak ada keputusan teknis lagi.
> Tindakan yang masih diperlukan: periksa apakah ada faktur yang sudah terlanjur rusak
> (diedit sebelum perbaikan), dan putuskan apakah perlu koreksi.

**Konteks perbaikan:** Sebelum commit `4045e38`, jika faktur lama (tarifPpn=11%) diedit tanpa mengisi ulang tarif, sistem menghitung ulang PPN menggunakan tarif terbaru (12%) secara diam-diam. Ini sudah diperbaiki: sistem sekarang membaca `tarifPpnPersen` yang tersimpan di database sebagai fallback — sama dengan perilaku Node.js (`pendapatan.ts:169-174`).

**Pertanyaan yang tersisa:** Apakah ada faktur lama yang PPN-nya sudah terlanjur dihitung ulang dengan tarif yang salah (12% padahal seharusnya 11%), dan apakah perlu dikoreksi?

**Query 1 — Faktur yang mungkin sudah rusak** (selisih antara ppn tersimpan vs ppn yang seharusnya):

```sql
-- Faktur dengan tarifPpn < 12 tetapi ppn tersimpan tampaknya dihitung pakai 12%
-- Indikator: ppn ≠ round(dppNilaiLain × tarifPpnPersen / 100)
SELECT
  noFaktur,
  masaPajak,
  tahunPajak,
  namaRekanan,
  dpp,
  dppNilaiLain,
  tarifPpnPersen                                        AS tarif_tersimpan,
  ppn                                                   AS ppn_tersimpan,
  ROUND(dppNilaiLain * tarifPpnPersen / 100, 0)         AS ppn_seharusnya,
  ppn - ROUND(dppNilaiLain * tarifPpnPersen / 100, 0)   AS selisih,
  createdAt,
  updatedAt
FROM FakturPendapatan
WHERE tarifPpnPersen < 12
  AND ABS(ppn - ROUND(dppNilaiLain * tarifPpnPersen / 100, 0)) > 1
ORDER BY tahunPajak, masaPajak;
```

**Query 2 — Semua faktur bertarif 11% untuk review:**

```sql
SELECT
  noFaktur, masaPajak, tahunPajak, namaRekanan,
  tarifPpnPersen, ppn,
  ROUND(dppNilaiLain * tarifPpnPersen / 100, 0) AS ppn_seharusnya,
  updatedAt
FROM FakturPendapatan
WHERE tarifPpnPersen < 12
ORDER BY tahunPajak, masaPajak;
```

**Tindakan jika ada selisih di Query 1:**

- Faktur yang perlu dikoreksi bisa diedit langsung di sistem — sekarang sistem sudah aman, edit tidak akan mengubah tarif.
- Atau akuntan buat catatan koreksi manual jika faktur sudah dilaporkan ke pajak.

**Pilihan jawaban:**

- **[x] Sudah diperbaiki** — jalankan Query 1 di produksi untuk melihat apakah ada faktur yang perlu dikoreksi manual.
- **[ ] Ada faktur rusak, perlu koreksi** — edit satu per satu lewat form, atau minta pengembang buat script koreksi batch.

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
