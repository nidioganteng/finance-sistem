"use client";

import { Trash2, X } from "lucide-react";

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
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-surface-card border border-border-soft rounded-[20px] shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-faint hover:bg-surface-hover"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-status-red" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-navy-text">Hapus Transaksi?</p>
            <p className="text-[12px] text-muted-stronger mt-0.5">Tindakan ini tidak dapat dibatalkan.</p>
          </div>
        </div>

        <div className="bg-surface-subtle border border-border-soft rounded-[12px] px-4 py-3">
          <p className="text-[11.5px] text-muted-faint font-semibold uppercase mb-1">Detail transaksi</p>
          <p className="text-[12.5px] font-mono text-muted-stronger">{noBukti}</p>
          <p className="text-[13px] font-semibold text-navy-text mt-0.5 line-clamp-2">{keterangan}</p>
        </div>

        <div className="flex gap-2.5 mt-1">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-[10px] border border-border-soft text-[13px] font-semibold text-muted-stronger hover:bg-surface-hover disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-[10px] bg-status-red text-white text-[13px] font-bold hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}
