# CLAUDE.md

Instruksi ini dibaca otomatis oleh Claude Code setiap sesi baru di repo ini. Isinya konteks
project + konvensi yang sudah dipakai, supaya kerjaan lanjutannya konsisten dengan yang sudah ada,
bukan mulai dari gaya/asumsi baru.

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
4. Ganti semua data dummy dengan query Prisma asli.

## Tech stack

- Next.js 14 (App Router, TypeScript) — satu project full-stack, tanpa backend terpisah
- MySQL lewat Docker Compose, akses via Prisma ORM
- NextAuth v4 (Credentials provider, JWT session) untuk auth
- Tailwind CSS dengan token warna custom di `tailwind.config.ts` (disalin dari mockup)
- recharts untuk chart, lucide-react untuk icon

## Struktur & konvensi yang SUDAH dipakai — ikuti pola ini untuk halaman baru

```
src/
  app/(app)/<route>/page.tsx   -> route yang butuh login (dijaga middleware.ts)
  app/login/page.tsx, app/register/page.tsx -> halaman publik
  components/layout/           -> Sidebar, PageHeader, EntitySwitcher, UserBadge, ThemeToggle
  components/<fitur>/          -> komponen spesifik satu fitur, mis. components/kas/, components/jurnal/
  lib/rbac.ts                  -> daftar nav sidebar per role + helper role
  lib/auth.ts                  -> config NextAuth
  lib/prisma.ts                -> Prisma client singleton, SELALU import dari sini, jangan `new PrismaClient()` di file lain
  lib/<fitur>.ts               -> query Prisma read-only untuk satu fitur (mis. lib/jurnal.ts, lib/kas.ts, lib/notifikasi.ts, lib/dashboard-data.ts)
  lib/actions/<fitur>.ts       -> Server Actions ("use server") untuk create/update/delete
```

**Pola satu halaman (contoh: lihat `src/app/(app)/jurnal/page.tsx` + `src/lib/jurnal.ts`):**
- `page.tsx` adalah **server component** async: `getServerSession(authOptions)`, cek role kalau
  halaman itu terbatas (`if (role !== "...") redirect("/dashboard")`), resolve entity terpilih dari
  `searchParams.entity` (fallback ke `entityKeys[0]`), panggil fungsi dari `lib/<fitur>.ts`, lalu
  render pakai `<PageHeader>` + komponen tampilan.
- Semua query Prisma taruh di `lib/<fitur>.ts`, bukan langsung di `page.tsx`.
- Kalau ada interaksi client (toggle panel, form, dropdown yang ubah URL) itu jadi component
  terpisah dengan `"use client"` di file sendiri (lihat `KasScreenClient.tsx` + `KasTransactionForm.tsx`
  sebagai contoh pola server-fetch + client-interactive-wrapper).
- Form yang nulis data pakai Server Action di `lib/actions/<fitur>.ts`, dipanggil dari client
  component pakai `useTransition`, BUKAN route API terpisah (lihat `lib/actions/kas.ts`).

**Akses entity & role — JANGAN bikin ulang, pakai yang sudah ada:**
- `session.user.role` dan `session.user.entityKeys` sudah tersedia di semua server component lewat
  NextAuth session (tipe-nya sudah di-augment di `src/types/next-auth.d.ts`).
- Entity yang boleh diakses = query `UserEntityAccess` (bukan bebas pilih semua kayak di mockup).
  Pakai `getAccessibleEntities(entityKeys)` dari `src/lib/dashboard-data.ts`.
- `canViewGrupAggregate(role)` di `lib/rbac.ts` nentuin siapa yang boleh lihat agregat "Semua
  Entitas" (cuma SUPER_ADMIN & MANAJER_KEUANGAN). STAF_KEUANGAN selalu terkunci ke entity
  pertama di `entityKeys`-nya.
- Nav sidebar per role SUDAH final dan disalin PERSIS dari mockup (baca komentar di `lib/rbac.ts`)
  — SUPER_ADMIN, MANAJER_KEUANGAN, dan STAF_KEUANGAN punya sidebar yang beda-beda. Jangan asumsi
  satu role bisa akses halaman yang nav-nya nggak ada di situ; tetap tambahkan guard role di setiap
  page.tsx halaman baru (lihat `if (role === "SUPER_ADMIN") redirect("/dashboard")` di `jurnal/page.tsx`).

