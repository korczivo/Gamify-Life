/**
 * All domain logic. Server actions are thin wrappers over these functions.
 * Single-user app on standalone Mongo: no multi-doc transactions, but every
 * payout is guarded by an atomic status flip so double-clicks can't double-pay.
 */
import { dbConnect } from "./db";
import { dayKey, weekKey, hoursBetween } from "./dates";
import {
  assetById,
  DIFFICULTY,
  EQUIPMENT_VALUE_MULT,
  ELITE_WINDOW_DAYS,
  FULLNESS_BONUS_MAX,
  hardSaturationMult,
  HEIST_BUYIN_PCT,
  HEIST_RP_DIVISOR,
  HEIST_TIERS,
  heistPayout,
  NIGHTCLUB_ACCRUAL_PER_BUSINESS,
  OFFICE_SALE_BONUS,
  PRODUCTION_PER_TICK,
  rankFromRp,
  RESIDUAL_CAP_BASE,
  RESIDUAL_CAP_WITH_AGENCY,
  RESIDUAL_PER_MISSION,
  RESIDUAL_PER_MISSION_WITH_AGENCY,
  rollLoot,
  SAFE_CAP,
  type PrepRequirement,
  skillBonus,
  skillLevel,
  STAFF_PRODUCTION_MULT,
  SUPPLY_MAX,
  SUPPLY_UNIT_COST,
  type BusinessType,
  type Difficulty,
  type HeistTier,
  type ObjectiveType,
} from "./economy";
import { ActivityDay } from "./models/ActivityDay";
import { Heist } from "./models/Heist";
import { LedgerEntry } from "./models/LedgerEntry";
import { Mission } from "./models/Mission";
import { MissionTemplate } from "./models/MissionTemplate";
import { OwnedAsset } from "./models/OwnedAsset";
import { Player } from "./models/Player";

// ---------------------------------------------------------------- shared

export interface CompletionResult {
  ok: boolean;
  error?: string;
  missionName?: string;
  cashDelta?: number;
  rpDelta?: number;
  rankUp?: boolean;
  newRank?: number;
  prepCompleted?: boolean;
  completed?: boolean; // false when a counter mission just incremented
  progress?: number;
  eliteAchieved?: boolean;
  /** Set when this mission ticked a prep of the active heist. */
  heistTick?: {
    prepName: string;
    progress: number;
    target: number;
    prepCompleted: boolean;
  };
}

/** Strip Mongoose internals: ObjectIds/Dates -> strings, plain JSON. */
export function serialize<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

export async function getPlayer() {
  await dbConnect();
  return Player.findOneAndUpdate(
    { _id: "player" },
    { $setOnInsert: { cash: 0, totalRp: 0, rank: 1 } },
    { upsert: true, returnDocument: "after" }
  );
}

async function netWorth(cash: number, safe: number): Promise<number> {
  const owned = await OwnedAsset.find({}).lean();
  let assets = 0;
  for (const o of owned) {
    assets += o.purchasePrice;
    const def = assetById(o.assetId);
    for (const upId of o.upgrades ?? []) {
      const up = def.upgrades?.find((u) => u.id === upId);
      if (up) assets += up.price;
    }
  }
  return cash + safe + assets;
}

async function appendLedger(opts: {
  type:
    | "MISSION_PAYOUT"
    | "HEIST_PAYOUT"
    | "STOCK_SALE"
    | "SAFE_COLLECT"
    | "ASSET_PURCHASE"
    | "UPGRADE_PURCHASE"
    | "SUPPLY_PURCHASE"
    | "HEIST_BUYIN";
  amountCash: number;
  amountRp?: number;
  refId?: string;
  note: string;
  balanceAfter: number;
  safeBalance: number;
}) {
  await LedgerEntry.create({
    type: opts.type,
    amountCash: opts.amountCash,
    amountRp: opts.amountRp ?? 0,
    refId: opts.refId,
    note: opts.note,
    balanceAfter: opts.balanceAfter,
    netWorthAfter: await netWorth(opts.balanceAfter, opts.safeBalance),
    dayKey: dayKey(),
  });
}

// ---------------------------------------------------------------- skills

type SkillMap = Record<string, number>;

/**
 * Payout bonus from the mission's businessType skill. Milestones at 30/60/90.
 * (Focus is earned from heist deep-work now, not missions.)
 */
