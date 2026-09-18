"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { markNotifikasiRead } from "@/lib/actions/notifikasi";

type NotifItem = {
  id: string;
  text: string;
  typeLabel: string;
  read: boolean;
  createdAt: string; // ISO string, di-format ulang di client
};

export function NotifikasiListClient({ initialList }: { initialList: NotifItem[] }) {
  const [list, setList] = useState(initialList);
  const [selected, setSelected] = useState<NotifItem | null>(null);
  const [, startTransition] = useTransition();

  function openDetail(n: NotifItem) {
    setSelected(n);
    if (!n.read) {
      setList((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
      startTransition(() => {
        markNotifikasiRead(n.id);
      });
    }
  }

  if (list.length === 0) {
    return <p className="p-6 text-sm text-muted">Tidak ada notifikasi untuk filter ini.</p>;
  }

  return (
    <>
      {list.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => openDetail(n)}
          className={`w-full flex gap-3 items-start px-5 py-4 border-b border-surface-subtle last:border-b-0 text-left hover:bg-surface-hover transition-colors ${
            n.read ? "" : "bg-blue-50 dark:bg-blue-500/10"
          }`}
        >
          <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-none ${n.read ? "bg-border" : "bg-brand"}`} />
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] text-muted-stronger leading-snug line-clamp-2">{n.text}</div>
            <div className="text-[11.5px] text-muted-faint mt-1">
              {new Date(n.createdAt).toLocaleString("id-ID")}
            </div>
          </div>
        </button>
      ))}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-[480px] bg-surface-card border border-border-soft rounded-[20px] shadow-[0_12px_40px_rgba(15,23,42,.2)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">
                {selected.typeLabel}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-stronger hover:bg-surface-hover transition-colors flex-none"
              >
                <X size={16} />
              </button>
            </div>
            <div className="text-[15px] text-navy-text font-semibold leading-relaxed whitespace-pre-wrap">
              {selected.text}
            </div>
            <div className="text-[12px] text-muted-faint mt-4">
              {new Date(selected.createdAt).toLocaleString("id-ID", {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
