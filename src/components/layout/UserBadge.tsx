"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { roleLabel } from "@/lib/rbac";
import { Role } from "@/types/app-enums";
import { motion } from "framer-motion";
import { useState } from "react";

const FEMALE_PREFIXES = [
  "siti", "dewi", "sri", "nur", "indah", "putri", "ayu", "rina", "fitri",
  "rini", "lina", "ani", "yuni", "desi", "wulan", "ratna", "maya", "dina",
  "tika", "vina", "nita", "lisa", "rosa", "suci", "cantika", "anggi",
];
const FEMALE_SUFFIXES = ["wati", "ati", "ini", "ani", "uni", "ina", "ita"];

function guessGender(name: string): "female" | "male" {
  const first = name.trim().split(" ")[0].toLowerCase();
  if (FEMALE_PREFIXES.some((p) => first.startsWith(p))) return "female";
  if (FEMALE_SUFFIXES.some((s) => first.endsWith(s))) return "female";
  return "male";
}

function avatarUrl(name: string) {
  const gender = guessGender(name);
  const seed = encodeURIComponent(name);
  if (gender === "female") {
    return `https://api.dicebear.com/9.x/lorelei/svg?seed=${seed}&backgroundColor=ffd5dc,ffdfbf,d1d4f9,c0aede`;
  }
  return `https://api.dicebear.com/9.x/micah/svg?seed=${seed}&backgroundColor=transparent&mouth[]=smile&mouth[]=laughing&hair[]=fonze&hair[]=full&hair[]=dannyPhantom&hairColor[]=000000&baseColor[]=f5f0eb&earringProbability=0&facialHairProbability=0&shirtColor[]=6b3a2a`;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function UserBadge({ name, role }: { name: string; role: Role }) {
  const url = avatarUrl(name);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative group" title={`${name} — ${roleLabel(role)}`}>
      {/* Pulse ring */}
      <motion.span
        className="absolute inset-0 rounded-full bg-navy/25 dark:bg-navy/40"
        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Avatar */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="relative w-[36px] h-[36px] rounded-full overflow-hidden border-2 border-white dark:border-surface-card shadow-sm cursor-pointer select-none flex-none"
      >
        {imgError ? (
          <span className="w-full h-full flex items-center justify-center bg-navy text-white text-[11px] font-bold">
            {initials(name)}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={initials(name)}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </motion.div>

      {/* Tooltip */}
      <div className="pointer-events-none absolute right-0 top-full mt-2 z-50 hidden group-hover:flex flex-col items-end">
        <div className="bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-white/10 leading-snug">
          <div className="font-bold">{name}</div>
          <div className="text-white/60 text-[10px]">{roleLabel(role)}</div>
        </div>
        <div className="w-0 h-0 border-x-[5px] border-x-transparent border-b-[5px] border-b-slate-900 dark:border-b-slate-800 mr-3 order-first -mb-px rotate-180" />
      </div>
    </div>
  );
}

export function NotifBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Link href="/notifikasi" className="relative block">
      <div className="w-[38px] h-[38px] rounded-[11px] border border-border-soft flex items-center justify-center cursor-pointer bg-surface-card relative hover:bg-surface-hover transition-colors">
        <Bell size={17} strokeWidth={1.8} className="text-muted-stronger" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-status-red text-white text-[9.5px] font-extrabold min-w-[16px] h-4 rounded-lg flex items-center justify-center px-1 border-2 border-surface-card">
            {unreadCount}
          </span>
        )}
      </div>
    </Link>
  );
}
