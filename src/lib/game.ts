/**
 * All domain logic. Server actions are thin wrappers over these functions.
 * Single-user app on standalone Mongo: no multi-doc transactions, but every
 * payout is guarded by an atomic status flip so double-clicks can't double-pay.
 */
import { dbConnect } from "./db";
import { dayKey, weekKey, hoursBetween } from "./dates";
import {
  ASSET_CATALOG,
  assetById,
  DIFFICULTY,
  EQUIPMENT_VALUE_MULT,
  FULLNESS_BONUS_MAX,
  HARD_MODE_WINDOW_HOURS,
  hardSaturationMult,
  TIMER_PREMIUM,
  HEIST_BUYIN_PCT,
  HEIST_RP_DIVISOR,
  HEIST_TIERS,
  heistPayout,
  NIGHTCLUB_ACCRUAL_PER_BUSINESS,
  OFFICE_SALE_BONUS,
  PREP_PAYOUT,
  PRODUCTION_PER_TICK,
  rankFromRp,
  RESIDUAL_CAP_BASE,
  RESIDUAL_CAP_WITH_AGENCY,
  RESIDUAL_PER_MISSION,
  RESIDUAL_PER_MISSION_WITH_AGENCY,
  rollLoot,
  SAFE_CAP,
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
 * Payout bonus from earned skills: the mission's businessType skill, plus
 * Focus for timer missions. Milestones at level 30/60/90.
 */
function skillMultiplier(
  skills: SkillMap | undefined,
  businessType: BusinessType,
  objectiveType: ObjectiveType
): number {
  let bonus = skillBonus(skillLevel(skills?.[businessType] ?? 0));
  if (objectiveType === "timer") {
    bonus += skillBonus(skillLevel(skills?.focus ?? 0));
  }
  return 1 + bonus;
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
    mission.businessType as BusinessType,
    mission.objectiveType as ObjectiveType
  );
  let cashMult = mult;
  let rpMult = mult;
  if (mission.objectiveType === "timer") {
    cashMult *= TIMER_PREMIUM;
    rpMult *= TIMER_PREMIUM;
  }
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

  // --- skill growth (work is the only source)
  const skills = player.skills as unknown as SkillMap;
  skills[mission.businessType] = (skills[mission.businessType] ?? 0) + mission.tickWeight;
  if (mission.objectiveType === "timer") {
    skills.focus = (skills.focus ?? 0) + (mission.durationMinutes ?? 0) / 45;
  }
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

  // --- heist prep
  let prepCompleted = false;
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
        deepWorkMinutes:
          mission.objectiveType === "timer" ? mission.durationMinutes ?? 0 : 0,
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

export function garageCapacity(ownedIds: Set<string>): {
  garage: number;
  aircraft: number;
} {
  let garage = 0;
  let aircraft = 0;
  for (const id of ownedIds) {
    const def = assetById(id);
    garage += def.garageSlots ?? 0;
    aircraft += def.aircraftSlots ?? 0;
  }
  return { garage, aircraft };
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
  const ownedIds = new Set(owned.map((o) => o.assetId));

  if (def.requiresBusinessCount) {
    const count = owned.filter((o) => assetById(o.assetId).class === "business").length;
    if (count < def.requiresBusinessCount) {
      return { ok: false, error: `Requires owning ${def.requiresBusinessCount} businesses` };
    }
  }

  if (def.class === "vehicle") {
    const capacity = garageCapacity(ownedIds);
    const vehicles = owned.filter((o) => assetById(o.assetId).class === "vehicle");
    const isAircraft = def.vehicleClass === "Aircraft";
    const used = vehicles.filter(
      (o) => (assetById(o.assetId).vehicleClass === "Aircraft") === isAircraft
    ).length;
    const max = isAircraft ? capacity.aircraft : capacity.garage;
    if (used >= max) {
      return {
        ok: false,
        error: isAircraft
          ? "No hangar space — buy a hangar"
          : "No garage space — buy a property with slots",
      };
    }
  }

  player.cash -= def.price;
  const isFirstVehicle =
    def.class === "vehicle" &&
    !owned.some((o) => assetById(o.assetId).class === "vehicle");
  await OwnedAsset.create({
    assetId,
    class: def.class,
    purchasePrice: def.price,
    supplyUnits: 0,
    stockUnits: 0,
    isDailyDriver: isFirstVehicle,
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

export async function setDailyDriver(assetId: string): Promise<void> {
  await dbConnect();
  await OwnedAsset.updateMany({ class: "vehicle" }, { $set: { isDailyDriver: false } });
  await OwnedAsset.updateOne(
    { assetId, class: "vehicle" },
    { $set: { isDailyDriver: true } }
  );
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
  tier: HeistTier;
  finaleName: string;
  preps: { name: string; kind: "mandatory" | "optional" }[];
}): Promise<{ ok: boolean; error?: string; heistId?: string }> {
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

  // Hard mode: re-committing within 24h of the last finale.
  const lastDone = await Heist.findOne({ status: "completed" }).sort({ completedAt: -1 });
  const hardMode = Boolean(
    lastDone?.completedAt && hoursBetween(lastDone.completedAt, new Date()) <= HARD_MODE_WINDOW_HOURS
  );

  player.cash -= buyIn;
  const heist = await Heist.create({
    name: input.name,
    tier: input.tier,
    status: "scoping",
    buyIn,
    basePayout: tierDef.basePayout,
    preps: [],
    finaleName: input.finaleName,
    hardMode,
  });

  // Each prep is a real one-off mission wired to the heist.
  const preps = [];
  for (const prep of input.preps) {
    const missionDoc = await Mission.create({
      name: prep.name,
      businessType: "admin",
      objectiveType: "checkbox",
      difficulty: "easy",
      cashReward: PREP_PAYOUT.cash,
      rpReward: PREP_PAYOUT.rp,
      tickWeight: PREP_PAYOUT.tickWeight,
      periodKey: dayKey(),
      isOneOff: true,
      heistId: heist._id,
      prepKind: prep.kind,
    });
    preps.push({
      missionId: missionDoc._id,
      name: prep.name,
      kind: prep.kind,
      completed: false,
    });
  }
  heist.preps.push(...preps);
  await heist.save();
  await player.save();
  await appendLedger({
    type: "HEIST_BUYIN",
    amountCash: -buyIn,
    refId: String(heist._id),
    note: `Heist buy-in: ${input.name}`,
    balanceAfter: player.cash,
    safeBalance: player.safeBalance,
  });
  return { ok: true, heistId: String(heist._id) };
}

/** Scope out: rolls the loot and activates the board. */
export async function scopeHeist(
  heistId: string
): Promise<{ ok: boolean; error?: string; loot?: { kind: string; multiplier: number } }> {
  await dbConnect();
  const heist = await Heist.findOne({ _id: heistId, status: "scoping" });
  if (!heist) return { ok: false, error: "Heist not found or already scoped" };
  const loot = rollLoot(heist.tier as HeistTier, Math.random());
  heist.loot = { kind: loot.kind, multiplier: loot.multiplier };
  heist.status = "active";
  await heist.save();
  return { ok: true, loot: { kind: loot.kind, multiplier: loot.multiplier } };
}

async function checkElite(heist: {
  createdAt?: Date;
  preps: { completed?: boolean | null }[];
}): Promise<boolean> {
  const allPreps = heist.preps.every((p) => p.completed);
  if (!allPreps) return false;
  const created = heist.createdAt ?? new Date();
  const days = Math.floor(hoursBetween(created, new Date()) / 24);
  if (days > 7) return false;
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
