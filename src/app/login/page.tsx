"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

const ENTITY_LOGOS = [
  { key: "gaharu", src: "/logo-entitas/gaharu.webp", name: "Gaharu" },
  { key: "kencana", src: "/logo-entitas/kencana.webp", name: "Kencana" },
  { key: "tataring", src: "/logo-entitas/tataring.webp", name: "Tataring" },
  { key: "ciptaAsri", src: "/logo-entitas/cipta-asri.webp", name: "Cipta Asri" },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen flex">
      {/* ── Kiri: gambar + overlay ── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden">
        {/* Background image — ganti file public/login-bg.jpg untuk ubah gambar */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-navy">
          {/* Uncomment baris di bawah setelah taruh file public/login-bg.jpg */}
          {/* <Image src="/login-bg.jpg" alt="background" fill className="object-cover opacity-60" priority /> */}
        </div>

        {/* Overlay gradient bawah */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Konten overlay */}
        <div className="relative z-10 flex flex-col justify-between w-full p-10">
          {/* Top: nama sistem */}
          <div>
            <div className="text-white/90 text-[13px] font-bold tracking-widest uppercase">
              Gaharu Sempana Group
            </div>
            <div className="text-white/60 text-[12px] mt-0.5">Sistem Data Keuangan</div>
          </div>

          {/* Bottom: 4 logo entitas */}
          <div>
            <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-3">Entitas Grup</div>
            <div className="flex items-center gap-3">
              {ENTITY_LOGOS.map((e) => (
                <div key={e.key} className="flex flex-col items-center gap-1.5">
                  <div className="w-12 h-12 rounded-[14px] bg-white shadow-lg flex items-center justify-center overflow-hidden border border-white/20">
                    <Image src={e.src} alt={e.name} width={44} height={44} className="object-contain p-1" />
                  </div>
                  <span className="text-white/70 text-[10.5px] font-semibold">{e.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Kanan: form login ── */}
      <div className="flex-1 flex flex-col bg-surface-page relative">
        {/* Theme toggle */}
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-[400px]">
            {/* Logo mobile (hanya muncul di layar kecil) */}
            <div className="flex items-center gap-3 mb-8 lg:hidden">
              <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center flex-none">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M4 20V10l8-6 8 6v10" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
                  <rect x="10" y="14" width="4" height="6" fill="#fff" />
                </svg>
              </div>
              <div>
                <div className="font-extrabold text-[15px] text-navy-text">Sistem Data Keuangan</div>
                <div className="text-[10.5px] text-muted font-semibold tracking-wide">GAHARU SEMPANA GROUP</div>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-[28px] font-extrabold text-navy-text leading-tight">Selamat Datang</h1>
              <p className="text-[14px] text-muted mt-1">Masuk ke akun Anda untuk melanjutkan.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[12px] font-bold text-muted-stronger uppercase tracking-wide block mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@gaharusempana.com"
                  className="w-full px-4 py-3 rounded-[12px] border border-border-soft bg-surface-input text-[13.5px] text-navy-text placeholder:text-muted-faint focus:outline-none focus:border-brand/60 transition-colors"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-muted-stronger uppercase tracking-wide block mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-[12px] border border-border-soft bg-surface-input text-[13.5px] text-navy-text placeholder:text-muted-faint focus:outline-none focus:border-brand/60 transition-colors"
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-[10px] bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-status-red text-[13px]">
                  {error}
                </div>
              )}

              {justRegistered && (
                <div className="px-4 py-3 rounded-[10px] bg-green-50 dark:bg-green-500/15 border border-green-200 dark:border-green-500/30 text-[12.5px] text-green-700 dark:text-green-400">
                  Pendaftaran berhasil! Akun Anda menunggu persetujuan Manajer Keuangan.
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-[12px] bg-navy text-white font-bold text-[14px] mt-1 disabled:opacity-60 hover:bg-navy/90 transition-colors"
              >
                {loading ? "Memproses..." : "Masuk"}
              </button>
            </form>

            <p className="text-center text-[12.5px] text-muted mt-6">
              Belum punya akun?{" "}
              <Link href="/register" className="text-brand font-semibold hover:underline">
                Daftar di sini
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 text-center">
          <p className="text-[11px] text-muted-faint">© 2026 Gaharu Sempana Group. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
