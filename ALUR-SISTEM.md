# ALUR SISTEM KOSHA — Dokumentasi Lengkap
> Dibuat: 21 Oktober 2026 | Diperbarui: 23 Oktober 2026  
> Branch: `main`  
> **Tujuan:** Referensi acuan sebelum refactor apapun. Jika ada perubahan, cek alur ini satu per satu.

---

## DAFTAR ISI
0. [Infrastruktur & Target Deployment](#0-infrastruktur--target-deployment)
1. [Alur Autentikasi](#1-alur-autentikasi)
2. [Middleware & Proteksi Route](#2-middleware--proteksi-route)
3. [RBAC — Role & Hak Akses](#3-rbac--role--hak-akses)
4. [Entity Switcher](#4-entity-switcher)
5. [Dark Mode Toggle](#5-dark-mode-toggle)
6. [Notifikasi (Polling)](#6-notifikasi-polling)
7. [Halaman & Alur Per Halaman](#7-halaman--alur-per-halaman)
8. [Server Actions (Mutasi Data)](#8-server-actions-mutasi-data)
9. [PHP API Endpoints](#9-php-api-endpoints)
10. [Diagram Data Flow](#10-diagram-data-flow)

---

## 0. INFRASTRUKTUR & TARGET DEPLOYMENT

**Target:** Semua komponen (frontend, backend PHP, database MySQL) berjalan di **Hostinger**.

### Komponen Sistem

| Komponen | Teknologi | Target Hosting |
|----------|-----------|---------------|
| Frontend | Next.js 14 App Router (TypeScript) | Hostinger (static export) |
| Backend API | PHP 8.x + PDO (plain PHP, tanpa framework) | Hostinger shared hosting |
| Database | MySQL | Hostinger shared hosting |

### Arsitektur Request

```
Browser
  ↓ halaman HTML/JS (file statis dari Hostinger)
Next.js Static Export (di-serve Hostinger)
  ↓ fetch ke PHP API (Authorization: Bearer <token>)
PHP Backend  →  api/index.php  →  api/routes/*.php
  ↓ PDO
MySQL Database (Hostinger)
```

### Konfigurasi Next.js untuk Hostinger

File `next.config.mjs` harus menggunakan `output: "export"` (bukan `"standalone"`):

```js
const nextConfig = {
  output: "export",   // ← static HTML/CSS/JS, tidak butuh Node.js runtime
  ...
};
```

**Konsekuensi static export:**
- Server Components tetap bisa fetch data saat build, tapi halaman yang butuh data real-time (session, entity aktif) harus pakai client-side fetch
- NextAuth tidak bisa berjalan server-side → session harus dikelola via JWT di localStorage atau cookie httpOnly yang di-set PHP
- Server Actions (`"use server"`) tidak tersedia di static export → semua mutasi data harus jadi client-side `fetch` ke PHP endpoint langsung
- API Routes Next.js (`app/api/*/route.ts`) tidak tersedia → digantikan PHP endpoint langsung

> **Catatan:** Perubahan dari `standalone` ke `export` membutuhkan refactor signifikan di layer auth dan server actions. Ini adalah pekerjaan yang belum selesai.

### Struktur File di Hostinger

```
public_html/
  kosha/
    api/          ← PHP backend (di-deploy dari api/ di repo)
      index.php
      config/
      helpers/
      middleware/
      routes/
    (frontend)    ← Next.js static export (folder out/ setelah build)
      index.html
      _next/
      ...
```

### Environment Variables

| Variable | Dipakai oleh | Keterangan |
|----------|-------------|-----------|
| `PHP_API_URL` | Next.js (server-side) | URL base PHP backend |
| `NEXT_PUBLIC_PHP_API_URL` | Next.js (client-side) | Sama, untuk fetch dari browser |
| `NEXTAUTH_SECRET` | NextAuth | Secret JWT session |
| `NEXTAUTH_URL` | NextAuth | URL app Next.js |
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` | PHP | Koneksi MySQL Hostinger |
| `JWT_SECRET` | PHP | Secret untuk JWT token PHP |

---

## 1. ALUR AUTENTIKASI

### 1.1 Login

**Path:** `/login`  
**File:** `src/app/login/page.tsx`

```
User isi form (email + password)
  ↓
signIn("credentials", { email, password })  ← NextAuth
  ↓
NextAuth → POST /api/auth/login (PHP)
  ↓
PHP validasi:
  - Email & password ada
  - Password cocok (bcrypt verify)
  - Status user = ACTIVE
  - User punya role
  ↓
PHP return: { token: JWT, user: { id, name, email, role, entityKeys } }
  ↓
NextAuth JWT Callback simpan: id, role, entityKeys, phpToken
  ↓
NextAuth Session Callback expose ke app: id, role, entityKeys, phpToken
  ↓
Redirect → /dashboard
```

**Error states:**
- Email/password salah → pesan error di form
- Status PENDING → pesan "akun menunggu persetujuan"
- Status INACTIVE → pesan "akun dinonaktifkan"

---

### 1.2 Registrasi

**Trigger:** Switch mode di halaman `/login`  
**Server Action:** `registerUser(formData)` di `src/lib/actions/auth.ts`

```
User isi: name, email, password, konfirmasi password
  ↓
Validasi client: semua wajib, password >= 8 char, password cocok
  ↓
registerUser(formData) → PHP POST /api/auth/register
  ↓
PHP:
  - Cek email unik (HTTP 409 jika duplikat)
  - Hash password bcrypt cost 12
  - Insert user: status = PENDING, role = NULL
  - Log activity USER_REGISTER
  ↓
Redirect /login?registered=1
```

---

### 1.3 Logout

```
User klik "Keluar" di Sidebar
  ↓
signOut() ← NextAuth
  ↓
NextAuth clear session cookie
  ↓
Redirect /login
```

---

### 1.4 Token PHP

- Disimpan di NextAuth session sebagai `session.user.phpToken`
- Dikirim ke semua request PHP via header: `Authorization: Bearer <token>`
- Semua fungsi di `src/lib/*.ts` dan `src/lib/actions/*.ts` pakai `phpFetch()` dari `src/lib/api-client.ts`
- `phpFetch()` otomatis ambil token dari session

---

## 2. MIDDLEWARE & PROTEKSI ROUTE

**File:** `src/middleware.ts`

- Pakai `withAuth` dari NextAuth
- Semua route di `(app)/` otomatis terlindungi
- Akses tanpa session → redirect `/login`

**Protected routes:**
- `/dashboard`, `/laporan`, `/log`, `/notifikasi`
- `/jurnal`, `/piutang`, `/pajak`, `/coa`
- `/dokumen`, `/pengguna`, `/jenis-input`
- `/kas-kecil`, `/kas-besar`, `/bank-buku`
- `/buku-besar`, `/neraca`, `/laba-rugi`, `/arus-kas`
- `/profitabilitas`, `/input/[key]`, dan lainnya

**Catatan:** Role guard per halaman dilakukan di `page.tsx` masing-masing, BUKAN di middleware.

---

## 3. RBAC — ROLE & HAK AKSES

**File:** `src/lib/rbac.ts`

### Daftar Role

| Role | Deskripsi |
|------|-----------|
| `SUPER_ADMIN` | Manajemen puncak, lihat semua laporan, tidak bisa input transaksi |
| `MANAJER_KEUANGAN` | Akses penuh operasional + pengaturan |
| `STAF_KEUANGAN` | Input transaksi + lihat laporan |
| `MANAGER_ADMIN` | Akses terbatas (notifikasi termin saja) |
| `ADMIN_SIDAMON` | Akses minimal, terutama sync dari Sidamon |

### Navigasi Per Role

**SUPER_ADMIN:**
- Dashboard, Notifikasi
- Laporan Pendapatan, Laporan Keuangan, Laporan Hutang & Piutang, Laporan Gaji
- Kontrol Termin, Log Aktivitas

**MANAJER_KEUANGAN:**
- Dashboard, Notifikasi
- Transaksi: Kas Kecil, Kas Besar, Buku Bank, Entry Jurnal, Aktiva Tetap
- Monitoring: Jurnal Umum, Buku Besar, Daftar Akun, Kontrol Termin
- Laporan: Pendapatan, Keuangan, Hutang/Piutang, Gaji
- Pengaturan: COA, Rekanan, Dokumen, Jenis Input, Manajemen Pengguna

**STAF_KEUANGAN:**
- Dashboard, Notifikasi
- Transaksi: Kas Kecil, Kas Besar, Buku Bank, Entry Jurnal, Aktiva Tetap
- Monitoring: Jurnal Umum, Buku Besar, Daftar Akun, Kontrol Termin
- Laporan: Pendapatan, Keuangan, Hutang/Piutang, Gaji
- Pengaturan: COA, Rekanan, Dokumen

### Helper Functions RBAC

```typescript
canManageTransaksi(role)     // true: STAF_KEUANGAN, MANAJER_KEUANGAN
canViewGrupAggregate(role)   // true: SUPER_ADMIN, MANAJER_KEUANGAN, STAF_KEUANGAN
getNavForRole(role)          // return array navigasi sidebar
```

---

## 4. ENTITY SWITCHER

**File:** `src/components/layout/EntitySwitcher.tsx`  
**Helper:** `src/lib/entity-prefs.ts`

### Entitas dalam Sistem

| Key | Nama |
|-----|------|
| `gaharu` | Gaharu |
| `kencana` | Kencana |
| `tataring` | Tataring |
| `ciptaAsri` | Cipta Asri |
| `umum` | Umum/KP (transit KSO) |

### Alur Switch Entity

```
User klik dropdown entity
  ↓
Tampil opsi:
  - "Semua Entitas" (hanya jika canViewGrupAggregate = true)
  - List entitas dari session.user.entityKeys
  ↓
User pilih entity
  ↓
Set cookie lastEntityKey=<value> (expire 30 hari)
Update URL param ?entity=<value>
router.push() dengan pathname + params baru
  ↓
Page re-render → data di-fetch ulang untuk entity baru
```

### Resolusi Entity (Prioritas)

```typescript
resolveEntityKey(searchParam, entityKeys):
  1. URL ?entity=<key> (jika ada di entityKeys user)
  2. Cookie lastEntityKey (jika ada di entityKeys user)
  3. Fallback: entityKeys[0]

resolveReportEntityKey(searchParam, entityKeys, canGrup):
  1. URL ?entity="grup" + canGrup=true → return undefined (agregat semua)
  2. URL ?entity=<valid key>
  3. Cookie fallback
  4. Default: canGrup ? undefined : entityKeys[0]
```

---

## 5. DARK MODE TOGGLE

**File:** `src/components/layout/ThemeToggle.tsx`

```
Initial load:
  - Read localStorage "theme"
  - Apply class "dark" ke <html> jika theme = "dark"

User toggle:
  - Toggle class "dark" di document.documentElement
  - Simpan ke localStorage
  - Update React state

CSS: Semua via Tailwind custom tokens (bukan dark: prefix manual)
     kecuali badge warna stok Tailwind (bg-green-100 dll) yang perlu dark: manual
```

---

## 6. NOTIFIKASI (POLLING)

**File:** `src/components/layout/AppShell.tsx`  
**API Route:** `src/app/api/notif-count/route.ts`

### Polling Jumlah Notif

```
AppShell mount:
  ↓
Jika pathname = "/notifikasi" → setUnreadCount(0), stop
  ↓
fetchCount() → GET /api/notif-count (Next.js route)
  → Next.js route → GET /api/notifikasi/count?role=<role> (PHP)
  → Return { count: number }
  ↓
Ulangi setiap 60 detik (clearInterval saat unmount / path berubah)
  ↓
unreadCount ditampilkan di bell icon sidebar
```

### Alur Halaman Notifikasi `/notifikasi`

```
Data: getNotifikasiList(role, filterType, page)
  → PHP GET /api/notifikasi?filter=<type>&page=<n>

Aksi user:
  - Klik notif → openDetail() → mark as read (silent, no loader)
  - Hover → tombol Trash muncul
  - Klik Trash → toast konfirmasi → deleteNotifikasiAction(id)
  - Klik "Tandai Semua Dibaca" → markAllNotifikasiRead()
  - Filter by type → URL param berubah
  - Pagination → URL param page berubah
```

### Tipe Notifikasi Per Role

**SUPER_ADMIN:**
- `TERMIN_BARU` — Input Termin Baru
- `PROGRES_80` — Progres Termin 80%
- `PERUBAHAN_CLOSED` — Perubahan Laporan Closed
- `BACKDATE` — Input Backdate
- `JENIS_INPUT_BARU` — Jenis Input Baru

**MANAJER_KEUANGAN / STAF_KEUANGAN:**
- `PENDAFTARAN` — Pendaftaran Akun
- `LOADING_DOCK` — Loading Dock
- `TERMIN_AUDIT` — Termin Perlu Diaudit
- `JENIS_INPUT_BARU` — Jenis Input Baru
- `PENUGASAN_BARU` — Penugasan dari Sidamon

---

## 7. HALAMAN & ALUR PER HALAMAN

---

### `/dashboard`

**File:** `src/app/(app)/dashboard/page.tsx`  
**Role:** Semua role (tidak ada guard)

**Query params:** `?entity=<key>`, `?year=<YYYY>`, `?chartYear=<YYYY>`, `?compareYears=<YYYY,...>`

**Data yang di-fetch:**
- `getAccessibleEntities(entityKeys, year)` → PHP `/api/entities`
- `canViewGrupAggregate(role)`
- `getUnreadNotificationCount(role)`
- `getGrupPiutangMetrics(entityKeys)` → PHP `/api/piutang`
- `getMonthlyChartData(entityKeys, year)` → PHP `/api/dashboard?type=monthly-chart`
- `getLaporanKeuanganData(entityIds, year, version)` → PHP `/api/laporan-keuangan`

**Fitur di halaman:**
- KPI Cards: Total Pendapatan, Total Pengeluaran, Laba Bersih, Termin Perlu Diwaspadai, Sisa Termin
- Entity Cards: Revenue, Spend, Profit per entitas
- Revenue Chart (monthly trends)
- Projects Table: running projects dengan contract value, spend, profit

**Aksi user:**
- Klik entity card → filter dashboard ke entity itu
- Klik "Lihat Arsip Proyek" → navigate ke `/piutang?tab=arsip&entity=<key>`
- Switch entity via EntitySwitcher
- Switch year via YearSelect

---

### `/jurnal` (Jurnal Umum)

**File:** `src/app/(app)/jurnal/page.tsx`  
**Role Guard:** SUPER_ADMIN DILARANG (redirect dashboard)  
**Role Bisa:** MANAJER_KEUANGAN, STAF_KEUANGAN

**Query params:** `?entity`, `?filter`, `?bulan=YYYY-MM`, `?akunCode`, `?projectId`, `?page`

**Data yang di-fetch:**
- `getJenisInputChips(entityId)` → list filter jenis input
- `getJurnalRows(entityId, filter, bulan?, akunCode?, page, projectId?)` → PHP `/api/jurnal`
- `getCoaList()` → PHP `/api/coa`
- `getProjectOptions(entityKey)` → PHP `/api/piutang`

**Fitur di halaman:**
- Tabel transaksi dikelompokkan per noBukti
- Hitung saldo kumulatif
- Warning jika Total Debit ≠ Total Kredit
- Filter chips jenis input + filter tambahan (bulan, akun, proyek)
- Print button
- Edit akun per row (jika `canManageTransaksi`)
- Pagination

**Aksi user:**
- Pilih filter chips → URL reload
- Isi filter tambahan → URL reload
- Klik "Edit" di row → modal edit COA
- Klik Print → print view

---

### `/kas-kecil`, `/kas-besar`, `/bank-buku`

**Files:** `src/app/(app)/kas-*/page.tsx`  
**Role Guard:** STAF_KEUANGAN, MANAJER_KEUANGAN  
**Komponen:** `<KasScreen jenisInputKey="kasKecil|kasBesar|bankBuku" />`

**Query params:** `?entity`, `?dari=YYYY-MM-DD`, `?sampai=YYYY-MM-DD`, `?page`  
(bank-buku tambahan: `?rekening=<id>`)

**Data yang di-fetch:**
- `getKasLedger(entityId, jenisInputKey, dari?, sampai?, rekening?, page)` → PHP `/api/kas/ledger`
- `getCoaList()`

**Fitur di halaman:**
1. **Ledger View** — tabel dengan kolom: tanggal, noBukti, keterangan, masuk, keluar, saldo
   - Saldo awal + per transaksi + saldo akhir
   - Dikelompokkan per noBukti
2. **Form Input Transaksi** — `KasTransactionForm`
   - Isi: tanggal, noBukti (auto), keterangan
   - Multi-row: pilih COA, nominal, keterangan opsional
   - Arah: masuk / keluar
   - Opsional: proyek, rekening, crossing entity

**Aksi user & Server Actions:**

| Aksi | Server Action | PHP Endpoint |
|------|--------------|--------------|
| Auto-generate noBukti | `generateNoBukti(entityKey, tanggal)` | `POST /api/kas/no-bukti` |
| Buat transaksi baru | `createKasTransaction(input)` | `POST /api/kas/transaksi` |
| Hapus grup transaksi | `deleteKasTransactionGroup(txIds, pagePath)` | `DELETE /api/kas/transaksi` |
| Edit/replace transaksi | `replaceKasTransaction(input)` | `PUT /api/kas/transaksi` |
| Update partial | `updateKasTransactionGroup(input)` | `PATCH /api/kas/transaksi` |

---

### `/input/[key]` (Jenis Input Custom)

**File:** `src/app/(app)/input/[key]/page.tsx`  
**Role Guard:** STAF_KEUANGAN, MANAJER_KEUANGAN  
**Catatan:** kasKecil, kasBesar, bankBuku punya halaman dedicated, ini untuk custom

**Data:** `getJenisInput(key)` → PHP `/api/jenis-input/:key`  
**Fitur:** Sama seperti KasScreen, tapi untuk jenis input buatan pengguna  
**Scope:** Entity switcher terbatas ke `entityKeys` scope jenis input tersebut

---

### `/piutang` (Kontrol Termin)

**File:** `src/app/(app)/piutang/page.tsx`  
**Role Guard:** MANAGER_ADMIN dan ADMIN_SIDAMON DILARANG

**Query params:** `?entity` (wajib, tidak ada grup), `?tab=berjalan|selesai|arsip`

**Data:** `getPiutangData(entityKey)` → PHP `/api/piutang`  
Returns: `projects[], summary { terminPerluPerhatian, totalPiutang }, loadingDock[]`

**Fitur:**
1. Tab Berjalan — proyek aktif dengan status (ON_TRACK, AT_RISK, NEEDS_AUDIT), metrics kontrak
2. Tab Selesai / Arsip — proyek completed
3. TerminWaspadaAlert — highlight proyek berisiko
4. Metrics: Termin Perlu Diwaspadai, Total Piutang Belum Tertagih

---

### `/notifikasi`

Sudah dijelaskan di bagian [6. NOTIFIKASI](#6-notifikasi-polling).

---

### `/laporan` (Laporan Keuangan)

**File:** `src/app/(app)/laporan/page.tsx`  
**Role Guard:** SUPER_ADMIN, MANAJER_KEUANGAN, STAF_KEUANGAN

**Query params:** `?entity`, `?year`, `?version=internal|umum`, `?tab=ringkasan|laba-rugi|neraca|arus-kas|piutang|utang-aset|komparasi`

**Data per tab:**

| Tab | Data Fetch | PHP Endpoint |
|-----|-----------|--------------|
| Ringkasan | `getLaporanKeuanganData` | `/api/laporan-keuangan` |
| Laba-Rugi | + `getLaporanPajakData` + `getValidasiPajak3Arah` | `/api/pajak`, `/api/validasi-pajak-3arah` |
| Neraca | `getLaporanKeuanganData` | `/api/laporan-keuangan` |
| Arus Kas | + `getArusKasData` + `getArusKasPresisiData` | `/api/arus-kas` |
| Piutang | `getPiutangData` | `/api/piutang` |
| Utang-Aset | `getLaporanUtangAsetData` | `/api/laporan-keuangan?type=utang-aset` |
| Komparasi | `getLabaRugiData` + `getMonthlyChartData` | `/api/laba-rugi` |

**Fitur:** Multi-tab, entity switcher, year selector, version switcher (INTERNAL/UMUM), Export Excel

---

### `/pengguna` (Manajemen Pengguna)

**File:** `src/app/(app)/pengguna/page.tsx`  
**Role Guard:** MANAJER_KEUANGAN, SUPER_ADMIN

**Data:**
- `getUserList()` → PHP `/api/pengguna`
- `getAllEntities()` → PHP `/api/entities`

**Aksi user & Server Actions:**

| Aksi | Server Action | PHP Endpoint |
|------|--------------|--------------|
| Setujui registrasi | `approveUser(userId, role, entityIds)` | `POST /api/pengguna/approve` |
| Tolak registrasi | `rejectUser(userId)` | `POST /api/pengguna/reject` |
| Update entity access | `updateUserEntities(userId, entityIds)` | `POST /api/pengguna/entities` |
| Nonaktifkan user | `deactivateUser(userId)` | `POST /api/pengguna/deactivate` |
| Aktifkan kembali | `activateUser(userId)` | `POST /api/pengguna/activate` |

---

### `/coa` (Bagan Akun)

**File:** `src/app/(app)/coa/page.tsx`  
**Role Guard:** MANAJER_KEUANGAN, SUPER_ADMIN, STAF_KEUANGAN

**Data:** `getCOAList()` → PHP `/api/coa`

**Fitur:** Pohon/tabel COA, CRUD, kategori (PENDAPATAN/BEBAN/ASET/KEWAJIBAN/MODAL)

---

### `/dokumen`

**File:** `src/app/(app)/dokumen/page.tsx`  
**Role Guard:** SUPER_ADMIN, MANAGER_ADMIN, ADMIN_SIDAMON DILARANG

**Query params:** `?kategori=semua|...`

**Fitur:** Library dokumen, upload (MANAJER+STAF), download, delete (MANAJER only)

---

### `/jenis-input`

**Role:** MANAJER_KEUANGAN  
**Fitur:** List semua jenis input (bawaan + custom), CRUD, set arahLaporan, set entity scope

---

### `/payroll` (Laporan Gaji)

**Query params:** `?entity`, `?year`, `?month`, `?tab=pegawai|tenaga-ahli|rekonsiliasi`

**Data:**
- `getPayrollData(entityId, year, month)` → PHP `/api/payroll`
- `getRekonsiliasiPajakGajiData(entityId, year)` → PHP `/api/rekonsiliasi-pajak-gaji`

**Tabs:** Pegawai tetap, Tenaga Ahli/honorarium, Rekonsiliasi pajak gaji

---

### `/log` (Log Aktivitas)

**File:** `src/app/(app)/log/page.tsx`  
**Role Guard:** SUPER_ADMIN, MANAJER_KEUANGAN, STAF_KEUANGAN  
**Cache:** `force-dynamic`

**Query params:** `?tab=all|user|financial`

**Data:** `getActivityLogs(category?)` → PHP `/api/log`

**Catatan:**
- Log user activity dihapus setelah 30 hari
- Log financial changes permanen (10+ tahun)

---

### `/pajak`

Redirect ke `/payroll?tab=rekonsiliasi&entity=<entity>&year=<year>`

---

## 8. SERVER ACTIONS (MUTASI DATA)

Semua Server Action ada di `src/lib/actions/`.  
Pattern: `"use server"` → `getServerSession` → `phpFetch()` → revalidatePath/redirect

| File | Actions |
|------|---------|
| `auth.ts` | `registerUser` |
| `kas.ts` | `generateNoBukti`, `createKasTransaction`, `deleteKasTransactionGroup`, `replaceKasTransaction`, `updateKasTransactionGroup` |
| `kas-transitory.ts` | Aksi kas transitory (hold, release, transfer antar entitas) |
| `notifikasi.ts` | `markAllNotifikasiRead`, `markNotifikasiRead`, `deleteNotifikasiAction` |
| `pengguna.ts` | `approveUser`, `rejectUser`, `updateUserEntities`, `deactivateUser`, `activateUser` |
| `jurnal.ts` | Edit COA per row |
| `jurnal-transaksi.ts` | Jurnal transaksi pencairan |
| `pendapatan.ts` | CRUD E-Faktur, rekonsiliasi |
| `piutang.ts` | Update project, input termin |
| `coa.ts` | CRUD COA |
| `dokumen.ts` | Upload, delete dokumen |
| `jenis-input.ts` | CRUD jenis input |
| `payroll.ts` | Input gaji, honor |
| `rekonsiliasi-pajak-gaji.ts` | Input rekonsiliasi pajak gaji |
| `saldo-awal.ts` | Set saldo awal akun |
| `log.ts` | Clear log lama |
| `aset-tetap.ts` | CRUD aset tetap |
| `rekanan.ts` | CRUD rekanan |

---

## 9. PHP API ENDPOINTS

Entry point: `api/index.php`  
Auth: semua endpoint (kecuali `/api/auth/login` dan `/api/auth/register`) butuh `Authorization: Bearer <token>`

### Auth
```
POST /api/auth/register    → { message, id }
POST /api/auth/login       → { token, user: { id, name, email, role, entityKeys } }
GET  /api/auth/me          → { id, name, email, role, entityKeys }
```

### Kas
```
GET    /api/kas/ledger         → { rows, totalDebit, totalKredit, saldoAwal, saldoAkhir, totalPages }
POST   /api/kas/no-bukti       → { noBukti }
POST   /api/kas/transaksi      → { noBukti }
DELETE /api/kas/transaksi      → { success }
PUT    /api/kas/transaksi      → success
PATCH  /api/kas/transaksi      → success
```

### Notifikasi
```
GET    /api/notifikasi?filter&page    → { data, pagination }
GET    /api/notifikasi/count?role     → { count }
POST   /api/notifikasi/read-all       → success
POST   /api/notifikasi/read           → success
DELETE /api/notifikasi/:id            → success
```

### Pengguna
```
GET    /api/pengguna               → { data: [...users] }
POST   /api/pengguna/approve       → success
POST   /api/pengguna/reject        → success
POST   /api/pengguna/entities      → success
POST   /api/pengguna/deactivate    → success
POST   /api/pengguna/activate      → success
```

### COA
```
GET    /api/coa       → { data: [...accounts] }
POST   /api/coa       → { id }
PUT    /api/coa/:id   → success
DELETE /api/coa/:id   → success
```

### Jurnal
```
GET   /api/jurnal                → { rows, totalDebit, totalKredit, isBalanced, totalPages }
PATCH /api/jurnal/:txId          → success (update COA)
```

### Laporan Keuangan
```
GET /api/laporan-keuangan?entityIds[]&year&version     → KPI + breakdown
GET /api/laporan-keuangan?type=jurnal&...              → top journal entries
GET /api/laporan-keuangan?type=bank&...                → top bank transactions
GET /api/laporan-keuangan?type=utang-aset&...          → utang & aset detail
GET /api/laporan-keuangan?type=tx-count&dateFrom&dateTo
```

### Kas Transitory
```
GET    /api/kas-transitory              → { items: [...], summary }
POST   /api/kas-transitory              → buat entri hold baru
PATCH  /api/kas-transitory/:id          → update status (release, transfer)
DELETE /api/kas-transitory/:id          → hapus entri
```

### Lainnya
```
GET /api/entities            → list entitas
GET /api/dashboard           → KPI & chart data
GET /api/piutang             → projects + termin data
GET /api/laba-rugi           → laba rugi detail
GET /api/neraca              → neraca detail
GET /api/arus-kas            → arus kas detail
GET /api/pajak               → data pajak
GET /api/profitabilitas      → profitabilitas proyek
GET /api/payroll             → payroll data
GET /api/rekonsiliasi-pajak-gaji
GET /api/pendapatan          → e-faktur + rekap
GET /api/log                 → activity logs
GET /api/buku-besar
GET /api/jenis-input
GET /api/rekanan
GET /api/aset-tetap
GET /api/saldo-awal
GET /api/validasi-pajak-3arah
GET /api/sync                → sync dari Sidamon
```

**Penting:** Semua field DECIMAL dari MySQL di-cast ke `(float)` di PHP sebelum masuk JSON response.

---

## 10. DIAGRAM DATA FLOW

### Login
```
/login form
  → signIn("credentials") [NextAuth]
  → PHP POST /api/auth/login
  → JWT disimpan di session
  → redirect /dashboard
```

### Input Transaksi Kas
```
/kas-kecil form submit
  → createKasTransaction(input) [Server Action]
  → PHP POST /api/kas/transaksi
  → Buat Transaction records
  → Auto-generate journal entries (debit/kredit)
  → Buat notifikasi jika perlu
  → revalidatePath → halaman refresh
```

### Mark Notif Read
```
User klik notif
  → openDetail() [client]
  → markNotifikasiRead(id) [Server Action, silent - pakai useTransition biasa]
  → PHP POST /api/notifikasi/read
  → State lokal update langsung (optimistic)
```

### Delete Notif
```
User klik Trash
  → toast konfirmasi muncul
  → User klik "Ya, Hapus"
  → State list filter optimistic (notif hilang langsung)
  → deleteNotifikasiAction(id) [Server Action, pakai usePageTransition = ada loader]
  → PHP DELETE /api/notifikasi/:id
  → Jika gagal: rollback state + toast error
```

### Crossing Entry Antar Entitas
```
Entitas A bayar untuk B:
  A: Debit Piutang ke B (akun 11x) | Kredit Kas
  Otomatis:
  B: Debit Kas | Kredit Hutang ke A (akun 31x)
Linked via extraFieldsJson.crossingGroupId
```

### Jurnal Transaksi Pencairan Bank (4-leg otomatis)
```
Input: nilai bruto
  → Debit: Kas/Bank (netto = bruto - PPN - PPh)
  → Debit: PPN Dipungut (akun 535)
  → Debit: Potongan PPh (akun 534)
  → Kredit: Pendapatan (akun 4xx, nilai bruto)
```

---

## CATATAN PENTING

### Aturan Akuntansi
- **Debet-normal** (ASET, BEBAN): `saldo_akhir = saldo_awal + debit - kredit`
- **Kredit-normal** (KEWAJIBAN, MODAL, PENDAPATAN): `saldo_akhir = saldo_awal + kredit - debit`
- **Kontra-aset** (akun 210, akun 1001 Akumulasi Penyusutan): kredit-normal meski kategori ASET
- `autoPostedFromJurnal=true` → exclude dari Laba Rugi (hindari double count)

### Kalkulasi E-Faktur
```
DPP = round(100/111 × bruto)
PPN = round(11/111 × bruto)
PPh = round(DPP × tarif)   // tarif default 3.5%
Laba = DPP - PPh
```

### Payroll PPh 21 TER
- 39-bracket tarif efektif
- PTKP-aware (TK/0 s.d K/3)
- Detail bracket: `src/lib/payroll.ts`

### Penyusutan Aset
- `beban/bulan = (harga - residu) / umur_bulan`
- Tanah tidak disusutkan (PSAK 16)
