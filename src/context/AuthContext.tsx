"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  AuthUser,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
  clearAuth,
} from "@/lib/auth-store";
import { PHP_API_URL } from "@/lib/api-client";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATHS = ["/login", "/register"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = getStoredToken();
    const storedUser = getStoredUser();
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  // Guard: redirect ke /login kalau belum auth dan bukan di halaman publik
  useEffect(() => {
    if (isLoading) return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    if (!token && !isPublic) {
      router.replace("/login");
    }
  }, [isLoading, token, pathname, router]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${PHP_API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { error: err.message ?? "Email atau password salah, atau akun belum aktif." };
      }

      const data = await res.json();
      if (!data.token || !data.user) {
        return { error: "Respons server tidak valid." };
      }

      const authUser: AuthUser = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        entityKeys: data.user.entityKeys ?? [],
      };

      setStoredToken(data.token);
      setStoredUser(authUser);
      setToken(data.token);
      setUser(authUser);

      return {};
    } catch {
      return { error: "Gagal terhubung ke server. Coba lagi." };
    }
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setToken(null);
    setUser(null);
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
