export default function Loading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="h-40 animate-pulse rounded border border-line bg-panel" />
      <div className="h-72 animate-pulse rounded border border-line bg-panel" />
    </div>
  );
}
