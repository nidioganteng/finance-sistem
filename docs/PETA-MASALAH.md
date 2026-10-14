# Peta Masalah: PHP vs Node.js (develop)

> Dibuat berdasarkan eksplorasi `api/routes/*.php` vs `gaharu-node/src/lib/actions/*.ts`  
> dan `git log` di branch develop. Bukan audit lengkap — gambaran besar saja.

## Tabel Per Modul

| Modul | Jml endpoint | Kondisi PHP | Contoh beda paling penting | Perkiraan upaya |
|-------|-------------|-------------|---------------------------|-----------------|
| **auth** | 3 | Rapi | — | kecil |
| **pengguna** | 5 | Rapi | Entity assignment tidak validasi duplikat (minor) | kecil |
| **coa** | 4 | Rapi | — | kecil |
| **entities** | 1 | Rapi | — | kecil |
| **saldo-awal** | 1 | Rapi | — | kecil |
| **jenis-input** | 4 | Rapi | — | kecil |
| **rekanan** | 1 | Rapi | — | kecil |
| **notifikasi** | 4 | Rapi | — | kecil |
| **log** | 2 | Rapi | Frontend-triggered log dapat diinjeksi (low risk) | kecil |
| **dokumen** | 3 | Rapi | `unlink` tanpa error handling saat DELETE | kecil |
| **jurnal** *(jurnal umum)* | 3 | Rapi | Tidak ada default pagination limit (Node.js ada) | kecil |
| **daftar-akun** | 1 | Rapi | — | kecil |
| **jurnal-transaksi** | 4 | ✅ Selesai dan teruji (`a1f2f95`, `71957fd`) | ~~`syncProjectSpend` hilang, `fakturId` diabaikan, edit mode hapus faktur terlalu destruktif.~~ Semua diperbaiki. Catatan terbuka: duplikat noBukti auto-suffix (Node.js) vs 409 (PHP) — perbedaan desain yang disengaja. | sedang → selesai |
| **kas** *(kecil+besar+bank)* | 6+ | Ada beda kecil | `LIMIT 2000` hardcoded di PHP; Node.js pakai pagination dinamis | kecil |
| **profitabilitas** | 2 | Ada beda kecil | Node.js hitung margin per proyek dari saldo COA — PHP hitung dari transaksi langsung, bisa beda hasil kalau ada saldo awal | sedang |
| **dashboard** | 3 | Ada beda kecil | Float casting pada agregat revenue; Node.js pakai Prisma `Decimal`, PHP pakai `(float)` biasa | kecil |
| **buku-besar** | 2 | Ada beda kecil | Running balance dihitung di PHP loop → floating point drift potensial pada akun dengan transaksi banyak | kecil |
| **laba-rugi** | 1 | Ada beda kecil | Node.js menarik Pendapatan dari faktur (`FakturPendapatan`); PHP menarik dari COA PENDAPATAN — bisa beda angka kalau sumber data tidak sinkron | sedang |
| **arus-kas** | 1 | Ada beda kecil | Node.js punya `arus-kas-presisi.ts` + export Excel; PHP hanya endpoint GET dasar, tanpa export | sedang |
| **piutang** | 6+ | ✅ Selesai dan teruji (`cadf998`, `7d7ec8f`) | ~~Klaim awal salah: DB transaction sudah ada.~~ Bug asli: (1) `coa_by_jenis()` silent skip jika entitas belum punya riwayat kas, (2) tidak ada cek duplikat noBukti, (3) kode COA gaharu/kencana tertukar, (4) `strtolower` rusak untuk ciptaAsri. Semua diperbaiki. Catatan terbuka: race condition `last_saldo()` dan data historis terdampak belum disentuh. | sedang → selesai |
| **pajak / validasi-3arah** | 4 | Ada beda kecil | Tarif PPN di PHP belum tentu mengikuti update 12% yang ada di Node.js (`tarifpajak.php` sudah ada, tapi perlu dicek apakah endpoint pendapatan sudah pakai) | kecil |
| **laporan-keuangan** | 2 | Ada beda kecil | Node.js mengonsolidasi 4 laporan dengan relasi yang konsisten; PHP masing-masing endpoint independen — potensi angka tidak sinkron antar laporan | sedang |
| **payroll** | 8+ | Ada beda kecil | Node.js punya field `ptkp` di master Pegawai (untuk PPh21 otomatis di masa depan); PHP tidak punya — belum jadi masalah karena PPh21 masih diinput manual di kedua versi | kecil |
| **pendapatan** | 8 | Ada beda kecil | Commit `24bcc05` di develop menambah field `kuitansiJenis`/`nilaiKuitansi` (e-faktur kuitansi bruto) + multi-termin — field-field ini kemungkinan belum ada di `pendapatan.php` | sedang |
| **sync** | 2 | Ada beda kecil | Entity mapping hardcoded di PHP (`Gaharu` → `GH`, dll) — tidak fleksibel jika struktur entitas berubah | kecil |
| **neraca** | 1 | Ada beda kecil | Commit `feddf3e` di develop menambah rekap 4 kategori aktiva tetap ke neraca; `neraca.php` belum punya ini | sedang |
| **aset-tetap** | 5+ | **Rusak parah** | PHP memakai 6 kategori custom; Node.js 4 kategori PSAK standar (Tanah, Bangunan, Kendaraan, Peralatan). Lebih kritis: PHP menyusutkan **Tanah** (salah — PSAK melarang); Node.js sudah fix ini di commit `887f4eb` + fix saldo tahunan + year-end rollover, **belum masuk ke PHP** | **besar** |

