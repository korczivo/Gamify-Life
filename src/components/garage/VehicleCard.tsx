"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { buyUpgradeAction, setDailyDriverAction } from "@/actions/empire";
import { useCelebration } from "@/components/hud/Celebrations";
import type { AssetDef } from "@/lib/economy";
import type { SerializedOwnedAsset } from "@/lib/types";

export function VehicleCard({
  def,
  owned,
  art,
}: {
  def: AssetDef;
  owned: SerializedOwnedAsset;
  art?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [showTuning, setShowTuning] = useState(false);
  const celebrate = useCelebration();

  const slots = def.upgrades ?? [];
  const tuned = slots.filter((u) => owned.upgrades.includes(u.id)).length;
  const fullyTuned = slots.length > 0 && tuned === slots.length;

  return (
    <div
      className={`overflow-hidden rounded border bg-panel ${
        owned.isDailyDriver ? "border-gold/60" : fullyTuned ? "border-cash/40" : "border-line"
      }`}
    >
      <div className="relative flex h-32 items-center justify-center bg-panel-2">
        {art ? (
          <Image src={art} alt={def.name} fill className="object-cover" sizes="340px" />
        ) : (
          <span className="text-4xl">
            {def.vehicleClass === "Motorcycles" ? "🏍" : def.vehicleClass === "Aircraft" ? "🚁" : "🚗"}
          </span>
        )}
        {owned.isDailyDriver && (
          <span className="hud-label absolute left-2 top-2 rounded-sm bg-gold/90 px-2 py-0.5 text-[10px] font-bold text-black">
            Daily driver
          </span>
        )}
        {fullyTuned && (
          <span className="hud-label absolute right-2 top-2 rounded-sm bg-cash/90 px-2 py-0.5 text-[10px] font-bold text-black">
            Fully tuned
          </span>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="truncate text-sm font-medium">{def.name}</div>
          <span className="hud-label shrink-0 text-[10px] text-muted">{def.vehicleClass}</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => setShowTuning((s) => !s)}
            className="hud-label rounded border border-line px-2.5 py-1 text-[11px] text-muted hover:text-white"
          >
            LS Customs · {tuned}/{slots.length}
          </button>
          {!owned.isDailyDriver && (
            <button
              onClick={() => startTransition(() => setDailyDriverAction(owned.assetId))}
              disabled={pending}
              className="hud-label rounded border border-gold/40 px-2.5 py-1 text-[11px] text-gold hover:bg-gold/10"
            >
              Drive it
            </button>
          )}
        </div>

        {showTuning && (
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
            {slots.map((up) => {
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
                  className={`hud-label rounded px-2 py-0.5 text-[10px] ${
                    has
                      ? "bg-cash/15 text-cash"
                      : "border border-line text-muted hover:text-white"
                  }`}
                >
                  {has ? "✓ " : ""}
                  {up.name}
                  {!has && ` · $${up.price.toLocaleString("en-US")}`}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
