# CLAUDE.md

Instruksi ini dibaca otomatis oleh Claude Code setiap sesi baru di repo ini. Isinya konteks
project + konvensi yang sudah dipakai, supaya kerjaan lanjutannya konsisten dengan yang sudah ada,
bukan mulai dari gaya/asumsi baru.

---

## Tentang project ini

Sistem Data Keuangan internal untuk **Gaharu Sempana Group**, holding dengan 4 anak perusahaan
konstruksi/properti (Gaharu, Kencana, Tataring, Cipta Asri) + 1 entitas "Umum" (ruang transit untuk
transaksi KSO / pinjam bendera antar entitas). Awalnya dibuat sebagai Kerja Praktek oleh tim 2
mahasiswa Undiknas.

Project ini adalah hasil konversi dari mockup desain (dibuat di Claude Design) ke aplikasi
full-stack sungguhan. **File mockup asli ada di `design-reference/`** (kalau belum ada, minta user
taruh `Sistem_Data_Keuangan_Gaharu_Sempana_dc.html` dan `support.js` di situ) — file itu HTML/CSS/JS
statis dengan custom template syntax (`{{ }}`, `<sc-if>`, `<sc-for>`) yang dirender oleh `support.js`,
BUKAN React beneran. Isinya cuma referensi visual & struktur data dummy, jangan pernah disalin
mentah-mentah.

**Cara pakai mockup itu untuk halaman yang belum dibangun:**
1. Buka file mockup, cari blok `<sc-if value="{{ isXxxScreen }}">...</sc-if>` yang sesuai nama layar.
2. Baca struktur visual (warna, spacing, tabel/card apa aja) dan bentuk data yang dipakai (lihat
   `renderVals()` di `<script type="text/x-dc" data-dc-script>` untuk tau field-field apa yang
   dibutuhkan layar itu).
3. Bangun ulang pakai komponen React/Tailwind asli mengikuti pola yang sudah ada di halaman lain
   (lihat "Konvensi" di bawah), JANGAN import atau jalankan `support.js`.
4. Ganti semua data dummy dengan fetch ke PHP backend via `phpFetch()`.

---

## Tech stack

Branch ini (`feat/php-conversion`) adalah versi yang ditargetkan ke **Hostinger shared hosting**
yang tidak support Node.js sebagai runtime. Arsitekturnya:

- **Frontend**: Next.js 14 (App Router, TypeScript) — di-deploy sebagai static export atau Node.js
  edge (bergantung konfigurasi Hostinger)
- **Backend**: PHP murni (`api/` folder di root) — plain PHP + PDO, tanpa framework. Berjalan di
  Apache/PHP Hostinger. 26+ route files, satu entry point `api/index.php`.
- **Database**: MySQL — diakses langsung via PDO dari PHP, **bukan** dari Next.js
- **Auth**: NextAuth v4 (Credentials provider, JWT session). Credentials di-validate ke
  `POST /api/auth/login` PHP. Token PHP (JWT) disimpan di session sebagai `session.user.phpToken`
  dan dikirim ke semua request PHP via `Authorization: Bearer <token>`.
- **API client**: semua fetch ke PHP backend lewat `phpFetch<T>()` di `src/lib/api-client.ts`
- Tailwind CSS dengan token warna custom di `tailwind.config.ts`
- recharts untuk chart, lucide-react untuk icon

**Perbedaan kunci dari branch `develop` (Next.js full-stack + Prisma):**
- Tidak ada Prisma, tidak ada `lib/prisma.ts`, tidak ada `prisma/` folder
- Enum TypeScript (Role, TerminStatus, dll) didefinisikan lokal di `src/types/app-enums.ts`
  (bukan import dari `@prisma/client`)
- Semua query DB ada di PHP (`api/routes/*.php`), bukan di `lib/*.ts`
- `lib/*.ts` tetap ada tapi isinya `phpFetch()` ke endpoint PHP, bukan query Prisma langsung

---

## Struktur & konvensi yang SUDAH dipakai — ikuti pola ini untuk halaman baru

