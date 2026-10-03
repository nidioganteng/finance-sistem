# UI Login & Register — Panduan Copy ke Project Lain

Halaman Login dan Register **digabung dalam satu komponen** yang sama.
Toggle antara mode Login ↔ Register dikendalikan oleh state `isLogin`.

---

## Lokasi File

| File | Keterangan |
|------|-----------|
| `src/auth/Login.jsx` | Komponen utama Login + Register |
| `src/shared/components/Icon.jsx` | Komponen icon SVG internal (tanpa library eksternal) |
| `src/assets/logo-sidamon.png` | Logo yang tampil di halaman |

---

## Dependencies yang Dibutuhkan

Pastikan project tujuan sudah punya:

```json
"dependencies": {
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
},
"devDependencies": {
  "tailwindcss": "^3.4.4",
  "autoprefixer": "^10.4.19",
  "postcss": "^8.4.38"
}
```

Tidak ada library icon eksternal (lucide-react, heroicons, dll) — icon sudah di-embed manual di `Icon.jsx`.

---

## Cara Pakai di Project Lain

### 1. Copy file Icon.jsx

Buat file `src/components/Icon.jsx` (atau lokasi sesuai project):

```jsx
// src/components/Icon.jsx
export const Icon = ({ name, size = 20, className = "" }) => {
    const paths = {
        "user": '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        "mail": '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
        "lock": '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        "eye": '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
        "eye-off": '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
        "loader-2": '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
        "alert-circle": '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
        "check-circle-2": '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    };
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            dangerouslySetInnerHTML={{ __html: paths[name] || '' }}
        />
    );
};

export default Icon;
```

> Hanya icon yang dipakai di Login/Register saja yang dicantumkan di atas.
> Kalau mau lengkap, copy semua `paths` dari `src/shared/components/Icon.jsx`.

---

### 2. Copy komponen Login.jsx

Sesuaikan import berikut:
- Ganti `'../services/firebase'` → koneksi auth project kamu
- Ganti `'../services/logService'` → hapus atau sesuaikan
- Ganti `'../services/userService'` → sesuaikan dengan backend kamu
- Ganti `'../assets/logo-sidamon.png'` → logo project kamu
- Ganti `'../shared/components/Icon'` → path Icon.jsx yang baru

