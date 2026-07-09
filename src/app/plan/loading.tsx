export default function Loading() {
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
      <div className="h-24 animate-pulse rounded-lg border border-line bg-panel" />
      <div className="h-[760px] animate-pulse rounded-lg border border-line bg-panel" />
    </div>
  );
}
