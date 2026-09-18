export default function Loading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      {/* PageHeader skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-52 bg-surface-subtle rounded-xl" />
          <div className="h-4 w-72 bg-surface-subtle rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 bg-surface-subtle rounded-xl" />
          <div className="h-9 w-9 bg-surface-subtle rounded-xl" />
        </div>
      </div>

      {/* Welcome banner skeleton */}
      <div className="h-24 rounded-[20px] bg-surface-subtle" />

      {/* KPI grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 bg-surface-subtle rounded-[16px]" />
        ))}
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-52 bg-surface-subtle rounded-2xl" />
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="h-80 bg-surface-subtle rounded-2xl" />
    </div>
  );
}