```jsx
// src/auth/Login.jsx  (atau src/pages/Login.jsx, dll)
import React, { useState } from 'react';
import logoProject from '../assets/logo-project.png'; // <-- ganti logo
import Icon from '../components/Icon';                // <-- sesuaikan path

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            if (isLogin) {
                // =============================================
                // GANTI BAGIAN INI dengan logika login project kamu
                // Contoh: await signInWithEmailAndPassword(auth, email, password);
                // =============================================
            } else {
                if (!username.trim()) throw new Error("Username harus diisi");
                if (password !== confirmPassword) throw new Error("Kata sandi dan konfirmasi tidak cocok");

                // =============================================
                // GANTI BAGIAN INI dengan logika register project kamu
                // Contoh: await createUserWithEmailAndPassword(auth, email, password);
                // =============================================

                setSuccessMsg("Pendaftaran berhasil!");
                setIsLogin(true);
            }
        } catch (err) {
            // Sesuaikan error code dengan provider auth yang kamu pakai
            let errorMsg = err.message;
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                errorMsg = 'Email atau kata sandi yang Anda masukkan salah. Silakan coba lagi.';
            } else if (err.code === 'auth/invalid-email') {
                errorMsg = 'Format email tidak valid.';
            } else if (err.code === 'auth/email-already-in-use') {
                errorMsg = 'Email ini sudah terdaftar. Silakan gunakan email lain atau masuk ke sistem.';
            } else if (err.code === 'auth/too-many-requests') {
                errorMsg = 'Akses ditolak karena terlalu banyak percobaan masuk yang gagal. Silakan coba lagi nanti.';
            } else if (err.code === 'auth/weak-password') {
                errorMsg = 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
            }
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row font-sans text-slate-100 overflow-hidden relative">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#158ed4]/20 blur-[120px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[150px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

            {/* Left Side: Branding (Hidden on mobile) */}
            <div className="hidden md:flex md:w-1/2 lg:w-[55%] relative flex-col justify-between p-12 lg:p-20 border-r border-white/10 shadow-[20px_0_40px_rgba(0,0,0,0.3)] z-10">
                <div className="absolute inset-0 z-0">
                    <img
                        src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"
                        alt="Background"
                        className="w-full h-full object-cover opacity-30 mix-blend-overlay"
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-[#158ed4]/40"></div>
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-12">
                        {/* GANTI logoProject dengan logo project kamu */}
                        <img src={logoProject} alt="Logo" className="w-12 h-12 object-contain drop-shadow-md" />
                        <h1 className="text-3xl font-black tracking-tight text-white">
                            NAMA APP<span className="text-[#158ed4]">.</span>
                        </h1>
                    </div>

                    <h2 className="text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-white mb-6">
                        Judul Besar <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#158ed4] to-cyan-400">
                            Sub Judul
                        </span>
                    </h2>
                    <p className="text-lg text-slate-300 max-w-md leading-relaxed border-l-4 border-[#158ed4] pl-4">
                        Deskripsi singkat aplikasi kamu di sini.
                    </p>
                </div>
            </div>

            {/* Right Side: Auth Form */}
            <div className="w-full md:w-1/2 lg:w-[45%] flex items-center justify-center p-6 sm:p-12 relative z-10 min-h-screen md:min-h-0">
                <div className="w-full max-w-md">
                    {/* Mobile Branding */}
                    <div className="md:hidden text-center mb-10">
                        <img src={logoProject} alt="Logo" className="w-16 h-16 object-contain mx-auto drop-shadow-lg mb-6" />
                        <h1 className="text-3xl font-black text-white tracking-tight mb-2">
                            NAMA APP<span className="text-[#158ed4]">.</span>
                        </h1>
                        <p className="text-sm text-slate-400">Nama Perusahaan</p>
                    </div>

                    <div className="bg-slate-800/40 backdrop-blur-2xl border border-white/10 p-8 sm:p-10 rounded-[2rem] shadow-2xl relative overflow-hidden">
                        {/* Gradient line top */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#158ed4] via-cyan-500 to-blue-500"></div>

                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-white mb-2">
                                {isLogin ? 'Selamat Datang' : 'Buat Akun Baru'}
                            </h2>
                            <p className="text-sm text-slate-400">
                                {isLogin
                                    ? 'Silahkan masukkan akun anda yang terdaftar untuk melanjutkan'
                                    : 'Daftarkan diri Anda untuk mengakses sistem.'}
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                                <Icon name="alert-circle" size={18} className="text-red-400 shrink-0 mt-0.5" />
                                <span className="text-red-300 text-sm font-medium">{error}</span>
                            </div>
                        )}

                        {successMsg && (
                            <div className="mb-6 p-4 rounded-xl bg-[#158ed4]/10 border border-[#158ed4]/20 flex items-start gap-3">
                                <Icon name="check-circle-2" size={18} className="text-[#158ed4] shrink-0 mt-0.5" />
                                <span className="text-[#158ed4] text-sm font-medium">{successMsg}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Username Field (Register only) */}
                            {!isLogin && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Username</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-[#158ed4] transition-colors">
                                            <Icon name="user" size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-slate-100 focus:outline-none focus:border-[#158ed4] focus:ring-1 focus:ring-[#158ed4] transition-all shadow-inner placeholder:text-slate-600"
                                            placeholder="username_unik"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            required={!isLogin}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Email Field */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Email</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-[#158ed4] transition-colors">
                                        <Icon name="mail" size={18} />
                                    </div>
                                    <input
                                        type="email"
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-slate-100 focus:outline-none focus:border-[#158ed4] focus:ring-1 focus:ring-[#158ed4] transition-all shadow-inner placeholder:text-slate-600"
                                        placeholder="nama@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-[#158ed4] transition-colors">
                                        <Icon name="lock" size={18} />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl pl-11 pr-12 py-3.5 text-sm text-slate-100 focus:outline-none focus:border-[#158ed4] focus:ring-1 focus:ring-[#158ed4] transition-all shadow-inner placeholder:text-slate-600"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                                    >
                                        <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password Field (Register only) */}
                            {!isLogin && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Konfirmasi Password</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-[#158ed4] transition-colors">
                                            <Icon name="lock" size={18} />
                                        </div>
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl pl-11 pr-12 py-3.5 text-sm text-slate-100 focus:outline-none focus:border-[#158ed4] focus:ring-1 focus:ring-[#158ed4] transition-all shadow-inner placeholder:text-slate-600"
                                            placeholder="••••••••"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required={!isLogin}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                                        >
                                            <Icon name={showConfirmPassword ? "eye-off" : "eye"} size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full group relative overflow-hidden bg-[#158ed4] hover:bg-[#158ed4] text-white font-bold text-sm py-4 px-4 rounded-2xl transition-all shadow-lg shadow-[#158ed4]/40 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                            >
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                                <span className="relative flex items-center justify-center gap-2">
                                    {loading ? (
                                        <><Icon name="loader-2" size={18} className="animate-spin" /> Memproses...</>
                                    ) : (
                                        isLogin ? 'Masuk ke Sistem' : 'Daftar Sekarang'
                                    )}
                                </span>
                            </button>
                        </form>

                        {/* Toggle Login/Register */}
                        <div className="mt-8 text-center border-t border-slate-700/50 pt-6">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setError('');
                                    setSuccessMsg('');
                                    setPassword('');
                                    setConfirmPassword('');
                                }}
                                className="text-sm text-slate-400 hover:text-white transition-colors font-medium flex items-center justify-center gap-2 mx-auto"
                            >
                                {isLogin ? (
                                    <>Belum punya akun? <span className="text-[#158ed4] font-bold">Daftar sekarang</span></>
                                ) : (
                                    <>Sudah punya akun? <span className="text-[#158ed4] font-bold">Masuk di sini</span></>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 text-center md:hidden">
                        <p className="text-xs text-slate-500">&copy; 2026 Nama Perusahaan. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
```

---

## Warna Brand (Ubah Sesuai Project)

Warna utama adalah `#158ed4` (biru). Untuk menggantinya, lakukan find & replace:

```
#158ed4  →  warna_brand_baru
```

---

## Checklist Adaptasi ke Project Lain

- [ ] Copy `Icon.jsx` ke project baru (atau pakai library icon seperti `lucide-react`)
- [ ] Ganti logo (`logoSidamon` → logo project kamu)
- [ ] Ganti teks branding ("SIDAMON", "Gaharu Sempana Group", dll)
- [ ] Hubungkan `handleSubmit` ke auth provider kamu (Firebase, Supabase, custom API, dll)
- [ ] Pastikan Tailwind CSS sudah terkonfigurasi di project tujuan
- [ ] (Opsional) Ganti foto background `unsplash.com` dengan foto branding sendiri
