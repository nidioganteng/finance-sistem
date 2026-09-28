# CLAUDE_KONTROLPIUTANGTERMIN.md

## Konteks Halaman
Halaman **Kontrol Piutang & Status Termin**. Ini gabungan dua fungsi dalam satu halaman: (A) area transisi **Loading Dock** untuk pengeluaran proyek yang belum resmi berkontrak, dan (B) **audit/pelacakan termin** untuk proyek yang sudah resmi berkontrak dan terdaftar di Sidamon.

⚠️ **Ini bagian paling kompleks di seluruh sistem** (integrasi sistem eksternal + audit trail + status periode). Sarankan ke Claude Code untuk dipecah jadi beberapa task terpisah, jangan dikerjakan sekaligus dalam satu komponen besar.

---

## BAGIAN A: Loading Dock

### A.1 Definisi
Loading Dock adalah wadah sementara di bawah **Entitas "Umum/Fleksibel"**, khusus mencatat pengeluaran proyek yang:
- belum jelas bendera entitasnya (Gaharu / Kencana / Tataring / Cipta Asri), atau
- belum ada kontrak resmi (contoh: biaya survei awal, biaya pra-proyek)

Tujuannya: pengeluaran tetap tercatat akurat di sistem walau status kontrak/bendera belum jelas.

⚠️ **Temuan terbaru (perlu konfirmasi klien)**: "Umum" kemungkinan **bukan** area staging virtual yang terpisah dari 5 entitas, tapi nama informal untuk entitas kelima yang nama resminya **Kardi Pratama (kode: KP)**, entitas nyata yang sejajar dengan Gaharu (GS), Kencana (KAK), Tataring (TB), Cipta Asri (CAD), bukan kategori "bukan entitas manapun". Ini ditemukan dari data Hutang Piutang asli (lihat `CLAUDE_HUTANGPIUTANG.md` bagian 5). Kalau benar, implikasinya ke implementasi:
- Loading Dock tetap berfungsi sebagai "area transisi", TAPI transaksinya tercatat sebagai transaksi resmi milik entitas KP/Kardi Pratama, bukan entitas non-real/placeholder.
- Reklasifikasi dari Loading Dock ke entitas lain (bagian A.2) berarti memindahkan transaksi dari pembukuan KP ke pembukuan entitas tujuan, bukan dari "kategori kosong" ke entitas.
- Entitas KP/Umum ini harus tersedia sebagai entitas penuh di modul lain juga (Kas Kecil, Kas Besar, Bank Buku, Hutang Piutang), bukan entitas khusus yang cuma muncul di Loading Dock.

Jangan bangun "Umum" sebagai entitas virtual terpisah sebelum dikonfirmasi ke klien.

### A.2 Mekanisme Akhir Bulan (sebelum Close Book)
Manajer Keuangan + tim me-review daftar transaksi Loading Dock, ada 3 kemungkinan aksi:

1. **Proyek resmi berkontrak** → transaksi direklasifikasi dari entitas Umum ke entitas penerima yang benar, **tanpa input ulang data** (harus ada fitur pindah/reklasifikasi transaksi antar entitas secara massal, bukan hapus-lalu-ketik-ulang).
2. **Proyek dipastikan batal** → pengeluaran dialihkan dan diakui sebagai Biaya Marketing.
3. **Masih menggantung/berjalan** → dibiarkan mengendap di Loading Dock, ditinjau lagi bulan depan.

### A.3 Kebutuhan UI
- Tab/halaman "Loading Dock" menampilkan daftar transaksi yang tag entitasnya "Umum".
- Aksi per transaksi atau per grup transaksi: **"Pindahkan ke Entitas [pilih]"** atau **"Alihkan ke Biaya Marketing"**.
- Reklasifikasi ini harus mengubah akun entitas pada baris Jurnal Umum yang sudah tercatat, sambil mempertahankan tanggal dan nominal transaksi asli (bukan membuat transaksi baru dari nol).

---

## BAGIAN B: Audit / Pelacakan Termin

### B.1 ⚠️ Integrasi dengan Sidamon (sistem eksternal, BUKAN bagian dari codebase ini)

Alur datanya:
1. **Admin Sidamon** input nama proyek + nilai kontrak awal, di aplikasi Sidamon (bukan di sistem keuangan ini).
2. Data itu **sinkron otomatis** ke sistem keuangan sebagai nilai **Piutang awal** proyek tersebut.
3. **Staf Keuangan** input pembayaran termin di sistem keuangan **hanya setelah dana benar-benar masuk rekening bank** (jadi ini terhubung ke transaksi nyata di Kas Kecil/Kas Besar/Bank Buku dengan Kategori "Penerimaan Termin", bukan input independen tanpa bukti kas).
4. Data pembayaran termin ini **sinkron balik** ke Sidamon, jadi laporan progres kerja & pelacakan piutang tertunggak/macet di Sidamon ikut ter-update.

