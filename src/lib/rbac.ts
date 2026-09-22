import { Role } from "@prisma/client";

export type NavItem = {
  label: string;
  href: string;
  icon: "grid" | "fileText" | "history" | "bell" | "listChecks" | "bookOpen" | "receipt" | "landmark" | "users" | "walletCards" | "trendingUp" | "scale";
};

type NavSection = {
  title: string;
  items: NavItem[];
};

// Struktur ini disalin persis dari sidebar tiap role di mockup
// (baris 75-225 di Sistem_Data_Keuangan_Gaharu_Sempana_dc.html).
// Halaman yang belum diimplementasikan diarahkan ke /coming-soon dulu
// supaya sidebar tetap bisa diklik tanpa link mati.
const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  SUPER_ADMIN: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: "grid" },
        { label: "Laporan Keuangan", href: "/laporan", icon: "fileText" },
        { label: "Log Aktivitas", href: "/log", icon: "history" },
        { label: "Notifikasi", href: "/notifikasi", icon: "bell" },
      ],
    },
  ],
  MANAJER_KEUANGAN: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: "grid" },
        { label: "Notifikasi", href: "/notifikasi", icon: "bell" },
      ],
    },
    {
      title: "Operasional",
      items: [
        { label: "Kas Kecil", href: "/kas-kecil", icon: "walletCards" },
        { label: "Kas Besar", href: "/kas-besar", icon: "walletCards" },
        { label: "Buku Bank", href: "/bank-buku", icon: "receipt" },
        { label: "Jurnal Umum", href: "/jurnal", icon: "fileText" },
        { label: "Buku Besar", href: "/buku-besar", icon: "bookOpen" },
        { label: "Kontrol Piutang & Termin", href: "/piutang", icon: "receipt" },
      ],
    },
    {
      title: "Laporan",
      items: [
        { label: "Laporan Keuangan", href: "/laporan", icon: "fileText" },
        { label: "Laporan Pajak", href: "/pajak", icon: "landmark" },
      ],
    },
    {
      title: "Pengaturan",
      items: [
        { label: "Bagan Akun", href: "/coa", icon: "listChecks" },
        { label: "Dokumen & SOP", href: "/dokumen", icon: "bookOpen" },
        { label: "Kelola Jenis Input Transaksi", href: "/jenis-input", icon: "listChecks" },
        { label: "Manajemen Pengguna", href: "/pengguna", icon: "users" },
      ],
    },
  ],
  STAF_KEUANGAN: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: "grid" },
      ],
    },
    {
      title: "Operasional",
      items: [
        { label: "Kas Kecil", href: "/kas-kecil", icon: "walletCards" },
        { label: "Kas Besar", href: "/kas-besar", icon: "walletCards" },
        { label: "Buku Bank", href: "/bank-buku", icon: "receipt" },
        { label: "Jurnal Umum", href: "/jurnal", icon: "fileText" },
        { label: "Buku Besar", href: "/buku-besar", icon: "bookOpen" },
        { label: "Laporan Keuangan", href: "/laporan-keuangan", icon: "fileText" },
        { label: "Kontrol Piutang & Termin", href: "/piutang", icon: "receipt" },
      ],
    },
    {
      title: "Lainnya",
      items: [
        { label: "Bagan Akun", href: "/coa", icon: "listChecks" },
        { label: "Dokumen & SOP", href: "/dokumen", icon: "bookOpen" },
        { label: "Kelola Jenis Input Transaksi", href: "/jenis-input", icon: "listChecks" },
      ],
    },
  ],
  MANAGER_ADMIN: [
    {
      title: "Overview",
      items: [{ label: "Notifikasi Termin", href: "/notifikasi", icon: "bell" }],
    },
  ],
  ADMIN_SIDAMON: [],
};

export function getNavForRole(role: Role): NavSection[] {
  return NAV_BY_ROLE[role] ?? [];
}

export function roleLabel(role: Role): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "SUPER ADMIN";
    case "MANAJER_KEUANGAN":
      return "MANAJER KEUANGAN";
    case "STAF_KEUANGAN":
      return "STAF KEUANGAN";
    case "MANAGER_ADMIN":
      return "MANAGER ADMIN";
    case "ADMIN_SIDAMON":
      return "ADMIN SIDAMON";
    default:
      return role;
  }
}

// Entity yang boleh dilihat lewat dropdown switcher = entity yang di-assign
// ke user (UserEntityAccess), bukan bebas pilih semua seperti di mockup.
// "grup" (agregat semua entity) hanya relevan untuk SUPER_ADMIN & MANAJER_KEUANGAN.
export function canViewGrupAggregate(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "MANAJER_KEUANGAN";
}

// Siapa yang boleh input/edit/hapus transaksi Kas Kecil, Kas Besar, Buku Bank.
// Manajer Keuangan awalnya cuma monitoring (read-only) — sekarang dikasih akses
// penuh yang sama dengan Staf Keuangan (issue #5).
export function canManageTransaksi(role: Role): boolean {
  return role === "STAF_KEUANGAN" || role === "MANAJER_KEUANGAN";
}
