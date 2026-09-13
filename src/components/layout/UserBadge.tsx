import Link from "next/link";
import { Bell } from "lucide-react";
import { roleLabel } from "@/lib/rbac";
import { Role } from "@prisma/client";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserBadge({ name, role }: { name: string; role: Role }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[11px] bg-surface-subtle">
      <div className="w-[26px] h-[26px] rounded-full bg-navy text-white text-[11px] font-bold flex items-center justify-center flex-none">
        {initials(name)}
      </div>
      <div className="text-xs font-semibold text-muted-stronger whitespace-nowrap">
        {name} - {roleLabel(role).replace(/\b\w/g, (c) => c.toUpperCase())}
      </div>
    </div>
  );
}

export function NotifBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Link href="/notifikasi" className="relative block">
      <div className="w-[38px] h-[38px] rounded-[11px] border border-border-soft flex items-center justify-center cursor-pointer bg-white relative hover:bg-surface-hover transition-colors">
        <Bell size={17} strokeWidth={1.8} className="text-muted-stronger" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-status-red text-white text-[9.5px] font-extrabold min-w-[16px] h-4 rounded-lg flex items-center justify-center px-1 border-2 border-white">
            {unreadCount}
          </span>
        )}
      </div>
    </Link>
  );
}
