"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Role } from "@prisma/client";
import { Sidebar } from "./Sidebar";

export function AppShell({
  role,
  customInputs,
  children,
}: {
  role: Role;
  customInputs: { key: string; nama: string }[];
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Tutup sidebar saat resize ke desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Kunci scroll body saat sidebar mobile terbuka
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen bg-surface-page">
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <div className="hidden lg:block print:hidden flex-none">
        <Sidebar role={role} customInputs={customInputs} />
      </div>

      {/* ── Mobile sidebar backdrop ──────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden print:hidden"
            >
              <Sidebar
                role={role}
                customInputs={customInputs}
                onClose={() => setSidebarOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-surface-card border-b border-border-soft print:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-surface-hover text-muted-strong transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-brand to-brand-soft flex items-center justify-center flex-none">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M4 20V10l8-6 8 6v10" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
                <rect x="10" y="14" width="4" height="6" fill="#fff" />
              </svg>
            </div>
            <span className="font-extrabold text-[13.5px] text-navy-text">Data Keuangan</span>
          </div>
        </div>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7 pb-16 flex flex-col gap-5">
          {children}
        </main>
      </div>
    </div>
  );
}
