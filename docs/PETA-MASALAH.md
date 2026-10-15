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
| **log** | 2 | ✅ Selesai (`9742960`) | ~~Frontend-triggered log dapat diinjeksi~~ — validasi panjang (3–200) dan karakter kontrol ditambah | kecil → selesai |
| **dokumen** | 3 | ✅ Selesai (`cab54e8`) | ~~`unlink` tanpa error handling saat DELETE~~ — cek return value + error 500 | kecil → selesai |
| **jurnal** *(jurnal umum)* | 3 | ✅ Selesai (`6bbc82d`) | ~~Tidak ada default pagination limit~~ — parameter `?limit=` (default 25, max 100) | kecil → selesai |
| **daftar-akun** | 1 | Rapi | — | kecil |
| **jurnal-transaksi** | 4 | ✅ Selesai dan teruji (`a1f2f95`, `71957fd`, `c3fb1cd`) | ~~`syncProjectSpend` hilang, `fakturId` diabaikan, edit mode hapus faktur terlalu destruktif, `$now` null di edit path.~~ Semua diperbaiki. 13/13 assertion lulus. Catatan terbuka: duplikat noBukti auto-suffix (Node.js) vs 409 (PHP) — perbedaan desain yang disengaja. | sedang → selesai |
| **kas** *(kecil+besar+bank)* | 6+ | ✅ Selesai (`0c329cf`) | ~~`LIMIT 2000` hardcoded~~ — LIMIT dihapus dari SQL; saldo berjalan dihitung di PHP atas semua grup sebelum paginasi | kecil → selesai |
| **profitabilitas** | 2 | ✅ Selesai (`d5107cd`) | ~~PHP hanya pakai Project.spend (cached)~~ — kini hitung dari SUM COA BEBAN per proyek; fallback ke Project.spend jika belum ada transaksi BEBAN. Field spendSource di response | sedang → selesai |
| **dashboard** | 3 | Ada beda kecil | Float casting pada agregat revenue; Node.js pakai Prisma `Decimal`, PHP pakai `(float)` biasa | kecil |
| **buku-besar** | 2 | Ada beda kecil | Running balance dihitung di PHP loop → floating point drift potensial pada akun dengan transaksi banyak | kecil |
| **laba-rugi** | 1 | ✅ Selesai (`7590f7a`) | ~~PHP hanya menarik COA PENDAPATAN~~ — kini dual-source: COA + FakturPendapatan belum dijurnal. Field fakturUnlinked di response. 4/4 tes lulus. | sedang → selesai |
| **arus-kas** | 1 | Ada beda kecil | Node.js punya `arus-kas-presisi.ts` + export Excel; PHP hanya endpoint GET dasar, tanpa export | sedang |
| **piutang** | 6+ | ✅ Selesai dan teruji (`cadf998`, `7d7ec8f`) | ~~Klaim awal salah: DB transaction sudah ada.~~ Bug asli: (1) `coa_by_jenis()` silent skip jika entitas belum punya riwayat kas, (2) tidak ada cek duplikat noBukti, (3) kode COA gaharu/kencana tertukar, (4) `strtolower` rusak untuk ciptaAsri. Semua diperbaiki. Catatan terbuka: race condition `last_saldo()` dan data historis terdampak belum disentuh. | sedang → selesai |
| **pajak / validasi-3arah** | 4 | Ada beda kecil | Tarif PPN di PHP belum tentu mengikuti update 12% yang ada di Node.js (`tarifpajak.php` sudah ada, tapi perlu dicek apakah endpoint pendapatan sudah pakai) | kecil |
| **laporan-keuangan** | 2 | ✅ Selesai (`511bba4`) | ~~Pendapatan hanya dari COA; neraca tidak punya rekap aktiva tetap~~ — dual-source Pendapatan + rekapPerKategoriAset di neraca section | sedang → selesai |
| **payroll** | 8+ | Ada beda kecil | Node.js punya field `ptkp` di master Pegawai (untuk PPh21 otomatis di masa depan); PHP tidak punya — belum jadi masalah karena PPh21 masih diinput manual di kedua versi | kecil |
| **pendapatan** | 8 | ✅ Selesai dan teruji (`5310d09`, `b34090f`, `71acd78`) | ~~rumus nilaiProyek salah (dpp+ppn), kuitansi bruto belum ada path-nya, DELETE tidak unlink fakturId, nominalDiterima null→crash.~~ Semua diperbaiki. 14/14 assertion lulus. `kuitansiJenis` tidak ada sebagai field DB; multi-termin adalah UI-only. | sedang → selesai |
| **sync** | 2 | ✅ T8 selesai (`1ee355c`); T7 ditunda | T8: ~~curl ke Sidamon tanpa error handling~~ — cek errno+HTTP, log kegagalan, syncBack di response. T7: entity mapping hardcode — ditunda (risiko rendah, ubah hanya jika entitas bertambah) | kecil → selesai (T8) |
| **neraca** | 1 | ✅ Selesai (`3ae9539`) | ~~Rekap 4 kategori aktiva tetap belum ada~~ — kini punya rekapPerKategoriAset; gunakan get_penyusutan_summary() satu panggilan | sedang → selesai |
| **aset-tetap** | 5+ | ✅ Selesai (`ee8b50c`) | ~~6 kategori custom, Tanah disusutkan (salah PSAK), tidak ada field awal tahun~~ — 4 kategori PSAK, TANAH guard (umurBulan=0), akumulasiPenyusutanAwalTahun + nilaiBukuAwalTahun, year-end rollover, rekapPerKategori. 10/10 tes lulus. Skrip migrasi: `tests/manual/migrate-aset-psak.sh` | **besar → selesai** |

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
- `24bcc05` — e-faktur kuitansi bruto + multi-termin: `nilaiKuitansi` adalah parameter kalkulasi (bukan field DB baru); multi-termin adalah UI-only. Gap sebenarnya: rumus `nilaiProyek` berbeda dan PHP belum punya path kalkulasi kuitansi bruto.

Ada juga beberapa commit style/UI (`ab405ca`, `0712293`), tapi itu bukan yang kritis.
