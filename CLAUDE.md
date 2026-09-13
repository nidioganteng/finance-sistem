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
  app/login/page.tsx           -> halaman publik
  components/layout/           -> Sidebar, PageHeader, EntitySwitcher, UserBadge, ComingSoon
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
`bg-surface-page` / `surface-subtle` / `surface-input` / `surface-hover`, `text-status-green` /
`status-red`, `rounded-pill`. Warna entity (gaharu/kencana/dst) dipakai langsung dari `entity.colorHex`
di database (bukan class Tailwind statis) karena sifatnya dinamis per baris data.

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

Login, Dashboard (Master Dashboard agregat + per-entity), Notifikasi (filter + tandai dibaca),
Jurnal Umum (ledger + filter jenis input), Kas Kecil, Kas Besar, Bank Buku (termasuk form input
transaksi baru multi-akun).

## Belum dibangun (masih halaman placeholder `ComingSoon` di `components/layout/ComingSoon.tsx`)

Urutan disarankan (yang lebih independen duluan):

1. **Bagan Akun** (`/coa`, Manajer) — CRUD `CoaAccount`. Paling sederhana, kerjain duluan.
2. **Dokumen & SOP** (`/dokumen`, Manajer + Staf) — CRUD `Dokumen`, perlu upload file (belum ada
   solusi upload file ditentukan — tanya user mau simpan ke mana: lokal, S3, atau lainnya).
3. **Manajemen Pengguna** (`/pengguna`, khusus Manajer) — approval `User` dengan status PENDING,
   assign `role` + `UserEntityAccess` saat approve. Perlu juga halaman/flow registrasi publik yang
   belum ada sama sekali (belum ada route `/register`).
4. **Kelola Jenis Input Transaksi** (`/jenis-input`, semua role tapi Staf yang bisa nambah) — CRUD
   `JenisInputTransaksi`, saat Staf nambah baru trigger `Notifikasi` ke SUPER_ADMIN & MANAJER_KEUANGAN
   (`NotifikasiType.JENIS_INPUT_BARU`).
5. **Log Aktivitas** (`/log`, Manajer + Super Admin) — baca `ActivityLog`, ada 2 tab (User Activity
   vs Financial Change) sesuai `LogCategory` enum. User activity auto-hapus 30 hari, financial change
   permanen — belum ada job/cron buat auto-hapus, perlu diputuskan caranya (cron eksternal / route
   API yang dipanggil terjadwal / dsb).
6. **Kontrol Piutang & Termin** (`/piutang`, Manajer + Staf) — audit `Termin` (update status,
   `auditedAt`, `auditedById`) + review `LoadingDockTransaksi` untuk entitas Umum.
7. **Buku Besar, Neraca, Laba Rugi, Arus Kas** (`/buku-besar`, `/neraca`, `/laba-rugi`, `/arus-kas`,
   Staf read-only) — turunan agregasi dari `Transaction` + `CoaAccount` per entity. Kerjain sebagai
   satu batch karena datanya saling terkait (semua turunan dari ledger yang sama).
8. **Profitabilitas Proyek** (`/profitabilitas`, Staf) — agregasi `Project.contractValue - Project.spend`
   per proyek, sudah ada logikanya di `EntityCard`/dashboard, tinggal dibuatkan tabel detail per proyek.
9. **Laporan Keuangan Internal** (`/laporan`, Super Admin + Manajer) — versi gabungan dari #7 dengan
   tab switcher, plus fitur cetak/print preview dan bandingkan tahun (`compareYear`) seperti di mockup.
10. **Laporan Pajak** (`/pajak`, Manajer) — rekonsiliasi data yang dilaporkan ke pajak vs laporan
    internal, butuh keputusan dulu dari user soal sumber data pajaknya dari mana.

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