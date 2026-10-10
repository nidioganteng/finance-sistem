"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { Role } from "@/types/app-enums";
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
  Settings,
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
  layers: Layers,
  settings: Settings,
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
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function toggleDropdown(href: string, defaultOpen: boolean) {
    const current = openDropdowns[href] !== undefined ? openDropdowns[href] : defaultOpen;
    const willOpen = !current;
    setOpenDropdowns((prev) => ({ ...prev, [href]: willOpen }));
    if (willOpen) {
      setTimeout(() => {
        dropdownRefs.current[href]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    }
  }

  function getSubHref(sub: { href: string; version?: "internal" | "umum" }) {
    const [basePath] = sub.href.split("?");
    const params = new URLSearchParams();

    if (sub.version) {
      params.set("version", sub.version);
    }

    let entity = searchParams.get("entity");
    if (!entity && typeof document !== "undefined") {
      const match = document.cookie.match(/(?:^|;\s*)lastEntityKey=([^;]+)/);
      if (match && match[1]) {
        entity = decodeURIComponent(match[1]);
      }
    }
    if (entity) {
      params.set("entity", entity);
    }

    const currentTab = searchParams.get("tab");
    if (currentTab) {
      params.set("tab", currentTab);
    }

    const currentYear = searchParams.get("year");
    if (currentYear) {
      params.set("year", currentYear);
    }

    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  function getItemHref(href: string) {
    let entity = searchParams.get("entity");
    if (!entity && typeof document !== "undefined") {
      const match = document.cookie.match(/(?:^|;\s*)lastEntityKey=([^;]+)/);
      if (match && match[1]) {
        entity = decodeURIComponent(match[1]);
      }
    }
    if (entity && entity !== "grup" && !href.includes("?")) {
      const noEntityPages = ["/log", "/notifikasi", "/dokumen", "/pengguna", "/jenis-input", "/coa"];
      if (!noEntityPages.some((p) => href.startsWith(p))) {
        return `${href}?entity=${encodeURIComponent(entity)}`;
      }
    }
    return href;
  }

  return (
    <aside className="w-[280px] flex-none bg-surface-card border-r border-border-soft flex flex-col p-4 pt-5 sticky top-0 h-screen">
      {/* Brand row */}
      <div className="flex items-center gap-3 px-2 pb-6">
        <div className="w-11 h-11 flex-none flex items-center justify-center">
          <img
            src="/logo-entitas/logo-simatra-light.png"
            alt="SIMATRA"
            className="w-11 h-11 object-contain block dark:hidden"
          />
          <img
            src="/logo-entitas/logo-simatra-dark.png"
            alt="SIMATRA"
            className="w-11 h-11 object-contain hidden dark:block"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-black text-[17px] tracking-tight text-navy-text leading-tight">SIMATRA</div>
          <div className="text-[11px] text-muted-faint font-semibold">Gaharu Sempana Group</div>
        </div>
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
        {sections.map((section) => {
          const sectionKey = `section:${section.title}`;
          const isSectionOpen = section.collapsible
            ? (openDropdowns[sectionKey] !== undefined ? openDropdowns[sectionKey] : true)
            : true;
          return (
          <div key={section.title} className="mb-2">
            {section.collapsible ? (
              <button
                type="button"
                onClick={() => toggleDropdown(sectionKey, true)}
                className="w-full flex items-center justify-between px-2.5 pt-1 pb-1 text-[10.5px] font-bold text-muted-faintest tracking-wider uppercase hover:text-muted-stronger transition-colors"
              >
                {section.title}
                <ChevronDown size={12} className={`transition-transform duration-200 ${isSectionOpen ? "rotate-180" : ""}`} />
              </button>
            ) : (
              <div className="text-[10.5px] font-bold text-muted-faintest tracking-wider uppercase px-2.5 pt-1 pb-1">
                {section.title}
              </div>
            )}
            {isSectionOpen && <div className="flex flex-col gap-0">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon];
                const isParentActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/") ||
                  (item.subItems?.some((s) => pathname === s.href.split("?")[0]) ?? false);

                if (item.subItems && item.subItems.length > 0) {
                  const isDefaultOpen = isParentActive;
                  const isOpen = openDropdowns[item.href] !== undefined ? openDropdowns[item.href] : isDefaultOpen;
                  return (
                    <div key={item.href} className="flex flex-col" ref={(el) => { dropdownRefs.current[item.href] = el; }}>
                      <button
                        type="button"
                        onClick={() => toggleDropdown(item.href, isDefaultOpen)}
                        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-pill text-sm font-semibold transition-all duration-150 cursor-pointer ${
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
                        <div className="ml-4 pl-3.5 border-l-2 border-border-soft flex flex-col gap-0.5 mt-1 mb-1.5">
                          {item.subItems.map((sub) => {
                            const subBasePath = sub.href.split("?")[0];
                            const isSubGroupActive = pathname === subBasePath ||
                              (sub.children?.some((c) => pathname === c.href.split("?")[0]) ?? false);

                            if (sub.children && sub.children.length > 0) {
                              const subKey = `${item.href}__${sub.href}`;
                              const isSubOpen = openDropdowns[subKey] !== undefined
                                ? openDropdowns[subKey]
                                : isSubGroupActive;
                              return (
                                <div key={sub.href} className="flex flex-col">
                                  <button
                                    type="button"
                                    onClick={() => toggleDropdown(subKey, isSubGroupActive)}
                                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
                                      isSubGroupActive
                                        ? "text-navy-text font-bold"
                                        : "text-muted-strong hover:bg-surface-hover hover:text-navy-text"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <span className="truncate">{sub.label}</span>
                                    </div>
                                    <ChevronDown size={13} className={`text-muted-faint transition-transform duration-200 ${isSubOpen ? "rotate-180" : ""}`} />
                                  </button>
                                  {isSubOpen && (
                                    <div className="ml-3 pl-3 border-l-2 border-border-soft flex flex-col gap-0.5 mt-0.5 mb-1">
                                      {sub.children.map((child) => {
                                        const isChildActive = child.version
                                          ? isSubGroupActive &&
                                            (child.version === "umum"
                                              ? currentVersionParam === "umum"
                                              : currentVersionParam !== "umum")
                                          : pathname === child.href.split("?")[0];
                                        return (
                                          <Link
                                            key={child.href}
                                            href={getSubHref(child)}
                                            onClick={onClose}
                                            className={`flex items-center gap-2 px-3 py-3 rounded-xl text-[12px] font-semibold transition-all duration-150 ${
                                              isChildActive
                                                ? "bg-navy text-white shadow-sm"
                                                : "text-muted hover:bg-surface-hover hover:text-navy-text"
                                            }`}
                                          >
                                            <span className="truncate">{child.label}</span>
                                          </Link>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            const isSubActive = sub.version
                              ? isParentActive &&
                                (sub.version === "umum"
                                  ? currentVersionParam === "umum"
                                  : currentVersionParam !== "umum")
                              : pathname === subBasePath;
                            return (
                              <Link
                                key={sub.href}
                                href={getSubHref(sub)}
                                onClick={onClose}
                                className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-[13px] font-semibold transition-all duration-150 ${
                                  isSubActive
                                    ? "bg-navy text-white shadow-sm"
                                    : "text-muted-strong hover:bg-surface-hover hover:text-navy-text"
                                }`}
                              >
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
                    href={getItemHref(item.href)}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-3.5 py-3 rounded-pill text-sm font-semibold transition-all duration-150 ${
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
            </div>}
          </div>
          );
        })}

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
                    href={getItemHref(href)}
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
