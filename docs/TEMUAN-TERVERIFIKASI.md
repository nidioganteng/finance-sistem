# Temuan Terverifikasi — Modul PHP Sisa

> Dibuat dari verifikasi read-only Tahap A. Setiap klaim dibuktikan dengan file:baris.  
> Modul yang sudah selesai (piutang, jurnal-transaksi, pendapatan) tidak ada di sini.  
> aset-tetap ditunda menunggu keputusan tim.

---

## Tabel Temuan

| Modul | Temuan | Terbukti/Salah | Jenis | Risiko | Usulan |
|-------|--------|----------------|-------|--------|--------|
| **pengguna** | POST `/api/pengguna/approve` dan `/entities` tidak cek duplikat sebelum INSERT ke `UserEntityAccess` — user bisa punya akses ganda ke entitas yang sama | TERBUKTI | TEKNIS | RENDAH | Tambah cek `SELECT COUNT(*) FROM UserEntityAccess WHERE userId=? AND entityId=?` sebelum INSERT di `set_entity_access()` (`pengguna.php:~23`) |
| **log** | POST `/api/log` menerima field `action` dari client tanpa validasi whitelist — string bebas bisa dimasukkan sebagai action name | TERBUKTI | TEKNIS | RENDAH | Tambah in_array() atau min-length check pada `action` sebelum `log_activity()` dipanggil (`log.php:~13`) |
| **dokumen** | `unlink($filePath)` dipanggil tanpa error handling saat DELETE — jika file sudah tidak ada di disk, PHP mencetak warning tapi tetap respons sukses (bergantung error_reporting) | TERBUKTI | TEKNIS | RENDAH | Ganti dengan: `if (file_exists($filePath)) { if (!unlink($filePath)) error_response('Gagal hapus file', 500); }` (`dokumen.php:~155`) |
| **jurnal** | `page_size` hardcode 25 (`jurnal.php:~83`), tidak ada parameter `limit` dari client. Klaim PETA-MASALAH "tidak ada default pagination limit" terbukti | TERBUKTI | TEKNIS | RENDAH | Tambah parameter `?limit=` (default 25, max 100) pada query |
| **kas** | `LIMIT 2000` hardcode di query ledger (`kas-helpers.php` atau `kas.php`) tanpa pagination — jika transaksi > 2000, data terpotong diam-diam | TERBUKTI | TEKNIS | SEDANG | Terapkan cursor/offset pagination, atau naikkan ke LIMIT 10000 jika volume data memungkinkan |
| **buku-besar** | Running balance dihitung di PHP loop dengan `(float)` casting tanpa pembulatan intermediate — potensi floating-point drift pada akun dengan banyak transaksi | TERBUKTI | TEKNIS | RENDAH | Tambah `$running_balance = round($running_balance, 2)` setiap iterasi (`buku-besar.php:~110`) |
| **sync** | Mapping entity hardcode di array PHP (`sync.php:~31`) — jika ada entitas baru di Sidamon, perlu ubah kode manual. Klaim PETA-MASALAH terbukti | TERBUKTI | TEKNIS | RENDAH | Refactor ke query `SELECT key, nama FROM Entity` + dynamic mapping. Atau env var `ENTITY_MAP_JSON` |
| **sync** | `curl_exec()` ke Sidamon tanpa cek return value (`sync.php:~144`) — jika Sidamon down atau HTTP 5xx, error diabaikan dan response PHP tetap sukses | TERBUKTI | TEKNIS | RENDAH | Tambah: cek `curl_errno()` dan HTTP status code; jika gagal, log ke `log_activity()` dengan kategori `SYNC_FAILED` |
| **dashboard** | Float casting `(float)$row['pendapatan']` pada agregat revenue (`dashboard.php:~43`). Klaim PETA-MASALAH terbukti | TERBUKTI | TEKNIS | RENDAH | Aman untuk nilai < 1 miliar. Pertimbangkan `bcmath` hanya jika presisi laporan keuangan dipermasalahkan |
| **profitabilitas** | Margin dihitung dari `Project.contractValue - Project.spend` saja. Node.js hitung dari saldo COA BEBAN per proyek. Biaya overhead yang tidak ter-link ke proyek tidak terhitung | TERBUKTI | AKUNTANSI-PAJAK | SEDANG | Perlu konfirmasi: apakah `Project.spend` sudah mencerminkan semua beban proyek (via `sync_project_spend()`)? Jika ya, aman. Jika ada beban yang tidak ter-link, angka profitabilitas tidak akurat |
| **laba-rugi** | PHP menarik Pendapatan dari COA kategori PENDAPATAN; Node.js dari `FakturPendapatan.nilaiProyek`. Jika ada faktur yang tidak diposting ke jurnal, angka berbeda | TERBUKTI | AKUNTANSI-PAJAK | SEDANG | Perlu konfirmasi: apakah semua FakturPendapatan otomatis diposting ke COA PENDAPATAN? Jika tidak, Laba Rugi PHP bisa undercount pendapatan |
| **laba-rugi** | Klaim PETA-MASALAH terbukti: PHP dan Node.js pakai sumber data berbeda untuk baris Pendapatan | TERBUKTI | AKUNTANSI-PAJAK | SEDANG | Lihat temuan di atas |
| **arus-kas** | PHP hanya endpoint GET dasar, Node.js punya `arus-kas-presisi.ts` + export Excel. Klaim PETA-MASALAH terbukti | TERBUKTI | UI | RENDAH | Tambah endpoint export jika dibutuhkan. Logic cash flow PHP sudah benar |
| **neraca** | PHP tidak memiliki breakdown 4 kategori aktiva tetap yang ditambah commit `feddf3e` di develop. Hanya ada `aktiva_tetap` sebagai satu baris aggregate (`neraca.php:~93`) | TERBUKTI | TEKNIS | SEDANG | Tambah query GROUP BY kategori ke AsetTetap dan sertakan dalam response neraca. Tergantung keputusan aset-tetap (A–D) |
| **laporan-keuangan** | PHP punya endpoint independen per laporan (laba-rugi, neraca, arus-kas). Klaim PETA-MASALAH "potensi tidak sinkron" terbukti — semua endpoint menarik dari Transaction, tapi rumus laba berbeda | TERBUKTI | TEKNIS | SEDANG | Fix laba-rugi source data (lihat temuan laba-rugi) akan menyelesaikan ini |
| **pajak / validasi-3arah** | Tarif PPN tidak hardcode di `validasi-pajak-3arah.php` — diambil dari COA transaction langsung. Klaim "tarif 12% belum masuk" perlu dicek: apakah ada transaksi PPN dengan tarif 12% yang sudah diinput? | TERBUKTI (parsial) | AKUNTANSI-PAJAK | SEDANG | Verifikasi dengan klien: apakah ada periode di mana PPN 12% dipakai? Jika ya, pastikan formula rekonsiliasi menggunakan tarif aktual dari TarifPajak, bukan hardcode |
| **payroll** | Field `ptkp` ada di master Pegawai tapi PPh21 masih diinput manual. Klaim PETA-MASALAH terbukti. Tidak ada bug aktif | TERBUKTI | TEKNIS | RENDAH | Feature future: `calculate_pph21(gajiKotor, ptkp)` saat PPh21 otomatis diaktifkan |
| **auth** | Rapi, tidak ada perbedaan material dengan Node.js | TERBUKTI | — | — | — |
| **coa** | Rapi | TERBUKTI | — | — | — |
| **entities** | Rapi | TERBUKTI | — | — | — |
| **saldo-awal** | Rapi | TERBUKTI | — | — | — |
| **jenis-input** | Rapi | TERBUKTI | — | — | — |
| **rekanan** | Rapi | TERBUKTI | — | — | — |
| **notifikasi** | Rapi | TERBUKTI | — | — | — |

