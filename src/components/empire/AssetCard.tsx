"use client";

import Image from "next/image";
import { useTransition } from "react";
import { buyAssetAction, setPinnedGoalAction } from "@/actions/empire";
import { useCelebration } from "@/components/hud/Celebrations";
import type { AssetDef } from "@/lib/economy";

export function AssetCard({
  def,
  cash,
  rank,
  pinned,
  lockReason,
  art,
  iconMask,
}: {
  def: AssetDef;
  cash: number;
  rank: number;
  pinned: boolean;
  /** Non-price reason this can't be bought yet (rank gate, prerequisite...). */
  lockReason: string | null;
  art?: string | null;
  /** SVG silhouette (game-icons) rendered as a recolorable mask. */
  iconMask?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const celebrate = useCelebration();

  const affordable = cash >= def.price;
  const rankLocked = def.requiredRank ? rank < def.requiredRank : false;
  const locked = Boolean(lockReason) || rankLocked;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded border bg-panel ${
        locked ? "border-line opacity-60" : affordable ? "border-cash/40" : "border-line"
      }`}
    >
      <div className="relative flex h-28 items-center justify-center bg-panel-2">
        {iconMask ? (
          <div
            className="h-14 w-14"
            style={{
              backgroundColor: locked ? "#3a4149" : "#c0c7ce",
              maskImage: `url(${iconMask})`,
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskImage: `url(${iconMask})`,
              WebkitMaskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
            }}
          />
        ) : art ? (
          <Image src={art} alt={def.name} fill className="object-cover" sizes="300px" />
        ) : def.map ? (
          <Image
            src={`/map/blips/${def.map.blip}.png`}
            alt=""
            width={40}
            height={40}
            className={locked ? "opacity-50 grayscale" : ""}
          />
        ) : (
          <span className="text-4xl">{def.emoji ?? (def.class === "gear" ? "🕶" : "🚗")}</span>
        )}
        {locked && (
          <span className="hud-label absolute right-2 top-2 rounded-sm bg-black/70 px-2 py-0.5 text-[10px] text-muted">
            🔒 {rankLocked ? `Rank ${def.requiredRank}` : lockReason}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="truncate text-sm font-medium">{def.name}</div>
        <div className="hud-label mt-0.5 line-clamp-2 text-[11px] text-muted">{def.tagline}</div>
        {def.unlocks && (
          <div className="hud-label mt-1 text-[11px] text-gold">{def.unlocks}</div>
        )}
        <div className="mt-auto flex items-center gap-2 pt-3">
          <span className={`display-font text-lg ${affordable && !locked ? "text-cash" : "text-muted"}`}>
            ${def.price.toLocaleString("en-US")}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => startTransition(() => setPinnedGoalAction(pinned ? null : def.id))}
              disabled={pending}
              className={`hud-label rounded px-2 py-1 text-[11px] ${
                pinned ? "bg-gold/20 text-gold" : "border border-line text-muted hover:text-gold"
              }`}
              title={pinned ? "Unpin goal" : "Pin as your goal"}
            >
              {pinned ? "★ Goal" : "☆"}
            </button>
            <button
              onClick={() =>
                startTransition(async () => {
                  const r = await buyAssetAction(def.id);
                  celebrate(r.ok ? { cashDelta: r.cashDelta } : { error: r.error });
                })
              }
              disabled={pending || locked || !affordable}
              className="hud-label rounded border border-cash/50 bg-cash/10 px-3 py-1 text-xs font-bold text-cash hover:bg-cash/20 disabled:opacity-40"
            >
              Buy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
