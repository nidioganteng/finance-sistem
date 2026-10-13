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
  ChevronLeft,
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
  collapsed = false,
  onToggleCollapse,
  unreadCount = 0,
}: {
  role: Role;
  customInputs?: { key: string; nama: string }[];
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  unreadCount?: number;
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
    <aside className={`flex-none bg-[#0f1729] dark:bg-[#0c0c14] flex flex-col p-4 pt-5 sticky top-0 h-screen transition-all duration-300 relative ${collapsed ? "w-[68px]" : "w-[280px]"}`}>
      {/* Toggle collapse button */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="absolute -right-3 top-7 z-10 w-6 h-6 rounded-full bg-[#0f1729] dark:bg-[#0c0c14] border border-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors shadow-md"
        >
          <ChevronLeft size={13} className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        </button>
      )}

      {/* Brand row */}
      <div className={`flex items-center pb-6 ${collapsed ? "justify-center px-0" : "gap-3 px-2"}`}>
        <div className="w-9 h-9 flex-none flex items-center justify-center">
          <img
            src="/logo-entitas/logo-simatra-dark.png"
            alt="SIMATRA"
            className="w-9 h-9 object-contain"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="font-black text-[17px] tracking-tight text-white leading-tight">SIMATRA</div>
            <div className="text-[11px] text-white/50 font-semibold">Gaharu Sempana Group</div>
          </div>
        )}
        {onClose && !collapsed && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 transition-colors flex-none"
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
            {!collapsed && (section.collapsible ? (
              <button
                type="button"
                onClick={() => toggleDropdown(sectionKey, true)}
                className="w-full flex items-center justify-between px-2.5 pt-1 pb-1 text-[10.5px] font-bold text-white/40 tracking-wider uppercase hover:text-white/60 transition-colors"
              >
                {section.title}
                <ChevronDown size={12} className={`transition-transform duration-200 ${isSectionOpen ? "rotate-180" : ""}`} />
              </button>
            ) : (
              <div className="text-[10.5px] font-bold text-white/40 tracking-wider uppercase px-2.5 pt-1 pb-1">
                {section.title}
              </div>
            ))}
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
                        onClick={() => collapsed ? undefined : toggleDropdown(item.href, isDefaultOpen)}
                        title={collapsed ? item.label : undefined}
                        className={`w-full flex items-center transition-all duration-150 cursor-pointer rounded-pill text-sm font-semibold ${collapsed ? "justify-center px-0 py-3" : "justify-between px-3.5 py-3"} ${
                          isParentActive
                            ? "bg-white/15 text-white font-bold"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <div className={`flex items-center min-w-0 ${collapsed ? "" : "gap-2.5"}`}>
                          <Icon size={17} strokeWidth={1.8} className="flex-none" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </div>
                        {!collapsed && <ChevronDown
                          size={15}
                          className={`text-white/40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />}
                      </button>

                      {isOpen && !collapsed && (
                        <div className="ml-4 pl-3.5 border-l-2 border-white/15 flex flex-col gap-0.5 mt-1 mb-1.5">
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
                                        ? "text-white font-bold"
                                        : "text-white/70 hover:bg-white/10 hover:text-white"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <span className="truncate">{sub.label}</span>
                                    </div>
                                    <ChevronDown size={13} className={`text-white/40 transition-transform duration-200 ${isSubOpen ? "rotate-180" : ""}`} />
                                  </button>
                                  {isSubOpen && (
                                    <div className="ml-3 pl-3 border-l-2 border-white/15 flex flex-col gap-0.5 mt-0.5 mb-1">
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
                                                ? "bg-white/20 text-white shadow-sm"
                                                : "text-white/60 hover:bg-white/10 hover:text-white"
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
                                    ? "bg-white/20 text-white shadow-sm"
                                    : "text-white/70 hover:bg-white/10 hover:text-white"
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

                const isNotifItem = item.href === "/notifikasi";
                const showBadge = isNotifItem && unreadCount > 0;
                return (
                  <Link
                    key={item.href}
                    href={getItemHref(item.href)}
                    onClick={onClose}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex items-center rounded-pill text-sm font-semibold transition-all duration-150 ${collapsed ? "justify-center px-0 py-3" : "gap-2.5 px-3.5 py-3"} ${
                      isParentActive
                        ? "bg-white/20 text-white shadow-sm"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="relative flex-none">
                      <Icon size={17} strokeWidth={1.8} />
                      {showBadge && collapsed && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </span>
                    {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                    {showBadge && !collapsed && (
                      <span className="ml-auto min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center leading-none flex-none">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>}
          </div>
          );
        })}

        {customInputs.length > 0 && (
          <div className="mb-3.5">
            {!collapsed && (
              <div className="text-[10.5px] font-bold text-white/40 tracking-wider uppercase px-2.5 pt-1.5 pb-2">
                Input Lainnya
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {customInputs.map((item) => {
                const href = `/input/${item.key}`;
                const active = pathname === href;
                return (
                  <Link
                    key={item.key}
                    href={getItemHref(href)}
                    onClick={onClose}
                    title={collapsed ? item.nama : undefined}
                    className={`flex items-center rounded-pill text-sm font-semibold transition-all duration-150 ${collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3.5 py-2.5"} ${
                      active
                        ? "bg-white/20 text-white shadow-sm"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Layers size={17} strokeWidth={1.8} className="flex-none" />
                    {!collapsed && <span className="truncate">{item.nama}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        title={collapsed ? "Keluar Sistem" : undefined}
        className={`mt-2 border border-white/20 rounded-pill flex items-center text-[13.5px] font-semibold text-white/60 hover:bg-white/10 hover:text-red-400 hover:border-red-400/40 transition-all duration-150 ${collapsed ? "justify-center px-0 py-2.5" : "gap-2 px-3.5 py-2.5"}`}
      >
        <LogOut size={16} strokeWidth={1.8} className="flex-none" />
        {!collapsed && "Keluar Sistem"}
      </button>
    </aside>
  );
}