```
src/
  app/(app)/<route>/page.tsx   -> route yang butuh login (dijaga middleware.ts)
  app/login/page.tsx, app/register/page.tsx -> halaman publik
  components/layout/           -> Sidebar, PageHeader, EntitySwitcher, UserBadge, ThemeToggle
  components/<fitur>/          -> komponen spesifik satu fitur
  lib/rbac.ts                  -> daftar nav sidebar per role + helper role
  lib/auth.ts                  -> config NextAuth (credentials → POST /api/auth/login ke PHP)
  lib/api-client.ts            -> phpFetch<T>() helper + getPhpToken() + ApiError
  lib/<fitur>.ts               -> fungsi read-only yang fetch data dari PHP endpoint
  lib/actions/<fitur>.ts       -> Server Actions ("use server") untuk create/update/delete ke PHP
  types/app-enums.ts           -> semua enum lokal (Role, TerminStatus, CoaKategori, dll)

api/
  index.php                    -> entry point PHP, routing semua request
  config/db.php                -> koneksi PDO MySQL
  helpers/auth.php             -> JWT decode + require_auth()
  helpers/utils.php            -> json_response(), error_response(), uuid4(), log_activity()
  routes/<fitur>.php           -> handler per fitur (GET/POST/PUT/DELETE/PATCH)
```

**Pola satu halaman (contoh: lihat `src/app/(app)/jurnal/page.tsx`):**
- `page.tsx` adalah **server component** async: `getServerSession(authOptions)`, cek role kalau
  halaman itu terbatas, resolve entity dari `searchParams.entity`, panggil fungsi dari `lib/<fitur>.ts`
  (yang di dalamnya memanggil `phpFetch()`), lalu render pakai `<PageHeader>` + komponen tampilan.
- Semua logic fetch data taruh di `lib/<fitur>.ts`, bukan langsung di `page.tsx`.
- Interaksi client (toggle, form, dropdown) jadi komponen terpisah dengan `"use client"`.
- Form yang nulis data pakai Server Action di `lib/actions/<fitur>.ts`, dipanggil dari client
  component pakai `useTransition`. Server Action memanggil `phpFetch()` ke PHP endpoint.

**PHP backend — pola per endpoint:**
- Semua file route PHP mulai dengan `if (!defined('APP_ENTRY')) die(...)` (keamanan direct access)
- Gunakan `require_auth()` di awal untuk endpoint yang butuh JWT
- `$method` (GET/POST/PUT/PATCH/DELETE), `$segments[]` (path segments), `$body` (parsed JSON body)
  sudah tersedia dari `index.php`
- Response selalu `json_response([...])` atau `error_response('pesan', kode_http)`
- DECIMAL dari MySQL **selalu di-cast ke float** sebelum masuk response:
  `$row['nominal'] = (float)$row['nominal']` — kalau tidak, PHP PDO mengirim string `"0.00"`
  yang menyebabkan NaN di JavaScript sisi client

**Akses entity & role — JANGAN bikin ulang, pakai yang sudah ada:**
- `session.user.role` dan `session.user.entityKeys` sudah tersedia di semua server component.
- `canViewGrupAggregate(role)` di `lib/rbac.ts` nentuin siapa yang boleh lihat agregat "Semua
  Entitas" (cuma SUPER_ADMIN & MANAJER_KEUANGAN). STAF_KEUANGAN selalu terkunci ke entity
  pertama di `entityKeys`-nya.
- Nav sidebar per role SUDAH final — tetap tambahkan guard role di setiap `page.tsx` halaman baru.

**Design token — JANGAN pakai warna hex manual, pakai class Tailwind custom di `tailwind.config.ts`:**
`bg-navy`, `text-navy-text`, `bg-brand` / `text-brand`, `text-muted` / `muted-strong` /
`muted-stronger` / `muted-faint` / `muted-faintest`, `border-border` / `border-border-soft`,
`bg-surface-page` / `surface-card` / `surface-subtle` / `surface-input` / `surface-hover`,
`text-status-green` / `status-red` / `status-amber`, `rounded-pill`.

**Dark mode — sudah aktif di semua halaman:**
- Mekanismenya: class `dark` di `<html>`, di-toggle oleh `ThemeToggle.tsx`, disimpan di `localStorage`.
- Pakai token di atas (`bg-surface-*`, `text-muted*`, dll) — dark mode otomatis, tanpa `dark:` manual.
- Untuk badge dengan warna Tailwind stok, tambahkan varian `dark:` manual:
  `"bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"`.
