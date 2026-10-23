"use client";

import { Trash2 } from "lucide-react";

export function DeleteConfirmModal({
  noBukti,
  keterangan,
  onConfirm,
  onCancel,
  isPending,
  error,
  title = "Hapus Transaksi?",
}: {
  noBukti: string;
  keterangan: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
  error?: string | null;
  title?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="absolute inset-0"
        onClick={onCancel}
      />
      <div className="relative bg-surface-card border border-border-soft rounded-2xl shadow-2xl w-full max-w-[380px] overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5 border border-red-200 dark:border-red-900/40">
              <Trash2 size={16} className="text-status-red" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-navy-text leading-snug">{title}</p>
              <p className="text-[12px] text-muted-faint mt-0.5 leading-relaxed">
                Data yang dihapus tidak bisa dikembalikan.
              </p>
            </div>
          </div>

          {/* Detail transaksi */}
          <div className="mt-4 bg-surface-subtle rounded-xl px-3.5 py-2.5 border border-border-soft">
            <p className="text-[10px] font-bold text-muted-faint uppercase tracking-wider mb-1">
              Detail Transaksi
            </p>
            <p className="text-[12px] font-mono font-bold text-navy-text">{noBukti || "-"}</p>
            <p className="text-[12.5px] font-medium text-navy-soft mt-0.5 line-clamp-2 leading-snug">
              {keterangan || "Tidak ada keterangan"}
            </p>
          </div>
        </div>

        {error && <p role="alert" className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-status-red dark:border-red-500/30 dark:bg-red-500/10">{error}</p>}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-soft bg-surface-subtle/50">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 rounded-xl text-[12.5px] font-semibold text-muted-stronger hover:bg-surface-hover border border-border-soft disabled:opacity-50 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-[12.5px] font-bold hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
          >
            {isPending ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}
