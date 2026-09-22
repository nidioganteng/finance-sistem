import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PaginationNav({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (p: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-1 py-2">
      <span className="text-[12.5px] text-muted">
        Halaman <span className="font-bold text-navy-text">{page}</span> dari{" "}
        <span className="font-bold text-navy-text">{totalPages}</span>
      </span>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            className="flex items-center gap-1 px-3 py-2 rounded-[10px] border border-border-soft text-[12.5px] font-semibold text-muted-stronger bg-surface-card hover:bg-surface-hover transition-colors"
          >
            <ChevronLeft size={14} /> Sebelumnya
          </Link>
        ) : (
          <span className="flex items-center gap-1 px-3 py-2 rounded-[10px] border border-border-soft text-[12.5px] font-semibold text-muted opacity-40 bg-surface-card cursor-not-allowed select-none">
            <ChevronLeft size={14} /> Sebelumnya
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={buildHref(page + 1)}
            className="flex items-center gap-1 px-3 py-2 rounded-[10px] border border-border-soft text-[12.5px] font-semibold text-muted-stronger bg-surface-card hover:bg-surface-hover transition-colors"
          >
            Berikutnya <ChevronRight size={14} />
          </Link>
        ) : (
          <span className="flex items-center gap-1 px-3 py-2 rounded-[10px] border border-border-soft text-[12.5px] font-semibold text-muted opacity-40 bg-surface-card cursor-not-allowed select-none">
            Berikutnya <ChevronRight size={14} />
          </span>
        )}
      </div>
    </div>
  );
}
