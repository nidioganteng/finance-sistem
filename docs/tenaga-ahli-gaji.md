# Gaji negosiasi dan bulanan tenaga ahli

## Alur penggunaan dan testing manual

1. Buka **Payroll → Tenaga Ahli → Pengisian Gaji & Negosiasi** (halaman awal Tenaga Ahli).
2. Klik **Tambah tenaga ahli manual**. Isi profil, NIK 16 digit, NPWP/PTKP, entitas, dan penugasan pada proyek yang sudah terdaftar. Gunakan data sintetis untuk testing. Jika belum ada proyek, buat melalui modul proyek terlebih dahulu.
3. Pada daftar, isi nominal gaji negosiasi langsung di baris tenaga ahli/proyek. Pilih basis **per bulan** atau **total kontrak**, lalu **Simpan negosiasi**. Klik **Data kontrak** jika nama pekerjaan, menman, gaji RAB, atau tanggal SPMK perlu dilengkapi. Setelah nominal disimpan, klik **Tindak lanjut** untuk membuka rincian bulanan orang tersebut.
4. Sistem membuat daftar bulan inklusif dari tanggal SPMK, termasuk pergantian tahun. Nominal gaji dan catatan bulan-bulan tersebut tetap kosong. Gaji negosiasi tidak disalin otomatis ke setiap bulan.
5. Isi nominal gaji per bulan dan catatan kendala di sebelahnya, lalu **Simpan gaji bulanan**. Nilai kosong dibedakan dari nol.
6. Tambahkan bulan untuk perpanjangan, atau hapus bulan saat pekerjaan selesai lebih cepat. Acuan SPMK tetap tersimpan. Bulan yang memiliki pembayaran manual tidak bisa dihapus dari jadwal. Pembayaran otomatis mengikuti perubahan atau penghapusan bulan saat disimpan.
7. Catatan ditandai **Ada kendala**, warna amber, dan rincian yang bisa dibuka. Penanda juga tampil di daftar utama dan halaman tindak lanjut. Tombol ringkasan catatan memfilter baris kendala pada halaman orang tersebut.
8. **Simpan gaji & pembayaran** menyimpan jadwal dan sekaligus mencatat pembayaran untuk semua bulan dengan nominal positif. Tidak perlu menekan Catat pembayaran per bulan. Bulan kosong atau nol tidak membuat transaksi. Tanggal pembayaran otomatis memakai tanggal penyimpanan pertama, sedangkan bulan/tahun payroll mengikuti bulan gaji. Simpan ulang memakai ID tetap; perubahan nominal memperbarui catatan otomatis yang sama. Pembayaran manual lama diperhitungkan sehingga hanya kekurangannya yang dicatat otomatis. Gaji tidak boleh diturunkan di bawah jumlah pembayaran manual. Mengosongkan nominal atau menghapus bulan menghapus catatan otomatis terkait, tanpa mengubah pembayaran manual. Gaji lama yang belum tercatat dapat disinkronkan dengan menekan Simpan gaji & pembayaran meski nominal belum diubah.

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

Daftar Pengisian Gaji & Negosiasi hanya menampilkan penugasan pada **entitas pemilik proyek**, dengan entitas profil sebagai fallback jika proyek tidak mempunyai entitas. Profil di Gaharu dengan proyek Cipta Asri hanya muncul pada pengisian Cipta Asri. Jika orang yang sama ditugaskan ke proyek Gaharu dan Kencana, masing-masing entitas hanya menampilkan proyeknya sendiri. Tidak ada profil duplikat yang dibuat untuk lintas entitas. Hak tulis staf tetap mengikuti akses entitas yang divalidasi backend.

Daftar awal dan tindak lanjut memakai **total gaji negosiasi kontrak − seluruh pembayaran bruto kontrak** sebagai balance untuk monitoring finance. RAB tetap referensi. Contoh RAB Rp50 juta, negosiasi Rp35 juta, dan pembayaran Rp20 juta menghasilkan sisa Rp15 juta. Saat pembayaran tepat Rp35 juta, status menjadi **Balance**, sisa Rp0, dan Tambah bulan dikunci. Pembayaran di atas target tetap terlihat sebagai sisa negatif dan status Melebihi total negosiasi. Gaji negosiasi selalu ditampilkan sebagai total kontrak; pilihan basis per bulan dihapus, dan penyimpanan menormalkan basis ke KONTRAK. Nilai negosiasi lama ditafsirkan sebagai target total tanpa dikalikan MM atau jumlah bulan. Tidak ada pembayaran yang dibuat hanya dari nominal negosiasi.

