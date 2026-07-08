import Link from "next/link";
import { ensurePeriodMissions, getPlayer, serialize } from "@/lib/game";
import { dbConnect } from "@/lib/db";
import { Mission } from "@/lib/models/Mission";
import { Heist } from "@/lib/models/Heist";
import { OwnedAsset } from "@/lib/models/OwnedAsset";
import { LedgerEntry } from "@/lib/models/LedgerEntry";
import { ActivityDay } from "@/lib/models/ActivityDay";
import { dayKey, weekKey } from "@/lib/dates";
import { assetById } from "@/lib/economy";
import type { SerializedMission } from "@/lib/types";
import { MissionCard } from "@/components/missions/MissionCard";
import { SafeCard } from "@/components/hud/SafeCard";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { buildNetWorthSeries } from "@/lib/networth";
import { assetArt } from "@/lib/art";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  await dbConnect();
  await ensurePeriodMissions();

  const dk = dayKey();
  const wk = weekKey();
  const [player, todayMissions, weekOpen, prepsOpen, activeHeist, owned, lastEntry, activity] =
    await Promise.all([
      getPlayer(),
      Mission.find({ periodKey: dk, heistId: null }).sort({ status: 1, createdAt: 1 }).lean(),
      Mission.find({ periodKey: wk, status: "open" }).lean(),
      Mission.find({ heistId: { $ne: null }, status: "open" }).lean(),
      Heist.findOne({ status: { $in: ["scoping", "active"] } }).lean(),
      OwnedAsset.find({}).lean(),
      LedgerEntry.findOne({}).sort({ createdAt: -1 }).lean(),
      ActivityDay.findOne({ dayKey: dayKey() }).lean(),
    ]);
  const nwSeries = await buildNetWorthSeries();
  const hardDoneToday = activity?.hardCompleted ?? 0;

  const sToday = serialize<SerializedMission[]>(todayMissions);
  const openToday = sToday.filter((m) => m.status === "open");
  const doneToday = sToday.length - openToday.length;

  const dailyDriver = owned.find((o) => o.isDailyDriver);
  const driverDef = dailyDriver ? assetById(dailyDriver.assetId) : null;

  const pinnedDef = player.pinnedGoalAssetId ? assetById(player.pinnedGoalAssetId) : null;
  const pinnedProgress = pinnedDef ? Math.min(1, player.cash / pinnedDef.price) : 0;

  const netWorth = lastEntry?.netWorthAfter ?? player.cash;

  return (
    <div className="mx-auto max-w-6xl">
      {/* daily brief */}
      <div className="hud-label mb-6 flex flex-wrap items-center gap-x-6 gap-y-1 rounded border border-line bg-panel px-4 py-2.5 text-xs text-muted">
        <span className="text-white">{dk}</span>
        <span>
          {openToday.length} jobs open · {doneToday} done
        </span>
        {weekOpen.length > 0 && <span>{weekOpen.length} weekly left</span>}
        {activeHeist ? (
          <span className="text-gold">
            Heist: {activeHeist.name} —{" "}
            {activeHeist.preps.filter((p) => p.completed).length}/{activeHeist.preps.length}{" "}
            preps
          </span>
        ) : (
          <span>No active heist</span>
        )}
        <span className="ml-auto">
          Net worth: <span className="text-cash">${netWorth.toLocaleString("en-US")}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* left: today's jobs */}
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between">
            <h1 className="hud-label text-lg text-white">Today&apos;s jobs</h1>
            <Link href="/missions" className="hud-label text-xs text-muted hover:text-white">
              Full board →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {sToday.length === 0 && (
              <p className="rounded border border-line bg-panel px-4 py-6 text-center text-sm text-muted">
                Board is empty — add jobs on the Missions page.
              </p>
            )}
            {sToday.map((m) => (
              <MissionCard key={m._id} mission={m} hardDoneToday={hardDoneToday} />
            ))}
          </div>
        </section>

        {/* right: empire status */}
        <aside className="flex flex-col gap-4">
          <SafeCard balance={player.safeBalance} residualPerDay={player.residualPerDay} />

          {pinnedDef && (
            <div className="rounded border border-line bg-panel p-4">
              <div className="hud-label text-xs text-muted">Grinding for</div>
              <div className="mt-1 font-medium">{pinnedDef.name}</div>
              <div className="hud-label mt-2 flex justify-between text-xs">
                <span className="text-cash">${player.cash.toLocaleString("en-US")}</span>
                <span className="text-muted">${pinnedDef.price.toLocaleString("en-US")}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-sm bg-panel-2">
                <div
                  className={`h-full transition-all duration-700 ${
                    pinnedProgress >= 1 ? "bg-cash animate-pulse-glow" : "bg-gold"
                  }`}
                  style={{ width: `${Math.round(pinnedProgress * 100)}%` }}
                />
              </div>
              {pinnedProgress >= 1 && (
                <Link
                  href="/empire"
                  className="hud-label mt-2 block text-center text-xs font-bold text-cash"
                >
                  You can afford it — go buy it →
                </Link>
              )}
            </div>
          )}

          {activeHeist && (
            <Link
              href={`/heists/${String(activeHeist._id)}`}
              className="block rounded border border-gold/40 bg-panel p-4 hover:bg-panel-2"
            >
              <div className="hud-label text-xs text-gold">Active heist</div>
              <div className="mt-1 font-medium">{activeHeist.name}</div>
              <div className="mt-2 h-2 overflow-hidden rounded-sm bg-panel-2">
                <div
                  className="h-full bg-gold transition-all"
                  style={{
                    width: `${Math.round(
                      (activeHeist.preps.filter((p) => p.completed).length /
                        Math.max(1, activeHeist.preps.length)) *
                        100
                    )}%`,
                  }}
                />
              </div>
              <div className="hud-label mt-1 text-xs text-muted">
                {activeHeist.preps.filter((p) => p.completed).length}/
                {activeHeist.preps.length} preps
                {activeHeist.hardMode && <span className="text-danger"> · HARD</span>}
              </div>
            </Link>
          )}

          {prepsOpen.length > 0 && !activeHeist && (
            <div className="hud-label rounded border border-line bg-panel p-4 text-xs text-muted">
              {prepsOpen.length} heist preps open
            </div>
          )}

          <div className="rounded border border-line bg-panel p-4">
            <div className="hud-label mb-1 text-xs text-muted">Net worth</div>
            <NetWorthChart series={nwSeries} height={120} compactMode />
          </div>

          {driverDef && (
            <div className="overflow-hidden rounded border border-line bg-panel">
              {assetArt(driverDef.id) ? (
                <div className="relative h-36 bg-panel-2">
                  <Image
                    src={assetArt(driverDef.id)!}
                    alt={driverDef.name}
                    fill
                    className="object-cover"
                    sizes="400px"
                  />
                </div>
              ) : null}
              <div className="p-4">
                <div className="hud-label text-xs text-muted">Daily driver</div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <span className="font-medium">{driverDef.name}</span>
                  <span className="hud-label text-xs text-muted">{driverDef.vehicleClass}</span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