---

## 1. Urutan pengerjaan yang disarankan (aman dan risiko rendah dulu)

**Gelombang 1 — Langsung aman:**  
`coa` → `entities` → `saldo-awal` → `jenis-input` → `rekanan` → `notifikasi` → `dokumen` → `log`  
*(Semua ini hanya CRUD sederhana, tidak ada logic bisnis kompleks)*

**Gelombang 2 — Beda kecil, mudah fix:**  
`jurnal` → `kas` → `buku-besar` → `payroll` → `pajak/validasi-3arah` → `sync`

**Gelombang 3 — Perlu perhatian lebih:**  
`jurnal-transaksi` → `piutang` → `pendapatan` → `laporan-keuangan` → `neraca` → `laba-rugi`

**Gelombang 4 — Paling berisiko, kerjakan terakhir:**  
`aset-tetap` *(butuh restrukturisasi kategori + fix depresiasi Tanah + saldo tahunan)*

---

## 2. Apakah arsitektur PHP saat ini konsisten?

Ya, arsitektur PHP secara keseluruhan konsisten: semua route mengikuti pola yang sama (`require_auth()`, `$segments`, `$method`, `json_response()`), dan entry point `index.php` berfungsi baik sebagai dispatcher. Yang tidak konsisten adalah perlakuan presisi angka — sebagian besar modul menggunakan `(float)` casting biasa, yang aman untuk nilai kecil tetapi berpotensi drift pada akumulasi running balance di `buku-besar.php`; ini bukan masalah arsitektur, melainkan masalah implementasi lokal.

---

## 3. Commit di develop yang belum masuk PHP: logic atau UI?

Sebagian besar commit terbaru yang belum masuk PHP adalah **logic**, bukan hanya UI:
- `887f4eb` — fix depresiasi aset tetap, year-end balance rollover (logic kalkulasi)
- `feddf3e` — neraca sertakan 4 kategori aktiva tetap (logic agregasi)
- `24bcc05` — e-faktur kuitansi bruto + multi-termin (logic field baru + perhitungan pajak)

Ada juga beberapa commit style/UI (`ab405ca`, `0712293`), tapi itu bukan yang kritis.
