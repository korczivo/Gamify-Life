"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl rounded border border-danger/40 bg-panel p-6 text-center">
      <div className="display-font text-3xl text-danger">Mission failed</div>
      <p className="mt-2 text-sm text-muted">{error.message}</p>
      <button
        onClick={reset}
        className="hud-label mt-4 rounded border border-line px-4 py-2 text-sm hover:bg-panel-2"
      >
        Retry
      </button>
    </div>
  );
}
