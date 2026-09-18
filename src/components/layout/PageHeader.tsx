import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function PageHeader({
  title,
  subtitle,
  rightSlot,
}: {
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="text-[22px] sm:text-[26px] font-extrabold text-navy-text tracking-tight leading-tight">{title}</div>
        <div className="text-[12.5px] sm:text-[13.5px] text-muted mt-1">{subtitle}</div>
      </div>
      <div className="print:hidden flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
        <ThemeToggle />
        {rightSlot}
      </div>
    </div>
  );
}
