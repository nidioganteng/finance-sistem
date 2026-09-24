"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { registerUser } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const SLIDESHOW_IMAGES = ["/img/daftar/gambar1.webp", "/img/daftar/gambar4.webp", "/img/daftar/gambar5.webp"];
const SLIDE_DELAY = 8000;

const ENTITY_LOGOS = [
  { key: "gaharu", src: "/logo-entitas/gaharu.webp", name: "Gaharu" },
  { key: "kencana", src: "/logo-entitas/kencana.webp", name: "Kencana" },
  { key: "tataring", src: "/logo-entitas/tataring.webp", name: "Tataring" },
  { key: "ciptaAsri", src: "/logo-entitas/cipta-asri.webp", name: "Cipta Asri" },
];

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIdx((i) => (i + 1) % SLIDESHOW_IMAGES.length);
    }, SLIDE_DELAY);
    return () => clearInterval(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPwError(null);
    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    const confirm = fd.get("confirm") as string;
    if (password !== confirm) { setPwError("Password dan konfirmasi tidak cocok."); return; }
    setLoading(true);
    const result = await registerUser(fd);
    setLoading(false);
    if (result?.error) setError(result.error);
  }

  const inputClass = "w-full px-4 py-3 rounded-[12px] border border-white/20 bg-white/10 text-[13.5px] text-white placeholder:text-white/40 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all";
  const labelClass = "text-[11px] font-bold text-white/70 uppercase tracking-widest block mb-1.5";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background slideshow */}
      <div className="absolute inset-0 bg-slate-900">
        {SLIDESHOW_IMAGES.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt="background"
            fill
            className={`object-cover transition-opacity duration-1000 ${i === slideIdx ? "opacity-100" : "opacity-0"}`}
            priority={i === 0}
          />
        ))}
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Theme toggle */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      {/* Copyright */}
      <div className="absolute bottom-5 right-6 z-20">
        <p className="text-[11px] text-white/30">© 2026 Gaharu Sempana Group</p>
      </div>

      {/* Label kiri atas */}
      <div className="absolute top-7 left-8 z-20 hidden lg:block">
        <div className="text-white text-[15px] font-extrabold tracking-widest uppercase" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>Gaharu Sempana Group</div>
        <div className="text-white/80 text-[12.5px] mt-0.5 font-semibold" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>Sistem Data Keuangan</div>
      </div>

      {/* Logo entitas + dots — kiri bawah */}
      <div className="absolute bottom-8 left-8 z-20 hidden lg:block">
        <div className="text-white text-[11px] font-bold uppercase tracking-widest mb-3" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>Entitas Grup</div>
        <div className="flex items-center gap-4 mb-4">
          {ENTITY_LOGOS.map((e) => (
            <div key={e.key} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-[16px] bg-white flex items-center justify-center overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
                <Image src={e.src} alt={e.name} width={52} height={52} className="object-contain p-1" />
              </div>
              <span className="text-white text-[11px] font-bold" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{e.name}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          {SLIDESHOW_IMAGES.map((_, i) => (
            <button key={i} onClick={() => setSlideIdx(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === slideIdx ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      </div>

      {/* Panel form — tengah */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[440px] flex flex-col
          bg-white/15 dark:bg-black/40 backdrop-blur-2xl
          rounded-[20px] sm:rounded-[28px] border border-white/25 dark:border-white/10
          px-6 py-8 sm:px-10 sm:py-10 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">

          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-[28px] font-extrabold text-white leading-tight">Buat Akun</h1>
            <p className="text-[13px] text-white/70 mt-1">Daftarkan diri Anda ke sistem keuangan grup.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div>
              <label className={labelClass}>Nama Lengkap</label>
              <input name="name" type="text" required placeholder="Nama lengkap Anda" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input name="email" type="email" required placeholder="nama@gaharusempana.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <div className="relative">
                <input name="password" type={showPassword ? "text" : "password"} required minLength={8} placeholder="Minimal 8 karakter" className={`${inputClass} pr-11`} />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Konfirmasi Password</label>
              <div className="relative">
                <input name="confirm" type={showConfirm ? "text" : "password"} required placeholder="Ulangi password" className={`${inputClass} pr-11`} />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {pwError && (
              <div className="px-4 py-3 rounded-[10px] bg-red-500/20 border border-red-400/40 text-red-200 text-[13px]">{pwError}</div>
            )}
            {error && (
              <div className="px-4 py-3 rounded-[10px] bg-red-500/20 border border-red-400/40 text-red-200 text-[13px]">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-[12px] bg-white text-navy font-bold text-[14px] mt-1 disabled:opacity-60 hover:bg-white/90 transition-colors">
              {loading ? "Memproses..." : "Daftar Sekarang"}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-white/15 text-center">
            <p className="text-[12.5px] text-white/60">
              Sudah punya akun?{" "}
              <Link href="/login" className="text-white font-semibold hover:underline">Masuk</Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
