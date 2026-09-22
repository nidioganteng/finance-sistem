"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const SLIDESHOW_IMAGES = ["/img/login/gambar2.webp", "/img/login/gambar3.webp", "/img/login/gambar6.webp"];
const SLIDE_DELAY = 8000;

const ENTITY_LOGOS = [
  { key: "gaharu", src: "/logo-entitas/gaharu.webp", name: "Gaharu" },
  { key: "kencana", src: "/logo-entitas/kencana.webp", name: "Kencana" },
  { key: "tataring", src: "/logo-entitas/tataring.webp", name: "Tataring" },
  { key: "ciptaAsri", src: "/logo-entitas/cipta-asri.webp", name: "Cipta Asri" },
];

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIdx((i) => (i + 1) % SLIDESHOW_IMAGES.length);
    }, SLIDE_DELAY);
    return () => clearInterval(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) { setError("Email atau password salah, atau akun belum aktif."); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* ── Background slideshow full layar ── */}
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
        {/* Overlay gelap tipis agar teks terbaca */}
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
      <div className="absolute top-7 left-8 z-20 hidden lg:block drop-shadow-lg">
        <div className="text-white text-[15px] font-extrabold tracking-widest uppercase" style={{textShadow:"0 2px 8px rgba(0,0,0,0.5)"}}>Gaharu Sempana Group</div>
        <div className="text-white/80 text-[12.5px] mt-0.5 font-semibold" style={{textShadow:"0 1px 4px rgba(0,0,0,0.5)"}}>Sistem Data Keuangan</div>
      </div>

      {/* Logo entitas + dots — kiri bawah */}
      <div className="absolute bottom-8 left-8 z-20 hidden lg:block">
        <div className="text-white text-[11px] font-bold uppercase tracking-widest mb-3" style={{textShadow:"0 1px 4px rgba(0,0,0,0.6)"}}>Entitas Grup</div>
        <div className="flex items-center gap-4 mb-4">
          {ENTITY_LOGOS.map((e) => (
            <div key={e.key} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-[16px] bg-white flex items-center justify-center overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
                <Image src={e.src} alt={e.name} width={52} height={52} className="object-contain p-1" />
              </div>
              <span className="text-white text-[11px] font-bold" style={{textShadow:"0 1px 4px rgba(0,0,0,0.6)"}}>{e.name}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          {SLIDESHOW_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlideIdx(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === slideIdx ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      </div>

      {/* ── Panel form — tengah, frosted glass ── */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px] flex flex-col justify-center
          bg-white/15 dark:bg-black/40 backdrop-blur-2xl
          rounded-[20px] sm:rounded-[28px] border border-white/25 dark:border-white/10
          px-6 py-8 sm:px-10 sm:py-12 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">

          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-none">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M4 20V10l8-6 8 6v10" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
                <rect x="10" y="14" width="4" height="6" fill="#fff" />
              </svg>
            </div>
            <div>
              <div className="font-extrabold text-[15px] text-white">Sistem Data Keuangan</div>
              <div className="text-[10.5px] text-white/70 font-semibold tracking-wide">GAHARU SEMPANA GROUP</div>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-[30px] font-extrabold text-white leading-tight">Selamat Datang</h1>
            <p className="text-[13.5px] text-white/70 mt-1">Masuk ke akun Anda untuk melanjutkan.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold text-white/70 uppercase tracking-widest block mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@gaharusempana.com"
                className="w-full px-4 py-3 rounded-[12px] border border-white/20 bg-white/10 text-[13.5px] text-white placeholder:text-white/40 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-white/70 uppercase tracking-widest block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-[12px] border border-white/20 bg-white/10 text-[13.5px] text-white placeholder:text-white/40 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all"
                />
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

            {error && (
              <div className="px-4 py-3 rounded-[10px] bg-red-500/20 border border-red-400/40 text-red-200 text-[13px]">
                {error}
              </div>
            )}

            {justRegistered && (
              <div className="px-4 py-3 rounded-[10px] bg-green-500/20 border border-green-400/40 text-green-200 text-[12.5px]">
                Pendaftaran berhasil! Akun Anda menunggu persetujuan Manajer Keuangan.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-[12px] bg-white text-navy font-bold text-[14px] mt-1 disabled:opacity-60 hover:bg-white/90 transition-colors"
            >
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>

          <p className="text-center text-[12.5px] text-white/60 mt-6">
            Belum punya akun?{" "}
            <Link href="/register" className="text-white font-semibold hover:underline">
              Daftar di sini
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
