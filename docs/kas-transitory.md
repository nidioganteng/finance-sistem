# Kas Transitory

## Alur penggunaan

1. Catat bukti cash out di Kas Besar, Kas Kecil, Buku Bank, atau Entry Jurnal yang terposting ke kas/bank. Tanggal bukti ini menjadi tanggal pencatatan transitory dan pengeluaran berikutnya.
2. Buka **Transaksi → Kas Transitory** pada sidebar, pilih entitas, lalu **Tambah dana ditahan**. Pilih bukti cash out asal. Sistem menampilkan sisa nominal yang belum dialokasikan.
3. Isi kategori (Gaji di-hold, Marketing, Uang muka proyek, Operasional tertunda), nama penerima hak, nominal, posisi fisik uang, alasan/tujuan pembayaran, dan target tanggal penyerahan. Seluruhnya wajib. Proyek mengikuti transaksi asal. Untuk gaji, pilih tautan payroll opsional agar nominal juga diperiksa terhadap gaji terkait.
4. Dana ditahan tetap kas perusahaan dan belum menjadi pengeluaran. Saat hold disimpan, sistem mereklasifikasi bagian biaya/aset pembayaran ke akun aset kas terbatas 159-TR (Kas Transitory), menggunakan tanggal bukti awal. Kas utama yang tersedia untuk operasional tetap berkurang, tetapi total kas perusahaan mencakup saldo transitory. Akun ini tidak dapat dipakai sebagai sumber operasional atau diubah manual.
5. **Cairkan** mencatat tanggal aktual, nominal, nomor bukti transfer/tanda terima, dan catatan. Pencairan boleh sebagian; sisa tetap ditahan. Pencairan penuh memberi status RELEASED. Aksi ini mengakui pengeluaran sekali sesuai nominal yang diserahkan, melalui reklasifikasi kas ditahan ke akun pembayaran asal. Tanggal pembukuannya memakai tanggal bukti awal, bukan tanggal penyerahan aktual. Tidak ada pemotongan bank kedua.
6. **Reversal**, khusus SUPER_ADMIN/MANAJER_KEUANGAN, memerlukan nominal, tanggal, bukti persetujuan/pengembalian, dan alasan pembatalan. Sistem memindahkan nominal yang dibatalkan dari kas transitory kembali ke kas utama. Dana yang belum diserahkan belum menjadi biaya, sehingga reversal tidak membuat pendapatan atau biaya baru. Mirror kas/bank tetap seimbang dan tidak menggandakan laporan. Riwayat tidak dihapus. Reversal boleh atas sisa setelah pencairan sebagian; bagian yang sudah diserahkan tidak dapat dibatalkan lewat modul ini.

Contoh: cash out Rp10 juta, hold Rp10 juta, release Rp6 juta, reversal sisa Rp4 juta. Saldo transitory nol, penerima memperoleh Rp6 juta, kas utama memperoleh kembali Rp4 juta, dan pengeluaran yang diakui hanya Rp6 juta. Selama seluruh Rp10 juta masih ditahan, pengeluaran nol dan total kas perusahaan masih mencakup Rp10 juta. Dana yang sudah dibatalkan tidak dapat dialokasikan ulang dari bukti lama; pencatatan baru memerlukan cash out baru.

## Monitoring dan balance

- HELD: masih ditahan dan belum melewati target; OVERDUE: masih bersisa setelah target (acuan tanggal WIB); RELEASED: seluruh dana diserahkan; REVERSED: terdapat pembatalan dan tidak ada sisa.
- Ringkasan mencakup semua periode dalam entitas aktif. Pencarian mendukung penerima, proyek, bukti, alasan, dan posisi uang; filter mendukung status serta Unbalanced.
- Balance Check memeriksa fingerprint baris cash out asal, total alokasi tidak melebihi sumber, saldo awal dikurangi seluruh release/reversal, serta keberadaan/nominal payroll jika ditautkan. Perubahan/hilangnya sumber atau payroll ditandai Unbalanced. Pencairan/reversal diblokir jika sumber/payroll tidak cocok.
- Bukti kas/jurnal yang sudah ditautkan dan bukti reversal dikunci dari edit/hapus di endpoint kas dan Entry Jurnal. Alokasi menggunakan penguncian baris sumber; event menggunakan penguncian hold dan revision untuk mencegah pencairan bersamaan. ID permintaan membuat retry hold/event idempotent; retry dengan isi berbeda ditolak.
- Ringkasan gaji ditahan muncul di halaman Payroll untuk seluruh periode. Pembayaran tercatat pada laporan payroll bukan bukti bahwa dana sudah diserahkan atau sudah diakui sebagai pengeluaran. Tautkan payroll saat input agar nominal terpantau. Jika tidak ditautkan, panel menyebutkannya secara eksplisit.
- Balance Check memeriksa **data yang dicatat**. Sistem tidak dapat membuktikan saldo fisik brankas atau menemukan hold yang belum pernah dicatat/ditandai oleh finance. Pemeriksaan fisik dan kelengkapan daftar hold tetap perlu dilakukan finance.

## Batas sumber dan akses

Sumber harus merupakan bukti pembayaran dengan tepat satu cash out kas/bank dan baris yang seimbang per jenis input. Bukti crossing antar entitas, pemindahbukuan internal, atau faktur penerimaan tidak dipakai sebagai sumber langsung. Ini mencegah pemindahan kas dianggap sebagai pembayaran penerima. Pilihan sumber tetap manual dan harus sesuai penerima/tujuan sebenarnya.

