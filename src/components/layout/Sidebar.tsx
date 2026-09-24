"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  Layers,
  LogOut,
  X,
  Wallet,
  Banknote,
  Building2,
  ScrollText,
  Table2,
  HandCoins,
  FolderOpen,
  Settings2,
  ClipboardList,
  ChevronDown,
  PenLine,
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
  wallet: Wallet,
  banknote: Banknote,
  building2: Building2,
  scrollText: ScrollText,
  table2: Table2,
  handCoins: HandCoins,
  folderOpen: FolderOpen,
  settings2: Settings2,
  clipboardList: ClipboardList,
  penLine: PenLine,
};

export function Sidebar({
  role,
  customInputs = [],
  onClose,
}: {
  role: Role;
  customInputs?: { key: string; nama: string }[];
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentVersionParam = searchParams.get("version")?.toLowerCase();
  const sections = getNavForRole(role);

  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});

  function toggleDropdown(href: string) {
    setOpenDropdowns((prev) => ({ ...prev, [href]: !prev[href] }));
  }

  return (
    <aside className="w-[260px] flex-none bg-surface-card border-r border-border-soft flex flex-col p-4 pt-5 sticky top-0 h-screen">
      {/* Brand row */}
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-brand to-brand-soft flex items-center justify-center flex-none">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M4 20V10l8-6 8 6v10" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
            <rect x="10" y="14" width="4" height="6" fill="#fff" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold text-[14.5px] text-navy-text leading-tight">Data Keuangan</div>
          <div className="text-[10px] text-muted-faint font-semibold">Gaharu Sempana Group</div>
        </div>
        {/* Close button — hanya tampil di mobile drawer */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-faint transition-colors flex-none"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-hide">
        {sections.map((section) => (
          <div key={section.title} className="mb-3.5">
            <div className="text-[10.5px] font-bold text-muted-faintest tracking-wider uppercase px-2.5 pt-1.5 pb-2">
              {section.title}
            </div>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon];
                const isParentActive = pathname === item.href || pathname.startsWith(item.href + "/");

                if (item.subItems && item.subItems.length > 0) {
                  const isOpen = Boolean(openDropdowns[item.href]);
                  return (
                    <div key={item.href} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => toggleDropdown(item.href)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-pill text-sm font-semibold transition-all duration-150 cursor-pointer ${
                          isParentActive
                            ? "bg-surface-hover/80 text-navy-text font-bold"
                            : "text-muted-strong hover:bg-surface-hover hover:text-navy-text"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon size={17} strokeWidth={1.8} className="flex-none" />
                          <span className="truncate">{item.label}</span>
                        </div>
                        <ChevronDown
                          size={15}
                          className={`text-muted-faint transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isOpen && (
                        <div className="ml-4 pl-3.5 border-l-2 border-border-soft flex flex-col gap-1 mt-1 mb-1.5">
                          {item.subItems.map((sub) => {
                            const isSubActive =
                              isParentActive &&
                              (sub.version === "umum"
                                ? currentVersionParam === "umum"
                                : currentVersionParam !== "umum");
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 ${
                                  isSubActive
                                    ? "bg-navy text-white shadow-sm"
                                    : "text-muted-strong hover:bg-surface-hover hover:text-navy-text"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full flex-none ${
                                    isSubActive ? "bg-white" : "bg-muted-faint"
                                  }`}
                                />
                                <span className="truncate">{sub.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-pill text-sm font-semibold transition-all duration-150 ${
                      isParentActive
                        ? "bg-navy text-white shadow-sm"
                        : "text-muted-strong hover:bg-surface-hover hover:text-navy-text"
                    }`}
                  >
                    <Icon size={17} strokeWidth={1.8} className="flex-none" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {customInputs.length > 0 && (
          <div className="mb-3.5">
            <div className="text-[10.5px] font-bold text-muted-faintest tracking-wider uppercase px-2.5 pt-1.5 pb-2">
              Input Lainnya
            </div>
            <div className="flex flex-col gap-0.5">
              {customInputs.map((item) => {
                const href = `/input/${item.key}`;
                const active = pathname === href;
                return (
                  <Link
                    key={item.key}
                    href={href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-pill text-sm font-semibold transition-all duration-150 ${
                      active
                        ? "bg-navy text-white shadow-sm"
                        : "text-muted-strong hover:bg-surface-hover hover:text-navy-text"
                    }`}
                  >
                    <Layers size={17} strokeWidth={1.8} className="flex-none" />
                    <span className="truncate">{item.nama}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="mt-2 px-3.5 py-2.5 border border-border-soft rounded-pill flex items-center gap-2 text-[13.5px] font-semibold text-muted-strong hover:bg-surface-hover hover:text-status-red hover:border-red-200 dark:hover:border-red-500/30 transition-all duration-150"
      >
        <LogOut size={16} strokeWidth={1.8} />
        Keluar Sistem
      </button>
    </aside>
  );
}
