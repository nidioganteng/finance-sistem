# Temuan Terverifikasi — Modul PHP Sisa

> Dibuat dari verifikasi read-only Tahap A. Setiap klaim dibuktikan dengan file:baris.  
> Modul yang sudah selesai (piutang, jurnal-transaksi, pendapatan) tidak ada di sini.  
> aset-tetap ditunda menunggu keputusan tim.

---

## Tabel Temuan

| Modul | Temuan | Terbukti/Salah | Jenis | Risiko | Status |
|-------|--------|----------------|-------|--------|--------|
| **pengguna** | Temuan awal salah: `set_entity_access()` pakai pola DELETE-first (`pengguna.php:25`) → duplikat baru sudah mustahil. Tidak ada kode yang perlu diubah. Query diagnostik duplikat lama tersedia di PROGRESS.md | SALAH | TEKNIS | — | ✅ Selesai (koreksi temuan) — commit `9742960` |
| **log** | POST `/api/log` menerima field `action` dari client tanpa validasi — string bebas bisa dimasukkan | TERBUKTI | TEKNIS | RENDAH | ✅ Selesai — `log.php:13–17`, validasi panjang 3–200 dan karakter kontrol — commit `9742960` |
| **dokumen** | `unlink($filePath)` dipanggil tanpa cek return value saat DELETE — jika gagal, response tetap sukses dan record DB terhapus | TERBUKTI | TEKNIS | RENDAH | ✅ Selesai — `dokumen.php:154–156`, check return value + error 500 — commit `cab54e8` |
| **jurnal** | `page_size` hardcode 25 (`jurnal.php:83`), tidak ada parameter `limit` dari client | TERBUKTI | TEKNIS | RENDAH | ✅ Selesai — parameter `?limit=` (default 25, max 100) — commit `6bbc82d` |
| **kas** | `LIMIT 2000` hardcode di query ledger SQL (`kas.php:61`) — transaksi > 2000 terpotong diam-diam | TERBUKTI | TEKNIS | SEDANG | ✅ Selesai — LIMIT dihapus dari SQL; saldo berjalan tetap benar karena dihitung di PHP atas semua grup sebelum array_slice() — commit `0c329cf` |
| **buku-besar** | Running balance dihitung di PHP loop dengan `(float)` casting — potensi float drift | TERBUKTI | TEKNIS | RENDAH | ⏸ Ditunda — verifikasi dev DB: akun 1100 (15 transaksi, semua integer) tidak menunjukkan drift. Ubah hanya jika ada bukti drift di data produksi. |
| **sync** | Mapping entity hardcode di array PHP (`sync.php:31`) | TERBUKTI | TEKNIS | RENDAH | ⏸ Ditunda — risiko rendah, perubahan hanya diperlukan jika ada entitas baru di Sidamon. |
| **sync** | `curl_exec()` ke Sidamon tanpa cek return value (`sync.php:144`) | TERBUKTI | TEKNIS | RENDAH | ✅ Selesai — cek errno + HTTP status, log kegagalan, syncBack di response — commit `1ee355c` |
| **dashboard** | Float casting `(float)$row['pendapatan']` pada agregat revenue | TERBUKTI | TEKNIS | RENDAH | ⏸ Ditunda — aman untuk nilai < 1 miliar. bcmath hanya jika presisi laporan dipermasalahkan klien. |
| **profitabilitas** | Margin dihitung dari `Project.contractValue - Project.spend` saja | TERBUKTI | AKUNTANSI-PAJAK | SEDANG | ⏸ Menunggu konfirmasi tim (A1) |
| **laba-rugi** | PHP menarik Pendapatan dari COA PENDAPATAN; Node.js dari `FakturPendapatan.nilaiProyek`. Jika ada faktur yang tidak diposting ke jurnal, angka berbeda | TERBUKTI | AKUNTANSI-PAJAK | SEDANG | ⏸ Ditunda — perlu konfirmasi A2 dulu. Lihat data A2 di bagian Keputusan Tim. |
| **arus-kas** | PHP hanya endpoint GET dasar, Node.js punya `arus-kas-presisi.ts` + export Excel | TERBUKTI | UI | RENDAH | ⏸ Ditunda — logic cash flow PHP sudah benar. Export hanya jika diminta klien. |
| **neraca** | PHP tidak punya breakdown 4 kategori aktiva tetap (`neraca.php:~93`) | TERBUKTI | TEKNIS | SEDANG | ⏸ Ditunda — bergantung keputusan aset-tetap (A–D). Kerjakan setelah A–D diputuskan. |
| **laporan-keuangan** | PHP punya endpoint independen per laporan, potensi tidak sinkron — akan selesai setelah fix laba-rugi | TERBUKTI | TEKNIS | SEDANG | ⏸ Ditunda — bergantung konfirmasi A2 dan fix laba-rugi. |
| **pajak / validasi-3arah** | Tarif PPN tidak hardcode — diambil dari COA transaction langsung | TERBUKTI (parsial) | AKUNTANSI-PAJAK | SEDANG | ⏸ Menunggu konfirmasi tim (A3) |
| **payroll** | Field `ptkp` ada tapi PPh21 otomatis belum diimplementasi | TERBUKTI | TEKNIS | RENDAH | ⏸ Ditunda — tidak ada bug aktif. Feature future saat PPh21 otomatis diaktifkan. |
| **auth** | Rapi, tidak ada perbedaan material dengan Node.js | TERBUKTI | — | — | — |
| **coa** | Rapi | TERBUKTI | — | — | — |
| **entities** | Rapi | TERBUKTI | — | — | — |
| **saldo-awal** | Rapi | TERBUKTI | — | — | — |
| **jenis-input** | Rapi | TERBUKTI | — | — | — |
| **rekanan** | Rapi | TERBUKTI | — | — | — |
| **notifikasi** | Rapi | TERBUKTI | — | — | — |