**Design token — JANGAN pakai warna hex manual, pakai class Tailwind custom di `tailwind.config.ts`:**
`bg-navy`, `text-navy-text`, `bg-brand` / `text-brand`, `text-muted` / `muted-strong` /
`muted-stronger` / `muted-faint` / `muted-faintest`, `border-border` / `border-border-soft`,
`bg-surface-page` / `surface-card` / `surface-subtle` / `surface-input` / `surface-hover`,
`text-status-green` / `status-red` / `status-amber`, `rounded-pill`. Warna entity (gaharu/kencana/dst)
dipakai langsung dari `entity.colorHex` di database (bukan class Tailwind statis) karena sifatnya
dinamis per baris data. JANGAN pakai `bg-white` atau `border-black/[.06]` mentah — pakai
`bg-surface-card` / `border-border-soft`, supaya otomatis ikut tema gelap (lihat bagian Dark Mode).

**Dark mode — sudah aktif di semua halaman, ikuti pola ini kalau nambah UI baru:**
- Mekanismenya: class `dark` di `<html>`, di-toggle oleh `components/layout/ThemeToggle.tsx` dan
  disimpan di `localStorage("theme")`. Script blocking di `src/app/layout.tsx` (`<head>`) nge-apply
  class itu sebelum paint pertama di SEMUA halaman (termasuk `/login`, `/register`) supaya nggak ada
  flash tema salah.
- Semua token warna di atas (`bg-surface-*`, `text-navy-text`, `text-muted*`, `border-border*`,
  `text-status-*`) sebenarnya CSS variable (`--color-*`, didefinisikan di `src/app/globals.css`,
  format `"R G B"`) yang dibaca `tailwind.config.ts` lewat helper `withOpacity()`. Nilai gelapnya
  didefinisikan di selector `:root.dark` di `globals.css`. Artinya: **kalau komponen baru konsisten
  pakai token-token ini (bukan `bg-white`/warna Tailwind default kayak `bg-gray-100` polos), dark
  mode otomatis jalan tanpa perlu nulis varian `dark:` sama sekali.**
- Untuk badge/alert status yang sengaja pakai warna Tailwind stok (`bg-green-100 text-green-700`,
  `bg-red-50`, dst — dipakai buat badge kategori/status yang variannya banyak), tambahkan varian
  `dark:` manual di sebelahnya, contoh pola yang sudah dipakai di `CoaClient.tsx`/`PiutangClient.tsx`:
  `"bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"`.
- `ThemeToggle` cuma dipasang sekali secara global: di brand row `Sidebar.tsx` (utk semua halaman
  `(app)/*`) dan di kartu login/register (halaman publik). JANGAN tambah `<ThemeToggle />` lagi di
  tiap `page.tsx` satu-satu.
- Untuk chart recharts (lihat `RevenueChart.tsx`), warna axis/grid/tooltip nggak bisa pakai class
  Tailwind (recharts butuh nilai warna langsung lewat prop), jadi dipakai string
  `"rgb(var(--color-xxx))"` langsung supaya tetap ikut ganti pas toggle tema tanpa perlu re-render JS.

## Model data (prisma/schema.prisma) — ringkasan

- `User` + `Role` enum (SUPER_ADMIN, MANAJER_KEUANGAN, STAF_KEUANGAN, MANAGER_ADMIN, ADMIN_SIDAMON)
  + `UserStatus` (PENDING/ACTIVE/INACTIVE, untuk alur approval registrasi)
- `Entity` + `UserEntityAccess` (many-to-many, terpisah dari role)
- `Project`, `Termin` (per project)
- `CoaAccount` (Bagan Akun)
- `JenisInputTransaksi` (Kas Kecil/Besar/Bank Buku bawaan + custom buatan Staf)
- `Transaction` — **satu baris = satu leg akun** (bukan satu baris = satu transaksi). Beberapa baris
  bisa berbagi `noBukti` yang sama untuk merepresentasikan satu transaksi dengan banyak akun (lihat
  cara pengelompokannya di `getKasLedger()` di `lib/kas.ts`). `debit`/`kredit` merepresentasikan arah
  dana transaksi itu (bukan double-entry akuntansi murni — ini simplifikasi yang disengaja).
