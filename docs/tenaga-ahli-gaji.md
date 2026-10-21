# Gaji negosiasi dan bulanan tenaga ahli

## Alur penggunaan dan testing manual

1. Buka **Payroll → Tenaga Ahli → Pengisian Gaji & Negosiasi** (halaman awal Tenaga Ahli).
2. Klik **Tambah tenaga ahli manual**. Isi profil, NIK 16 digit, NPWP/PTKP, entitas, dan penugasan pada proyek yang sudah terdaftar. Gunakan data sintetis untuk testing. Jika belum ada proyek, buat melalui modul proyek terlebih dahulu.
3. Pada daftar, isi nominal gaji negosiasi langsung di baris tenaga ahli/proyek. Pilih basis **per bulan** atau **total kontrak**, lalu **Simpan negosiasi**. Klik **Data kontrak** jika nama pekerjaan, menman, gaji RAB, atau tanggal SPMK perlu dilengkapi. Setelah nominal disimpan, klik **Tindak lanjut** untuk membuka rincian bulanan orang tersebut.
4. Sistem membuat daftar bulan inklusif dari tanggal SPMK, termasuk pergantian tahun. Nominal gaji dan catatan bulan-bulan tersebut tetap kosong. Gaji negosiasi tidak disalin otomatis ke setiap bulan.
5. Isi nominal gaji per bulan dan catatan kendala di sebelahnya, lalu **Simpan gaji bulanan**. Nilai kosong dibedakan dari nol.
6. Tambahkan bulan untuk perpanjangan, atau hapus bulan saat pekerjaan selesai lebih cepat. Acuan SPMK tetap tersimpan. Bulan yang memiliki riwayat pembayaran tidak bisa dihapus dari jadwal.
7. Catatan ditandai **Ada kendala**, warna amber, dan rincian yang bisa dibuka. Penanda juga tampil di daftar utama dan halaman tindak lanjut. Tombol ringkasan catatan memfilter baris kendala pada halaman orang tersebut.
8. Setelah jadwal disimpan, **Catat pembayaran** membuka form honor yang sudah ada dengan orang, proyek, bulan, dan nominal terpilih. Periksa tanggal, nominal, dan pajak sebelum menyimpan. Pencatatan jadwal tidak mengubah transaksi honor/jurnal secara otomatis. Riwayat pembayaran yang sudah ada ditampilkan untuk bulan tersebut. Jika baru dibayar sebagian, **Catat sisa pembayaran** mengisi form dengan sisa nominal bulan itu.

Satu orang dapat memiliki beberapa proyek. Negosiasi, jadwal, dan catatan dipisahkan per `(rekananId, projectId)`. Halaman rincian dapat dibuka melalui URL `/payroll?entity=...&tab=tenaga-ahli&ahliId=...&proyekAhliId=...`.

## Data dan deployment

Jalankan `database/migrations/2026-10-21-tenaga-ahli-gaji-negosiasi.sql` pada database target sebelum deployment. Backend juga menyediakan `CREATE TABLE IF NOT EXISTS` mengikuti pola tabel tenaga ahli yang sudah ada; sertakan folder `database/migrations` saat deploy. Tabel `TenagaAhliProject` tetap diperlukan. Input manual payroll tidak membutuhkan kolom integrasi Sidamon pada tabel `Project`: acuan tanggal berasal dari referensi kontrak gaji atau tanggal penugasan manual.

`TenagaAhliGajiKontrak` menyimpan referensi, gaji negosiasi, basis negosiasi, daftar bulan eksplisit (`jadwalJson`), serta revision. Jadwal eksplisit memastikan pengurangan/perpanjangan bulan dan catatan tidak direset oleh sync. Tidak ada backfill nominal ke data honor lama. Profil/penugasan dengan negosiasi tersimpan dilindungi dari penghapusan yang membuat data gaji tidak terjangkau.

