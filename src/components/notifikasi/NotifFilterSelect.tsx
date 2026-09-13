"use client";

import { useRouter } from "next/navigation";

export function NotifFilterSelect({
  options,
  current,
}: {
  options: { key: string; label: string }[];
  current: string;
}) {
  const router = useRouter();
  return (
    <select
      value={current}
      onChange={(e) => router.push(`/notifikasi?filter=${e.target.value}`)}
      className="px-3.5 py-2 rounded-pill border border-border-soft text-[13px] font-semibold text-muted-stronger bg-white"
    >
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