Staf hanya dapat membaca/menulis entitas yang diizinkan UserEntityAccess; manajer/admin dapat mengelola modul. Role lain ditolak di halaman dan API. Pencairan merupakan **pencatatan penyerahan**, bukan instruksi transfer bank. Keputusan pembatalan hak pembayaran dibuat oleh pihak berwenang, bukan otomatis oleh aplikasi. Catatan create dan event menyimpan aktor/tanggal; ActivityLog mencatat aksi tambahan.

## Deployment dan verifikasi

Jalankan `database/migrations/2026-10-22-kas-transitory.sql` pada database target. API mempunyai fallback pembuatan tabel mengikuti pola aplikasi. Tabel KasTransitory menyimpan referensi sumber, snapshot, penerima, alasan, lokasi, nominal, dan revision; KasTransitoryEvent menyimpan riwayat release/reversal. Tidak ada data transaksi nyata yang dibuat sebagai fixture otomatis. Untuk tabel yang sudah ada, buka modul/API agar kolom versi pembukuan disiapkan, kemudian jalankan `php scripts/migrate-transitory-cash-recognition.php` sebagai preview dan tambahkan `--apply`. Script membuat backup lokal terbatas, mengompensasi reversal lama bila ada, dan memindahkan data ke aturan baru secara atomik/idempotent tanpa mengubah tanggal penyerahan/receipt/catatan lama.

Perubahan payroll terkait kebijakan PPh perusahaan menggunakan migration terpisah `2026-10-22-pph-tenaga-ahli-perusahaan.sql`. PPh tenaga ahli tetap manual dan dilaporkan, tetapi gaji diterima sama dengan honor sebelum PPh. Nominal honor dan PPh lama dipertahankan; migration menyamakan nominalBersih dengan nominalHonor. Payroll pegawai tetap sudah tidak mengurangi THP dengan PPh; potongan non-PPh yang berlaku tetap mengikuti alur sebelumnya. Tidak ada gross-up atau jurnal pajak otomatis baru.

Verifikasi: `php tests/kas-transitory.php`, `node tests/kas-transitory.cjs`, tes payroll/rekap/master/PTKP, PHP lint, TypeScript, dan build Next.js terpisah. Pengujian MySQL lokal memakai fixture sementara dengan rollback, termasuk retry, pencairan parsial, koreksi kas/biaya, dan saldo akhir. Pengujian browser interaktif belum tersedia karena izin Computer Use tidak diberikan.


## Tanggal, saldo kas, dan laporan

Tanggal bukti cash out awal adalah tanggal pencatatan. Event menyimpan tanggal penyerahan/pembatalan aktual dan nomor bukti tersendiri. Contoh bukti 5 Oktober, penyerahan 12 November: pengeluaran hanya muncul setelah penyerahan dicatat, tetapi masuk periode Oktober dengan tanggal 5 Oktober. Dengan demikian, laporan periode awal dapat berubah setelah pencairan dicatat. Tidak ada pemindahan tanggal penyerahan aktual ke tanggal awal.

Dashboard memisahkan total kas perusahaan, kas tersedia operasional, dan kas transitory. Neraca tetap menempatkan 159-TR sebagai aset lancar; saldo ditahan yang berasal dari tahun sebelumnya tetap dimonitor sampai selesai dan tidak diinput ulang sebagai saldo awal manual akun 159-TR. Saldo awal kas utama harus merepresentasikan kas tersedia, tidak menggandakan dana ditahan yang sudah terpisah. Arus kas bruto mengecualikan pemindahan internal HOLD/REVERSAL dan hanya memasukkan RELEASE sebagai pengeluaran pada periode bukti awal. Pengeluaran/biaya proyek dan laba rugi mengikuti posting yang sama.

Rekonsiliasi payroll akun 511/612 menggunakan beban bersih (debet dikurangi kredit), digabung per bukti asal/akun/proyek. HOLD, RELEASE, dan koreksi reversal lama tidak ditampilkan sebagai pembayaran baru. Periode akrual tetap mengikuti bukti asal, termasuk bila pencairannya dicatat pada bulan/tahun berbeda. Dana yang masih ditahan menghasilkan beban nol; pencairan parsial hanya mengakui nominal yang diserahkan. Selisih dengan modul payroll tetap ditampilkan bila data gajinya belum dicatat atau nominalnya berbeda; sistem tidak membuat data gaji personal secara otomatis dari jurnal manual.

Daftar Akun tetap menampilkan seluruh mutasi debet/kredit agar sesuai buku besar. Contoh cash out Rp1 juta, HOLD Rp1 juta, RELEASE Rp1 juta: mutasi beban debet Rp2 juta dan kredit Rp1 juta menghasilkan saldo akhir/beban bersih Rp1 juta, bukan dua kali pembayaran. Jalankan `php tests/payroll-transitory-sync.php` untuk regresi rekonsiliasi ini.

Nomor bukti transitory menggunakan urutan primary key tabel `KasTransitoryVoucher`, misalnya `KTH-000001` (hold), `KTL-000002` (release), `KTR-000003` (reversal), dan `KTC-000004` (kompensasi legacy). Posting yang sama memperoleh nomor yang sama; primary key UUID transaksi tetap dipertahankan. Semua baris debet/kredit satu bukti memakai nomor yang sama. Tabel urutan disiapkan otomatis sebelum transaksi modul. Untuk menyingkat nomor lama, jalankan `php scripts/shorten-transitory-vouchers.php --apply`; script membuat backup, memperbarui nomor dan referensi event secara atomik, tanpa mengubah nominal/ID transaksi. Nomor urut dapat berlubang setelah rollback dan tidak dipotong saat melewati enam digit.