`POST /api/payroll/gaji-kontrak` memerlukan autentikasi dan role finance/admin. Staf dapat menulis jika memiliki akses ke entitas profil tenaga ahli atau entitas proyek penugasannya. Penyimpanan menggunakan transaksi dan pemeriksaan revision; halaman lama mendapat HTTP 409 untuk mencegah menimpa edit lain atau sync. Perubahan dicatat di ActivityLog melalui mekanisme audit yang sudah ada.

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
- `node tests/tenaga-ahli-tracking.cjs`
- `npx tsc --noEmit --incremental false`
- `npm run build`
- PHP lint pada helper dan route yang berubah.

Tes otomatis memakai data sintetis dan tidak menulis ke database. Tes mencakup periode lintas tahun, akhir bulan/kabisat, input nominal kosong/nol, catatan kendala, escaping, pemisahan entitas, serta render akses read-only. Respons payroll dan penyimpanan negosiasi juga diuji terhadap MySQL lokal; pengujian penyimpanan di-rollback agar negosiasi testing tetap kosong. Uji browser interaktif dan pengiriman Sidamon sungguhan tetap perlu dilakukan pada lingkungan testing.

## Pembaruan alur negosiasi dan balance

Menu Gaji Bulanan lama dikeluarkan dari navigasi Tenaga Ahli. Pengisian berpusat pada daftar **Pengisian Gaji & Negosiasi**: isi nominal dan basis negosiasi langsung di baris orang/proyek, simpan, lalu klik **Tindak lanjut** untuk mengisi gaji per bulan pada halaman khusus di dalam menu yang sama. **Data kontrak** menyediakan akses untuk melengkapi referensi manual.

Tenaga ahli muncul di entitas tempat profilnya terdaftar maupun entitas proyek penugasannya. Contoh: profil di Gaharu dengan proyek Cipta Asri tetap tampil pada Gaharu; entitas profil dan proyek ditampilkan terpisah. Hak tulis staf menerima akses ke salah satu dari kedua entitas tersebut. Tidak ada profil duplikat yang dibuat untuk lintas entitas.

Daftar awal dan halaman tindak lanjut menampilkan gaji yang telah diisi, pembayaran bruto pada periode yang dipilih, dan **balance = total gaji terisi − sudah dibayar bruto**. Pilihan Tahun di daftar atau Semua bulan kontrak di tindak lanjut menampilkan rentang yang lebih luas, termasuk riwayat tahun sebelumnya pada mode seluruh kontrak. Gaji yang masih kosong tidak dihitung sebagai nol: balance belum tersedia jika belum ada nominal yang diisi, dan diberi tanda **sementara** jika baru sebagian bulan terisi. Kelebihan bayar tetap ditampilkan sebagai balance negatif. Pembayaran lama berdasarkan NIK digabung dengan pembayaran berdasarkan rekananId tanpa menghitung transaksi yang sama dua kali. Bulan yang sudah pernah dibayar di luar rentang SPMK tetap ditampilkan pada tindak lanjut.

Untuk fixture lokal sesuai screenshot, jalankan `php scripts/seed-tenaga-ahli-testing.php` sebagai preview, lalu tambahkan `--apply` untuk melengkapi referensi kosong pada profil **kevinnn / CAD-001** yang sudah ada: nama pekerjaan Landscape Taman Kota Palangka Raya, RAB Rp50.000.000, menman contoh 8, dan periode 21 Februari–21 Oktober 2026. Script tidak membuat profil/pembayaran baru, tidak menimpa referensi terisi atau data Sidamon, dan mempertahankan negosiasi/jadwal yang sudah disimpan. Gunakan input negosiasi di daftar untuk mencoba alur selanjutnya.

## Rekap terpadu dan tracking per bulan