**Belum bisa dikerjakan Claude Code sebelum ada:**
- Dokumentasi API Sidamon (endpoint, format data masuk/keluar, cara autentikasi)
- Kejelasan siapa "sumber kebenaran" (source of truth) untuk tiap data: nilai kontrak awal dari Sidamon, tapi status pembayaran dari sistem keuangan sini — perlu dipastikan tidak ada konflik kalau dua sisi sama-sama mengubah data yang sama.

### B.2 Notifikasi Alert 80% ke CEO
- Begitu total termin yang sudah dibayar untuk satu proyek mencapai atau melebihi **80% dari Nilai Kontrak**, sistem otomatis kirim notifikasi in-app ke CEO/Super Admin.
- Ini murni pemberitahuan (bukan approval/gerbang), tujuannya CEO tahu proyek mana yang progres pembayarannya sudah mendekati selesai.

### B.3 Tampilan Halaman (sudah sesuai mockup yang ada)
- 3 kartu ringkasan: Total Nilai Kontrak Aktif, Total Termin Tertagih, Sisa Piutang Belum Tertagih (dijumlah dari seluruh proyek aktif).
- Tabel Daftar Proyek: Kode, Nama Proyek, Nilai Kontrak, Termin Tertagih, progress bar %.
- Tombol "+ Input Termin Baru": karena aturannya termin baru boleh dicatat SETELAH uang masuk kas/bank (lihat B.1 poin 3), form ini idealnya berupa **pemilihan transaksi kas/bank yang sudah ada** untuk dikaitkan ke proyek & termin tertentu, bukan staf mengetik ulang nominal secara manual dan terpisah dari transaksi kasnya.

---

## BAGIAN C: Titik Temu Loading Dock dan Audit Termin

### C.1 Pemisahan Data
Transaksi di Loading Dock bersifat tentatif, **belum** masuk skema audit termin, karena belum ada kontrak resmi = belum ada nilai Piutang yang sah di Sidamon.

### C.2 Titik Masuk Siklus Termin
Begitu proyek di Loading Dock dapat kepastian kontrak dan bendera entitas (Bagian A.2 poin 1), dan kontrak itu didaftarkan di Sidamon (Bagian B.1), barulah nilai Piutang resmi terbentuk dan siklus audit termin (Bagian B) mulai aktif untuk proyek itu.

### C.3 ⚠️ Backdate Alert (Audit Trail) — Butuh Konsep "Close Book"

- Kalau reklasifikasi Loading Dock → entitas utama terjadi di **bulan yang sama** (periode belum ditutup), data langsung update normal, tidak perlu alert.
- Kalau reklasifikasi itu mengubah data di **bulan yang statusnya sudah ditutup (Close Book)**, sistem harus:
  1. Tetap mengizinkan perubahan (tidak di-block total), TAPI
  2. Mencatatnya sebagai **"transaksi backdate"**
  3. Mengirim notifikasi alert otomatis ke CEO untuk keperluan audit trail

**Prasyarat yang belum ada di dokumen manapun sebelumnya**: sistem harus punya konsep eksplisit **status periode per bulan** (terbuka/ditutup). Ini belum pernah dibahas di `CLAUDE_JURNALUMUM.md` atau dokumen lain manapun. **Perlu dicek dulu ke tim**: apakah fitur "Close Book" ini sudah direncanakan di bagian sistem lain, atau ini kebutuhan baru yang harus didesain dari nol (siapa yang berwenang menutup buku bulanan — kemungkinan Manajer Keuangan atau Super Admin, kapan waktunya, apakah bisa dibuka lagi kalau perlu koreksi, dst).

---

## Tugas untuk Claude Code

1. **Cek dulu** apakah konsep "Close Book"/status periode sudah ada di bagian sistem manapun. Kalau belum, ini prasyarat yang harus didesain dan dikonfirmasi ke tim dulu sebelum bagian C.3 bisa dibangun.
2. **Jangan mulai coding integrasi Sidamon** sebelum ada dokumentasi API resminya. Untuk sementara, boleh bangun sisi sistem keuangan-nya dengan asumsi data kontrak awal diinput manual dulu (placeholder), supaya pengembangan bagian lain tidak terhambat menunggu Sidamon.
3. Bangun Bagian A (Loading Dock) sebagai tab terpisah di halaman ini, dengan aksi reklasifikasi transaksi.
4. Bangun notifikasi 80% (Bagian B.2), ini tidak bergantung pada integrasi Sidamon, bisa dikerjakan lebih dulu.
5. Sarankan pecah pengerjaan bagian ini jadi beberapa PR/task terpisah: (1) Loading Dock, (2) tampilan Kontrol Piutang dasar + notifikasi 80%, (3) Close Book & backdate alert, (4) integrasi Sidamon — dikerjakan terakhir setelah API-nya jelas.