function skillMultiplier(
  skills: SkillMap | undefined,
  businessType: BusinessType
): number {
  return 1 + skillBonus(skillLevel(skills?.[businessType] ?? 0));
}

// ---------------------------------------------------------------- missions

/** Lazily materialize today's daily + this week's weekly template instances. */
export async function ensurePeriodMissions(): Promise<void> {
  await dbConnect();
  const templates = await MissionTemplate.find({ active: true }).lean();
  if (templates.length === 0) return;
  const dk = dayKey();
  const wk = weekKey();
  const ops = [];
  for (const t of templates) {
    if (!t.schedule) continue;
    const periodKey = t.schedule.kind === "daily" ? dk : wk;
    const times = t.schedule.timesPerPeriod ?? 1;
    for (let slot = 0; slot < times; slot++) {
      ops.push({
        updateOne: {
          filter: { templateId: t._id, periodKey, slot },
          update: {
            $setOnInsert: {
              name: t.name,
              businessType: t.businessType,
              objectiveType: t.objectiveType,
              targetCount: t.targetCount,
              durationMinutes: t.durationMinutes,
              difficulty: t.difficulty,
              cashReward: t.cashReward,
              rpReward: t.rpReward,
              tickWeight: DIFFICULTY[t.difficulty as Difficulty].tickWeight,
              progress: 0,
              status: "open" as const,
              isOneOff: false,
            },
          },
          upsert: true,
        },
      });
    }
  }
  await Mission.bulkWrite(ops, { ordered: false });
}

export async function addOneOffMission(input: {
  name: string;
  businessType: BusinessType;
  objectiveType: ObjectiveType;
  difficulty: Difficulty;
  targetCount?: number;
  durationMinutes?: number;
  cashReward?: number;
  rpReward?: number;
}): Promise<string> {
  await dbConnect();
  const d = DIFFICULTY[input.difficulty];
  const doc = await Mission.create({
    name: input.name,
    businessType: input.businessType,
    objectiveType: input.objectiveType,
    targetCount: input.objectiveType === "counter" ? input.targetCount ?? 10 : undefined,
    durationMinutes: input.objectiveType === "timer" ? input.durationMinutes ?? 45 : undefined,
    difficulty: input.difficulty,
    cashReward: input.cashReward ?? d.cash,
    rpReward: input.rpReward ?? d.rp,
    tickWeight: d.tickWeight,
    periodKey: dayKey(),
    isOneOff: true,
  });
  return String(doc._id);
}

/** +1 on a counter mission; completes it when the target is reached. */
export async function incrementProgress(missionId: string): Promise<CompletionResult> {
  await dbConnect();
  const mission = await Mission.findOneAndUpdate(
    {
      _id: missionId,
      status: "open",
      objectiveType: "counter",
      $expr: { $lt: ["$progress", "$targetCount"] },
    },
    { $inc: { progress: 1 } },
    { returnDocument: "after" }
  );
  if (!mission) return { ok: false, error: "Mission not found or already done" };
  if ((mission.progress ?? 0) >= (mission.targetCount ?? Infinity)) {
    return completeMission(missionId);
  }
  return { ok: true, completed: false, progress: mission.progress ?? 0 };
}

/**
 * The heart of the game. One completed mission:
 * pays cash+RP -> bumps residuals -> credits the safe on the first completion
 * of the day -> delivers supply to its business -> ticks production everywhere
 * -> checks off a heist prep -> logs activity + ledger.
 */