Rekap Per Proyek, Rekap Setahun, Akumulasi Tenaga Ahli, dan Konsolidasi Holding sekarang memakai satu pembentuk data: `src/lib/tenaga-ahli-tracking.ts`. Sumber gaji terisi adalah `TenagaAhliGajiKontrak.jadwalJson`, dan sumber pembayaran adalah `HonorTenagaAhli` yang dinormalisasi melalui `honorTracking` pada respons payroll. Pembayaran lama yang tidak memiliki master tetap ikut terhitung. ID pembayaran dideduplikasi agar riwayat lewat NIK/rekanan tidak menggandakan total.

Setiap rekap menampilkan gaji terisi, pembayaran bruto, PPh, netto, dan balance. Menyimpan gaji bulanan saja tidak membuat pembayaran, pajak, kas keluar, atau jurnal baru. Penyesuaian Gaji dan Sinkronisasi Laba Rugi tetap mencocokkan pembayaran riil dengan jurnal; ringkasan gaji terisi di Penyesuaian ditampilkan terpisah. Nilai RAB/negosiasi tidak menggantikan input bulanan dan tidak dianggap terbayar.

Rekap Per Proyek, Rekap Setahun, Akumulasi Tenaga Ahli, dan Konsolidasi Holding awalnya menampilkan **setahun**. Pembayaran Februari tetap masuk akumulasi meski bulan halaman sedang Oktober, selama tahun dan entitasnya sesuai. Pilihan **Bulan dipilih** memfilter bulan dan tahun secara tepat untuk tracking. Klik detail kelompok untuk melihat baris orang/proyek/bulan, catatan, dan tanggal bayar. **Tracking bulan ini** membuka orang/proyek dengan periode baris tersebut.

Daftar negosiasi mengikuti bulan terpilih untuk ringkasan nominal dan pembayaran, dengan pilihan Tahun untuk melihat semua input pada tahun itu. Tindak lanjut awalnya hanya memperlihatkan bulan terpilih; **Semua bulan kontrak** menampilkan seluruh jadwal untuk input beberapa bulan atau perpanjangan. Pergantian tampilan tidak menghapus bulan yang tersembunyi: penyimpanan tetap membawa jadwal lengkap. Modal Riwayat Gaji di database juga awalnya memfilter bulan/tahun terpilih.

Periode gaji disimpan dari `bulan`/`tahun` form honor, sedangkan `tanggal` menyimpan tanggal pembayaran. Contoh: gaji Oktober yang dicatat dibayar pada November tetap masuk periode payroll Oktober, dengan tanggal bayar November terlihat di rincian. Payload lama tanpa bulan/tahun mengikuti tanggal. Keduanya harus valid; periode bulan 1–12 dan tahun 2000–2199. Rekonsiliasi jurnal tetap menggunakan periodenya sendiri dan dapat menunjukkan selisih jika tanggal pengeluaran berbeda.

Pada rekap entitas, gaji terisi dialokasikan ke entitas profil, sedangkan pembayaran mengikuti entitas pembayar. Konsolidasi Holding mencakup semua entitas sekali tanpa menjumlahkan ulang data yang sama. Database menampilkan gaji terisi pada bulan yang dipilih sebagai pengganti Honor Standar; referensi RAB tetap tersedia pada data kontrak. Pengambilan payroll memakai `cache: no-store` agar refresh sesudah edit/pembayaran mengambil data terbaru.

Verifikasi tambahan: `node tests/tenaga-ahli-tracking.cjs` mencakup dua bulan pembayaran, cicilan, duplikasi ID, perubahan gaji tersimpan, pembayaran lama tanpa master, perbedaan entitas/tahun, dan konsistensi total di semua pengelompokan. Uji MySQL lokal memakai fixture sementara: Februari/Maret dibayar Rp20 juta, gaji Oktober Rp15 juta belum dibayar. Semua rekap setahun sepakat pada gaji terisi Rp35 juta dan pembayaran Rp20 juta; filter Oktober hanya berisi gaji Rp15 juta dan pembayaran Rp0. Fixture pengujian dihapus/di-rollback; data asli pengguna dipertahankan.
