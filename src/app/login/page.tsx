"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const SLIDESHOW_IMAGES = ["/img/gambar1.png", "/img/gambar2.png"];

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
  const [slideIdx, setSlideIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIdx((i) => (i + 1) % SLIDESHOW_IMAGES.length);
    }, 5000);
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

      {/* Label kiri atas */}
      <div className="absolute top-6 left-8 z-20 hidden lg:block">
        <div className="text-white/90 text-[13px] font-bold tracking-widest uppercase">Gaharu Sempana Group</div>
        <div className="text-white/60 text-[11.5px] mt-0.5">Sistem Data Keuangan</div>
      </div>

      {/* Logo entitas + dots — kiri bawah */}
      <div className="absolute bottom-8 left-8 z-20 hidden lg:block">
        <div className="text-white/50 text-[10.5px] font-semibold uppercase tracking-widest mb-2.5">Entitas Grup</div>
        <div className="flex items-center gap-3 mb-3">
          {ENTITY_LOGOS.map((e) => (
            <div key={e.key} className="flex flex-col items-center gap-1.5">
              <div className="w-11 h-11 rounded-[13px] bg-white shadow-lg flex items-center justify-center overflow-hidden">
                <Image src={e.src} alt={e.name} width={40} height={40} className="object-contain p-1" />
              </div>
              <span className="text-white/70 text-[10px] font-semibold">{e.name}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          {SLIDESHOW_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlideIdx(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === slideIdx ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
            />
          ))}
        </div>
      </div>

      {/* ── Panel form — tengah, frosted glass ── */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-[420px] flex flex-col justify-center
          bg-white/10 backdrop-blur-xl
          rounded-[28px] border border-white/20
          px-10 py-12 shadow-2xl">

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
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-[12px] border border-white/20 bg-white/10 text-[13.5px] text-white placeholder:text-white/40 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all"
              />
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

          <p className="text-center text-[11px] text-white/30 mt-8">© 2026 Gaharu Sempana Group</p>
        </div>
      </div>
    </div>
  );
}