export async function completeMission(missionId: string): Promise<CompletionResult> {
  await dbConnect();
  // Atomic flip guards against double payouts.
  const mission = await Mission.findOneAndUpdate(
    { _id: missionId, status: "open" },
    { $set: { status: "completed", completedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!mission) return { ok: false, error: "Mission not found or already done" };

  const player = await getPlayer();
  const owned = await OwnedAsset.find({}).lean();
  const ownedIds = new Set(owned.map((o) => o.assetId));

  // --- payout with gear buffs, verified-work premium and hard saturation
  const dk = dayKey();
  const mult = skillMultiplier(
    player.skills as unknown as SkillMap,
    mission.businessType as BusinessType
  );
  let cashMult = mult;
  let rpMult = mult;
  const isHard = mission.difficulty === "hard" && !mission.heistId;
  if (isHard) {
    const activity = await ActivityDay.findOne({ dayKey: dk }).lean();
    const sat = hardSaturationMult(activity?.hardCompleted ?? 0);
    cashMult *= sat;
    rpMult *= sat;
  }
  const cashDelta = Math.round(mission.cashReward * cashMult);
  const rpDelta = Math.round(mission.rpReward * rpMult);

  const prevRank = player.rank;
  player.cash += cashDelta;
  player.totalRp += rpDelta;
  player.rank = rankFromRp(player.totalRp);

  // --- skill growth: the mission's businessType (Focus grows from heists)
  const skills = player.skills as unknown as SkillMap;
  skills[mission.businessType] = (skills[mission.businessType] ?? 0) + mission.tickWeight;
  player.markModified("skills");

  // --- residuals (Agency doubles rate and cap)
  const hasAgency = ownedIds.has("agency");
  const residualCap = hasAgency ? RESIDUAL_CAP_WITH_AGENCY : RESIDUAL_CAP_BASE;
  const residualRate = hasAgency
    ? RESIDUAL_PER_MISSION_WITH_AGENCY
    : RESIDUAL_PER_MISSION;
  player.residualPerDay = Math.min(residualCap, player.residualPerDay + residualRate);

  // --- safe credit on the first completed mission of the day
  if (player.safeLastCreditedDayKey !== dk) {
    player.safeBalance = Math.min(SAFE_CAP, player.safeBalance + player.residualPerDay);
    player.safeLastCreditedDayKey = dk;
  }

  // --- supply delivery: matching business with the lowest supply bar
  const producing = owned.filter((o) => {
    const def = assetById(o.assetId);
    return def.class === "business" && def.businessType === mission.businessType;
  });
  producing.sort((a, b) => (a.supplyUnits ?? 0) - (b.supplyUnits ?? 0));
  const target = producing.find((o) => (o.supplyUnits ?? 0) < SUPPLY_MAX);
  if (target) {
    await OwnedAsset.updateOne({ _id: target._id }, { $inc: { supplyUnits: 1 } });
  }

  // --- production tick across the whole empire
  await tickProduction(mission.tickWeight, owned, target ? String(target._id) : null);

  // --- heist prep progress
  //
  // Heists are NOT fed by missions anymore. A heist is a deep-work TIME gate:
  // each prep has its own timer you sit through on the heist board (see
  // startPrepTimer/stopPrepTimer). Missions are discrete, checkable work —
  // they pay cash/RP/skills/supply but never move a heist. The only exception
  // is the legacy model where a prep WAS its own one-off mission.
  let prepCompleted = false;
  const heistTick: CompletionResult["heistTick"] = undefined;
  if (mission.heistId) {
    const res = await Heist.updateOne(
      { _id: mission.heistId, "preps.missionId": mission._id },
      {
        $set: {
          "preps.$.completed": true,
          "preps.$.completedAt": new Date(),
        },
      }
    );
    prepCompleted = res.modifiedCount > 0;
  }

  // --- activity + ledger
  await ActivityDay.updateOne(
    { dayKey: dk },
    {
      $inc: {
        missionsCompleted: 1,
        hardCompleted: isHard ? 1 : 0,
        cashEarned: cashDelta,
        rpEarned: rpDelta,
      },
    },
    { upsert: true }
  );

  await player.save();
  await appendLedger({
    type: "MISSION_PAYOUT",
    amountCash: cashDelta,
    amountRp: rpDelta,
    refId: String(mission._id),
    note: `Completed: ${mission.name}`,
    balanceAfter: player.cash,
    safeBalance: player.safeBalance,
  });

  return {
    ok: true,
    completed: true,
    missionName: mission.name,
    cashDelta,
    rpDelta,
    rankUp: player.rank > prevRank,
    newRank: player.rank,
    prepCompleted,
    heistTick,
  };
}

/**
 * Convert supplies to stock in every producing business. `deliveredToId`
 * receives its +1 supply before this runs (already persisted), so re-read
 * would be stale for it — we adjust in memory instead.
 */
interface OwnedLean {
  _id: unknown;
  assetId: string;
  supplyUnits?: number;
  stockUnits?: number;
  upgrades?: string[];
}

async function tickProduction(
  tickWeight: number,
  owned: OwnedLean[],
  deliveredToId: string | null
) {
  const businesses = owned.filter((o) => assetById(o.assetId).class === "business");
  const producingCount = businesses.filter(
    (o) => !assetById(o.assetId).isNightclub && assetById(o.assetId).businessType
  ).length;

  for (const biz of businesses) {
    const def = assetById(biz.assetId);
    const staff = (biz.upgrades ?? []).includes("staff");
    const speed = staff ? STAFF_PRODUCTION_MULT : 1;
    const cap = def.stockCap ?? 0;
    let supply = biz.supplyUnits ?? 0;
    if (deliveredToId && String(biz._id) === deliveredToId) supply += 1;
    const stock = biz.stockUnits ?? 0;

    if (def.isNightclub) {
      // Aggregator: accrues from every other producing business, no supplies.
      const others = producingCount;
      if (others === 0 || stock >= cap) continue;
      const accrued = Math.min(
        cap - stock,
        NIGHTCLUB_ACCRUAL_PER_BUSINESS * tickWeight * others * speed
      );
      if (accrued > 0) {
        await OwnedAsset.updateOne({ _id: biz._id }, { $inc: { stockUnits: accrued } });
      }
      continue;
    }

    if (!def.businessType || supply <= 0 || stock >= cap) continue;
    const produced = Math.min(
      supply,
      cap - stock,
      PRODUCTION_PER_TICK * tickWeight * speed
    );
    if (produced <= 0) continue;
    await OwnedAsset.updateOne(
      { _id: biz._id },
      { $inc: { stockUnits: produced, supplyUnits: -produced } }
    );
  }
}

// ---------------------------------------------------------------- empire

export async function buySupplies(assetId: string): Promise<CompletionResult> {
  await dbConnect();
  const ownedBiz = await OwnedAsset.findOne({ assetId });
  if (!ownedBiz) return { ok: false, error: "Business not owned" };
  const missing = SUPPLY_MAX - (ownedBiz.supplyUnits ?? 0);
  if (missing <= 0.01) return { ok: false, error: "Supplies already full" };
  // Proportional: topping up a quarter-bar costs a quarter of the full price.
  const cost = Math.round(missing * SUPPLY_UNIT_COST);
  const player = await getPlayer();
  if (player.cash < cost) {
    return { ok: false, error: `Not enough cash — need $${cost.toLocaleString("en-US")}` };
  }
  player.cash -= cost;
  ownedBiz.supplyUnits = SUPPLY_MAX;
  await ownedBiz.save();
  await player.save();
  await appendLedger({
    type: "SUPPLY_PURCHASE",
    amountCash: -cost,
    refId: assetId,
    note: `Supplies: ${assetById(assetId).name}`,
    balanceAfter: player.cash,
    safeBalance: player.safeBalance,
  });
  return { ok: true, cashDelta: -cost };
}

export async function sellStock(assetId: string): Promise<CompletionResult> {
  await dbConnect();
  const ownedBiz = await OwnedAsset.findOne({ assetId });
  if (!ownedBiz) return { ok: false, error: "Business not owned" };
  const def = assetById(assetId);
  const units = Math.floor(ownedBiz.stockUnits ?? 0);
  if (units < 1) return { ok: false, error: "Nothing to sell" };

  const equipment = (ownedBiz.upgrades ?? []).includes("equipment");
  const cap = def.stockCap ?? 1;
  const fullness = 1 + FULLNESS_BONUS_MAX * ((ownedBiz.stockUnits ?? 0) / cap);
  const ownedIds = new Set((await OwnedAsset.find({}).lean()).map((o) => o.assetId));
  const officeBonus =
    ownedIds.has("maze-bank-west") || ownedIds.has("maze-bank-tower")
      ? 1 + OFFICE_SALE_BONUS
      : 1;
  const value = Math.round(
    units *
      (def.unitValue ?? 0) *
      (equipment ? EQUIPMENT_VALUE_MULT : 1) *
      fullness *
      officeBonus
  );

  const player = await getPlayer();
  player.cash += value;
  ownedBiz.stockUnits = 0;
  ownedBiz.totalEarned = (ownedBiz.totalEarned ?? 0) + value;
  await ownedBiz.save();
  await player.save();
  await appendLedger({
    type: "STOCK_SALE",
    amountCash: value,
    refId: assetId,
    note: `Sold ${units} units: ${def.name}`,
    balanceAfter: player.cash,
    safeBalance: player.safeBalance,
  });
  return { ok: true, cashDelta: value };
}

export async function buyAsset(assetId: string): Promise<CompletionResult> {
  await dbConnect();
  const def = assetById(assetId);
  const existing = await OwnedAsset.findOne({ assetId });
  if (existing) return { ok: false, error: "Already owned" };

  const player = await getPlayer();
  if (player.cash < def.price) return { ok: false, error: "Not enough cash" };
  if (def.requiredRank && player.rank < def.requiredRank) {
    return { ok: false, error: `Requires rank ${def.requiredRank}` };
  }

  const owned = await OwnedAsset.find({}).lean();

  if (def.requiresBusinessCount) {
    const count = owned.filter((o) => assetById(o.assetId).class === "business").length;
    if (count < def.requiresBusinessCount) {
      return { ok: false, error: `Requires owning ${def.requiresBusinessCount} businesses` };
    }
  }

  player.cash -= def.price;
  await OwnedAsset.create({
    assetId,
    class: def.class,
    purchasePrice: def.price,
    supplyUnits: 0,
    stockUnits: 0,
  });
  await player.save();
  await appendLedger({
    type: "ASSET_PURCHASE",
    amountCash: -def.price,
    refId: assetId,
    note: `Purchased: ${def.name}`,
    balanceAfter: player.cash,
    safeBalance: player.safeBalance,
  });
  if (player.pinnedGoalAssetId === assetId) {
    player.pinnedGoalAssetId = null;
    await player.save();
  }
  return { ok: true, cashDelta: -def.price };
}

export async function buyUpgrade(
  assetId: string,
  upgradeId: string
): Promise<CompletionResult> {
  await dbConnect();
  const def = assetById(assetId);
  const upgrade = def.upgrades?.find((u) => u.id === upgradeId);
  if (!upgrade) return { ok: false, error: "Unknown upgrade" };
  const ownedAsset = await OwnedAsset.findOne({ assetId });
  if (!ownedAsset) return { ok: false, error: "Asset not owned" };
  if ((ownedAsset.upgrades ?? []).includes(upgradeId)) {
    return { ok: false, error: "Already installed" };
  }
  const player = await getPlayer();
  if (player.cash < upgrade.price) return { ok: false, error: "Not enough cash" };
  player.cash -= upgrade.price;
  ownedAsset.upgrades.push(upgradeId);
  await ownedAsset.save();
  await player.save();
  await appendLedger({
    type: "UPGRADE_PURCHASE",
    amountCash: -upgrade.price,
    refId: assetId,
    note: `${def.name}: ${upgrade.name}`,
    balanceAfter: player.cash,
    safeBalance: player.safeBalance,
  });
  return { ok: true, cashDelta: -upgrade.price };
}

export async function collectSafe(): Promise<CompletionResult> {
  await dbConnect();
  const player = await getPlayer();
  const amount = Math.round(player.safeBalance);
  if (amount < 1) return { ok: false, error: "Safe is empty" };
  player.cash += amount;
  player.safeBalance = 0;
  await player.save();
  await appendLedger({
    type: "SAFE_COLLECT",
    amountCash: amount,
    note: "Collected the safe",
    balanceAfter: player.cash,
    safeBalance: 0,
  });
  return { ok: true, cashDelta: amount };
}

export async function setPinnedGoal(assetId: string | null): Promise<void> {
  await dbConnect();
  const player = await getPlayer();
  player.pinnedGoalAssetId = assetId;
  await player.save();
}

// ---------------------------------------------------------------- heists

export async function startHeist(input: {
  name: string;
  templateId?: string;
  tier: HeistTier;
  finaleName: string;
  preps: {
    name: string;
    kind: "mandatory" | "optional";
    flavor?: string;
    requirement: PrepRequirement;
    target: number;
  }[];
}): Promise<{
  ok: boolean;
  error?: string;
  heistId?: string;
  loot?: { kind: string; multiplier: number };
}> {
  await dbConnect();
  const tierDef = HEIST_TIERS[input.tier];

  const active = await Heist.findOne({ status: { $in: ["scoping", "active"] } });
  if (active) return { ok: false, error: "Finish your current heist first" };

  if (tierDef.requiresAssetId) {
    const gate = await OwnedAsset.findOne({ assetId: tierDef.requiresAssetId });
    if (!gate) {
      return {
        ok: false,
        error: `Requires: ${assetById(tierDef.requiresAssetId).name}`,
      };
    }
  }

  const buyIn = Math.round(tierDef.basePayout * HEIST_BUYIN_PCT);
  const player = await getPlayer();
  if (player.cash < buyIn) return { ok: false, error: "Not enough cash for the buy-in" };

  player.cash -= buyIn;
  // Scoping happens at start: the crew cases the target while you sign on,
  // so the board opens armed — one less dead click.
  const loot = rollLoot(input.tier, Math.random());
  const heist = await Heist.create({
    name: input.name,
    templateId: input.templateId,
    tier: input.tier,
    status: "active",
    loot: { kind: loot.kind, multiplier: loot.multiplier },
    buyIn,
    basePayout: tierDef.basePayout,
    // Preps are counters — regular missions completed while the heist is
    // active fill them (see completeMission). No separate prep missions.
    preps: input.preps.map((p) => ({
      name: p.name,
      flavor: p.flavor,
      requirement: p.requirement,
      target: Math.max(1, Math.round(p.target)),
      progress: 0,
      kind: p.kind,
      completed: false,
    })),
    finaleName: input.finaleName,
    hardMode: false,
  });
  await player.save();
  await appendLedger({
    type: "HEIST_BUYIN",
    amountCash: -buyIn,
    refId: String(heist._id),
    note: `Heist buy-in: ${input.name}`,
    balanceAfter: player.cash,
    safeBalance: player.safeBalance,
  });
  return {
    ok: true,
    heistId: String(heist._id),
    loot: { kind: loot.kind, multiplier: loot.multiplier },
  };
}

/** Bank a running prep's elapsed minutes (capped at its target) and stop it. */
function bankPrep(
  prep: {
    runningSince?: Date | null;
    progress?: number | null;
    target?: number | null;
    completed?: boolean | null;
    completedAt?: Date | null;
  },
  now: Date
): number {
  if (!prep.runningSince) return 0;
  const elapsedMin = (now.getTime() - prep.runningSince.getTime()) / 60000;
  const target = prep.target ?? 1;
  // Cap at the prep's remaining need: leaving a timer running overnight can at
  // most complete the one prep it's on, never overfill or bleed into others.
  const add = Math.max(0, Math.min(target - (prep.progress ?? 0), elapsedMin));
  prep.progress = (prep.progress ?? 0) + add;
  prep.runningSince = null;
  if ((prep.progress ?? 0) >= target) {
    prep.completed = true;
    prep.completedAt = now;
  }
  return add;
}

/**
 * Start the deep-work timer on one prep. Only one prep runs at a time —
 * starting a new one banks whatever was running elsewhere. The timer lives in
 * the DB (runningSince), so it keeps counting across reloads: this is the
 * "sit through it" time that gates the finale.
 */
export async function startPrepTimer(
  heistId: string,
  prepId: string
): Promise<CompletionResult> {
  await dbConnect();
  const heist = await Heist.findOne({ _id: heistId, status: "active" });
  if (!heist) return { ok: false, error: "Heist not active" };
  const now = new Date();
  for (const p of heist.preps) {
    if (p.runningSince && String(p._id) !== prepId) bankPrep(p, now);
  }
  const prep = heist.preps.id(prepId);
  if (!prep) return { ok: false, error: "Prep not found" };
  if (prep.completed) return { ok: false, error: "Prep already done" };
  prep.runningSince = now;
  await heist.save();
  return { ok: true };
}

/** Pause/stop a prep's timer: bank the elapsed minutes and grow Focus. */
export async function stopPrepTimer(
  heistId: string,
  prepId: string
): Promise<CompletionResult> {
  await dbConnect();
  const heist = await Heist.findOne({ _id: heistId, status: "active" });
  if (!heist) return { ok: false, error: "Heist not active" };
  const prep = heist.preps.id(prepId);
  if (!prep) return { ok: false, error: "Prep not found" };
  const banked = bankPrep(prep, new Date());
  await heist.save();

  // Deep work is a heist thing now: it grows Focus and logs to the day's
  // deep-work total (feeds /stats and /character).
  if (banked > 0) {
    const player = await getPlayer();
    const skills = player.skills as unknown as SkillMap;
    skills.focus = (skills.focus ?? 0) + banked / 45;
    player.markModified("skills");
    await player.save();
    await ActivityDay.updateOne(
      { dayKey: dayKey() },
      { $inc: { deepWorkMinutes: banked } },
      { upsert: true }
    );
  }

  return {
    ok: true,
    prepCompleted: Boolean(prep.completed),
    progress: prep.progress ?? 0,
    heistTick: {
      prepName: prep.flavor ?? prep.name,
      progress: prep.progress ?? 0,
      target: prep.target ?? 1,
      prepCompleted: Boolean(prep.completed),
    },
  };
}

async function checkElite(heist: {
  createdAt?: Date;
  tier: string;
  preps: { completed?: boolean | null }[];
}): Promise<boolean> {
  const allPreps = heist.preps.every((p) => p.completed);
  if (!allPreps) return false;
  const created = heist.createdAt ?? new Date();
  const days = Math.floor(hoursBetween(created, new Date()) / 24);
  if (days > ELITE_WINDOW_DAYS[heist.tier as HeistTier]) return false;
  // Every day of the heist's run must have at least one completed mission.
  for (let i = 0; i <= days; i++) {
    const d = new Date(created.getTime() + i * 24 * 60 * 60 * 1000);
    const activity = await ActivityDay.findOne({ dayKey: dayKey(d) }).lean();
    if (!activity || activity.missionsCompleted < 1) return false;
  }
  return true;
}

export async function finishHeist(heistId: string): Promise<CompletionResult> {
  await dbConnect();
  const heist = await Heist.findOne({ _id: heistId, status: "active" });
  if (!heist) return { ok: false, error: "Heist not found or not active" };

  const mandatoryLeft = heist.preps.filter((p) => p.kind === "mandatory" && !p.completed);
  if (mandatoryLeft.length > 0) {
    return { ok: false, error: `${mandatoryLeft.length} mandatory preps left` };
  }

  const optionalDone = heist.preps.filter(
    (p) => p.kind === "optional" && p.completed
  ).length;
  const elite = await checkElite(heist);
  const player = await getPlayer();
  const repBonus = skillBonus(
    skillLevel((player.skills as unknown as SkillMap)?.reputation ?? 0)
  );
  const payout = Math.round(
    heistPayout({
      basePayout: heist.basePayout,
      lootMultiplier: heist.loot?.multiplier ?? 1,
      optionalPrepsDone: optionalDone,
      hardMode: heist.hardMode,
      elite,
    }) *
      (1 + repBonus)
  );
  const rp = Math.round(payout / HEIST_RP_DIVISOR);

  const prevRank = player.rank;
  player.cash += payout;
  player.totalRp += rp;
  player.rank = rankFromRp(player.totalRp);

  // Reputation grows with the size of the score (1-4 by tier).
  const repGain = { small: 1, medium: 2, big: 3, cayo: 4 }[heist.tier as HeistTier];
  const pSkills = player.skills as unknown as SkillMap;
  pSkills.reputation = (pSkills.reputation ?? 0) + repGain;
  player.markModified("skills");

  heist.status = "completed";
  heist.payout = payout;
  heist.eliteAchieved = elite;
  heist.completedAt = new Date();

  // Open (unfinished optional) preps disappear from the board with the heist.
  await Mission.updateMany(
    { heistId: heist._id, status: "open" },
    { $set: { status: "completed", completedAt: new Date() } }
  );

  await heist.save();
  await player.save();
  await appendLedger({
    type: "HEIST_PAYOUT",
    amountCash: payout,
    amountRp: rp,
    refId: String(heist._id),
    note: `Heist finale: ${heist.name}${elite ? " (ELITE)" : ""}${heist.hardMode ? " [HARD]" : ""}`,
    balanceAfter: player.cash,
    safeBalance: player.safeBalance,
  });

  return {
    ok: true,
    completed: true,
    missionName: heist.name,
    cashDelta: payout,
    rpDelta: rp,
    rankUp: player.rank > prevRank,
    newRank: player.rank,
    eliteAchieved: elite,
  };
}

export async function archiveHeist(heistId: string): Promise<void> {
  await dbConnect();
  await Heist.updateOne(
    { _id: heistId, status: { $in: ["scoping", "active"] } },
    { $set: { status: "archived" } }
  );
  await Mission.deleteMany({ heistId, status: "open" });
}
