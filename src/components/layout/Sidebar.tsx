"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Role } from "@prisma/client";
import {
  LayoutGrid,
  FileText,
  History,
  Bell,
  ListChecks,
  BookOpen,
  Receipt,
  Landmark,
  Users,
  WalletCards,
  TrendingUp,
  Scale,
  LogOut,
} from "lucide-react";
import { getNavForRole, type NavItem } from "@/lib/rbac";

const ICONS: Record<NavItem["icon"], typeof LayoutGrid> = {
  grid: LayoutGrid,
  fileText: FileText,
  history: History,
  bell: Bell,
  listChecks: ListChecks,
  bookOpen: BookOpen,
  receipt: Receipt,
  landmark: Landmark,
  users: Users,
  walletCards: WalletCards,
  trendingUp: TrendingUp,
  scale: Scale,
};

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const sections = getNavForRole(role);

  return (
    <aside className="w-[260px] flex-none bg-white border-r border-black/[.06] flex flex-col p-4 pt-5 sticky top-0 h-screen">
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-brand to-brand-soft flex items-center justify-center flex-none">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M4 20V10l8-6 8 6v10" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
            <rect x="10" y="14" width="4" height="6" fill="#fff" />
          </svg>
        </div>
        <div>
          <div className="font-extrabold text-[14.5px] text-navy-text leading-tight">Data Keuangan</div>
          <div className="text-[10px] text-muted-faint font-semibold">Gaharu Sempana Group</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title} className="mb-3.5">
            <div className="text-[10.5px] font-bold text-muted-faintest tracking-wider uppercase px-2.5 pt-1.5 pb-2">
              {section.title}
            </div>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-pill text-sm font-semibold transition-colors ${
                      active ? "bg-navy text-white" : "text-muted-strong hover:bg-surface-hover"
                    }`}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="mt-2 px-3.5 py-2.5 border border-border-soft rounded-pill flex items-center gap-2 text-[13.5px] font-semibold text-muted-strong"
      >
        <LogOut size={16} strokeWidth={1.8} />
        Keluar Sistem
      </button>
    </aside>
  );
}