- Untuk chart recharts, warna pakai `"rgb(var(--color-xxx))"` langsung (recharts butuh nilai, bukan class).

---

## Model data — ringkasan (sumber kebenaran: `api/routes/*.php`)

Karena Prisma sudah dihapus, schema canonical ada di logika PHP dan MySQL langsung.
Enum-enum TypeScript yang masih dipakai di frontend ada di `src/types/app-enums.ts`.

- **User** + `Role` (SUPER_ADMIN, MANAJER_KEUANGAN, STAF_KEUANGAN, MANAGER_ADMIN, ADMIN_SIDAMON)
  + `UserStatus` (PENDING/ACTIVE/INACTIVE, untuk alur approval registrasi)
- **Entity** + **UserEntityAccess** (many-to-many, terpisah dari role)
- **Project**, **Termin** (per project, status: ON_TRACK / AT_RISK / NEEDS_AUDIT)
- **CoaAccount** (Bagan Akun, kategori: PENDAPATAN/BEBAN/ASET/KEWAJIBAN/MODAL)
- **JenisInputTransaksi** (Kas Kecil/Besar/Bank Buku bawaan + custom buatan Staf)
- **Transaction** — satu baris = satu leg akun. Beberapa baris berbagi `noBukti` untuk satu
  transaksi multi-akun. `debit`/`kredit` merepresentasikan arah dana (bukan double-entry murni).
- **LoadingDockTransaksi** — transaksi KSO/pinjam bendera di entitas Umum.
- **FakturPendapatan** — faktur pajak (e-faktur), sumber data Laporan Pendapatan.
- **RekonsiliasiPajakBulanan** — input DPP/PPN/PPh yang dilaporkan ke kantor pajak per bulan.
- **Rekanan** (VENDOR/KLIEN/TENAGA_AHLI/SUBKONTRAKTOR/LAINNYA), **Pegawai**, **GajiPegawaiBulanan**,
  **HonorTenagaAhli**, **AsetTetap**, **Notifikasi**, **ActivityLog**, **Dokumen**

---

## Sudah dibangun

- **Auth & akun**: Login, Register (alur approval), Manajemen Pengguna.
- **Overview**: Dashboard, Notifikasi, Log Aktivitas.
- **Operasional harian**: Jurnal Umum, Kas Kecil, Kas Besar, Bank Buku, Kontrol Piutang & Termin,
  Jurnal Transaksi.
- **Laporan**: Buku Besar, Neraca, Laba Rugi, Arus Kas, Profitabilitas Proyek, Laporan Keuangan,
  Laporan Pajak (Rekap E-Faktur + Rekonsiliasi), Aktiva Tetap, Payroll.
- **Pengaturan**: Bagan Akun, Dokumen & SOP, Kelola Jenis Input, Rekanan, Validasi Pajak 3 Arah.
- **Dark mode**: aktif di semua halaman.

---

## Menjalankan project

**PHP backend** (Hostinger / lokal dengan Apache+PHP):
- Taruh folder `api/` di root public hosting
- Buat `.env` PHP atau set environment variable: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`,
  `JWT_SECRET`, `JWT_EXPIRES_IN` (default: `30d`)
- PHP 8.x, ekstensi PDO + PDO_MySQL wajib aktif

**Next.js frontend**:
```
npm install
cp .env.example .env.local   # isi NEXTAUTH_SECRET, PHP_API_URL, NEXTAUTH_URL
npm run dev
```

**Environment variables penting:**
- `PHP_API_URL` — URL base PHP backend, contoh: `http://localhost:8000` (dev) atau
  `https://yourdomain.com` (prod)
- `NEXT_PUBLIC_PHP_API_URL` — sama, untuk client-side (kalau perlu)
- `NEXTAUTH_SECRET` — random secret untuk NextAuth JWT
- `NEXTAUTH_URL` — URL Next.js app

---

## Kontrol Piutang & Termin — konteks bisnis

Halaman `/piutang` adalah **gabungan dua fungsi**: (A) Loading Dock untuk pengeluaran proyek yang
belum resmi berkontrak, dan (B) audit/pelacakan termin untuk proyek yang sudah berkontrak.

