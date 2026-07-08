import type { Metadata } from "next";
import Image from "next/image";
import { dbConnect } from "@/lib/db";
import { getPlayer, serialize } from "@/lib/game";
import { OwnedAsset } from "@/lib/models/OwnedAsset";
import { ActivityDay } from "@/lib/models/ActivityDay";
import { Heist } from "@/lib/models/Heist";
import { LedgerEntry } from "@/lib/models/LedgerEntry";
import {
  ASSET_CATALOG,
  assetById,
  SKILL_MILESTONES,
  SKILLS,
  skillBonus,
  skillLevel,
  rpForRank,
} from "@/lib/economy";
import { computeAwards, type AwardMetrics } from "@/lib/awards";
import type { SerializedOwnedAsset } from "@/lib/types";
import { AssetCard } from "@/components/empire/AssetCard";
import { CharacterWizard } from "@/components/character/CharacterWizard";
import { SurgeryPanel } from "@/components/character/SurgeryPanel";
import { CashDonut } from "@/components/character/CashDonut";
import { AwardBadge } from "@/components/character/AwardBadge";

export const metadata: Metadata = { title: "Character — EMPIRE" };
export const dynamic = "force-dynamic";

export default async function CharacterPage() {
  await dbConnect();
  const [player, ownedDocs, activity, heistsDone, elites, cashByType, lastEntry, stockSales] =
    await Promise.all([
      getPlayer(),
      OwnedAsset.find({}).lean(),
      ActivityDay.find({}).lean(),
      Heist.countDocuments({ status: "completed" }),
      Heist.countDocuments({ status: "completed", eliteAchieved: true }),
      LedgerEntry.aggregate([
        { $match: { amountCash: { $gt: 0 } } },
        { $group: { _id: "$type", total: { $sum: "$amountCash" } } },
      ]),
      LedgerEntry.findOne({}).sort({ createdAt: -1 }).lean(),
      LedgerEntry.countDocuments({ type: "STOCK_SALE" }),
    ]);

  // First visit: the character wizard.
  if (!player.characterName || !player.portraitId) {
    return (
      <div className="mx-auto max-w-3xl">
        <CharacterWizard mode="create" />
      </div>
    );
  }

  const owned = serialize<SerializedOwnedAsset[]>(ownedDocs);
  const ownedIds = new Set(owned.map((o) => o.assetId));
  const skills = (player.skills ?? {}) as unknown as Record<string, number>;
  const wardrobe = ASSET_CATALOG.filter((d) => d.class === "gear");

  const totalMissions = activity.reduce((s, d) => s + d.missionsCompleted, 0);
  const totalDeepWork = activity.reduce((s, d) => s + d.deepWorkMinutes, 0);
  const rankStart = rpForRank(player.rank);
  const rankEnd = rpForRank(player.rank + 1);

  const cashOf = (type: string) => cashByType.find((c) => c._id === type)?.total ?? 0;
  const netWorth = lastEntry?.netWorthAfter ?? player.cash;
  const totalEarned = cashByType.reduce((s, c) => s + c.total, 0);

  const metrics: AwardMetrics = {
    grinder: totalMissions,
    "deep-focus": totalDeepWork / 60,
    mastermind: heistsDone,
    "elite-thief": elites,
    "empire-builder": owned.filter((o) => {
      const cls = assetById(o.assetId).class;
      return cls === "business" || cls === "property";
    }).length,
    collector: owned.filter((o) => assetById(o.assetId).class === "vehicle").length,
    "millionaires-club": netWorth,
    rainmaker: totalEarned,
    salesman: stockSales,
    "high-roller": owned.filter((o) => assetById(o.assetId).class === "gear").length,
  };
  const awards = computeAwards(metrics);
  const awardsUnlocked = awards.filter((a) => a.tier !== null).length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Social Club header: mugshot, rank medallion, cash */}
      <div className="flex flex-wrap items-stretch gap-5 rounded border border-line bg-panel p-5">
        {/* mugshot */}
        <div className="relative w-32 shrink-0 overflow-hidden rounded border-2 border-rp/60 bg-[repeating-linear-gradient(180deg,#20242a_0px,#20242a_14px,#181c21_14px,#181c21_28px)]">
          <Image
            src={`/assets/portraits/${player.portraitId}.jpg`}
            alt={player.characterName}
            fill
            className="object-cover object-top"
            sizes="128px"
          />
        </div>

        <div className="flex min-w-52 flex-col justify-center">
          <div className="display-font text-3xl text-white/90">{player.characterName}</div>
          <div className="mt-2 flex items-center gap-3">
            {/* rank medallion */}
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-[#b08d57] bg-panel-2">
              <span className="display-font text-xl text-[#b08d57]">{player.rank}</span>
            </div>
            <div>
              <div className="hud-label text-xs text-rp">
                {player.totalRp.toLocaleString("en-US")} RP
              </div>
              <div className="mt-1 h-1.5 w-44 overflow-hidden rounded-sm bg-panel-2">
                <div
                  className="h-full bg-rp"
                  style={{
                    width: `${Math.round(((player.totalRp - rankStart) / Math.max(1, rankEnd - rankStart)) * 100)}%`,
                  }}
                />
              </div>
              <div className="hud-label mt-0.5 text-[10px] text-muted">
                {(rankEnd - player.totalRp).toLocaleString("en-US")} RP to rank{" "}
                {player.rank + 1}
              </div>
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-col justify-center gap-1 text-right">
          <div>
            <span className="hud-label text-xs text-muted">Play time </span>
            <span className="hud-label text-sm text-white">
              {Math.floor(totalDeepWork / 60)}h {totalDeepWork % 60}m deep work
            </span>
          </div>
          <div>
            <span className="hud-label text-xs text-muted">Cash </span>
            <span className="display-font text-lg text-cash">
              ${player.cash.toLocaleString("en-US")}
            </span>
          </div>
          <div>
            <span className="hud-label text-xs text-muted">Safe </span>
            <span className="display-font text-lg text-gold">
              ${Math.round(player.safeBalance).toLocaleString("en-US")}
            </span>
          </div>
          <div className="mt-1">
            <SurgeryPanel
              currentName={player.characterName}
              currentPortraitId={player.portraitId}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* cash earned donut */}
        <section className="rounded border border-line bg-panel p-5">
          <h2 className="hud-label mb-4 text-sm text-white">Cash earned</h2>
          <CashDonut
            sources={[
              { label: "Jobs", value: cashOf("MISSION_PAYOUT") },
              { label: "Heists", value: cashOf("HEIST_PAYOUT") },
              { label: "Stock sales", value: cashOf("STOCK_SALE") },
              { label: "Residuals", value: cashOf("SAFE_COLLECT") },
            ]}
          />
        </section>

        {/* skills */}
        <section className="rounded border border-line bg-panel p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="hud-label text-sm text-white">Stats</h2>
            <span className="hud-label text-[10px] text-muted">
              {SKILL_MILESTONES.map((m) => `${m.level}→+${Math.round(m.bonus * 100)}%`).join(" · ")}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {SKILLS.map((skill) => {
              const level = skillLevel(skills[skill.key] ?? 0);
              const bonus = skillBonus(level);
              return (
                <div key={skill.key} className="flex items-center gap-3">
                  <span className="hud-label w-24 shrink-0 text-xs text-white">
                    {skill.name}
                  </span>
                  <div className="flex flex-1 gap-0.5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 flex-1 rounded-[2px] ${
                          level >= (i + 1) * 10
                            ? "bg-rp"
                            : level > i * 10
                              ? "bg-rp/50"
                              : "bg-panel-2"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="hud-label w-16 shrink-0 text-right text-[10px] text-muted">
                    {bonus > 0 ? (
                      <span className="text-cash">+{Math.round(bonus * 100)}%</span>
                    ) : (
                      `${level}/100`
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="hud-label mt-3 border-t border-line pt-2 text-[10px] text-muted">
            Skills grow from work only: typed missions, deep-work minutes, heist finales.
          </p>
        </section>
      </div>

      {/* awards */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="hud-label text-lg text-white">Awards</h2>
          <span className="hud-label text-xs text-muted">
            {awardsUnlocked}/{awards.length} unlocked · bronze → silver → gold → platinum
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {awards.map((a) => (
            <AwardBadge key={a.def.id} award={a} />
          ))}
        </div>
      </section>

      {/* wardrobe */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="hud-label text-lg text-white">Wardrobe — Ponsonbys & Co.</h2>
          <span className="hud-label text-xs text-muted">
            {metrics["high-roller"]}/{wardrobe.length} pieces · pure flex, counts toward net
            worth
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {wardrobe.map((d) =>
            ownedIds.has(d.id) ? (
              <div
                key={d.id}
                className="flex flex-col items-center justify-center gap-3 rounded border border-gold/40 bg-panel p-4 text-center"
              >
                <div
                  className="h-14 w-14"
                  style={{
                    backgroundColor: "#e8b71a",
                    maskImage: `url(/assets/wardrobe/${d.id}.svg)`,
                    maskSize: "contain",
                    maskRepeat: "no-repeat",
                    maskPosition: "center",
                    WebkitMaskImage: `url(/assets/wardrobe/${d.id}.svg)`,
                    WebkitMaskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                  }}
                />
                <div>
                  <div className="text-sm font-medium">{d.name}</div>
                  <div className="hud-label mt-0.5 text-[10px] text-gold">Owned</div>
                </div>
              </div>
            ) : (
              <AssetCard
                key={d.id}
                def={d}
                cash={player.cash}
                rank={player.rank}
                pinned={player.pinnedGoalAssetId === d.id}
                lockReason={null}
                art={null}
                iconMask={`/assets/wardrobe/${d.id}.svg`}
              />
            )
          )}
        </div>
      </section>
    </div>
  );
}
