export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 h-10 animate-pulse rounded border border-line bg-panel" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-2 lg:col-span-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[74px] animate-pulse rounded border border-line bg-panel" />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded border border-line bg-panel" />
          ))}
        </div>
      </div>
    </div>
  );
}
