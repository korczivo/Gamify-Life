export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded border border-line bg-panel" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded border border-line bg-panel" />
      <div className="h-40 animate-pulse rounded border border-line bg-panel" />
    </div>
  );
}
