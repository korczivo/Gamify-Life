export default function Loading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2">
      <div className="h-7 w-44 animate-pulse rounded bg-panel" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-[74px] animate-pulse rounded border border-line bg-panel" />
      ))}
    </div>
  );
}
