# Gaji negosiasi dan bulanan tenaga ahli

## Alur penggunaan dan testing manual

1. Buka **Payroll → Tenaga Ahli → Pengisian Gaji & Negosiasi** (halaman awal Tenaga Ahli).
2. Klik **Tambah tenaga ahli manual**. Isi profil, NIK 16 digit, NPWP/PTKP, entitas, dan penugasan pada proyek yang sudah terdaftar. Gunakan data sintetis untuk testing. Jika belum ada proyek, buat melalui modul proyek terlebih dahulu.
3. Pada daftar, klik **Isi gaji negosiasi** untuk tenaga ahli dan proyek yang dipilih. Isi nama pekerjaan, menman, gaji RAB, tanggal SPMK, serta gaji negosiasi. Pilih basis **per bulan** atau **total kontrak**, lalu simpan.
4. Sistem membuat daftar bulan inklusif dari tanggal SPMK, termasuk pergantian tahun. Nominal gaji dan catatan bulan-bulan tersebut tetap kosong. Gaji negosiasi tidak disalin otomatis ke setiap bulan.
5. Isi nominal gaji per bulan dan catatan kendala di sebelahnya, lalu **Simpan gaji bulanan**. Nilai kosong dibedakan dari nol.
6. Tambahkan bulan untuk perpanjangan, atau hapus bulan saat pekerjaan selesai lebih cepat. Acuan SPMK tetap tersimpan. Bulan yang memiliki riwayat pembayaran tidak bisa dihapus dari jadwal.
7. Catatan ditandai **Ada kendala**, warna amber, dan rincian yang bisa dibuka. Penanda juga tampil di daftar utama serta daftar pembayaran gaji bulanan. Tombol ringkasan catatan memfilter baris kendala pada halaman orang tersebut.
8. Setelah jadwal disimpan, **Catat pembayaran** membuka form honor yang sudah ada dengan orang, proyek, bulan, dan nominal terpilih. Periksa tanggal, nominal, dan pajak sebelum menyimpan. Pencatatan jadwal tidak mengubah transaksi honor/jurnal secara otomatis. Riwayat pembayaran yang sudah ada ditampilkan untuk bulan tersebut.

Satu orang dapat memiliki beberapa proyek. Negosiasi, jadwal, dan catatan dipisahkan per `(rekananId, projectId)`. Halaman rincian dapat dibuka melalui URL `/payroll?entity=...&tab=tenaga-ahli&ahliId=...&proyekAhliId=...`.

## Data dan deployment

Jalankan `database/migrations/2026-10-21-tenaga-ahli-gaji-negosiasi.sql` pada database target sebelum deployment. Backend juga menyediakan `CREATE TABLE IF NOT EXISTS` mengikuti pola tabel tenaga ahli yang sudah ada; sertakan folder `database/migrations` saat deploy. Tabel `TenagaAhliProject` tetap diperlukan. Input manual payroll tidak membutuhkan kolom integrasi Sidamon pada tabel `Project`: acuan tanggal berasal dari referensi kontrak gaji atau tanggal penugasan manual.

`TenagaAhliGajiKontrak` menyimpan referensi, gaji negosiasi, basis negosiasi, daftar bulan eksplisit (`jadwalJson`), serta revision. Jadwal eksplisit memastikan pengurangan/perpanjangan bulan dan catatan tidak direset oleh sync. Tidak ada backfill nominal ke data honor lama. Profil/penugasan dengan negosiasi tersimpan dilindungi dari penghapusan yang membuat data gaji tidak terjangkau.

`POST /api/payroll/gaji-kontrak` memerlukan autentikasi dan role finance/admin. Staf hanya dapat menulis untuk entitas proyek yang ditugaskan kepadanya. Penyimpanan menggunakan transaksi dan pemeriksaan revision; halaman lama mendapat HTTP 409 untuk mencegah menimpa edit lain atau sync. Perubahan dicatat di ActivityLog melalui mekanisme audit yang sudah ada.

## Kontrak penerimaan Sidamon

Endpoint penerima tetap `POST /api/sync/tenaga-ahli` dengan `X-Internal-Secret`. Pengiriman dari aplikasi Sidamon belum diubah dalam repository ini.

Selain field profil/penugasan yang sudah ada, setiap item dapat membawa:

| Field | Isi |
|---|---|
| `namaPekerjaan` | Jabatan/pekerjaan orang tersebut; alias `jobName` diterima |
| `manMonth` | Menman numerik; alias `menman` diterima |
| `gajiRab` | Nominal RAB; fallback ke `nominalHonorBulanan` untuk payload lama |
| `spmkMulai` | Tanggal `YYYY-MM-DD`; fallback ke `tanggalMulaiTugas` |
| `spmkSelesai` | Tanggal `YYYY-MM-DD`; fallback ke `tanggalSelesaiTugas` |

`assignmentId` atau `projectCode` harus dapat diresolusikan ke proyek Simatra agar referensi dapat dikaitkan. Referensi yang diterima ditandai `SIDAMON` dan menjadi read-only di halaman finance. Field referensi yang tidak dikirim tidak mengosongkan nilai yang sudah ada. Sync tidak menulis `gajiNegosiasi`, `basisNegosiasi`, atau `jadwalJson`. Satu item disimpan secara atomik bersama profil dan penugasannya; kegagalan dikembalikan pada `results` item tersebut.

## Verifikasi

- `php tests/tenaga-ahli-gaji.php`
- `node tests/tenaga-ahli-gaji.cjs`
- `npx tsc --noEmit --incremental false`
- `npm run build`
- PHP lint pada helper dan route yang berubah.

Tes otomatis memakai data sintetis dan tidak menulis ke database. Tes mencakup periode lintas tahun, akhir bulan/kabisat, input nominal kosong/nol, catatan kendala, escaping, pemisahan entitas, serta render akses read-only. Uji browser dengan database dan pengiriman Sidamon sungguhan tetap perlu dilakukan pada lingkungan testing.
