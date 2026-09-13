"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
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

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email atau password salah, atau akun belum aktif.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-subtle p-6">
      <div className="w-full max-w-[400px] bg-white border border-black/[.06] rounded-[20px] shadow-[0_4px_24px_rgba(15,23,42,.06)] p-10 px-9">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand to-brand-soft flex items-center justify-center flex-none">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 20V10l8-6 8 6v10" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
              <rect x="10" y="14" width="4" height="6" fill="#fff" />
            </svg>
          </div>
          <div>
            <div className="font-extrabold text-[17px] text-navy-text leading-tight">Sistem Data Keuangan</div>
            <div className="text-[11px] text-muted font-semibold tracking-wide">GAHARU SEMPANA GROUP</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[12.5px] font-semibold text-muted-stronger block mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@gaharusempana.com"
              className="w-full px-3.5 py-3 rounded-xl border border-border bg-surface-input text-sm"
            />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-muted-stronger block mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-3 rounded-xl border border-border bg-surface-input text-sm"
            />
          </div>

          {error && <p className="text-sm text-status-red">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-navy text-white font-bold text-[14.5px] mt-2 disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        {justRegistered && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-[12.5px] text-green-700">
            Pendaftaran berhasil! Akun Anda menunggu persetujuan Manajer Keuangan.
          </div>
        )}

        <p className="text-center text-xs text-muted mt-6">
          Belum punya akun?{" "}
          <Link href="/register" className="text-brand font-semibold hover:underline">
            Daftar di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
