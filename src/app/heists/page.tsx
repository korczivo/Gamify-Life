import type { Metadata } from "next";
import Link from "next/link";
import { dbConnect } from "@/lib/db";
import { serialize } from "@/lib/game";
import { Heist } from "@/lib/models/Heist";
import { OwnedAsset } from "@/lib/models/OwnedAsset";
import { HEIST_TIERS } from "@/lib/economy";
import type { SerializedHeist } from "@/lib/types";
import { HeistCreator } from "@/components/heists/HeistCreator";
import { weekKey } from "@/lib/dates";

export const metadata: Metadata = { title: "Heists — EMPIRE" };
export const dynamic = "force-dynamic";

export default async function HeistsPage() {
  await dbConnect();
  const [heists, owned] = await Promise.all([
    Heist.find({}).sort({ createdAt: -1 }).lean(),
    OwnedAsset.find({}).select({ assetId: 1 }).lean(),
  ]);
  const sHeists = serialize<SerializedHeist[]>(heists);
  const active = sHeists.find((h) => h.status === "scoping" || h.status === "active");
  const past = sHeists.filter((h) => h.status === "completed" || h.status === "archived");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {active ? (
        <Link
          href={`/heists/${active._id}`}
          className="block rounded border border-gold/50 bg-panel p-5 hover:bg-panel-2"
        >
          <div className="hud-label text-xs text-gold">
            Active heist · {HEIST_TIERS[active.tier].label} · {weekKey(new Date(active.createdAt))}
            {active.hardMode && " · 💀 HARD"}
          </div>
          <div className="display-font mt-1 text-3xl text-white/90">{active.name}</div>
          <div className="mt-3 h-2 overflow-hidden rounded-sm bg-panel-2">
            <div
              className="h-full bg-gold transition-all"
              style={{
                width: `${Math.round(
                  (active.preps.filter((p) => p.completed).length /
                    Math.max(1, active.preps.length)) *
                    100
                )}%`,
              }}
            />
          </div>
          <div className="hud-label mt-1.5 text-xs text-muted">
            {active.preps.filter((p) => p.completed).length}/{active.preps.length} preps —
            open the planning board →
          </div>
        </Link>
      ) : (
        <HeistCreator ownedAssetIds={owned.map((o) => o.assetId)} disabled={false} />
      )}

      {active && (
        <HeistCreator ownedAssetIds={owned.map((o) => o.assetId)} disabled={true} />
      )}

      {past.length > 0 && (
        <section>
          <h2 className="hud-label mb-3 text-lg text-white">Past scores</h2>
          <div className="flex flex-col gap-2">
            {past.map((h) => (
              <div
                key={h._id}
                className={`flex items-center gap-4 rounded border border-line bg-panel px-4 py-3 ${
                  h.status === "archived" ? "opacity-50" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{h.name}</div>
                  <div className="hud-label text-xs text-muted">
                    {HEIST_TIERS[h.tier].label} · {weekKey(new Date(h.createdAt))}
                    {h.loot?.kind && ` · ${h.loot.kind}`}
                    {h.hardMode && " · HARD"}
                    {h.eliteAchieved && " · ⭐ ELITE"}
                  </div>
                </div>
                {h.status === "completed" ? (
                  <span className="display-font text-xl text-cash">
                    +${(h.payout ?? 0).toLocaleString("en-US")}
                  </span>
                ) : (
                  <span className="hud-label text-xs text-muted">archived</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
