"use client";

import { useState } from "react";
import Link from "next/link";
import { registerUser } from "@/lib/actions/auth";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPwError(null);
    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    const confirm = fd.get("confirm") as string;
    if (password !== confirm) {
      setPwError("Password dan konfirmasi tidak cocok.");
      return;
    }
    setLoading(true);
    const result = await registerUser(fd);
    setLoading(false);
    if (result?.error) setError(result.error);
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
            <div className="font-extrabold text-[17px] text-navy-text leading-tight">Daftar Akun</div>
            <div className="text-[11px] text-muted font-semibold tracking-wide">GAHARU SEMPANA GROUP</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[12.5px] font-semibold text-muted-stronger block mb-1.5">Nama Lengkap</label>
            <input
              name="name"
              type="text"
              required
              placeholder="Nama lengkap Anda"
              className="w-full px-3.5 py-3 rounded-xl border border-border bg-surface-input text-sm"
            />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-muted-stronger block mb-1.5">Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="nama@gaharusempana.com"
              className="w-full px-3.5 py-3 rounded-xl border border-border bg-surface-input text-sm"
            />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-muted-stronger block mb-1.5">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Minimal 8 karakter"
              className="w-full px-3.5 py-3 rounded-xl border border-border bg-surface-input text-sm"
            />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-muted-stronger block mb-1.5">Konfirmasi Password</label>
            <input
              name="confirm"
              type="password"
              required
              placeholder="Ulangi password"
              className="w-full px-3.5 py-3 rounded-xl border border-border bg-surface-input text-sm"
            />
          </div>

          {pwError && <p className="text-sm text-status-red">{pwError}</p>}
          {error && <p className="text-sm text-status-red">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-navy text-white font-bold text-[14.5px] mt-2 disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Daftar"}
          </button>
        </form>

        <div className="mt-5 pt-5 border-t border-surface-subtle">
          <p className="text-center text-[12.5px] text-muted">
            Setelah mendaftar, akun Anda menunggu persetujuan dari Manajer Keuangan sebelum bisa login.
          </p>
          <p className="text-center text-xs text-muted mt-3">
            Sudah punya akun?{" "}
            <Link href="/login" className="text-brand font-semibold hover:underline">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