Filter bulan/tahun tetap membatasi tabel gaji terisi, tetapi pembayaran dan balance monitoring memakai seluruh riwayat kontrak agar tidak berubah saat filter diganti. Pembayaran lama berdasarkan NIK dan rekananId dideduplikasi. Penambahan bulan ditolak di frontend dan backend setelah pembayaran mencapai batas. Total gaji bulanan beserta pembayaran manual di luar jadwal tidak boleh melewati negosiasi. Jika ada perpanjangan bernilai tambahan, negosiasi dapat diperbarui terlebih dahulu. Bulan yang sudah pernah dibayar di luar SPMK tetap ditampilkan pada tindak lanjut.

Untuk fixture lokal sesuai screenshot, jalankan `php scripts/seed-tenaga-ahli-testing.php` sebagai preview, lalu tambahkan `--apply` untuk melengkapi referensi kosong pada profil **kevinnn / CAD-001** yang sudah ada: nama pekerjaan Landscape Taman Kota Palangka Raya, RAB Rp50.000.000, menman contoh 8, dan periode 21 Februari–21 Oktober 2026. Script tidak membuat profil/pembayaran baru, tidak menimpa referensi terisi atau data Sidamon, dan mempertahankan negosiasi/jadwal yang sudah disimpan. Buka entitas Cipta Asri dan gunakan input negosiasi di daftar untuk mencoba alur selanjutnya.

## Rekap terpadu dan tracking per bulan

Rekap Per Proyek, Rekap Setahun, Akumulasi Tenaga Ahli, dan Konsolidasi Holding sekarang memakai satu pembentuk data: `src/lib/tenaga-ahli-tracking.ts`. Sumber gaji terisi adalah `TenagaAhliGajiKontrak.jadwalJson`, dan sumber pembayaran adalah `HonorTenagaAhli` yang dinormalisasi melalui `honorTracking` pada respons payroll. Pembayaran lama yang tidak memiliki master tetap ikut terhitung. ID pembayaran dideduplikasi agar riwayat lewat NIK/rekanan tidak menggandakan total.

Setiap rekap menampilkan gaji terisi, pembayaran bruto, PPh, netto, dan balance negosiasi. Target negosiasi dihitung sekali per orang/proyek, dan balance menggunakan pembayaran seluruh kontrak, termasuk di luar filter bulan/tahun. Gaji terisi, PPh, netto, dan kolom pembayaran periode tetap mengikuti filter; keterangan balance menjelaskan cakupan seluruh kontrak. Jadwal kosong yang sudah memiliki negosiasi tetap membawa target monitoring tanpa membuat input gaji atau pembayaran palsu. Penyimpanan gaji bulanan sekarang sekaligus menyinkronkan HonorTenagaAhli dalam satu transaksi dengan penguncian revisi kontrak. Jika salah satu proses gagal, seluruh perubahan dibatalkan. PPh/netto memakai tarif default form honor aplikasi; tarif dan nominal pajak pada pembayaran otomatis yang sudah ada dipertahankan saat nominal tidak berubah. Tidak ada transaksi bank atau jurnal baru yang dibuat oleh proses ini. Penyesuaian Gaji dan Sinkronisasi Laba Rugi tetap mencocokkan catatan honor dengan jurnal. Nilai RAB/negosiasi tidak menggantikan input bulanan dan tidak dianggap terbayar.

Rekap Per Proyek, Rekap Setahun, Akumulasi Tenaga Ahli, dan Konsolidasi Holding awalnya menampilkan **setahun**. Pembayaran Februari tetap masuk akumulasi meski bulan halaman sedang Oktober, selama tahun dan entitasnya sesuai. Akumulasi Tenaga Ahli awalnya memakai **Semua entitas**, dengan dropdown untuk memilih satu entitas. Daftar nama menampilkan jumlah proyek dan total per tenaga ahli, termasuk tenaga ahli terdaftar yang belum memiliki input gaji. Buka nama untuk menampilkan daftar proyek beserta entitas dan ringkasan nominal setiap proyek. Buka proyek tersebut untuk melihat detail gaji per bulan, catatan, tanggal pembayaran, dan tautan tracking. Detail bulanan tidak langsung dibuka saat nama diklik. Nama dengan NIK yang sama digabung tanpa menjumlahkan gaji dua kali. Filter entitas membatasi penugasan serta angka pada entitas tersebut. Pilihan **Bulan dipilih** memfilter bulan dan tahun secara tepat untuk tracking. Pada Akumulasi Tenaga Ahli, urutannya nama → proyek → detail gaji bulanan. Pada rekap lainnya, detail kelompok tetap membuka rincian baris terkait. **Tracking bulan ini** membuka orang/proyek dengan periode baris tersebut dan berpindah ke entitas pemilik proyek, termasuk saat dibuka dari akumulasi semua entitas.