⚠️ **Ini bagian paling kompleks di sistem** (integrasi sistem eksternal + audit trail + status periode).

### A. Loading Dock

Loading Dock adalah wadah sementara di bawah **Entitas "Umum"**, mencatat pengeluaran proyek yang
belum jelas bendera entitasnya atau belum ada kontrak resmi.

⚠️ **Temuan (perlu konfirmasi klien)**: "Umum" kemungkinan bukan area staging virtual, tapi nama
informal untuk entitas kelima yang nama resminya **Kardi Pratama (kode: KP)**, entitas nyata sejajar
dengan Gaharu/Kencana/Tataring/Cipta Asri. Kalau benar, transaksi Loading Dock tercatat sebagai
transaksi resmi milik KP, bukan entitas placeholder. Jangan bangun "Umum" sebagai entitas virtual
sebelum dikonfirmasi ke klien.

**Mekanisme akhir bulan** — Manajer Keuangan review Loading Dock, 3 kemungkinan aksi:
1. Proyek resmi berkontrak → reklasifikasi ke entitas penerima (tanpa input ulang)
2. Proyek batal → alihkan jadi Biaya Marketing
3. Masih menggantung → biarkan, tinjau bulan depan

### B. Audit Termin

⚠️ **Integrasi Sidamon** (sistem eksternal, BUKAN bagian codebase ini):
1. Admin Sidamon input nama proyek + nilai kontrak di Sidamon
2. Data sinkron ke sistem keuangan sebagai Piutang awal
3. Staf Keuangan input pembayaran termin di sistem keuangan **setelah dana masuk rekening**
4. Data pembayaran sinkron balik ke Sidamon

**Belum bisa diimplementasi** sebelum ada dokumentasi API Sidamon. Untuk sementara, nilai kontrak
diinput manual sebagai placeholder.

**Notifikasi 80%**: begitu total termin yang dibayar ≥ 80% Nilai Kontrak, sistem kirim notifikasi
in-app ke CEO/Super Admin (ini tidak bergantung integrasi Sidamon, sudah bisa dibangun).

### C. Backdate Alert & Close Book

Kalau reklasifikasi Loading Dock mengubah data di bulan yang sudah ditutup (Close Book), sistem
harus mencatatnya sebagai "transaksi backdate" dan kirim notifikasi ke CEO.

**Prasyarat belum ada**: sistem belum punya konsep eksplisit status periode per bulan
(terbuka/ditutup). Perlu dikonfirmasi ke tim: siapa yang berwenang tutup buku bulanan, kapan
waktunya, apakah bisa dibuka lagi untuk koreksi.

---

## Laporan Pendapatan (Rekap E-Faktur) — konteks bisnis

Halaman `/pajak` mencakup Laporan Pendapatan. Ini **beda alur** dari Neraca/Laba Rugi/Arus Kas —
sumber datanya adalah **faktur pajak per transaksi**, bukan Buku Besar.

*Disusun dari hasil membaca sheet `PENDAPATAN` di file Excel asli klien (`LAPORAN_KEUANGAN_TB_2026.xlsx`).*

### Input: Data per Faktur Pajak

Satu baris = satu transaksi penjualan yang sudah terbit faktur pajaknya.

| Field | Wajib | Catatan |
|---|---|---|
| NPWP | ya | NPWP klien/rekanan |
| No. Faktur | ya | Nomor e-faktur resmi |
| Masa Pajak | ya | Bulan pajak |
| Nama Rekanan | ya | Nama klien (sering instansi pemerintah) |
| Nama JKP | ya | Deskripsi jasa yang difakturkan |
| DPP | ya | Dasar Pengenaan Pajak |
| DPP Nilai Lain | ya | Varian DPP, basis hitung PPN |
| Kode Jenis Proyek | ya | 1 = Perencanaan, 2 = Pengawasan |
| Pekerjaan Perusahaan | tidak | Porsi nilai pekerjaan milik entitas sendiri |
| Pekerjaan yang Dipinjam | tidak | Porsi pakai bendera/lisensi entitas lain dalam grup |
| Tanggal Terima | ya | Tanggal uang benar-benar diterima di bank |
| Bank | ya | Rekening tujuan (BRI/BPD/MDR/BNI dst) |
| Nominal Diterima | ya | Nominal yang cair ke rekening |
| Kode Proyek | tidak | Dari daftar proyek Kontrol Piutang, kalau terkait proyek berkontrak |

