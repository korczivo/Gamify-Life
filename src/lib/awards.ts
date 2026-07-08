/**
 * Social Club-style awards: circular badges with bronze/silver/gold/platinum
 * tiers and progress toward the next one. All computed from real play data.
 */

export const AWARD_TIERS = ["bronze", "silver", "gold", "platinum"] as const;
export type AwardTier = (typeof AWARD_TIERS)[number];

export const TIER_COLORS: Record<AwardTier, string> = {
  bronze: "#b08d57",
  silver: "#c0c7ce",
  gold: "#e8b71a",
  platinum: "#8fe3cf",
};

export interface AwardDef {
  id: string;
  name: string;
  description: string;
  /** Thresholds for bronze/silver/gold/platinum. */
  thresholds: [number, number, number, number];
  format: "count" | "cash" | "hours";
}

export const AWARDS: AwardDef[] = [
  { id: "grinder", name: "The Grinder", description: "Missions completed", thresholds: [10, 50, 200, 500], format: "count" },
  { id: "deep-focus", name: "Deep Focus", description: "Hours of deep work", thresholds: [5, 25, 100, 250], format: "hours" },
  { id: "mastermind", name: "Mastermind", description: "Heists completed", thresholds: [1, 5, 15, 40], format: "count" },
  { id: "elite-thief", name: "Elite Thief", description: "Elite Challenges", thresholds: [1, 3, 10, 25], format: "count" },
  { id: "empire-builder", name: "Empire Builder", description: "Businesses & properties owned", thresholds: [1, 4, 8, 14], format: "count" },
  { id: "collector", name: "The Collector", description: "Vehicles in the garage", thresholds: [1, 5, 15, 28], format: "count" },
  { id: "millionaires-club", name: "Millionaire's Club", description: "Net worth", thresholds: [100_000, 1_000_000, 10_000_000, 50_000_000], format: "cash" },
  { id: "rainmaker", name: "Rainmaker", description: "Total cash earned", thresholds: [250_000, 1_000_000, 5_000_000, 20_000_000], format: "cash" },
  { id: "salesman", name: "The Salesman", description: "Stock sales closed", thresholds: [3, 10, 40, 100], format: "count" },
  { id: "high-roller", name: "High Roller", description: "Wardrobe pieces", thresholds: [1, 3, 6, 10], format: "count" },
];

export interface AwardMetrics {
  grinder: number;
  "deep-focus": number;
  mastermind: number;
  "elite-thief": number;
  "empire-builder": number;
  collector: number;
  "millionaires-club": number;
  rainmaker: number;
  salesman: number;
  "high-roller": number;
}

export interface AwardProgress {
  def: AwardDef;
  value: number;
  /** null = not yet bronze. */
  tier: AwardTier | null;
  /** Progress 0-1 toward the next tier (1 when platinum). */
  progress: number;
  nextThreshold: number | null;
}

export function computeAwards(metrics: AwardMetrics): AwardProgress[] {
  return AWARDS.map((def) => {
    const value = metrics[def.id as keyof AwardMetrics] ?? 0;
    let tierIdx = -1;
    for (let i = 0; i < def.thresholds.length; i++) {
      if (value >= def.thresholds[i]) tierIdx = i;
    }
    const nextThreshold = tierIdx >= 3 ? null : def.thresholds[tierIdx + 1];
    const prevThreshold = tierIdx >= 0 ? def.thresholds[tierIdx] : 0;
    const progress =
      nextThreshold === null
        ? 1
        : Math.min(1, (value - prevThreshold) / (nextThreshold - prevThreshold));
    return {
      def,
      value,
      tier: tierIdx >= 0 ? AWARD_TIERS[tierIdx] : null,
      progress,
      nextThreshold,
    };
  });
}

export function formatAwardValue(value: number, format: AwardDef["format"]): string {
  if (format === "cash") {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
    return `$${Math.round(value)}`;
  }
  if (format === "hours") return `${Math.floor(value)}h`;
  return String(Math.floor(value));
}
