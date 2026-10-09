"use client";

export function LoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface-card/60 backdrop-blur-[2px] rounded-[20px]">
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-surface-card border border-border-soft shadow-md">
        <div className="w-4 h-4 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
        <span className="text-[13px] font-semibold text-navy-text">Memproses...</span>
      </div>
    </div>
  );
}
