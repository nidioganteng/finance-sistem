import { withAuth } from "next-auth/middleware";

// Semua route di bawah (app) group butuh login. Pengecekan role per-halaman
// (misalnya Manajemen Pengguna cuma untuk MANAJER_KEUANGAN) dilakukan di
// masing-masing page/layout, bukan di sini, karena aturannya beda-beda per role.
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/laporan/:path*",
    "/log/:path*",
    "/notifikasi/:path*",
    "/jurnal/:path*",
    "/piutang/:path*",
    "/pajak/:path*",
    "/coa/:path*",
    "/dokumen/:path*",
    "/pengguna/:path*",
    "/jenis-input/:path*",
    "/kas-kecil/:path*",
    "/kas-besar/:path*",
    "/bank-buku/:path*",
    "/buku-besar/:path*",
    "/neraca/:path*",
    "/laba-rugi/:path*",
    "/arus-kas/:path*",
    "/profitabilitas/:path*",
    "/coming-soon/:path*",
  ],
};
