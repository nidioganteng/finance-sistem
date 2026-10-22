# Kas Transitory

## Alur penggunaan

1. Catat cash out di Kas Besar, Kas Kecil, Buku Bank, atau Entry Jurnal yang terposting ke kas/bank. Biaya tetap diakui oleh transaksi asal.
2. Buka **Kas Transitory** pada sidebar, pilih entitas, lalu **Tambah dana ditahan**. Pilih bukti cash out asal. Sistem menampilkan sisa nominal yang belum dialokasikan.
3. Isi kategori (Gaji di-hold, Marketing, Uang muka proyek, Operasional tertunda), nama penerima hak, nominal, posisi fisik uang, alasan/tujuan pembayaran, dan target tanggal penyerahan. Seluruhnya wajib. Proyek mengikuti transaksi asal. Untuk gaji, pilih tautan payroll opsional agar nominal juga diperiksa terhadap gaji terkait.
4. Dana ditahan menjadi saldo terpisah yang hanya dapat diserahkan kepada penerima tercatat atau dibatalkan melalui reversal. Dana ini tidak menjadi rekening/COA yang dapat dipilih sebagai sumber biaya operasional. Saldo kas utama sudah berkurang pada cash out pertama; sistem tidak menguranginya dua kali.
5. **Cairkan** mencatat tanggal aktual, nominal, nomor bukti transfer/tanda terima, dan catatan. Pencairan boleh sebagian; sisa tetap ditahan. Pencairan penuh memberi status RELEASED. Aksi ini tidak membuat transaksi kas atau beban baru.
6. **Reversal**, khusus SUPER_ADMIN/MANAJER_KEUANGAN, memerlukan nominal, tanggal, bukti persetujuan/pengembalian, dan alasan pembatalan. Sistem membalik baris kas/jurnal asal secara proporsional terhadap dana yang dibatalkan, mempertahankan mirror jurnal agar tidak menggandakan biaya, dan memperbarui biaya proyek. Riwayat tidak dihapus. Reversal boleh atas sisa setelah pencairan sebagian; bagian yang sudah diserahkan tidak dapat dibatalkan lewat modul ini.

Contoh: cash out Rp10 juta, hold Rp10 juta, release Rp6 juta, reversal sisa Rp4 juta. Saldo transitory nol, penerima memperoleh Rp6 juta, kas utama memperoleh kembali Rp4 juta, dan biaya asal dikoreksi menjadi Rp6 juta. Dana yang sudah dibatalkan tidak dapat dialokasikan ulang dari bukti lama; pencatatan baru memerlukan cash out baru.

## Monitoring dan balance

- HELD: masih ditahan dan belum melewati target; OVERDUE: masih bersisa setelah target (acuan tanggal WIB); RELEASED: seluruh dana diserahkan; REVERSED: terdapat pembatalan dan tidak ada sisa.
- Ringkasan mencakup semua periode dalam entitas aktif. Pencarian mendukung penerima, proyek, bukti, alasan, dan posisi uang; filter mendukung status serta Unbalanced.
- Balance Check memeriksa fingerprint baris cash out asal, total alokasi tidak melebihi sumber, saldo awal dikurangi seluruh release/reversal, serta keberadaan/nominal payroll jika ditautkan. Perubahan/hilangnya sumber atau payroll ditandai Unbalanced. Pencairan/reversal diblokir jika sumber/payroll tidak cocok.
- Bukti kas/jurnal yang sudah ditautkan dan bukti reversal dikunci dari edit/hapus di endpoint kas dan Entry Jurnal. Alokasi menggunakan penguncian baris sumber; event menggunakan penguncian hold dan revision untuk mencegah pencairan bersamaan. ID permintaan membuat retry hold/event idempotent; retry dengan isi berbeda ditolak.
- Ringkasan gaji ditahan muncul di halaman Payroll untuk seluruh periode. Pembayaran tercatat pada laporan payroll bukan bukti bahwa dana sudah diserahkan. Tautkan payroll saat input agar nominal terpantau. Jika tidak ditautkan, panel menyebutkannya secara eksplisit.
- Balance Check memeriksa **data yang dicatat**. Sistem tidak dapat membuktikan saldo fisik brankas atau menemukan hold yang belum pernah dicatat/ditandai oleh finance. Pemeriksaan fisik dan kelengkapan daftar hold tetap perlu dilakukan finance.

## Batas sumber dan akses

Sumber harus merupakan bukti pembayaran dengan tepat satu cash out kas/bank dan baris yang seimbang per jenis input. Bukti crossing antar entitas, pemindahbukuan internal, atau faktur penerimaan tidak dipakai sebagai sumber langsung. Ini mencegah pemindahan kas dianggap sebagai pembayaran penerima. Pilihan sumber tetap manual dan harus sesuai penerima/tujuan sebenarnya.

Staf hanya dapat membaca/menulis entitas yang diizinkan UserEntityAccess; manajer/admin dapat mengelola modul. Role lain ditolak di halaman dan API. Pencairan merupakan **pencatatan penyerahan**, bukan instruksi transfer bank. Keputusan pembatalan hak pembayaran dibuat oleh pihak berwenang, bukan otomatis oleh aplikasi. Catatan create dan event menyimpan aktor/tanggal; ActivityLog mencatat aksi tambahan.

## Deployment dan verifikasi

Jalankan `database/migrations/2026-10-22-kas-transitory.sql` pada database target. API mempunyai fallback pembuatan tabel mengikuti pola aplikasi. Tabel KasTransitory menyimpan referensi sumber, snapshot, penerima, alasan, lokasi, nominal, dan revision; KasTransitoryEvent menyimpan riwayat release/reversal. Tidak ada data transaksi nyata yang dibuat sebagai fixture otomatis.

Perubahan payroll terkait kebijakan PPh perusahaan menggunakan migration terpisah `2026-10-22-pph-tenaga-ahli-perusahaan.sql`. PPh tenaga ahli tetap manual dan dilaporkan, tetapi gaji diterima sama dengan honor sebelum PPh. Nominal honor dan PPh lama dipertahankan; migration menyamakan nominalBersih dengan nominalHonor. Payroll pegawai tetap sudah tidak mengurangi THP dengan PPh; potongan non-PPh yang berlaku tetap mengikuti alur sebelumnya. Tidak ada gross-up atau jurnal pajak otomatis baru.

Verifikasi: `php tests/kas-transitory.php`, `node tests/kas-transitory.cjs`, tes payroll/rekap/master/PTKP, PHP lint, TypeScript, dan build Next.js terpisah. Pengujian MySQL lokal memakai fixture sementara dengan rollback, termasuk retry, pencairan parsial, koreksi kas/biaya, dan saldo akhir. Pengujian browser interaktif belum tersedia karena izin Computer Use tidak diberikan.
