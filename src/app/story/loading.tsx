export default function Loading() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div className="h-20 animate-pulse rounded-lg border border-line bg-panel" />
      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="h-[74vh] min-h-[520px] animate-pulse rounded-lg border border-line bg-panel" />
        <div className="h-[74vh] min-h-[520px] animate-pulse rounded-lg border border-line bg-panel" />
      </div>
    </div>
  );
}
