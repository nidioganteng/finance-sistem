"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const msg = error?.message ?? "";
    const isAuthError =
      msg.includes("Token tidak valid") ||
      msg.includes("Token tidak ditemukan") ||
      msg.includes("Belum login") ||
      msg.includes("sudah kadaluarsa") ||
      msg.includes("401");

    if (isAuthError) {
      router.replace("/login");
    }
  }, [error, router]);

  const msg = error?.message ?? "";
  const isAuthError =
    msg.includes("Token tidak valid") ||
    msg.includes("Belum login") ||
    msg.includes("sudah kadaluarsa");

  if (isAuthError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-page">
        <p className="text-sm text-muted">Sesi berakhir, mengalihkan ke halaman login…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-surface-page">
      <p className="text-sm font-semibold text-status-red">Terjadi kesalahan</p>
      <p className="text-xs text-muted max-w-sm text-center">{msg}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-pill bg-navy text-white text-xs font-semibold"
      >
        Coba lagi
      </button>
    </div>
  );
}
