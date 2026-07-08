"use client";

import { useTransition } from "react";
import { buyUpgradeAction } from "@/actions/empire";
import { useCelebration } from "@/components/hud/Celebrations";
import type { AssetDef } from "@/lib/economy";
import type { SerializedOwnedAsset } from "@/lib/types";

export function PropertyUpgradeCard({
  def,
  owned,
}: {
  def: AssetDef;
  owned: SerializedOwnedAsset;
}) {
  const [pending, startTransition] = useTransition();
  const celebrate = useCelebration();

  return (
    <div className="rounded border border-line bg-panel p-4">
      <div className="font-medium">{def.name}</div>
      <div className="hud-label text-[11px] text-muted">{def.tagline}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {def.upgrades!.map((up) => {
          const has = owned.upgrades.includes(up.id);
          return (
            <button
              key={up.id}
              onClick={() =>
                startTransition(async () => {
                  const r = await buyUpgradeAction(owned.assetId, up.id);
                  celebrate(r.ok ? { cashDelta: r.cashDelta } : { error: r.error });
                })
              }
              disabled={pending || has}
              className={`hud-label rounded px-2.5 py-1 text-[11px] ${
                has
                  ? "bg-cash/15 text-cash"
                  : "border border-line text-muted hover:text-white hover:bg-panel-2"
              }`}
              title={up.effect}
            >
              {has ? "✓ " : ""}
              {up.name}
              {!has && ` · $${up.price.toLocaleString("en-US")}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
