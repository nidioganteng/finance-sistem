"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  // Selalu mulai dari `false` supaya render pertama di client PERSIS sama
  // dengan HTML dari server (server nggak punya akses ke `document`/
  // localStorage, jadi nggak tau tema aktif). Baru dikoreksi di useEffect
  // (setelah hydration selesai) — kalau langsung dibaca dari
  // document.documentElement di lazy initializer useState, render pertama
  // client bisa beda dari server dan bikin React lempar hydration error.
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      className="w-[38px] h-[38px] rounded-[11px] border border-border-soft flex items-center justify-center bg-surface-card hover:bg-surface-hover transition-colors flex-none"
      title={dark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
    >
      {dark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-muted-stronger" />}
    </button>
  );
}
