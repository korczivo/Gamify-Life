/**
 * THE tuning surface. Every number in the game economy lives in this file:
 * mission payouts, rank curve, residuals, production rates, heist formulas
 * and the full asset catalog (real GTA$ prices).
 *
 * Owned assets snapshot price/params at purchase time, so retuning here
 * never corrupts history.
 */

// ---------------------------------------------------------------- missions

export type BusinessType = "marketing" | "content" | "dev" | "admin";
export type Difficulty = "easy" | "medium" | "hard";
export type ObjectiveType = "checkbox" | "counter" | "timer";

/** Payout defaults per difficulty. A solid day of work ≈ $80–120k. */
export const DIFFICULTY: Record<
  Difficulty,
  { cash: number; rp: number; tickWeight: number }
> = {
  easy: { cash: 8_000, rp: 60, tickWeight: 0.5 },
  medium: { cash: 20_000, rp: 150, tickWeight: 1 },
  hard: { cash: 50_000, rp: 400, tickWeight: 2 },
};

/**
 * Market saturation on hard missions (GTA-style cooldown economics):
 * spamming "hard" stops paying. First 2 hards a day pay full,
 * the next 2 pay half, anything beyond a quarter.
 */
export function hardSaturationMult(hardCompletedToday: number): number {
  if (hardCompletedToday < 2) return 1;
  if (hardCompletedToday < 4) return 0.5;
  return 0.25;
}

// ---------------------------------------------------------------- rank

export function rankFromRp(rp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, rp) / 80)) + 1;
}

export function rpForRank(rank: number): number {
  return 80 * (rank - 1) ** 2;
}

// ---------------------------------------------------------------- residuals

/**
 * Agency-style residuals: every completed mission permanently raises the
 * daily safe income. The safe only accrues on days you completed >= 1 mission.
 */
export const RESIDUAL_PER_MISSION = 100;
export const RESIDUAL_CAP_BASE = 10_000; // per day
export const RESIDUAL_CAP_WITH_AGENCY = 20_000; // owning the Agency raises the cap
export const RESIDUAL_PER_MISSION_WITH_AGENCY = 200;
export const SAFE_CAP = 250_000;

// ---------------------------------------------------------------- production

export const SUPPLY_MAX = 5;
/** Stock units produced (and supplies consumed) per tick-weight unit. */
export const PRODUCTION_PER_TICK = 0.5;
export const STAFF_PRODUCTION_MULT = 1.4;
export const EQUIPMENT_VALUE_MULT = 1.5;
/** Selling a fuller warehouse pays more per unit: 1 + 0.5 * stock/cap. */
export const FULLNESS_BONUS_MAX = 0.5;
/** Owning any CEO office adds a global bonus to stock sales. */
export const OFFICE_SALE_BONUS = 0.05;
/**
 * Buying supplies is a deliberately BAD deal — an emergency shortcut, not a
 * strategy. At $40k/unit it's at or above what the produced stock sells for
 * in most businesses; the real resupply channel is completing missions.
 */
export const SUPPLY_UNIT_COST = 40_000;
/** Nightclub accrues this much stock per tick-weight per other owned business. */
export const NIGHTCLUB_ACCRUAL_PER_BUSINESS = 0.1;

// ---------------------------------------------------------------- heists

export type HeistTier = "small" | "medium" | "big" | "cayo";

export const HEIST_TIERS: Record<
  HeistTier,
  { basePayout: number; label: string; requiresAssetId?: string }
> = {
  small: { basePayout: 200_000, label: "Small Job" },
  medium: { basePayout: 500_000, label: "Heist", requiresAssetId: "eclipse-towers" },
  big: { basePayout: 1_000_000, label: "Big Score", requiresAssetId: "the-facility" },
  cayo: { basePayout: 1_500_000, label: "Island Job", requiresAssetId: "kosatka" },
};

export const HEIST_BUYIN_PCT = 0.1;
export const OPTIONAL_PREP_BONUS = 0.1; // per completed optional prep
export const ELITE_BONUS = 0.15;
/** Legacy multiplier — hard mode is retired, kept for old heists' payout math. */
export const HARD_MODE_MULT = 1.25;
export const HEIST_RP_DIVISOR = 100; // rp = payout / 100

/**
 * Elite window scales with tier: bigger scores take more missions, so they
 * get more days. (Elite also requires no day skipped — see checkElite.)
 */
export const ELITE_WINDOW_DAYS: Record<HeistTier, number> = {
  small: 3,
  medium: 7,
  big: 10,
  cayo: 14,
};

