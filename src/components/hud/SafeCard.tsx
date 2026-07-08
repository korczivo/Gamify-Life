"use client";

import { useTransition } from "react";
import { collectSafeAction } from "@/actions/empire";
import { useCelebration } from "./Celebrations";

export function SafeCard({
  balance,
  residualPerDay,
}: {
  balance: number;
  residualPerDay: number;
}) {
  const [pending, startTransition] = useTransition();
  const celebrate = useCelebration();

  return (
    <div className="rounded border border-line bg-panel p-4">
      <div className="hud-label text-xs text-muted">The safe</div>
      <div className="display-font mt-1 text-3xl text-cash">
        ${balance.toLocaleString("en-US")}
      </div>
      <div className="hud-label mt-1 text-xs text-muted">
        Residuals: +${residualPerDay.toLocaleString("en-US")}/day — grows with every
        mission, forever
      </div>
      <button
        onClick={() =>
          startTransition(async () => {
            const r = await collectSafeAction();
            celebrate(r.ok ? { cashDelta: r.cashDelta } : { error: r.error });
          })
        }
        disabled={pending || balance < 1}
        className="hud-label mt-3 w-full rounded border border-cash/50 bg-cash/10 py-2 text-sm font-bold text-cash hover:bg-cash/20 disabled:opacity-40"
      >
        Collect
      </button>
    </div>
  );
}
