"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { registerUser } from "@/lib/actions/auth";

const BG_IMAGE = "/img/login/gambar2.webp";

const ENTITY_LOGOS = [
  { key: "gaharu",    src: "/logo-entitas/gaharu.webp",    name: "Gaharu" },
  { key: "kencana",   src: "/logo-entitas/kencana.webp",   name: "Kencana" },
  { key: "tataring",  src: "/logo-entitas/tataring.webp",  name: "Tataring" },
  { key: "ciptaAsri", src: "/logo-entitas/cipta-asri.webp",name: "Cipta Asri" },
];

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(
    justRegistered ? "Pendaftaran berhasil! Akun Anda menunggu persetujuan Manajer Keuangan." : null
  );
  const [loading, setLoading] = useState(false);

  function switchMode(toLogin: boolean) {
    setIsLogin(toLogin);
    setError(null);
    setSuccessMsg(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      if (isLogin) {
        const result = await signIn("credentials", { email, password, redirect: false });
        if (result?.error) {
          setError("Email atau password salah, atau akun belum aktif.");
        } else {
          router.push("/dashboard");
          router.refresh();
        }
      } else {
        if (!name.trim()) throw new Error("Nama lengkap harus diisi.");
        if (password !== confirmPassword) throw new Error("Password dan konfirmasi tidak cocok.");
        const fd = new FormData();
        fd.set("name", name);
        fd.set("email", email);
        fd.set("password", password);
        fd.set("confirm", confirmPassword);
        const result = await registerUser(fd);
        if (result?.error) {
          setError(result.error);
        } else {
          setSuccessMsg("Pendaftaran berhasil! Akun Anda menunggu persetujuan Manajer Keuangan.");
          switchMode(true);
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const inputBase = "w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl py-3.5 text-sm text-slate-100 focus:outline-none focus:border-[#158ed4] focus:ring-1 focus:ring-[#158ed4] transition-all shadow-inner placeholder:text-slate-600";

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row font-sans text-slate-100 overflow-hidden relative">
      {/* Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#158ed4]/20 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[150px] pointer-events-none animate-pulse" style={{ animationDelay: "2s" }} />

      {/* ── Left: Branding ── */}
      <div className="hidden md:flex md:w-1/2 lg:w-[55%] relative flex-col justify-between p-12 lg:p-20 border-r border-white/10 z-10">
        <div className="absolute inset-0 z-0">
          <Image src={BG_IMAGE} alt="Background" fill className="object-cover opacity-30 mix-blend-overlay" priority />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-[#158ed4]/40" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center flex-none">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M4 20V10l8-6 8 6v10" stroke="#158ed4" strokeWidth="1.8" strokeLinejoin="round" />
                <rect x="10" y="14" width="4" height="6" fill="#158ed4" />
              </svg>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Data Keuangan<span className="text-[#158ed4]">.</span>
            </h1>
          </div>

          <h2 className="text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-white mb-6">
            Sistem Keuangan <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#158ed4] to-cyan-400">
              Grup Terpadu
            </span>
          </h2>
          <p className="text-lg text-slate-300 max-w-md leading-relaxed border-l-4 border-[#158ed4] pl-4">
            Platform pengelolaan keuangan internal Gaharu Sempana Group — real-time, akurat, dan aman.
          </p>
        </div>

        <div className="relative z-10">
          <div className="text-white/60 text-[11px] font-bold uppercase tracking-widest mb-4">Entitas Grup</div>
          <div className="flex items-center gap-5">
            {ENTITY_LOGOS.map((e) => (
              <div key={e.key} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-[16px] bg-white/10 backdrop-blur flex items-center justify-center overflow-hidden border border-white/20">
                  <Image src={e.src} alt={e.name} width={44} height={44} className="object-contain p-1" />
                </div>
                <span className="text-white/70 text-[11px] font-semibold">{e.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Form ── */}
      <div className="w-full md:w-1/2 lg:w-[45%] flex items-center justify-center p-6 sm:p-12 relative z-10 min-h-screen md:min-h-0">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="md:hidden text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-[#158ed4]/20 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M4 20V10l8-6 8 6v10" stroke="#158ed4" strokeWidth="1.8" strokeLinejoin="round" />
                <rect x="10" y="14" width="4" height="6" fill="#158ed4" />
              </svg>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-1">
              Data Keuangan<span className="text-[#158ed4]">.</span>
            </h1>
            <p className="text-sm text-slate-400">Gaharu Sempana Group</p>
          </div>

          {/* Card */}
          <div className="bg-slate-800/40 backdrop-blur-2xl border border-white/10 p-8 sm:p-10 rounded-[2rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#158ed4] via-cyan-500 to-blue-500" />

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                {isLogin ? "Selamat Datang" : "Buat Akun Baru"}
              </h2>
              <p className="text-sm text-slate-400">
                {isLogin
                  ? "Silahkan masukkan akun anda yang terdaftar untuk melanjutkan"
                  : "Daftarkan diri Anda untuk mengakses sistem."}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <span className="text-red-300 text-sm font-medium">{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-6 p-4 rounded-xl bg-[#158ed4]/10 border border-[#158ed4]/20 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-[#158ed4] shrink-0 mt-0.5" />
                <span className="text-[#158ed4] text-sm font-medium">{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Nama Lengkap</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-[#158ed4] transition-colors">
                      <User size={18} />
                    </div>
                    <input type="text" className={`${inputBase} pl-11`} placeholder="Nama lengkap Anda"
                      value={name} onChange={(e) => setName(e.target.value)} required={!isLogin} />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-[#158ed4] transition-colors">
                    <Mail size={18} />
                  </div>
                  <input type="email" className={`${inputBase} pl-11`} placeholder="nama@gaharusempana.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-[#158ed4] transition-colors">
                    <Lock size={18} />
                  </div>
                  <input type={showPassword ? "text" : "password"} className={`${inputBase} pl-11 pr-12`}
                    placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                    required minLength={isLogin ? undefined : 8} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors focus:outline-none">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Konfirmasi Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-[#158ed4] transition-colors">
                      <Lock size={18} />
                    </div>
                    <input type={showConfirmPassword ? "text" : "password"} className={`${inputBase} pl-11 pr-12`}
                      placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      required={!isLogin} />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors focus:outline-none">
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full group relative overflow-hidden bg-[#158ed4] text-white font-bold text-sm py-4 px-4 rounded-2xl transition-all shadow-lg shadow-[#158ed4]/40 disabled:opacity-70 disabled:cursor-not-allowed mt-4">
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
                <span className="relative flex items-center justify-center gap-2">
                  {loading
                    ? <><Loader2 size={18} className="animate-spin" /> Memproses...</>
                    : isLogin ? "Masuk ke Sistem" : "Daftar Sekarang"
                  }
                </span>
              </button>
            </form>

            <div className="mt-8 text-center border-t border-slate-700/50 pt-6">
              <button type="button" onClick={() => switchMode(!isLogin)}
                className="text-sm text-slate-400 hover:text-white transition-colors font-medium flex items-center justify-center gap-1.5 mx-auto">
                {isLogin
                  ? <>Belum punya akun? <span className="text-[#158ed4] font-bold">Daftar sekarang</span></>
                  : <>Sudah punya akun? <span className="text-[#158ed4] font-bold">Masuk di sini</span></>
                }
              </button>
            </div>
          </div>

          <div className="mt-8 text-center md:hidden">
            <p className="text-xs text-slate-500">&copy; 2026 Gaharu Sempana Group. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