Daftar negosiasi mengikuti bulan terpilih untuk ringkasan nominal dan pembayaran, dengan pilihan Tahun untuk melihat semua input pada tahun itu. Tindak lanjut awalnya hanya memperlihatkan bulan terpilih; **Semua bulan kontrak** menampilkan seluruh jadwal untuk input beberapa bulan atau perpanjangan. Pergantian tampilan tidak menghapus bulan yang tersembunyi: penyimpanan tetap membawa jadwal lengkap. Modal Riwayat Gaji di database juga awalnya memfilter bulan/tahun terpilih.

Periode gaji disimpan dari `bulan`/`tahun` form honor, sedangkan `tanggal` menyimpan tanggal pembayaran. Contoh: gaji Oktober yang dicatat dibayar pada November tetap masuk periode payroll Oktober, dengan tanggal bayar November terlihat di rincian. Payload lama tanpa bulan/tahun mengikuti tanggal. Keduanya harus valid; periode bulan 1–12 dan tahun 2000–2199. Rekonsiliasi jurnal tetap menggunakan periodenya sendiri dan dapat menunjukkan selisih jika tanggal pengeluaran berbeda.

Pada rekap entitas, gaji terisi dialokasikan ke **entitas proyek penugasan**, dengan entitas profil sebagai fallback jika entitas proyek tidak tersedia. Contoh: profil Gaharu yang mengisi gaji Februari Rp10 juta pada proyek Cipta Asri muncul sebagai gaji terisi Rp10 juta di rekap proyek dan akumulasi tenaga ahli Cipta Asri. Setelah Simpan gaji & pembayaran, Rp10 juta juga tercatat pada Sudah dibayar; balance memakai selisih terhadap total negosiasi kontrak. Pembayaran mengikuti entitas pembayar. Konsolidasi Holding mencakup semua entitas sekali tanpa menjumlahkan ulang data yang sama. Database menampilkan gaji terisi pada bulan yang dipilih sebagai pengganti Honor Standar; referensi RAB tetap tersedia pada data kontrak. Pengambilan payroll memakai `cache: no-store` agar refresh sesudah edit/pembayaran mengambil data terbaru.

Verifikasi tambahan: `node tests/tenaga-ahli-tracking.cjs` mencakup dua bulan pembayaran, cicilan, duplikasi ID, perubahan gaji tersimpan, pembayaran lama tanpa master, perbedaan entitas/tahun, dan konsistensi total di semua pengelompokan. Uji MySQL lokal memakai fixture sementara: Februari/Maret dibayar Rp20 juta, gaji Oktober Rp15 juta belum dibayar. Semua rekap setahun sepakat pada gaji terisi Rp35 juta dan pembayaran Rp20 juta; filter Oktober hanya berisi gaji Rp15 juta dan pembayaran Rp0. Fixture pengujian dihapus/di-rollback; data asli pengguna dipertahankan.

Verifikasi pembayaran otomatis: tes PHP mencakup simpan ulang tanpa duplikasi, perubahan nominal, pembayaran manual lama lewat NIK, penolakan nominal di bawah pembayaran manual, gaji kosong, tarif default form honor, entitas proyek, periode gaji, dan rollback transaksi. Pengujian komponen memastikan tombol Catat pembayaran diganti dengan Simpan gaji & pembayaran.

Tes monitoring negosiasi mencakup target Rp35 juta versus pembayaran Rp20 juta (sisa Rp15 juta), pembayaran tepat target, penolakan gaji di atas target, penguncian tambah bulan, pembukaan kembali setelah kenaikan negosiasi, dan balance lintas bulan yang konsisten pada seluruh rekap.