---

## Ringkasan per Jenis

### TEKNIS — bisa diperbaiki tanpa keputusan tim (12 temuan)

| # | Modul | Temuan | Risiko |
|---|-------|--------|--------|
| T1 | pengguna | Duplikat UserEntityAccess tidak dicegah | RENDAH |
| T2 | log | Action field tidak divalidasi | RENDAH |
| T3 | dokumen | `unlink()` tanpa error handling | RENDAH |
| T4 | jurnal | page_size tidak bisa dikontrol client | RENDAH |
| T5 | kas | LIMIT 2000 hardcode tanpa pagination | SEDANG |
| T6 | buku-besar | Float drift di running balance | RENDAH |
| T7 | sync | Entity mapping hardcode | RENDAH |
| T8 | sync | curl ke Sidamon tanpa error handling | RENDAH |
| T9 | dashboard | Float casting agregat (aman untuk nilai saat ini) | RENDAH |
| T10 | neraca | 4 kategori aktiva tetap belum ada (bergantung aset-tetap) | SEDANG |
| T11 | laporan-keuangan | Sinkronisasi akan selesai setelah fix laba-rugi | SEDANG |
| T12 | payroll | ptkp ada tapi PPh21 otomatis belum diimplementasi | RENDAH |

### AKUNTANSI-PAJAK — perlu konfirmasi klien/akuntan (3 temuan)

| # | Modul | Pertanyaan untuk tim |
|---|-------|---------------------|
| A1 | profitabilitas | Apakah `Project.spend` (via `sync_project_spend()`) sudah mencerminkan SEMUA beban proyek, termasuk overhead? |
| A2 | laba-rugi | Apakah semua FakturPendapatan otomatis diposting ke COA PENDAPATAN? Jika tidak, sumber data PHP (COA) vs Node.js (FakturPendapatan) akan menghasilkan angka berbeda |
| A3 | pajak/validasi-3arah | Apakah ada periode di mana PPN 12% dipakai dan perlu direkonsiliasi? |

### UI — tidak ada logic backend yang perlu berubah (1 temuan)

| # | Modul | Keterangan |
|---|-------|-----------|
| U1 | arus-kas | Export Excel hanya ada di Node.js; PHP endpoint GET sudah benar |

---

## Urutan pengerjaan Tahap B (menunggu persetujuan)

**Prioritas SEDANG dulu (T5, T10, T11):**
1. **kas T5** — LIMIT 2000 bisa potong data di produksi
2. **neraca T10** — tergantung keputusan aset-tetap; kerjakan setelah A–D diputuskan
3. **laba-rugi / laporan-keuangan T11** — perlu konfirmasi A2 dulu

**Prioritas RENDAH (T1–T4, T6–T9, T12):**  
Bisa dikerjakan berurutan tanpa risiko, satu commit per temuan.
