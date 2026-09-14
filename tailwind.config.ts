import type { Config } from "tailwindcss";

// Token warna & font diambil langsung dari mockup Claude Design
// (Sistem_Data_Keuangan_Gaharu_Sempana_dc.html) supaya hasil konversi
// tetap konsisten secara visual dengan desain aslinya.
//
// Nilai tiap token dibaca dari CSS variable (didefinisikan di globals.css,
// format "R G B") supaya otomatis ganti nilai saat class "dark" aktif di
// <html> — komponen yang sudah pakai token ini (bg-surface-page, text-muted,
// dst) otomatis dukung dark mode tanpa perlu nulis varian `dark:` manual.
// Return type dilonggarkan ke `any` karena tipe resmi `tailwindcss` untuk
// `theme.colors` belum mendeklarasikan bentuk function ini walau didukung
// penuh saat runtime oleh Tailwind (dipakai untuk resolve opacity modifier
// seperti `bg-surface-card/50`).
function withOpacity(varName: string): any {
  return ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined
      ? `rgb(var(${varName}))`
      : `rgb(var(${varName}) / ${opacityValue})`;
}

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "sans-serif"],
      },
      colors: {
        navy: {
          DEFAULT: "#0f1729", // sidebar aktif / tombol utama — sengaja tetap gelap di kedua tema
          text: withOpacity("--color-navy-text"), // warna teks judul
        },
        brand: {
          DEFAULT: "#3b6fed",
          hover: "#2952c4",
          soft: "#6d5ef5",
        },
        surface: {
          page: withOpacity("--color-surface-page"),
          card: withOpacity("--color-surface-card"),
          subtle: withOpacity("--color-surface-subtle"),
          input: withOpacity("--color-surface-input"),
          hover: withOpacity("--color-surface-hover"),
        },
        border: {
          DEFAULT: withOpacity("--color-border"),
          soft: withOpacity("--color-border-soft"),
        },
        muted: {
          DEFAULT: withOpacity("--color-muted"),
          strong: withOpacity("--color-muted-strong"),
          stronger: withOpacity("--color-muted-stronger"),
          faint: withOpacity("--color-muted-faint"),
          faintest: withOpacity("--color-muted-faintest"),
        },
        entity: {
          gaharu: "#3b6fed",
          kencana: "#e0433f",
          tataring: "#1f9d55",
          ciptaAsri: "#8b5cf6",
          umum: "#64748b",
        },
        status: {
          amber: withOpacity("--color-status-amber"),
          amberDark: withOpacity("--color-status-amberDark"),
          green: withOpacity("--color-status-green"),
          red: withOpacity("--color-status-red"),
        },
      },
      borderRadius: {
        pill: "999px",
      },
    },
  },
  plugins: [],
};

export default config;
