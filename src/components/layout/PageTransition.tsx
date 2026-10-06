"use client";
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-5 flex-1">{children}</div>;
}