---

## Ringkasan per Jenis

### TEKNIS — Tahap B selesai/ditunda

| # | Modul | Temuan | Status | Commit |
|---|-------|--------|--------|--------|
| T1 | pengguna | Duplikat UserEntityAccess | ✅ Temuan salah — sudah dicegah DELETE-first | — |
| T2 | log | Action field tidak divalidasi | ✅ Selesai | `9742960` |
| T3 | dokumen | `unlink()` tanpa error handling | ✅ Selesai | `cab54e8` |
| T4 | jurnal | page_size tidak bisa dikontrol client | ✅ Selesai | `6bbc82d` |
| T5 | kas | LIMIT 2000 hardcode tanpa pagination | ✅ Selesai | `0c329cf` |
| T6 | buku-besar | Float drift di running balance | ⏸ Ditunda — tidak terbukti di dev DB |
| T7 | sync | Entity mapping hardcode | ⏸ Ditunda — risiko rendah, ubah hanya jika entitas bertambah |
| T8 | sync | curl ke Sidamon tanpa error handling | ✅ Selesai | `1ee355c` |
| T9 | dashboard | Float casting agregat | ⏸ Ditunda — aman untuk nilai saat ini |
| T10 | neraca | 4 kategori aktiva tetap belum ada | ⏸ Ditunda — bergantung keputusan aset-tetap A–D |
| T11 | laporan-keuangan | Sinkronisasi bergantung fix laba-rugi | ⏸ Ditunda — bergantung konfirmasi A2 |
| T12 | payroll | ptkp ada tapi PPh21 otomatis belum diimplementasi | ⏸ Ditunda — tidak ada bug aktif |

### AKUNTANSI-PAJAK — perlu konfirmasi klien/akuntan

| # | Modul | Pertanyaan untuk tim | Data Dev |
|---|-------|---------------------|----------|
| A1 | profitabilitas | Apakah `Project.spend` mencerminkan SEMUA beban proyek termasuk overhead? | Dev DB: GHR-PWS-007 spend=13,063,063 = total BEBAN dari transaksi (selisih=0). `sync_project_spend()` berjalan benar. Konfirmasi: apakah ada beban overhead yang tidak di-link ke proyek? |
| A2 | laba-rugi | Apakah semua FakturPendapatan otomatis diposting ke COA PENDAPATAN? | Dev DB: Oct 2026 — FakturPendapatan nilaiProyek=100M, COA PENDAPATAN kredit=200M (selisih −100M). **Data dev tidak representatif** (ada transaksi manual yang mengembungkan COA). Perlu cek data produksi. |
| A3 | pajak/validasi-3arah | Apakah ada periode di mana PPN 12% dipakai dan perlu direkonsiliasi? | Dev DB: hanya 2 faktur Oct 2026 dengan PPN 12%. TarifPajak punya PPN 12% (active since 2025-01-01) dan PPN 11% (active since 2022-04-01), keduanya `active=1`. `get_tarif_ppn_aktif()` mengembalikan 12% (ORDER BY tanggalMulai DESC). |

### UI — tidak ada logic backend yang perlu berubah

| # | Modul | Status |
|---|-------|--------|
| U1 | arus-kas | ⏸ Ditunda — Export Excel hanya jika diminta klien |

---

## Query diagnostik T1 — duplikat lama UserEntityAccess

Jalankan di DB produksi (read-only, tidak ada efek):

```sql
SELECT userId, entityId, COUNT(*) AS cnt
FROM UserEntityAccess
GROUP BY userId, entityId
HAVING cnt > 1
ORDER BY cnt DESC;
```

Jika ada hasil, hapus duplikat dengan:

```sql
-- Preview dulu (baca saja):
SELECT id, userId, entityId, createdAt FROM UserEntityAccess
WHERE (userId, entityId) IN (
    SELECT userId, entityId FROM UserEntityAccess
    GROUP BY userId, entityId HAVING COUNT(*) > 1
)
ORDER BY userId, entityId, createdAt;
```
