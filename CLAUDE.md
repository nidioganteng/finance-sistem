# CLAUDE.md

Instruksi ini dibaca otomatis oleh Claude Code setiap sesi baru di repo ini. Isinya konteks
project + konvensi yang sudah dipakai, supaya kerjaan lanjutannya konsisten dengan yang sudah ada,
bukan mulai dari gaya/asumsi baru.

> [!IMPORTANT]
> **Status project saat ini**: Semua fitur dan alur bisnis sudah dibangun lengkap.
> Fokus pengerjaan sekarang adalah **perbaikan & peningkatan UI** — bukan menambah fitur baru.

---

## Tentang project ini

Sistem Data Keuangan internal untuk **Gaharu Sempana Group**, holding dengan 4 anak perusahaan
konstruksi/properti (Gaharu, Kencana, Tataring, Cipta Asri) + 1 entitas "Umum/KP" (ruang transit
untuk transaksi KSO / pinjam bendera antar entitas).

File mockup asli ada di `design-reference/` (`Sistem_Data_Keuangan_Gaharu_Sempana_dc.html` +
`support.js`) — HTML/CSS/JS statis dengan custom template syntax (`{{ }}`, `<sc-if>`, `<sc-for>`)
yang dirender `support.js`. Dipakai sebagai **referensi visual saja**, JANGAN dijalankan atau
disalin mentah-mentah.

---

## Tech stack

Branch ini (`feat/php-conversion`) ditargetkan ke **Hostinger shared hosting** (tanpa Node.js
runtime). Arsitekturnya:

- **Frontend**: Next.js 14 (App Router, TypeScript) — static export atau Node.js edge
- **Backend**: PHP murni (`api/` folder di root) — plain PHP + PDO, tanpa framework. Apache/PHP
  Hostinger. 26+ route files, satu entry point `api/index.php`.
- **Database**: MySQL — diakses langsung via PDO dari PHP, **bukan** dari Next.js
- **Auth**: NextAuth v4 (Credentials provider, JWT session). Credentials di-validate ke
  `POST /api/auth/login` PHP. Token PHP (JWT) disimpan di session sebagai `session.user.phpToken`
  dan dikirim ke semua request PHP via `Authorization: Bearer <token>`.
- **API client**: semua fetch ke PHP backend lewat `phpFetch<T>()` di `src/lib/api-client.ts`
- Tailwind CSS dengan token warna custom di `tailwind.config.ts`
- recharts untuk chart, lucide-react untuk icon

**Tidak ada Prisma** di branch ini — enum TypeScript didefinisikan lokal di
`src/types/app-enums.ts`, semua query DB ada di PHP (`api/routes/*.php`).

---

## Struktur & konvensi yang SUDAH dipakai — ikuti pola ini

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
- **LoadingDockTransaksi** — transaksi KSO/pinjam bendera di entitas Umum/KP.
- **FakturPendapatan** — faktur pajak (e-faktur), sumber data Laporan Pendapatan.
- **RekonsiliasiPajakBulanan** — input DPP/PPN/PPh yang dilaporkan ke kantor pajak per bulan.
- **Rekanan** (VENDOR/KLIEN/TENAGA_AHLI/SUBKONTRAKTOR/LAINNYA), **Pegawai**, **GajiPegawaiBulanan**,
  **HonorTenagaAhli**, **AsetTetap**, **Notifikasi**, **ActivityLog**, **Dokumen**

---

## Fitur yang sudah dibangun (semua lengkap)

- **Auth & akun**: Login, Register (alur approval), Manajemen Pengguna.
- **Overview**: Dashboard, Notifikasi, Log Aktivitas.
- **Operasional harian**: Jurnal Umum, Kas Kecil, Kas Besar, Bank Buku, Kontrol Piutang & Termin,
  Jurnal Transaksi.
- **Laporan**: Buku Besar, Neraca, Laba Rugi, Arus Kas, Profitabilitas Proyek, Laporan Keuangan,
  Laporan Pajak (Rekap E-Faktur + Rekonsiliasi), Aktiva Tetap, Payroll.
- **Pengaturan**: Bagan Akun, Dokumen & SOP, Kelola Jenis Input, Rekanan, Validasi Pajak 3 Arah.
- **Dark mode**: aktif di semua halaman.

---

## Aturan akuntansi & kalkulasi penting

**Saldo akun:**
- Debet-normal (ASET, BEBAN): `saldo_akhir = saldo_awal + debit - kredit`
- Kredit-normal (KEWAJIBAN, MODAL, PENDAPATAN): `saldo_akhir = saldo_awal + kredit - debit`
- Kontra-aset (akun 210, 1001 Akumulasi Penyusutan): **kredit-normal** meski kategorinya ASET

**E-Faktur pendapatan (input berbasis nilai kuitansi bruto 111%):**
- `DPP = round(100/111 × bruto)`
- `PPN = round(11/111 × bruto)`
- `PPh = round(DPP × tarif)` — default 3.5%, jangan hardcode, ikuti tarif aktif
- `Laba = DPP - PPh`
- Tarif PPN tidak konsisten historis (ada 11%, ada 12%) — selalu pakai parameter, bukan konstanta

**Jurnal transaksi pencairan bank (4-leg otomatis):**
- Debit: Kas/Bank (netto cair)
- Debit: PPN Dipungut (akun 535)
- Debit: Potongan PPh (akun 534)
- Kredit: Pendapatan (akun 4xx, nilai bruto)

**`autoPostedFromJurnal=true`** pada Transaction = mirror row dari jurnal transaksi, di-exclude
dari laporan Laba Rugi agar tidak double-count.

**Crossing entry antar entitas:**
- Entitas A bayar untuk B → A: Debit Piutang ke B (11x) | Kredit Kas
- Otomatis: B: Debit Kas | Kredit Hutang ke A (31x)
- Linked via `extraFieldsJson.crossingGroupId`

**PPh 21 TER Payroll:** 39-bracket tarif efektif, PTKP-aware (TK/0 s.d K/3). Lihat
`src/lib/payroll.ts` untuk tabel bracket lengkap.

**Penyusutan aset garis lurus:**
- `beban/bulan = (harga - residu) / umur_bulan`
- Tanah: tidak disusutkan (PSAK 16)

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

## Keputusan desain yang SUDAH final

- Login pakai email+password asli (NextAuth + PHP backend), BUKAN tombol demo seperti di mockup.
- Role tidak bisa diganti-ganti bebas — role dan entity access ikut akun yang login.
- Revenue/spend per entity dihitung dari `Project` asli.
- Backend adalah PHP murni (bukan Laravel, bukan Node.js) karena target hosting adalah Hostinger
  shared hosting yang tidak support Node.js sebagai runtime backend.
- Enum TypeScript didefinisikan lokal di `src/types/app-enums.ts`, bukan dari `@prisma/client`.
- MySQL DECIMAL selalu di-cast ke float di PHP sebelum di-return sebagai JSON.
