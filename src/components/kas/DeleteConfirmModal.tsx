"use client";

import { Trash2 } from "lucide-react";

export function DeleteConfirmModal({
  noBukti,
  keterangan,
  onConfirm,
  onCancel,
  isPending,
}: {
  noBukti: string;
  keterangan: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/10"
        onClick={onCancel}
      />
      <div className="relative bg-surface-card border border-border-soft rounded-2xl shadow-2xl w-full max-w-[360px] overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <Trash2 size={16} className="text-status-red" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-navy-text leading-snug">Hapus Transaksi?</p>
              <p className="text-[12px] text-muted mt-0.5 leading-relaxed">
                Data yang dihapus tidak bisa dikembalikan.
              </p>
            </div>
          </div>

          {/* Detail transaksi */}
          <div className="mt-4 bg-surface-subtle rounded-[10px] px-3.5 py-2.5">
            <p className="text-[10.5px] font-bold text-muted-faint uppercase tracking-wide mb-1">
              Detail transaksi
            </p>
            <p className="text-[11.5px] font-mono text-muted">{noBukti}</p>
            <p className="text-[13px] font-semibold text-navy-text mt-0.5 line-clamp-2 leading-snug">
              {keterangan}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-soft bg-surface-subtle/50">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 rounded-[9px] text-[12.5px] font-semibold text-muted-stronger hover:bg-surface-hover border border-border-soft disabled:opacity-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 rounded-[9px] bg-red-500 text-white text-[12.5px] font-bold hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}
