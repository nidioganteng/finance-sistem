"use client";

import { useState, useTransition } from "react";
import { usePageTransition } from "@/lib/use-page-transition";
import { X, Trash2 } from "lucide-react";
import { markNotifikasiRead, deleteNotifikasiAction } from "@/lib/actions/notifikasi";
import { toast } from "sonner";

type NotifItem = {
  id: string;
  text: string;
  typeLabel: string;
  read: boolean;
  createdAt: string;
};

export function NotifikasiListClient({ initialList }: { initialList: NotifItem[] }) {
  const [list, setList] = useState(initialList);
  const [selected, setSelected] = useState<NotifItem | null>(null);
  const [, startSilentTransition] = useTransition();       // mark-read: no loader
  const [, startDeleteTransition] = usePageTransition();   // delete: shows loader

  function openDetail(n: NotifItem) {
    setSelected(n);
    if (!n.read) {
      setList((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
      startSilentTransition(() => markNotifikasiRead(n.id));
    }
  }

  function handleDelete(e: React.MouseEvent, n: NotifItem) {
    e.stopPropagation();
    toast("Hapus notifikasi ini?", {
      description: n.text.slice(0, 80) + (n.text.length > 80 ? "…" : ""),
      duration: 7000,
      action: {
        label: "Ya, Hapus",
        onClick: () => {
          setList((prev) => prev.filter((item) => item.id !== n.id));
          if (selected?.id === n.id) setSelected(null);
          startDeleteTransition(async () => {
            try {
              await deleteNotifikasiAction(n.id);
            } catch {
              setList((prev) =>
                [n, ...prev].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )
              );
              toast.error("Gagal menghapus notifikasi.");
            }
          });
        },
      },
      cancel: { label: "Batal", onClick: () => {} },
    });
  }

  if (list.length === 0) {
    return (
      <p className="py-12 text-sm text-muted text-center">
        Tidak ada notifikasi untuk filter ini.
      </p>
    );
  }

  return (
    <>
      {list.map((n) => (
        <div
          key={n.id}
          className={`group flex gap-3 items-start px-5 py-4 border-b border-surface-subtle last:border-b-0 transition-colors ${
            n.read
              ? "hover:bg-surface-hover"
              : "bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100/70 dark:hover:bg-blue-500/15"
          }`}
        >
          <button
            type="button"
            onClick={() => openDetail(n)}
            className="flex gap-3 items-start flex-1 min-w-0 text-left"
          >
            <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-none ${n.read ? "bg-border" : "bg-brand"}`} />
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] text-muted-stronger leading-snug line-clamp-2">{n.text}</div>
              <div className="text-[11.5px] text-muted-faint mt-1">
                {new Date(n.createdAt).toLocaleString("id-ID")}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={(e) => handleDelete(e, n)}
            title="Hapus dari daftar saya (akun lain tidak terpengaruh)"
            className="flex-none opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-muted-faint hover:text-status-red hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            <Trash2 size={14} />
          </button>
        </div>
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
            <div className="mt-5 pt-4 border-t border-border-soft flex justify-end">
              <button
                type="button"
                onClick={(e) => { handleDelete(e, selected); setSelected(null); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] font-semibold text-status-red hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
                Hapus dari daftar saya
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
