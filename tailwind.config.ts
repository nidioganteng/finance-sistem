import type { Config } from "tailwindcss";

// Token warna & font diambil langsung dari mockup Claude Design
// (Sistem_Data_Keuangan_Gaharu_Sempana_dc.html) supaya hasil konversi
// tetap konsisten secara visual dengan desain aslinya.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "sans-serif"],
      },
      colors: {
        navy: {
          DEFAULT: "#0f1729", // sidebar aktif / tombol utama
          text: "#0f172a", // warna teks judul
        },
        brand: {
          DEFAULT: "#3b6fed",
          hover: "#2952c4",
          soft: "#6d5ef5",
        },
        surface: {
          page: "#f5f6f8",
          card: "#ffffff",
          subtle: "#f7f8fa",
          input: "#f9fafb",
          hover: "#f1f2f5",
        },
        border: {
          DEFAULT: "#e2e6eb",
          soft: "#e5e8ec",
        },
        muted: {
          DEFAULT: "#64748b",
          strong: "#475569",
          stronger: "#334155",
          faint: "#94a3b8",
          faintest: "#a3acba",
        },
        entity: {
          gaharu: "#3b6fed",
          kencana: "#e0433f",
          tataring: "#1f9d55",
          ciptaAsri: "#8b5cf6",
          umum: "#64748b",
        },
        status: {
          amber: "#f59e0b",
          amberDark: "#92400e",
          green: "#1f9d55",
          red: "#e0433f",
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
