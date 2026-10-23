"use client";

import { AuthProvider } from "@/context/AuthContext";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
