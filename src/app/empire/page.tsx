import type { Metadata } from "next";
import { dbConnect } from "@/lib/db";
import { getPlayer, serialize } from "@/lib/game";
import { OwnedAsset } from "@/lib/models/OwnedAsset";
import { ASSET_CATALOG, assetById, type AssetDef } from "@/lib/economy";
import { assetArt } from "@/lib/art";
import type { SerializedOwnedAsset } from "@/lib/types";
import { BusinessPanel } from "@/components/empire/BusinessPanel";
import { AssetCard } from "@/components/empire/AssetCard";
import { PropertyUpgradeCard } from "@/components/empire/PropertyUpgradeCard";
import { LosSantosMap } from "@/components/empire/LosSantosMap";

export const metadata: Metadata = { title: "Empire — EMPIRE" };
export const dynamic = "force-dynamic";

export default async function EmpirePage() {
  await dbConnect();
  const [player, ownedDocs] = await Promise.all([getPlayer(), OwnedAsset.find({}).lean()]);
  const owned = serialize<SerializedOwnedAsset[]>(ownedDocs);
  const ownedIds = new Set(owned.map((o) => o.assetId));

  const businessCount = owned.filter((o) => assetById(o.assetId).class === "business").length;
  const hasOfficeBonus = ownedIds.has("maze-bank-west") || ownedIds.has("maze-bank-tower");

  const lockReason = (def: AssetDef): string | null => {
    if (def.requiresBusinessCount && businessCount < def.requiresBusinessCount) {
      return `Own ${def.requiresBusinessCount} businesses`;
    }
    return null;
  };

  const ownedBusinesses = owned.filter((o) => assetById(o.assetId).class === "business");
  const marketBusinesses = ASSET_CATALOG.filter(
    (d) => d.class === "business" && !ownedIds.has(d.id)
  );
  const marketProperties = ASSET_CATALOG.filter(
    (d) => d.class === "property" && !ownedIds.has(d.id)
  );
  const ownedProperties = owned.filter((o) => assetById(o.assetId).class === "property");

  // Property upgrades available for owned properties (penthouse rooms, yacht tiers...)
  const propertyUpgrades = ownedProperties
    .map((o) => ({ owned: o, def: assetById(o.assetId) }))
    .filter(({ def }) => def.upgrades && def.upgrades.length > 0);

  const empireIncomePerDay = player.residualPerDay;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      {(() => {
        const producingIds = ownedBusinesses
          .filter((o) => (assetById(o.assetId).isNightclub ? true : o.supplyUnits > 0))
          .map((o) => o.assetId);
        // Key remounts the map when ownership/production state changes.
        const mapKey = [...ownedIds].sort().join(",") + "|" + producingIds.sort().join(",");
        return <LosSantosMap key={mapKey} ownedIds={[...ownedIds]} producing={producingIds} />;
      })()}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="hud-label text-lg text-white">Your operations</h1>
          <span className="hud-label text-xs text-muted">
            Empire income: <span className="text-cash">${empireIncomePerDay.toLocaleString("en-US")}/day</span> in residuals
          </span>
        </div>
        {ownedBusinesses.length === 0 ? (
          <p className="rounded border border-line bg-panel px-4 py-6 text-center text-sm text-muted">
            You own no businesses yet. Every business turns your real work into product —
            missions deliver supplies, supplies become stock, stock becomes a payday.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {ownedBusinesses.map((o) => (
              <BusinessPanel
                key={o.assetId}
                def={assetById(o.assetId)}
                owned={o}
                hasOfficeBonus={hasOfficeBonus}
              />
            ))}
          </div>
        )}
      </section>

      {propertyUpgrades.length > 0 && (
        <section>
          <h2 className="hud-label mb-3 text-lg text-white">Property upgrades</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {propertyUpgrades.map(({ owned: o, def }) => (
              <PropertyUpgradeCard key={o.assetId} def={def} owned={o} />
            ))}
          </div>
        </section>
      )}

      {marketBusinesses.length > 0 && (
        <section>
          <h2 className="hud-label mb-3 text-lg text-white">Business opportunities</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {marketBusinesses.map((d) => (
              <AssetCard
                key={d.id}
                def={d}
                cash={player.cash}
                rank={player.rank}
                pinned={player.pinnedGoalAssetId === d.id}
                lockReason={lockReason(d)}
                art={assetArt(d.id)}
              />
            ))}
          </div>
        </section>
      )}

      {marketProperties.length > 0 && (
        <section>
          <h2 className="hud-label mb-3 text-lg text-white">
            Dynasty 8 — property market
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {marketProperties.map((d) => (
              <AssetCard
                key={d.id}
                def={d}
                cash={player.cash}
                rank={player.rank}
                pinned={player.pinnedGoalAssetId === d.id}
                lockReason={lockReason(d)}
                art={assetArt(d.id)}
              />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
