import type { Metadata } from "next";
import { dbConnect } from "@/lib/db";
import { garageCapacity, getPlayer, serialize } from "@/lib/game";
import { OwnedAsset } from "@/lib/models/OwnedAsset";
import { ASSET_CATALOG, assetById } from "@/lib/economy";
import { assetArt } from "@/lib/art";
import type { SerializedOwnedAsset } from "@/lib/types";
import { VehicleCard } from "@/components/garage/VehicleCard";
import { AssetCard } from "@/components/empire/AssetCard";

export const metadata: Metadata = { title: "Garage — EMPIRE" };
export const dynamic = "force-dynamic";

const CLASS_ORDER = [
  "Motorcycles",
  "Muscle",
  "Sports",
  "Sports Classics",
  "Super",
  "Aircraft",
] as const;

export default async function GaragePage() {
  await dbConnect();
  const [player, ownedDocs] = await Promise.all([getPlayer(), OwnedAsset.find({}).lean()]);
  const owned = serialize<SerializedOwnedAsset[]>(ownedDocs);
  const ownedIds = new Set(owned.map((o) => o.assetId));

  const capacity = garageCapacity(ownedIds);
  const ownedVehicles = owned.filter((o) => assetById(o.assetId).class === "vehicle");
  const groundUsed = ownedVehicles.filter(
    (o) => assetById(o.assetId).vehicleClass !== "Aircraft"
  ).length;
  const airUsed = ownedVehicles.length - groundUsed;

  const allVehicles = ASSET_CATALOG.filter((d) => d.class === "vehicle");
  const showroom = allVehicles.filter((d) => !ownedIds.has(d.id));

  const slotLock = (isAircraft: boolean): string | null => {
    if (isAircraft) return airUsed >= capacity.aircraft ? "Needs hangar space" : null;
    return groundUsed >= capacity.garage ? "Needs garage space" : null;
  };

  const emptyGround = Math.max(0, capacity.garage - groundUsed);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="hud-label text-lg text-white">Your garage</h1>
          <span className="hud-label text-xs text-muted">
            Collection {ownedVehicles.length}/{allVehicles.length} · Garage {groundUsed}/
            {capacity.garage}
            {capacity.aircraft > 0 && ` · Hangar ${airUsed}/${capacity.aircraft}`}
          </span>
        </div>

        {capacity.garage === 0 && ownedVehicles.length === 0 ? (
          <p className="rounded border border-line bg-panel px-4 py-6 text-center text-sm text-muted">
            No garage yet — buy a property with garage slots on the Empire page, then come
            back for your first ride.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {ownedVehicles.map((o) => (
              <VehicleCard
                key={o.assetId}
                def={assetById(o.assetId)}
                owned={o}
                art={assetArt(o.assetId)}
              />
            ))}
            {Array.from({ length: Math.min(emptyGround, 8) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex h-full min-h-44 items-center justify-center rounded border border-dashed border-line/70 bg-panel/40"
              >
                <span className="hud-label text-xs text-muted">Empty slot</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="hud-label mb-3 text-lg text-white">Legendary Motorsport — showroom</h2>
        {CLASS_ORDER.map((cls) => {
          const inClass = showroom.filter((d) => d.vehicleClass === cls);
          if (inClass.length === 0) return null;
          return (
            <div key={cls} className="mb-6">
              <h3 className="hud-label mb-2 text-sm text-muted">{cls}</h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {inClass.map((d) => (
                  <AssetCard
                    key={d.id}
                    def={d}
                    cash={player.cash}
                    rank={player.rank}
                    pinned={player.pinnedGoalAssetId === d.id}
                    lockReason={slotLock(cls === "Aircraft")}
                    art={assetArt(d.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
