import { Role } from "@prisma/client";

export type NavSubItem = {
  label: string;
  href: string;
  version?: "internal" | "umum";
  children?: { label: string; href: string; version?: "internal" | "umum" }[];
};

export type NavItem = {
  label: string;
  href: string;
  icon: "grid" | "fileText" | "history" | "bell" | "listChecks" | "bookOpen" | "receipt" | "landmark" | "users" | "walletCards" | "trendingUp" | "scale" | "wallet" | "banknote" | "building2" | "scrollText" | "table2" | "handCoins" | "folderOpen" | "settings" | "settings2" | "clipboardList" | "penLine" | "layers";
  subItems?: NavSubItem[];
};

type NavSection = {
  title: string;
  items: NavItem[];
  collapsible?: boolean;
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
        {
          label: "Laporan Keuangan",
          href: "/laporan",
          icon: "fileText",
          subItems: [
            { label: "Laporan Internal", href: "/laporan?version=internal", version: "internal" },
            { label: "Laporan Umum", href: "/laporan?version=umum", version: "umum" },
          ],
        },
        { label: "Laporan Pendapatan", href: "/pendapatan", icon: "receipt" },
        { label: "Laporan Hutang & Piutang", href: "/laporan-hutang-piutang", icon: "walletCards" },
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
        {
          label: "Transaksi",
          href: "/operasional-transaksi",
          icon: "penLine",
          subItems: [
            { label: "Kas Kecil", href: "/kas-kecil" },
            { label: "Kas Besar", href: "/kas-besar" },
            { label: "Buku Bank", href: "/bank-buku" },
            { label: "Entry Jurnal", href: "/jurnal-transaksi" },
            { label: "Aktiva Tetap", href: "/aktiva-tetap" },
          ],
        },
        {
          label: "Monitoring",
          href: "/operasional-monitoring",
          icon: "fileText",
          subItems: [
            { label: "Jurnal Umum", href: "/jurnal" },
            { label: "Buku Besar", href: "/buku-besar" },
            { label: "Daftar Akun", href: "/daftar-akun" },
            { label: "Kontrol Termin", href: "/piutang" },
          ],
        },
      ],
    },
    {
      title: "Laporan",
      collapsible: true,
      items: [
        { label: "Laporan Pendapatan", href: "/pendapatan", icon: "receipt" },
        {
          label: "Laporan Keuangan",
          href: "/laporan",
          icon: "fileText",
          subItems: [
            { label: "Laporan Internal", href: "/laporan?version=internal", version: "internal" },
            { label: "Laporan Umum", href: "/laporan?version=umum", version: "umum" },
          ],
        },
        { label: "Laporan Hutang & Piutang", href: "/laporan-hutang-piutang", icon: "walletCards" },
      ],
    },
    {
      title: "Pengaturan",
      collapsible: true,
      items: [
        { label: "Bagan Akun", href: "/coa", icon: "landmark" },
        { label: "Dokumen & SOP", href: "/dokumen", icon: "folderOpen" },
        { label: "Kelola Jenis Input", href: "/jenis-input", icon: "layers" },
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
        {
          label: "Transaksi",
          href: "/operasional-transaksi",
          icon: "penLine",
          subItems: [
            { label: "Kas Kecil", href: "/kas-kecil" },
            { label: "Kas Besar", href: "/kas-besar" },
            { label: "Buku Bank", href: "/bank-buku" },
            { label: "Entry Jurnal", href: "/jurnal-transaksi" },
            { label: "Aktiva Tetap", href: "/aktiva-tetap" },
          ],
        },
        {
          label: "Monitoring",
          href: "/operasional-monitoring",
          icon: "fileText",
          subItems: [
            { label: "Jurnal Umum", href: "/jurnal" },
            { label: "Buku Besar", href: "/buku-besar" },
            { label: "Daftar Akun", href: "/daftar-akun" },
            { label: "Kontrol Termin", href: "/piutang" },
          ],
        },
      ],
    },
    {
      title: "Laporan",
      collapsible: true,
      items: [
        { label: "Laporan Pendapatan", href: "/pendapatan", icon: "receipt" },
        {
          label: "Laporan Keuangan",
          href: "/laporan",
          icon: "fileText",
          subItems: [
            { label: "Laporan Internal", href: "/laporan?version=internal", version: "internal" },
            { label: "Laporan Umum", href: "/laporan?version=umum", version: "umum" },
          ],
        },
        { label: "Laporan Hutang & Piutang", href: "/laporan-hutang-piutang", icon: "walletCards" },
      ],
    },
    {
      title: "Pengaturan",
      collapsible: true,
      items: [
        { label: "Bagan Akun", href: "/coa", icon: "listChecks" },
        { label: "Dokumen & SOP", href: "/dokumen", icon: "folderOpen" },
        { label: "Kelola Jenis Input", href: "/jenis-input", icon: "settings2" },
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
// "grup" (agregat semua entity) — SUPER_ADMIN, MANAJER_KEUANGAN, dan STAF_KEUANGAN.
export function canViewGrupAggregate(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "MANAJER_KEUANGAN" || role === "STAF_KEUANGAN";
}

// Siapa yang boleh input/edit/hapus transaksi Kas Kecil, Kas Besar, Buku Bank.
// Manajer Keuangan awalnya cuma monitoring (read-only) — sekarang dikasih akses
// penuh yang sama dengan Staf Keuangan (issue #5).
export function canManageTransaksi(role: Role): boolean {
  return role === "STAF_KEUANGAN" || role === "MANAJER_KEUANGAN";
}