- `LoadingDockTransaksi` — untuk transaksi KSO/pinjam bendera di entitas Umum. **Belum dipakai di UI
  manapun**, siap dipakai untuk halaman Piutang.
- `Dokumen`, `Notifikasi`, `ActivityLog` — `Dokumen` dan `ActivityLog` **belum dipakai di UI**.

## Sudah dibangun (full, baca+tulis dari database asli)

Semua halaman di sidebar (lihat `lib/rbac.ts`) sudah punya implementasi asli, bukan placeholder lagi:

- **Auth & akun**: Login, Register (alur approval — akun baru `status: PENDING` sampai di-approve
  Manajer Keuangan), Manajemen Pengguna (`/pengguna` — approve/reject, assign role + entity access).
- **Overview**: Dashboard (Master Dashboard agregat grup + per-entity, chart performa bulanan),
  Notifikasi (filter + tandai dibaca), Log Aktivitas (`/log`, 2 tab User Activity / Financial Change).
- **Operasional harian**: Jurnal Umum, Kas Kecil, Kas Besar, Bank Buku (form input transaksi
  multi-akun), Kontrol Piutang & Termin (`/piutang` — update status termin + review LoadingDock Umum).
- **Laporan turunan ledger**: Buku Besar, Neraca, Laba Rugi, Arus Kas, Profitabilitas Proyek,
  Laporan Keuangan (`/laporan`, gabungan dengan tab switcher), Laporan Pajak (`/pajak`).
- **Pengaturan**: Bagan Akun (`/coa`, CRUD `CoaAccount`), Dokumen & SOP (`/dokumen`), Kelola Jenis
  Input Transaksi (`/jenis-input`).
- **Dark mode**: aktif di semua halaman di atas termasuk `/login` & `/register` — lihat bagian
  "Dark mode" di atas untuk konvensi tokennya sebelum nambah UI baru.

Komponen `ComingSoon` sudah nggak dipakai/nggak ada lagi di codebase — semua route punya halaman asli.

## Area yang masih perlu keputusan / kemungkinan belum final

Bagian implementasi sudah ada, tapi beberapa keputusan produk berikut ditandai "perlu dicek ulang
manual" saat terakhir diaudit (belum tentu masih relevan — cek kode dulu sebelum nanya user):

- **Upload file Dokumen & SOP** (`/dokumen`) — cek `Dokumen.fileUrl` diisi dari mana (lokal/S3/dsb).
- **Auto-hapus Log Aktivitas** — `LogCategory.USER_ACTIVITY` seharusnya auto-hapus 30 hari,
  `FINANCIAL_CHANGE` permanen. Cek apakah sudah ada job/cron buat itu atau masih manual.
- **Sumber data Laporan Pajak** (`/pajak`) — cek dari mana angka pajak direkonsiliasi terhadap
  laporan internal.

## Keputusan desain yang SUDAH final — jangan diulang tanya ke user kecuali user minta ubah

- Login pakai email+password asli (NextAuth), BUKAN tombol demo "Masuk sebagai..." seperti di mockup.
- Role tidak bisa diganti-ganti bebas seperti di mockup — role dan entity access ikut akun yang login.
- Revenue/spend per entity dihitung dari `Project` asli (bukan angka terpisah kayak di mockup).
- Backend & database dibangun bareng frontend dari awal (bukan UI-first), stack: Next.js full-stack
  (bukan Laravel), MySQL, Docker.

## Menjalankan project

Lihat `README.md` di root untuk langkah setup lengkap (`docker compose up -d`, `npm install`,
`.env`, `npx prisma db push`, `npm run prisma:seed`, `npm run dev`). Akun contoh ada di situ juga.

**Catatan:** kalau abis ubah `prisma/schema.prisma`, jalankan `npx prisma db push` lagi (dev) atau
bikin migration kalau sudah mau ke arah produksi (`npx prisma migrate dev`).