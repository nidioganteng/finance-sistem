import type { Config } from "tailwindcss";

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
          DEFAULT: withOpacity("--color-navy"),
          text: withOpacity("--color-navy-text"),
          soft: withOpacity("--color-navy-soft"),
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
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "slide-in-from-top": {
          from: { transform: "translateY(-8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-from-bottom": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "zoom-in": {
          from: { transform: "scale(0.95)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "zoom-out": {
          from: { transform: "scale(1)", opacity: "1" },
          to: { transform: "scale(0.95)", opacity: "0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.2s ease-out",
        "slide-in-from-top": "slide-in-from-top 0.2s ease-out",
        "slide-in-from-bottom": "slide-in-from-bottom 0.2s ease-out",
        "zoom-in": "zoom-in 0.15s ease-out",
        "zoom-out": "zoom-out 0.15s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