/**
 * What fuels a heist prep. Preps are counters filled by completing regular
 * missions — the heist is a meta-layer over the daily grind, like GTA preps
 * were regular gameplay. "deepwork" counts timer missions of any type.
 */
export type PrepRequirement = BusinessType | "deepwork";

export const PREP_REQUIREMENTS: { key: PrepRequirement; label: string }[] = [
  { key: "marketing", label: "Marketing" },
  { key: "content", label: "Content" },
  { key: "dev", label: "Dev" },
  { key: "admin", label: "Admin" },
  { key: "deepwork", label: "Deep Work" },
];

export function prepRequirementLabel(key: string): string {
  return PREP_REQUIREMENTS.find((r) => r.key === key)?.label ?? key;
}

/** "45m", "1h 30m" — preps and heist gates are measured in deep-work time. */
export function formatMinutes(m: number): string {
  const mins = Math.max(0, Math.round(m));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** Deep-work minutes the mandatory preps demand — the real time gate. */
export function heistMandatoryMinutes(
  preps: { kind: string; minutes?: number; target?: number }[]
): number {
  return preps
    .filter((p) => p.kind === "mandatory")
    .reduce((s, p) => s + (p.minutes ?? p.target ?? 0), 0);
}

export interface LootRoll {
  kind: string;
  multiplier: number;
  weight: number;
}

export const LOOT_TABLE: LootRoll[] = [
  { kind: "Cash", multiplier: 1.0, weight: 55 },
  { kind: "Artwork", multiplier: 1.15, weight: 25 },
  { kind: "Gold", multiplier: 1.3, weight: 13 },
  { kind: "Pink Diamond", multiplier: 1.5, weight: 7 },
];

/** Cayo tier rolls from a richer table. */
export const LOOT_TABLE_CAYO: LootRoll[] = [
  { kind: "Cash", multiplier: 1.0, weight: 40 },
  { kind: "Artwork", multiplier: 1.15, weight: 25 },
  { kind: "Gold", multiplier: 1.3, weight: 18 },
  { kind: "Pink Diamond", multiplier: 1.5, weight: 12 },
  { kind: "Panther Statue", multiplier: 1.75, weight: 5 },
];

export function rollLoot(tier: HeistTier, random: number): LootRoll {
  const table = tier === "cayo" ? LOOT_TABLE_CAYO : LOOT_TABLE;
  const total = table.reduce((s, l) => s + l.weight, 0);
  let r = random * total;
  for (const loot of table) {
    r -= loot.weight;
    if (r <= 0) return loot;
  }
  return table[0];
}

export function heistPayout(opts: {
  basePayout: number;
  lootMultiplier: number;
  optionalPrepsDone: number;
  hardMode: boolean;
  elite: boolean;
}): number {
  let payout =
    opts.basePayout *
    opts.lootMultiplier *
    (1 + OPTIONAL_PREP_BONUS * opts.optionalPrepsDone);
  if (opts.hardMode) payout *= HARD_MODE_MULT;
  if (opts.elite) payout *= 1 + ELITE_BONUS;
  return Math.round(payout);
}

// ---------------------------------------------------------------- heist templates

/**
 * Predefined heists: an authentic GTA identity (name, art, prep flavor)
 * wrapped around a real time investment. Preps are DEEP-WORK TIME BLOCKS —
 * only timer missions (verified, sat-through work) fill them, so a heist
 * can't run faster than the hours you actually put in. Checkboxes don't count:
 * the big score is gated by time, the one resource you can't fake or spam.
 */
export interface HeistTemplatePrep {
  /** Authentic GTA prep name, shown on the polaroid. */
  flavor: string;
  /** What the block stands for in real work (editable at start). */
  task: string;
  /** Deep-work minutes this segment demands. */
  minutes: number;
  kind: "mandatory" | "optional";
}

export interface HeistTemplateDef {
  id: string;
  name: string;
  tier: HeistTier;
  /** Which real-work playbook this heist packages. */
  tagline: string;
  finaleName: string;
  preps: HeistTemplatePrep[];
}

export const HEIST_TEMPLATES: HeistTemplateDef[] = [
  {
    id: "fleeca-job",
    name: "The Fleeca Job",
    tier: "small",
    tagline: "Quick sales raid — 90 min of focused outreach",
    finaleName: "CLOSE THE LEADS",
    preps: [
      { flavor: "Scope Out", task: "Lead research", minutes: 45, kind: "mandatory" },
      { flavor: "Kuruma", task: "Focused outreach block", minutes: 45, kind: "mandatory" },
    ],
  },
  {
    id: "prison-break",
    name: "The Prison Break",
    tier: "medium",
    tagline: "Ship a YouTube video — ~4h, script to publish",
    finaleName: "PUBLISH",
    preps: [
      { flavor: "Station", task: "Script writing", minutes: 90, kind: "mandatory" },
      { flavor: "Plane", task: "Recording", minutes: 90, kind: "mandatory" },
      { flavor: "Bus", task: "Editing", minutes: 60, kind: "mandatory" },
    ],
  },
  {
    id: "pacific-standard",
    name: "The Pacific Standard Job",
    tier: "medium",
    tagline: "Content blitz — ~4h of SEO writing",
    finaleName: "HIT PUBLISH ON EVERYTHING",
    preps: [
      { flavor: "Signal", task: "Keyword research", minutes: 60, kind: "mandatory" },
      { flavor: "Vans", task: "SEO post #1", minutes: 90, kind: "mandatory" },
      { flavor: "Hack", task: "SEO post #2", minutes: 90, kind: "mandatory" },
    ],
  },
  {
    id: "doomsday",
    name: "The Doomsday Heist",
    tier: "big",
    tagline: "Launch week — ~8h of deep work",
    finaleName: "LAUNCH DAY",
    preps: [
      { flavor: "Paramedic Equipment", task: "Landing page + launch post", minutes: 120, kind: "mandatory" },
      { flavor: "Khanjali", task: "Final build + polish", minutes: 180, kind: "mandatory" },
      { flavor: "Air Defenses", task: "Line up launch channels", minutes: 180, kind: "mandatory" },
    ],
  },
  {
    id: "cayo-perico",
    name: "The Cayo Perico Heist",
    tier: "cayo",
    tagline: "Ship a feature — ~12h, zero to deploy",
    finaleName: "DEPLOY",
    preps: [
      { flavor: "Gather Intel", task: "Spec + research", minutes: 180, kind: "mandatory" },
      { flavor: "Approach Vehicle", task: "Build it", minutes: 300, kind: "mandatory" },
      { flavor: "Equipment", task: "Tests + bug fixes", minutes: 240, kind: "mandatory" },
    ],
  },
];

export function heistTemplateById(id: string): HeistTemplateDef | undefined {
  return HEIST_TEMPLATES.find((t) => t.id === id);
}

// ---------------------------------------------------------------- catalog

export type AssetClass = "business" | "property" | "gear";

export interface UpgradeDef {
  id: string;
  name: string;
  price: number;
  /** Human-readable effect line shown in the UI. */
  effect: string;
}

export interface AssetDef {
  id: string;
  name: string;
  tagline: string;
  class: AssetClass;
  price: number;
  requiredRank?: number;
  /** Position on the 8192x8192 Los Santos map (x right, y down). */
  map?: { x: number; y: number; blip: string };
  art?: string; // path under /public

  // business
  businessType?: BusinessType; // which mission type resupplies it
  stockCap?: number;
  unitValue?: number;
  isNightclub?: boolean; // aggregator: accrues from other owned businesses
  requiresBusinessCount?: number;

  // property
  unlocks?: string; // human-readable unlock line

  // wardrobe card display
  emoji?: string;

  upgrades?: UpgradeDef[];
}

export const ASSET_CATALOG: AssetDef[] = [
  // ---------------- businesses (one per mission type + the aggregator)
  {
    id: "cargo-warehouse",
    name: "Special Cargo Warehouse",
    tagline: "La Mesa · fed by Admin missions",
    class: "business",
    price: 250_000,
    businessType: "admin",
    stockCap: 16,
    unitValue: 10_000,
    map: { x: 4650, y: 6320, blip: "warehouse" },
    upgrades: [
      { id: "staff", name: "Warehouse Staff", price: 90_000, effect: "+40% production speed" },
      { id: "equipment", name: "Logistics Equipment", price: 140_000, effect: "+50% cargo value" },
    ],
  },
  {
    id: "forgery-office",
    name: "Document Forgery Office",
    tagline: "Grapeseed · fed by Marketing missions",
    class: "business",
    price: 650_000,
    businessType: "marketing",
    stockCap: 20,
    unitValue: 12_000,
    map: { x: 5550, y: 2500, blip: "agency" },
    upgrades: [
      { id: "staff", name: "Office Staff", price: 230_000, effect: "+40% production speed" },
      { id: "equipment", name: "Printing Equipment", price: 360_000, effect: "+50% document value" },
    ],
  },
  {
    id: "bunker",
    name: "R&D Bunker",
    tagline: "Chumash · fed by Dev missions",
    class: "business",
    price: 1_165_000,
    businessType: "dev",
    stockCap: 25,
    unitValue: 17_500,
    map: { x: 2450, y: 4900, blip: "bunker" },
    upgrades: [
      { id: "staff", name: "Research Staff", price: 400_000, effect: "+40% production speed" },
      { id: "equipment", name: "Lab Equipment", price: 640_000, effect: "+50% research value" },
    ],
  },
  {
    id: "arcade",
    name: "Content Arcade",
    tagline: "La Mesa · fed by Content missions",
    class: "business",
    price: 1_235_000,
    businessType: "content",
    stockCap: 20,
    unitValue: 16_000,
    map: { x: 4700, y: 6260, blip: "arcade" },
    upgrades: [
      { id: "staff", name: "Arcade Staff", price: 430_000, effect: "+40% production speed" },
      { id: "equipment", name: "Production Rig", price: 680_000, effect: "+50% content value" },
    ],
  },
  {
    id: "nightclub",
    name: "Nightclub",
    tagline: "West Vinewood · accrues from ALL your businesses",
    class: "business",
    price: 1_700_000,
    isNightclub: true,
    requiresBusinessCount: 2,
    stockCap: 30,
    unitValue: 10_000,
    map: { x: 3900, y: 5800, blip: "nightclub" },
    upgrades: [
      { id: "staff", name: "Warehouse Technicians", price: 600_000, effect: "+40% accrual speed" },
      { id: "equipment", name: "Club Equipment", price: 900_000, effect: "+50% goods value" },
    ],
  },
  {
    id: "agency",
    name: "The Agency",
    tagline: "Little Seoul · doubles residual income",
    class: "business",
    price: 2_010_000,
    map: { x: 3880, y: 6480, blip: "agency" },
    unlocks: "Residuals: +$200/mission, cap $20,000/day",
  },

  // ---------------- properties
  {
    id: "eclipse-towers",
    name: "Eclipse Towers, Apt 31",
    tagline: "High-end living in West Vinewood",
    class: "property",
    price: 400_000,
    requiredRank: 5,
    unlocks: "Heist tier: Heist ($500k)",
    map: { x: 3720, y: 5880, blip: "safehouse" },
  },
  {
    id: "maze-bank-west",
    name: "Maze Bank West Office",
    tagline: "CEO status · Del Perro",
    class: "property",
    price: 1_000_000,
    requiredRank: 8,
    unlocks: "+5% on all stock sales",
    map: { x: 3560, y: 6280, blip: "office" },
  },
  {
    id: "the-facility",
    name: "Route 68 Facility",
    tagline: "Underground ops center",
    class: "property",
    price: 1_250_000,
    requiredRank: 10,
    unlocks: "Heist tier: Big Score ($1M)",
    map: { x: 3800, y: 3600, blip: "facility" },
  },
  {
    id: "kosatka",
    name: "RUNE Kosatka",
    tagline: "Nuclear submarine · your island ticket",
    class: "property",
    price: 2_200_000,
    requiredRank: 12,
    unlocks: "Heist tier: Island Job ($1.5M, Panther Statue in loot pool)",
    map: { x: 1900, y: 6050, blip: "kosatka" },
  },
  {
    id: "casino-penthouse",
    name: "Casino Penthouse",
    tagline: "Master Penthouse over Vinewood",
    class: "property",
    price: 1_500_000,
    requiredRank: 12,
    unlocks: "Pure flex over the Strip",
    map: { x: 4880, y: 5560, blip: "casino" },
    upgrades: [
      { id: "spa", name: "Spa Room", price: 245_000, effect: "Private spa" },
      { id: "cinema", name: "Media Room", price: 500_000, effect: "Private cinema" },
      { id: "bar", name: "Bar & Party Hub", price: 385_000, effect: "In-house bar" },
    ],
  },
  {
    id: "maze-bank-tower",
    name: "Maze Bank Tower",
    tagline: "The top floor of Los Santos",
    class: "property",
    price: 4_000_000,
    requiredRank: 18,
    unlocks: "+5% on all stock sales + the skyline is yours",
    map: { x: 4080, y: 6520, blip: "office" },
  },
  {
    id: "galaxy-super-yacht",
    name: "Galaxy Super Yacht",
    tagline: "Orion class · the endgame trophy",
    class: "property",
    price: 6_000_000,
    requiredRank: 22,
    unlocks: "You made it.",
    map: { x: 2450, y: 7050, blip: "yacht" },
    upgrades: [
      { id: "pisces", name: "Pisces Model", price: 1_000_000, effect: "Tier 2 yacht" },
      { id: "aquarius", name: "Aquarius Model", price: 1_000_000, effect: "Tier 3 yacht" },
    ],
  },

  // ---------------- wardrobe (pure flex — buffs come from SKILLS, earned by work)
  { id: "perseus-gloves", name: "Perseus Leather Gloves", tagline: "Details matter", class: "gear", price: 30_000, emoji: "🧤" },
  { id: "designer-shades", name: "Bespoke Designer Shades", tagline: "Never look at the sun. Or your haters.", class: "gear", price: 45_000, emoji: "🕶" },
  { id: "crocodile-loafers", name: "Crocodile Loafers", tagline: "Step on necks, tastefully", class: "gear", price: 65_000, emoji: "👞" },
  { id: "ponsonbys-suit", name: "Ponsonbys Tailored Suit", tagline: "The uniform of the boardroom", class: "gear", price: 95_000, requiredRank: 5, emoji: "🤵" },
  { id: "cashmere-overcoat", name: "Cashmere Overcoat", tagline: "Winter is a flex", class: "gear", price: 120_000, requiredRank: 6, emoji: "🧥" },
  { id: "gold-chain", name: "Solid Gold Chain", tagline: "Subtlety is for the poor", class: "gear", price: 150_000, requiredRank: 8, emoji: "⛓" },
  { id: "diamond-studs", name: "Diamond Ear Studs", tagline: "Ice, tastefully applied", class: "gear", price: 180_000, requiredRank: 10, emoji: "💎" },
  { id: "medici-watch", name: "Medici Radiale", tagline: "Time is money. This is both.", class: "gear", price: 250_000, requiredRank: 12, emoji: "⌚" },
  { id: "vinewood-ring", name: "Vinewood Signet Ring", tagline: "Old money energy, new money speed", class: "gear", price: 400_000, requiredRank: 15, emoji: "💍" },
  { id: "platinum-grill", name: "Platinum Grill", tagline: "Smile like you own the block. You do.", class: "gear", price: 500_000, requiredRank: 18, emoji: "😬" },
];

// ---------------------------------------------------------------- skills

/**
 * GTA-style character stats. Skills grow ONLY from real work (never bought):
 * typed missions raise their skill, deep-work minutes raise Focus, heist
 * finales raise Reputation. Milestones unlock permanent payout bonuses.
 */
export type SkillKey = BusinessType | "focus" | "reputation";

export const SKILLS: {
  key: SkillKey;
  name: string;
  grows: string;
  bonusTarget: string;
}[] = [
  { key: "marketing", name: "Hustle", grows: "Marketing missions", bonusTarget: "marketing payouts" },
  { key: "dev", name: "Engineering", grows: "Dev missions", bonusTarget: "dev payouts" },
  { key: "content", name: "Creativity", grows: "Content missions", bonusTarget: "content payouts" },
  { key: "admin", name: "Operations", grows: "Ops/Admin missions", bonusTarget: "ops payouts" },
  { key: "focus", name: "Focus", grows: "Deep-work minutes", bonusTarget: "timer payouts" },
  { key: "reputation", name: "Reputation", grows: "Heist finales", bonusTarget: "heist payouts" },
];

/** XP -> level 0-100: fast early gains, long late grind (GTA stat bars). */
export function skillLevel(xp: number): number {
  return Math.min(100, Math.floor(8 * Math.sqrt(Math.max(0, xp))));
}

/** Milestone bonuses: 30 -> +3%, 60 -> +6%, 90 -> +10%. */
export function skillBonus(level: number): number {
  if (level >= 90) return 0.1;
  if (level >= 60) return 0.06;
  if (level >= 30) return 0.03;
  return 0;
}

// ---------------------------------------------------------------- character

export const PLASTIC_SURGERY_COST = 100_000;

/** Portrait ids available in the character wizard (files under /assets/portraits). */
export const PORTRAIT_IDS = [
  "michael",
  "franklin",
  "trevor",
  "michael-suit",
  "lamar",
  "lester",
  "tony",
  "chop",
];

export const SKILL_MILESTONES = [
  { level: 30, bonus: 0.03 },
  { level: 60, bonus: 0.06 },
  { level: 90, bonus: 0.1 },
];

export const CATALOG_BY_ID: Map<string, AssetDef> = new Map(
  ASSET_CATALOG.map((a) => [a.id, a])
);

export function assetById(id: string): AssetDef {
  const def = CATALOG_BY_ID.get(id);
  if (!def) throw new Error(`Unknown asset: ${id}`);
  return def;
}
