# Sistem Data Keuangan - Gaharu Sempana Group

Hasil konversi dari mockup Claude Design (`Sistem_Data_Keuangan_Gaharu_Sempana_dc.html`) ke Next.js
full-stack (App Router, TypeScript) + MySQL (Prisma) + Docker.

## Cara jalanin di lokal

1. Nyalakan database:
   ```
   docker compose up -d
   ```
   Ini bakal jalanin MySQL di port 3306 dan Adminer (buat lihat isi database lewat browser) di
   http://localhost:8081 (server: `mysql`, user: `sdk_user`, password: `sdk_password`).

2. Install dependency:
   ```
   npm install
   ```

3. Salin `.env.example` jadi `.env`, generate `NEXTAUTH_SECRET` pakai `openssl rand -base64 32`.

4. Push schema ke database dan isi data contoh:
   ```
   npx prisma db push
   npm run prisma:seed
   ```

5. Jalankan dev server:
   ```
   npm run dev
   ```
   Buka http://localhost:3000

## Akun contoh (dari seed, password semua `password123`)

| Role | Email |
|---|---|
| Super Admin | superadmin@gaharusempana.com |
| Manajer Keuangan | manajer@gaharusempana.com |
| Staf Keuangan | staf@gaharusempana.com |

## Yang sudah dibangun

- Struktur project Next.js (App Router, TypeScript, Tailwind dengan token warna dari mockup)
- Docker Compose untuk MySQL + Adminer
- Schema Prisma: Entity, User, UserEntityAccess (akses many-to-many), Project, Termin, CoaAccount,
  JenisInputTransaksi, Transaction, LoadingDockTransaksi, Dokumen, Notifikasi, ActivityLog
- Auth asli (NextAuth, email + password) menggantikan tombol demo "Masuk sebagai..." di mockup
- Middleware proteksi route + Sidebar yang nav-nya difilter persis sesuai role
  (Super Admin, Manajer Keuangan, Staf Keuangan punya sidebar berbeda, disalin dari mockup)
- Halaman **Login** dan **Dashboard** (Master Dashboard agregat grup, dan dashboard per-entity)
  jalan penuh dari database asli (bukan dummy data lagi)
- Halaman **Notifikasi** (filter per tipe, tandai semua dibaca — pakai Server Action)
- Halaman **Jurnal Umum** (ledger per entity, filter per jenis input, total periode berjalan)
- Halaman **Kas Kecil**, **Kas Besar**, **Bank Buku** — termasuk form "+ Transaksi Baru" yang
  betulan nulis ke database (multi baris akun, validasi total, saldo berjalan otomatis terupdate)

## Yang belum dibangun (masih placeholder "Coming Soon")

Laporan Keuangan Internal, Log Aktivitas, Kontrol Piutang & Termin, Laporan Pajak, Bagan Akun,
Dokumen & SOP, Manajemen Pengguna, Kelola Jenis Input Transaksi, Buku Besar, Neraca, Laba Rugi,
Arus Kas, Profitabilitas Proyek.

## Catatan soal generate Prisma Client

Sandbox yang dipakai untuk nulis project ini nggak bisa akses `binaries.prisma.sh` (network-nya
dibatasi), jadi `npx prisma generate` belum sempat dijalankan di sana — makanya kalau kamu lihat
riwayat kerja sebelum ini, ada error TypeScript soal `@prisma/client` "has no exported member".
Itu semua bakal hilang begitu kamu jalankan `npx prisma generate` (atau `npx prisma db push`, yang
otomatis generate juga) di komputer kamu sendiri. Sudah dicek dengan `tsc --noEmit`, dan di luar
error yang disebabkan client belum ke-generate itu, tidak ada error lain.

Rute dan proteksi role untuk semua halaman di atas sudah ada di `src/lib/rbac.ts` — tinggal diisi
kontennya satu-satu di iterasi berikutnya.

## Catatan penting soal perbedaan dari mockup

- **Login**: mockup pakai 3 tombol pintasan ("Masuk sebagai CEO/Manajer/Staf") buat keperluan demo.
  Versi ini pakai form email + password asli yang divalidasi ke database.
- **Role & entity switcher**: di mockup, role & entity bisa diganti bebas lewat dropdown untuk
  keperluan preview desain. Di versi ini, role ikut akun yang login (tidak bisa diganti-ganti), dan
  pilihan entity di dropdown hanya menampilkan entity yang benar-benar di-assign ke user itu lewat
  tabel `UserEntityAccess`.
- **Angka revenue/spend per entity**: di mockup itu angka dummy terpisah dari data proyek. Di versi
  ini, revenue dan spend dihitung langsung dari data Project asli di database supaya cuma ada satu
  sumber kebenaran.