⚠️ Field Tanggal Terima/Bank/Nominal Diterima idealnya terhubung ke transaksi Bank Buku yang sudah
ada (pilih transaksi penerimaan), bukan diketik ulang manual, supaya tidak dobel pencatatan.

### Proses Otomatis: Perhitungan Pajak

| Field | Formula |
|---|---|
| PPN | `DPP Nilai Lain × tarif PPN` |
| PPh | `DPP × 3.5%` |
| Nilai Proyek | `DPP × 111/100` |
| Laba Setelah Pajak | `Nilai Proyek − PPN − PPh` |

⚠️ Tarif PPN **tidak konsisten** di data asli (ada 12%, ada 11%) karena mengikuti perubahan tarif
pemerintah. **Jangan hardcode satu tarif.** Tarif PPN harus parameter yang bisa diatur per periode.

### Output: Tiga Lapis Rekap

1. **Total Periode** — jumlah semua faktur (DPP, PPN, PPh, Nilai Proyek, Laba)
2. **Rekap Bulanan** — agregasi otomatis per bulan, pemantauan tren
3. **Rekonsiliasi vs Dilaporkan ke Pajak** — input terpisah "DPP Terlapor" dan "Pajak Terlapor"
   per bulan (nilai yang benar-benar dilaporkan ke kantor pajak). Sistem hitung Selisih = rekap
   faktur − terlapor. Selisih ≠ 0 = indikasi faktur belum/salah dilaporkan, perlu visual merah/kuning.

### Aliran ke Laba Rugi

**Total Nilai Proyek** dari rekap = angka Pendapatan di Laba Rugi.

⚠️ **Bug di Excel asli**: Laba Rugi tidak menarik dari sheet Pendapatan, melainkan dari Daftar Akun
lewat link yang putus → hasilnya Rp0, padahal nilai asli Rp160.938.123. Di sistem baru, pastikan
baris Pendapatan di Laba Rugi menarik dari total Laporan Pendapatan (atau akumulasi Buku Besar
kalau tiap faktur otomatis digenerate jadi baris Jurnal Umum).

### Konsep Pekerjaan Perusahaan vs Pekerjaan yang Dipinjam

Terkait praktik "pinjam bendera" (satu entitas mengerjakan proyek pakai lisensi entitas lain dalam
grup). **Perlu dikonfirmasi ke klien**: kalau ada porsi "Pekerjaan yang Dipinjam", apakah otomatis
menghasilkan entri Hutang/Piutang antar entitas? Jangan bangun otomatisasi ini sebelum dikonfirmasi.

### Bug Excel yang Tidak Boleh Direplikasi

| Temuan | Masalah | Rekomendasi |
|---|---|---|
| Formula `#REF!` di baris rekap tahunan | Referensi ke baris/sheet yang sudah dihapus | Validasi tiap kali struktur data berubah |
| Dua nilai hardcode manual tanpa formula | Tidak bisa ditelusuri asalnya | Buat field input resmi dengan jejak (siapa, kapan) |
| Rentang SUMIF rekap bulanan tidak konsisten | Berpotensi salah hitung saat data bertambah | Agregasi harus query dinamis berdasarkan field Masa Pajak |
| Total rekap bulanan PPN melewatkan Januari | Kemungkinan salah ketik rentang SUM | Uji dengan data 12 bulan penuh |

---

## Keputusan desain yang SUDAH final

- Login pakai email+password asli (NextAuth + PHP backend), BUKAN tombol demo seperti di mockup.
- Role tidak bisa diganti-ganti bebas — role dan entity access ikut akun yang login.
- Revenue/spend per entity dihitung dari `Project` asli.
- Backend adalah PHP murni (bukan Laravel, bukan Node.js) karena target hosting adalah Hostinger
  shared hosting yang tidak support Node.js sebagai runtime backend.
- Enum TypeScript didefinisikan lokal di `src/types/app-enums.ts`, bukan dari `@prisma/client`.
- MySQL DECIMAL selalu di-cast ke float di PHP sebelum di-return sebagai JSON.
