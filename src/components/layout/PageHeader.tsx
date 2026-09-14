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
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="text-[26px] font-extrabold text-navy-text tracking-tight">{title}</div>
        <div className="text-[13.5px] text-muted mt-1">{subtitle}</div>
      </div>
      <div className="print:hidden flex items-center gap-2.5 flex-none">
        <ThemeToggle />
        {rightSlot}
      </div>
    </div>
  );
}
